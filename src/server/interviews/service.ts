/**
 * Server-Side Interview Creation & Lifecycle Service.
 *
 * Implements Milestone 5 requirements:
 * 1. Strict Zod configuration validation and size limits.
 * 2. Fail-closed server-side consent enforcement for users and guest sessions.
 * 3. Idempotent execution envelope to prevent duplicate interview creation.
 * 4. Atomic usage-reservation with automatic release on failed starts.
 * 5. Primary Gemini AI question generation with complete reviewed fallback bank.
 * 6. Transactional persistence in PostgreSQL.
 * 7. Server-side ownership authorization.
 *
 * References:
 * - ARCHITECTURE.md (Section 3: interviews, Section 4: request flow)
 * - SECURITY_PRIVACY.md (Consent enforcement, upload limits)
 * - DECISIONS.md (Replaceable provider adapter, fallback question bank)
 */

import { prisma } from "@/server/db";
import { AiProviderAdapter } from "@/server/ai/types";
import { GeminiProviderAdapter } from "@/server/ai/gemini-adapter";
import { getFallbackQuestions } from "@/server/question-bank/service";
import { assertRequiredAiConsent } from "@/server/consent/service";
import { ConsentRequiredError } from "@/server/consent/errors";
import { commitUsage, releaseUsage, reserveUsage } from "@/server/usage/service";
import { UsageActor } from "@/server/usage/types";
import { withIdempotency } from "@/server/idempotency/service";
import { assertResourceAccess } from "@/server/auth/authorization";
import { InterviewCreationInput, InterviewSummary } from "./types";
import { InterviewConfigSchema } from "./schemas";
import { InterviewConfigurationError, InterviewNotFoundError } from "./errors";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Interview service cannot be imported into client-side code."
  );
}

export interface InterviewServiceOptions {
  aiProvider?: AiProviderAdapter;
}

/**
 * Asserts that the actor has granted all required AI processing consents.
 * Fails closed if consent is absent, false, or expired.
 */
async function enforceActorConsent(
  actor: UsageActor,
  hasResume: boolean
): Promise<void> {
  if (actor.userId) {
    await assertRequiredAiConsent(actor.userId, { hasResume });
    return;
  }

  if (actor.guestSessionId) {
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: actor.guestSessionId },
    });

    if (!guestSession) {
      throw new ConsentRequiredError(
        "ai_questions",
        "Guest session not found or invalid."
      );
    }

    if (guestSession.expiresAt <= new Date()) {
      throw new ConsentRequiredError(
        "ai_questions",
        "Guest session has expired. Start a new guest session or sign in."
      );
    }

    if (!guestSession.consentAiQuestions) {
      throw new ConsentRequiredError(
        "ai_questions",
        "Explicit consent for AI question generation is required."
      );
    }

    if (!guestSession.consentAiEvaluation) {
      throw new ConsentRequiredError(
        "ai_evaluation",
        "Explicit consent for AI answer evaluation is required."
      );
    }

    if (hasResume && !guestSession.consentResumeProcessing) {
      throw new ConsentRequiredError(
        "resume_processing",
        "Explicit consent for resume processing is required to use resume context."
      );
    }

    return;
  }

  throw new ConsentRequiredError(
    "ai_questions",
    "Valid user or guest session identity is required."
  );
}

/**
 * Core orchestrator to validate, generate questions for, and initialize an interview.
 */
export async function createAndInitializeInterview(
  actor: UsageActor,
  rawInput: InterviewCreationInput,
  options: InterviewServiceOptions = {}
): Promise<InterviewSummary> {
  // 1. Strict server-side Zod validation
  const parseResult = InterviewConfigSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    throw new InterviewConfigurationError(
      "Interview configuration validation failed",
      issues
    );
  }
  const config = parseResult.data;

  // 2. Fail-closed consent enforcement
  const hasResume = Boolean(config.resumeText && config.resumeText.trim().length > 0);
  await enforceActorConsent(actor, hasResume);

  // 3. Define execution logic
  const executeCreation = async (): Promise<InterviewSummary> => {
    // 3a. Reserve usage quota atomically
    const reservation = await reserveUsage(actor, "question_generation");

    let questionSet: {
      questions: Array<{
        questionText: string;
        category: string;
        difficulty: string;
        timeLimitSeconds?: number;
      }>;
      questionSource: "gemini" | "fallback";
      modelIdentifier: string;
      promptVersion: string;
      schemaVersion: string;
      tokenMetadata?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; model?: string };
    };

    const aiProvider = options.aiProvider || new GeminiProviderAdapter();

    try {
      // 3b. Attempt generation through replaceable AI adapter
      const aiResponse = await aiProvider.generateQuestions({
        mode: config.mode,
        role: config.role,
        difficulty: config.difficulty,
        questionCount: config.questionCount,
        durationMinutes: config.durationMinutes,
        companyName: config.companyName,
        jobDescription: config.jobDescription,
        resumeText: config.resumeText,
      });

      questionSet = {
        questions: aiResponse.questions,
        questionSource: "gemini",
        modelIdentifier: aiResponse.modelIdentifier,
        promptVersion: aiResponse.promptVersion,
        schemaVersion: aiResponse.schemaVersion,
        tokenMetadata: aiResponse.usageMetadata,
      };

      // Commit usage reservation with real provider metadata
      await commitUsage(reservation.id, aiResponse.usageMetadata);
    } catch {
      // 3c. Bounded fallback: use reviewed question bank
      try {
        const fallback = getFallbackQuestions({
          mode: config.mode,
          role: config.role,
          difficulty: config.difficulty,
          questionCount: config.questionCount,
          durationMinutes: config.durationMinutes,
          companyName: config.companyName,
          jobDescription: config.jobDescription,
          resumeText: config.resumeText,
        });

        // Release AI usage reservation since AI generation failed
        await releaseUsage(reservation.id);

        questionSet = {
          questions: fallback.questions,
          questionSource: "fallback",
          modelIdentifier: "fallback-bank",
          promptVersion: "1.0",
          schemaVersion: "1.0",
        };
      } catch (fallbackError) {
        // Both primary AI and fallback failed: release reservation and stop safely
        await releaseUsage(reservation.id);
        throw fallbackError;
      }
    }

    // 3d. Transactional persistence in PostgreSQL
    const createdInterview = await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          userId: actor.userId || null,
          guestSessionId: actor.guestSessionId || null,
          interviewType: config.mode,
          status: "in_progress",
          role: config.role,
          difficulty: config.difficulty,
          durationMinutes: config.durationMinutes,
          questionCount: config.questionCount,
          companyName: config.companyName || null,
          jobDescription: config.jobDescription || null,
          resumeText: config.resumeText || null,
          questionSource: questionSet.questionSource,
          modelIdentifier: questionSet.modelIdentifier,
          promptVersion: questionSet.promptVersion,
          schemaVersion: questionSet.schemaVersion,
        },
      });

      // Insert validated questions
      await tx.interviewQuestion.createMany({
        data: questionSet.questions.map((q, idx) => ({
          interviewId: interview.id,
          orderIndex: idx + 1,
          questionText: q.questionText,
          category: q.category,
          difficulty: q.difficulty,
          source: questionSet.questionSource,
          timeLimitSeconds: q.timeLimitSeconds ?? 120,
        })),
      });

      // Associate usage reservation with created interview
      await tx.usageRecord.update({
        where: { id: reservation.id },
        data: { interviewId: interview.id },
      });

      const questions = await tx.interviewQuestion.findMany({
        where: { interviewId: interview.id },
        orderBy: { orderIndex: "asc" },
      });

      return {
        id: interview.id,
        userId: interview.userId,
        guestSessionId: interview.guestSessionId,
        interviewType: interview.interviewType,
        status: interview.status,
        role: interview.role,
        difficulty: interview.difficulty,
        durationMinutes: interview.durationMinutes,
        questionCount: interview.questionCount,
        companyName: interview.companyName,
        questionSource: interview.questionSource,
        modelIdentifier: interview.modelIdentifier,
        promptVersion: interview.promptVersion,
        schemaVersion: interview.schemaVersion,
        createdAt: interview.createdAt,
        questions: questions.map((q) => ({
          id: q.id,
          orderIndex: q.orderIndex,
          questionText: q.questionText,
          category: q.category,
          difficulty: q.difficulty,
          source: q.source,
          timeLimitSeconds: q.timeLimitSeconds,
        })),
      };
    });

    return createdInterview;
  };

  // 4. Wrap with idempotency if key provided
  if (config.idempotencyKey) {
    const outcome = await withIdempotency<InterviewSummary>(
      {
        key: config.idempotencyKey,
        scope: "create_interview",
        userId: actor.userId,
        guestSessionId: actor.guestSessionId,
      },
      executeCreation
    );
    return outcome.result;
  }

  return await executeCreation();
}

/**
 * Retrieves an interview by ID with server-side authorization enforcement.
 */
export async function getInterviewById(
  actor: UsageActor,
  interviewId: string
): Promise<InterviewSummary> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!interview) {
    throw new InterviewNotFoundError(interviewId);
  }

  // Server-side authorization check
  assertResourceAccess(
    { userId: actor.userId, guestSessionId: actor.guestSessionId },
    { userId: interview.userId, guestSessionId: interview.guestSessionId }
  );

  return {
    id: interview.id,
    userId: interview.userId,
    guestSessionId: interview.guestSessionId,
    interviewType: interview.interviewType,
    status: interview.status,
    role: interview.role,
    difficulty: interview.difficulty,
    durationMinutes: interview.durationMinutes,
    questionCount: interview.questionCount,
    companyName: interview.companyName,
    questionSource: interview.questionSource,
    modelIdentifier: interview.modelIdentifier,
    promptVersion: interview.promptVersion,
    schemaVersion: interview.schemaVersion,
    createdAt: interview.createdAt,
    questions: interview.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      category: q.category,
      difficulty: q.difficulty,
      source: q.source,
      timeLimitSeconds: q.timeLimitSeconds,
    })),
  };
}

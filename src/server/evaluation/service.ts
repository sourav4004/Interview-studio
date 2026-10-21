/**
 * Server-Side Interview Evaluation & Report Pipeline Service.
 *
 * Implements:
 * - End-to-end evaluation pipeline per PRODUCT_SPEC.md (Section 7 & 8)
 * - Strict server-side authorization and consent boundaries (ai_evaluation purpose)
 * - Atomic usage quota reservation, commit on success, release on failure
 * - Idempotency safeguards: never charges twice or overwrites valid reports
 * - Recovery from failure without losing submitted answers
 * - Transparent status tracking: "pending" -> "processing" -> "completed" / "failed"
 *
 * References:
 * - AGENTS.md (Check consent at request, job, retry, and persistence boundaries)
 * - SECURITY_PRIVACY.md (Data retention, prompt safety, ownership checks)
 * - ARCHITECTURE.md (Request flow, AI provider boundary)
 */

import { prisma } from "@/server/db";
import { assertResourceAccess } from "@/server/auth/authorization";
import { assertConsent } from "@/server/consent";
import { validateGuestSession } from "@/server/guest";
import {
  commitUsage,
  releaseUsage,
  reserveUsage,
} from "@/server/usage";
import { AiProviderAdapter } from "@/server/ai/types";
import { GeminiProviderAdapter } from "@/server/ai/gemini-adapter";
import {
  DimensionEvaluation,
  InterviewEvaluationRequest,
  InterviewReportSummary,
  QuestionEvaluation,
  ReportActor,
} from "./types";
import {
  InterviewNotReadyForEvaluationError,
  InterviewReportNotFoundError,
} from "./errors";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Evaluation service cannot be imported into client-side code."
  );
}

let defaultAiAdapter: AiProviderAdapter = new GeminiProviderAdapter();

/**
 * Allows test suites to inject mock AI adapters.
 */
export function setEvaluationAiAdapter(adapter: AiProviderAdapter): void {
  defaultAiAdapter = adapter;
}

export function resetEvaluationAiAdapter(): void {
  defaultAiAdapter = new GeminiProviderAdapter();
}

/**
 * Serializes Prisma InterviewReport database record to domain summary.
 */
function toReportSummary(record: {
  id: string;
  interviewId: string;
  userId: string | null;
  guestSessionId: string | null;
  status: string;
  overallScore: number | null;
  summary: string | null;
  scoreExplanation: string | null;
  strengths: string[];
  improvements: string[];
  primaryRecommendation: string | null;
  dimensionScores: unknown;
  questionFeedback: unknown;
  modelIdentifier: string | null;
  promptVersion: string | null;
  rubricVersion: string | null;
  schemaVersion: string | null;
  evaluatedAnswersCount: number;
  skippedAnswersCount: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InterviewReportSummary {
  return {
    id: record.id,
    interviewId: record.interviewId,
    userId: record.userId,
    guestSessionId: record.guestSessionId,
    status: record.status as "pending" | "processing" | "completed" | "failed",
    overallScore: record.overallScore,
    summary: record.summary,
    scoreExplanation: record.scoreExplanation,
    strengths: record.strengths,
    improvements: record.improvements,
    primaryRecommendation: record.primaryRecommendation,
    dimensionScores: (record.dimensionScores || []) as DimensionEvaluation[],
    questionFeedback: (record.questionFeedback || []) as QuestionEvaluation[],
    modelIdentifier: record.modelIdentifier,
    promptVersion: record.promptVersion,
    rubricVersion: record.rubricVersion,
    schemaVersion: record.schemaVersion,
    evaluatedAnswersCount: record.evaluatedAnswersCount,
    skippedAnswersCount: record.skippedAnswersCount,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Asserts that the actor has granted required AI evaluation consent.
 */
async function assertEvaluationConsent(
  actor: ReportActor,
  guestRawToken?: string
): Promise<void> {
  if (actor.userId) {
    await assertConsent(actor.userId, "ai_evaluation");
    return;
  }

  if (actor.guestSessionId) {
    if (!guestRawToken) {
      // Validate via session query if raw token not directly supplied
      const session = await prisma.guestSession.findUnique({
        where: { id: actor.guestSessionId },
      });
      if (!session || !session.consentAiEvaluation) {
        throw new Error(
          "Guest session lacks explicit consent for AI answer evaluation."
        );
      }
      return;
    }

    const session = await validateGuestSession(guestRawToken);
    if (!session.consentAiEvaluation) {
      throw new Error(
        "Guest session lacks explicit consent for AI answer evaluation."
      );
    }
    return;
  }

  throw new Error("Cannot verify evaluation consent: unauthenticated actor.");
}

/**
 * Retrieves the evaluation report for an interview session.
 * Enforces ownership access checks.
 */
export async function getInterviewReport(
  actor: ReportActor,
  interviewId: string
): Promise<InterviewReportSummary> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      report: true,
    },
  });

  if (!interview) {
    throw new InterviewReportNotFoundError(interviewId);
  }

  // Enforce server-side resource ownership
  assertResourceAccess(actor, interview);

  if (!interview.report) {
    throw new InterviewReportNotFoundError(interviewId);
  }

  return toReportSummary(interview.report);
}

/**
 * Triggers or retries AI evaluation for an interview session.
 *
 * Pipeline sequence:
 * 1. Ownership & state verification.
 * 2. Purpose-specific consent check (ai_evaluation).
 * 3. Idempotency check (returns completed report without double-processing).
 * 4. Quota reservation (prevents exceeding daily limits).
 * 5. Durable "processing" state update.
 * 6. AI model evaluation call.
 * 7. Consent re-verification at persistence boundary.
 * 8. Transactional persistence & quota commit.
 * 9. Safe error handling: releases quota and records failure state without losing answers.
 */
export async function generateInterviewReport(
  actor: ReportActor,
  interviewId: string,
  options: {
    forceRetry?: boolean;
    guestRawToken?: string;
  } = {}
): Promise<InterviewReportSummary> {
  // Step 1: Fetch interview and associated data
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          answer: true,
        },
      },
      report: true,
    },
  });

  if (!interview) {
    throw new InterviewReportNotFoundError(interviewId);
  }

  // Enforce server-side ownership
  assertResourceAccess(actor, interview);

  // Verify interview readiness
  if (interview.questions.length === 0) {
    throw new InterviewNotReadyForEvaluationError(
      "Cannot evaluate an interview with no questions."
    );
  }

  // Step 2: Check consent before AI processing
  await assertEvaluationConsent(actor, options.guestRawToken);

  // Step 3: Idempotency check — if already completed and not force retry, return existing report
  if (
    interview.report &&
    interview.report.status === "completed" &&
    !options.forceRetry
  ) {
    return toReportSummary(interview.report);
  }

  // Check if already processing recently (within last 45 seconds) to avoid duplicate concurrent calls
  if (
    interview.report &&
    interview.report.status === "processing" &&
    !options.forceRetry
  ) {
    const elapsedSinceUpdateMs =
      Date.now() - new Date(interview.report.updatedAt).getTime();
    if (elapsedSinceUpdateMs < 45000) {
      return toReportSummary(interview.report);
    }
  }

  // Step 4: Quota reservation
  const usageActor = actor.userId
    ? { userId: actor.userId }
    : { guestSessionId: actor.guestSessionId! };

  const reservation = await reserveUsage(
    usageActor,
    "evaluation",
    interview.id
  );

  // Step 5: Upsert report into "processing" state
  const processingReport = await prisma.interviewReport.upsert({
    where: { interviewId: interview.id },
    create: {
      interviewId: interview.id,
      userId: interview.userId,
      guestSessionId: interview.guestSessionId,
      status: "processing",
      dimensionScores: [],
      questionFeedback: [],
      strengths: [],
      improvements: [],
    },
    update: {
      status: "processing",
      failureReason: null,
    },
  });

  // Step 6: Assemble evaluation request
  const evaluationRequest: InterviewEvaluationRequest = {
    interviewId: interview.id,
    mode: interview.interviewType as "technical" | "behavioral" | "resume" | "company",
    role: interview.role,
    difficulty: interview.difficulty as "easy" | "medium" | "hard",
    companyName: interview.companyName,
    jobDescription: interview.jobDescription,
    resumeText: interview.resumeText,
    hasResumeConsent: Boolean(interview.resumeText),
    questions: interview.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      category: q.category,
      difficulty: q.difficulty,
      answer: q.answer
        ? {
            transcript: q.answer.transcript,
            status: q.answer.status as "submitted" | "skipped" | "unanswered",
            inputMode: q.answer.inputMode as "speech" | "text" | "mixed",
            isEdited: q.answer.isEdited,
            durationSeconds: q.answer.durationSeconds,
          }
        : null,
    })),
  };

  try {
    // Call AI provider adapter
    const result = await defaultAiAdapter.evaluateInterview(evaluationRequest);

    // Step 7: Re-verify consent at persistence boundary (fails closed if user withdrew consent during processing)
    await assertEvaluationConsent(actor, options.guestRawToken);

    // Step 8: Transactionally persist completed report and finalize interview state
    const completedReport = await prisma.$transaction(async (tx) => {
      const updatedReport = await tx.interviewReport.update({
        where: { id: processingReport.id },
        data: {
          status: "completed",
          overallScore: result.overallScore,
          summary: result.summary,
          scoreExplanation: result.scoreExplanation,
          strengths: result.strengths,
          improvements: result.improvements,
          primaryRecommendation: result.primaryRecommendation,
          dimensionScores: result.dimensionScores as unknown as object,
          questionFeedback: result.questionFeedback as unknown as object,
          modelIdentifier: result.modelIdentifier,
          promptVersion: result.promptVersion,
          rubricVersion: result.rubricVersion,
          schemaVersion: result.schemaVersion,
          evaluatedAnswersCount: result.evaluatedAnswersCount,
          skippedAnswersCount: result.skippedAnswersCount,
          failureReason: null,
        },
      });

      // Ensure interview is marked completed
      if (interview.status !== "completed") {
        await tx.interview.update({
          where: { id: interview.id },
          data: { status: "completed", endedAt: new Date() },
        });
      }

      return updatedReport;
    });

    // Commit usage reservation
    await commitUsage(reservation.id, result.usageMetadata);

    return toReportSummary(completedReport);
  } catch (err: unknown) {
    // Step 9: Safe failure handling
    // 1. Release quota reservation so candidate is never charged for failed evaluation
    await releaseUsage(reservation.id).catch(() => {
      // non-fatal on release failure
    });

    const errorMessage =
      err instanceof Error ? err.message : "AI evaluation processing failed.";

    // 2. Persist failed state to database so candidate can see failure and retry
    const failedReport = await prisma.interviewReport
      .update({
        where: { id: processingReport.id },
        data: {
          status: "failed",
          failureReason: errorMessage,
        },
      })
      .catch(() => processingReport);

    return toReportSummary(failedReport);
  }
}

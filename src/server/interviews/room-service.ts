/**
 * Server-Side Interview Room Lifecycle & Answer Persistence Service.
 *
 * Implements Milestone 6 requirements:
 * 1. Strict server-side ownership enforcement (registered users & guest sessions).
 * 2. Reliable server-derived timer and pause accounting.
 * 3. Idempotent answer submission and question status tracking (submitted, skipped).
 * 4. Realistic Mode locking: submitted answers cannot be modified in realistic mode.
 * 5. Safe pause, resume, exit, and expiry transitions.
 * 6. Never logs raw answers or transcripts per SECURITY_PRIVACY.md.
 *
 * References:
 * - PRODUCT_SPEC.md (Section 6: Interview room)
 * - ARCHITECTURE.md (Section 3: interviews, Section 5: Database and state)
 * - DECISIONS.md (Realistic mode locks confirmed answers)
 * - SECURITY_PRIVACY.md (Safe state persistence, data minimization)
 */

import { prisma } from "@/server/db";
import { assertResourceAccess } from "@/server/auth/authorization";
import { UsageActor } from "@/server/usage/types";
import { withIdempotency } from "@/server/idempotency/service";
import {
  InterviewRoomAction,
  InterviewRoomState,
  SubmitAnswerInput,
} from "./types";
import {
  InterviewAnswerLockedError,
  InterviewExpiredError,
  InterviewNotFoundError,
  InterviewQuestionNotFoundError,
  InterviewStateTransitionError,
} from "./errors";
import { SubmitAnswerSchema } from "./schemas";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Interview room service cannot be imported into client-side code."
  );
}

/**
 * Calculates server-derived elapsed and remaining duration in seconds.
 */
function computeTimerStats(
  durationMinutes: number,
  startedAt: Date | null,
  lastPausedAt: Date | null,
  totalPauseDurationSeconds: number
): { elapsedSeconds: number; remainingSeconds: number; isExpired: boolean } {
  const totalAllocatedSeconds = durationMinutes * 60;

  if (!startedAt) {
    return {
      elapsedSeconds: 0,
      remainingSeconds: totalAllocatedSeconds,
      isExpired: false,
    };
  }

  const nowMs = Date.now();
  let rawElapsedMs: number;

  if (lastPausedAt) {
    // Currently paused: freeze elapsed time at moment of pause
    rawElapsedMs = Math.max(0, lastPausedAt.getTime() - startedAt.getTime());
  } else {
    // Currently active
    rawElapsedMs = Math.max(0, nowMs - startedAt.getTime());
  }

  const activeElapsedSeconds = Math.max(
    0,
    Math.floor(rawElapsedMs / 1000) - totalPauseDurationSeconds
  );

  const remainingSeconds = Math.max(
    0,
    totalAllocatedSeconds - activeElapsedSeconds
  );
  const isExpired = remainingSeconds <= 0;

  return {
    elapsedSeconds: activeElapsedSeconds,
    remainingSeconds,
    isExpired,
  };
}

/**
 * Retrieves the complete server-authoritative room state for an interview.
 */
export async function getInterviewRoomState(
  actor: UsageActor,
  interviewId: string
): Promise<InterviewRoomState> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
      answers: true,
    },
  });

  if (!interview) {
    throw new InterviewNotFoundError(interviewId);
  }

  // Server-side authorization check for registered user or guest session
  assertResourceAccess(
    { userId: actor.userId, guestSessionId: actor.guestSessionId },
    { userId: interview.userId, guestSessionId: interview.guestSessionId }
  );

  const timer = computeTimerStats(
    interview.durationMinutes,
    interview.startedAt,
    interview.lastPausedAt,
    interview.totalPauseDurationSeconds
  );

  // If timer expired while interview was in_progress or paused, mark completed
  if (
    timer.isExpired &&
    (interview.status === "in_progress" || interview.status === "paused")
  ) {
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: "completed",
        endedAt: new Date(),
        lastPausedAt: null,
      },
    });
    interview.status = "completed";
  }

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
    isPracticeMode: interview.isPracticeMode,
    currentQuestionIndex: interview.currentQuestionIndex,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    lastPausedAt: interview.lastPausedAt,
    totalPauseDurationSeconds: interview.totalPauseDurationSeconds,
    elapsedSeconds: timer.elapsedSeconds,
    remainingSeconds: timer.remainingSeconds,
    isExpired: timer.isExpired,
    questions: interview.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      category: q.category,
      difficulty: q.difficulty,
      source: q.source,
      timeLimitSeconds: q.timeLimitSeconds,
    })),
    answers: interview.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      transcript: a.transcript,
      rawTranscript: a.rawTranscript,
      status: a.status as "submitted" | "skipped" | "unanswered",
      inputMode: a.inputMode as "speech" | "text" | "mixed",
      durationSeconds: a.durationSeconds,
      isEdited: a.isEdited,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * Executes a lifecycle state transition on an interview session.
 */
export async function executeInterviewAction(
  actor: UsageActor,
  interviewId: string,
  action: InterviewRoomAction
): Promise<InterviewRoomState> {
  const currentState = await getInterviewRoomState(actor, interviewId);

  // If terminal, reject mutations except safe idempotent status checks
  if (
    currentState.status === "completed" ||
    currentState.status === "safely_exited"
  ) {
    return currentState;
  }

  switch (action) {
    case "start": {
      if (currentState.startedAt) {
        // Idempotent: already started
        return currentState;
      }
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          startedAt: new Date(),
          status: "in_progress",
        },
      });
      break;
    }

    case "pause": {
      if (currentState.status === "paused") {
        return currentState;
      }
      if (currentState.status !== "in_progress") {
        throw new InterviewStateTransitionError(currentState.status, action);
      }
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          lastPausedAt: new Date(),
          status: "paused",
        },
      });
      break;
    }

    case "resume": {
      if (currentState.status !== "paused") {
        return currentState;
      }
      const pauseDuration = currentState.lastPausedAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(currentState.lastPausedAt).getTime()) / 1000
            )
          )
        : 0;

      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: "in_progress",
          lastPausedAt: null,
          totalPauseDurationSeconds:
            currentState.totalPauseDurationSeconds + pauseDuration,
        },
      });
      break;
    }

    case "exit": {
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: "safely_exited",
          endedAt: new Date(),
        },
      });
      break;
    }

    case "expire": {
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: "completed",
          endedAt: new Date(),
          lastPausedAt: null,
        },
      });
      break;
    }

    default:
      throw new InterviewStateTransitionError(currentState.status, action);
  }

  return await getInterviewRoomState(actor, interviewId);
}

/**
 * Submits an answer for a question with validation, ownership, and Realistic Mode locks.
 */
export async function submitQuestionAnswer(
  actor: UsageActor,
  interviewId: string,
  rawInput: SubmitAnswerInput
): Promise<InterviewRoomState> {
  const parseResult = SubmitAnswerSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new Error(
      `Validation error: ${parseResult.error.issues.map((i) => i.message).join(", ")}`
    );
  }
  const input = parseResult.data;

  const executeSubmit = async (): Promise<InterviewRoomState> => {
    const currentState = await getInterviewRoomState(actor, interviewId);

    if (currentState.isExpired) {
      throw new InterviewExpiredError(
        "Interview timer has expired. Cannot submit further answers."
      );
    }

    // Verify question belongs to this interview
    const question = currentState.questions.find((q) => q.id === input.questionId);
    if (!question) {
      throw new InterviewQuestionNotFoundError(input.questionId, interviewId);
    }

    // Realistic Mode check: locked answers cannot be edited
    const existingAnswer = currentState.answers.find(
      (a) => a.questionId === input.questionId
    );
    if (
      !currentState.isPracticeMode &&
      existingAnswer &&
      existingAnswer.status === "submitted"
    ) {
      throw new InterviewAnswerLockedError(input.questionId);
    }

    // Transactionally upsert answer and calculate next question index
    await prisma.$transaction(async (tx) => {
      await tx.interviewAnswer.upsert({
        where: { questionId: input.questionId },
        create: {
          interviewId,
          questionId: input.questionId,
          transcript: input.transcript,
          rawTranscript: input.rawTranscript || null,
          status: "submitted",
          inputMode: input.inputMode,
          durationSeconds: input.durationSeconds || null,
          isEdited: input.isEdited,
        },
        update: {
          transcript: input.transcript,
          rawTranscript: input.rawTranscript || null,
          status: "submitted",
          inputMode: input.inputMode,
          durationSeconds: input.durationSeconds || null,
          isEdited: input.isEdited,
        },
      });

      // Calculate progress
      const allAnswers = await tx.interviewAnswer.findMany({
        where: { interviewId },
      });

      const answeredIds = new Set(allAnswers.map((a) => a.questionId));
      const remainingQuestions = currentState.questions.filter(
        (q) => !answeredIds.has(q.id)
      );

      if (remainingQuestions.length === 0) {
        // All questions addressed
        await tx.interview.update({
          where: { id: interviewId },
          data: {
            status: "completed",
            endedAt: new Date(),
            currentQuestionIndex: currentState.questions.length - 1,
          },
        });
      } else {
        // Advance to next unanswered question index
        const nextOrderIndex = remainingQuestions[0].orderIndex - 1;
        await tx.interview.update({
          where: { id: interviewId },
          data: {
            currentQuestionIndex: Math.max(0, nextOrderIndex),
          },
        });
      }
    });

    return await getInterviewRoomState(actor, interviewId);
  };

  if (input.idempotencyKey) {
    const outcome = await withIdempotency<InterviewRoomState>(
      {
        key: input.idempotencyKey,
        scope: `submit_answer_${input.questionId}`,
        userId: actor.userId,
        guestSessionId: actor.guestSessionId,
      },
      executeSubmit
    );
    return outcome.result;
  }

  return await executeSubmit();
}

/**
 * Skips a question deliberately, persisting status as 'skipped'.
 * Skipped questions are labeled unanswered and not treated as incorrect answers.
 */
export async function skipQuestion(
  actor: UsageActor,
  interviewId: string,
  questionId: string,
  idempotencyKey?: string
): Promise<InterviewRoomState> {
  const executeSkip = async (): Promise<InterviewRoomState> => {
    const currentState = await getInterviewRoomState(actor, interviewId);

    if (currentState.isExpired) {
      throw new InterviewExpiredError(
        "Interview timer has expired. Cannot skip questions."
      );
    }

    const question = currentState.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new InterviewQuestionNotFoundError(questionId, interviewId);
    }

    // Realistic Mode check: already submitted answers cannot be skipped/overwritten
    const existingAnswer = currentState.answers.find(
      (a) => a.questionId === questionId
    );
    if (
      !currentState.isPracticeMode &&
      existingAnswer &&
      existingAnswer.status === "submitted"
    ) {
      throw new InterviewAnswerLockedError(questionId);
    }

    await prisma.$transaction(async (tx) => {
      await tx.interviewAnswer.upsert({
        where: { questionId },
        create: {
          interviewId,
          questionId,
          transcript: "",
          rawTranscript: null,
          status: "skipped",
          inputMode: "text",
          durationSeconds: 0,
          isEdited: false,
        },
        update: {
          transcript: "",
          rawTranscript: null,
          status: "skipped",
          inputMode: "text",
          durationSeconds: 0,
          isEdited: false,
        },
      });

      const allAnswers = await tx.interviewAnswer.findMany({
        where: { interviewId },
      });

      const answeredIds = new Set(allAnswers.map((a) => a.questionId));
      const remainingQuestions = currentState.questions.filter(
        (q) => !answeredIds.has(q.id)
      );

      if (remainingQuestions.length === 0) {
        await tx.interview.update({
          where: { id: interviewId },
          data: {
            status: "completed",
            endedAt: new Date(),
            currentQuestionIndex: currentState.questions.length - 1,
          },
        });
      } else {
        const nextOrderIndex = remainingQuestions[0].orderIndex - 1;
        await tx.interview.update({
          where: { id: interviewId },
          data: {
            currentQuestionIndex: Math.max(0, nextOrderIndex),
          },
        });
      }
    });

    return await getInterviewRoomState(actor, interviewId);
  };

  if (idempotencyKey) {
    const outcome = await withIdempotency<InterviewRoomState>(
      {
        key: idempotencyKey,
        scope: `skip_question_${questionId}`,
        userId: actor.userId,
        guestSessionId: actor.guestSessionId,
      },
      executeSkip
    );
    return outcome.result;
  }

  return await executeSkip();
}

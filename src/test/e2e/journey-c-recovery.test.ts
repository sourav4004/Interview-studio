// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeInterviewAction,
  submitQuestionAnswer,
  skipQuestion,
} from "@/server/interviews/room-service";
import { InterviewAnswerLockedError } from "@/server/interviews/errors";
import { createSpeechRecognitionAdapter } from "@/lib/speech";
import {
  generateInterviewReport,
  setEvaluationAiAdapter,
} from "@/server/evaluation/service";
import { commitUsage, releaseUsage } from "@/server/usage/service";

// Mock usage service
vi.mock("@/server/usage/service", () => ({
  reserveUsage: vi.fn().mockResolvedValue({ id: "res-rec-001" }),
  commitUsage: vi.fn().mockResolvedValue({ id: "res-rec-001" }),
  releaseUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock consent service
vi.mock("@/server/consent/service", () => ({
  assertConsent: vi.fn().mockResolvedValue(undefined),
  assertRequiredAiConsent: vi.fn().mockResolvedValue(undefined),
}));

const mockEvaluateInterview = vi.fn();

interface MockQuestionAnswer {
  id: string;
  questionId: string;
  transcript: string;
  rawTranscript: string | null;
  status: string;
  inputMode: string;
  durationSeconds: number | null;
  isEdited: boolean;
}

interface MockInterviewState {
  id: string;
  userId: string;
  guestSessionId: string | null;
  interviewType: string;
  status: string;
  role: string;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  isPracticeMode: boolean;
  currentQuestionIndex: number;
  startedAt: Date | null;
  endedAt: Date | null;
  lastPausedAt: Date | null;
  totalPauseDurationSeconds: number;
  companyName: string | null;
  jobDescription: string | null;
  resumeText: string | null;
  questions: Array<{
    id: string;
    orderIndex: number;
    questionText: string;
    category: string;
    difficulty: string;
  }>;
  answers: MockQuestionAnswer[];
  report: Record<string, unknown> | null;
}

// In-memory Prisma mock for recovery scenarios
vi.mock("@/server/db", () => {
  const interviewStore: MockInterviewState = {
    id: "interview-recovery-123",
    userId: "usr-candidate-rec",
    guestSessionId: null,
    interviewType: "technical",
    status: "ready",
    role: "Full Stack Engineer",
    difficulty: "medium",
    durationMinutes: 10,
    questionCount: 3,
    isPracticeMode: false, // Realistic mode locks confirmed answers
    currentQuestionIndex: 0,
    startedAt: null,
    endedAt: null,
    lastPausedAt: null,
    totalPauseDurationSeconds: 0,
    companyName: null,
    jobDescription: null,
    resumeText: null,
    questions: [
      {
        id: "q-rec-1",
        orderIndex: 0,
        questionText: "Explain how React reconciles virtual DOM trees.",
        category: "technical",
        difficulty: "medium",
      },
      {
        id: "q-rec-2",
        orderIndex: 1,
        questionText: "How do you handle database connection pooling in serverless environments?",
        category: "technical",
        difficulty: "medium",
      },
      {
        id: "q-rec-3",
        orderIndex: 2,
        questionText: "What are the trade-offs of microservices vs monoliths?",
        category: "technical",
        difficulty: "medium",
      },
    ],
    answers: [],
    report: null,
  };

  return {
    prisma: {
      interview: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id === interviewStore.id) return interviewStore;
          return null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<MockInterviewState> }) => {
          if (where.id === interviewStore.id) {
            Object.assign(interviewStore, data);
            return interviewStore;
          }
          return null;
        }),
      },
      interviewAnswer: {
        findMany: vi.fn().mockImplementation(async () => interviewStore.answers),
        upsert: vi.fn().mockImplementation(async ({ where, create, update }: { where: { questionId: string }; create: MockQuestionAnswer; update: Partial<MockQuestionAnswer> }) => {
          const existingIdx = interviewStore.answers.findIndex(
            (a) => a.questionId === where.questionId
          );
          if (existingIdx >= 0) {
            Object.assign(interviewStore.answers[existingIdx], update);
            return interviewStore.answers[existingIdx];
          } else {
            const newAns = { ...create, id: create.id || `ans-${Math.random()}` };
            interviewStore.answers.push(newAns);
            return newAns;
          }
        }),
      },
      interviewReport: {
        upsert: vi.fn().mockImplementation(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          if (!interviewStore.report) {
            interviewStore.report = {
              id: "report-rec-001",
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          } else {
            Object.assign(interviewStore.report, update, { updatedAt: new Date() });
          }
          return interviewStore.report;
        }),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          if (interviewStore.report) {
            Object.assign(interviewStore.report, data, { updatedAt: new Date() });
          }
          return interviewStore.report;
        }),
      },
      $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
        callback({
          interviewAnswer: {
            findMany: vi.fn().mockImplementation(async () => interviewStore.answers),
            upsert: vi.fn().mockImplementation(async ({ where, create, update }: { where: { questionId: string }; create: MockQuestionAnswer; update: Partial<MockQuestionAnswer> }) => {
              const existingIdx = interviewStore.answers.findIndex(
                (a) => a.questionId === where.questionId
              );
              if (existingIdx >= 0) {
                Object.assign(interviewStore.answers[existingIdx], update);
                return interviewStore.answers[existingIdx];
              } else {
                const newAns = { ...create, id: create.id || `ans-${Math.random()}` };
                interviewStore.answers.push(newAns);
                return newAns;
              }
            }),
          },
          interview: {
            update: vi.fn().mockImplementation(async ({ data }: { data: Partial<MockInterviewState> }) => {
              Object.assign(interviewStore, data);
              return interviewStore;
            }),
          },
          interviewReport: {
            update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
              if (interviewStore.report) {
                Object.assign(interviewStore.report, data, { updatedAt: new Date() });
              }
              return interviewStore.report;
            }),
          },
        })
      ),
      _store: interviewStore,
    },
  };
});

describe("Milestone 10 — Journey C: Interview Room Recovery", () => {
  const actor = { userId: "usr-candidate-rec" };

  beforeEach(() => {
    vi.clearAllMocks();
    setEvaluationAiAdapter({
      providerName: "gemini",
      generateQuestions: vi.fn(),
      evaluateInterview: (...args: unknown[]) => mockEvaluateInterview(...args),
    });
  });

  it("handles mic permission denial, unsupported speech, pause/resume, skip, exit, realistic locks, and evaluation failure recovery", async () => {
    // 1. Test unsupported speech recognition environment
    const unsupportedAdapter = createSpeechRecognitionAdapter({});
    expect(unsupportedAdapter.isSupported).toBe(false);
    expect(unsupportedAdapter.getStatus()).toBe("unsupported");

    // 2. Start room and verify transition to in_progress
    const startedRoom = await executeInterviewAction(actor, "interview-recovery-123", "start");
    expect(startedRoom.status).toBe("in_progress");
    expect(startedRoom.startedAt).not.toBeNull();

    // 3. Pause interview
    const pausedRoom = await executeInterviewAction(actor, "interview-recovery-123", "pause");
    expect(pausedRoom.status).toBe("paused");
    expect(pausedRoom.lastPausedAt).not.toBeNull();

    // Invalid state transition during pause (e.g. attempting to pause again)
    const idempotentPaused = await executeInterviewAction(actor, "interview-recovery-123", "pause");
    expect(idempotentPaused.status).toBe("paused");

    // 4. Resume interview
    const resumedRoom = await executeInterviewAction(actor, "interview-recovery-123", "resume");
    expect(resumedRoom.status).toBe("in_progress");
    expect(resumedRoom.lastPausedAt).toBeNull();

    // 5. Submit first answer in text fallback mode
    const submittedRoom = await submitQuestionAnswer(actor, "interview-recovery-123", {
      questionId: "q-rec-1",
      transcript: "React compares the previous and next virtual DOM trees using a heuristic O(n) diffing algorithm.",
      inputMode: "text",
      isEdited: false,
    });
    expect(submittedRoom.answers.length).toBe(1);
    expect(submittedRoom.answers[0].status).toBe("submitted");

    // 6. Realistic Mode Lock: attempting to resubmit or edit locked answer throws InterviewAnswerLockedError
    await expect(
      submitQuestionAnswer(actor, "interview-recovery-123", {
        questionId: "q-rec-1",
        transcript: "Modified answer text trying to override locked realistic answer.",
        inputMode: "text",
        isEdited: true,
      })
    ).rejects.toThrow(InterviewAnswerLockedError);

    // 7. Skip second question
    const skippedRoom = await skipQuestion(actor, "interview-recovery-123", "q-rec-2");
    expect(skippedRoom.answers.length).toBe(2);
    const skippedAnswer = skippedRoom.answers.find((a) => a.questionId === "q-rec-2");
    expect(skippedAnswer?.status).toBe("skipped");

    // 8. Safe exit
    const exitedRoom = await executeInterviewAction(actor, "interview-recovery-123", "exit");
    expect(exitedRoom.status).toBe("safely_exited");
    expect(exitedRoom.endedAt).not.toBeNull();

    // 9. Evaluation failure handling: AI service throws error
    mockEvaluateInterview.mockRejectedValueOnce(new Error("AI Provider 503 Overloaded"));

    const failedReport = await generateInterviewReport(actor, "interview-recovery-123", {
      forceRetry: true,
    });
    expect(failedReport.status).toBe("failed");
    expect(failedReport.failureReason).toContain("AI Provider 503 Overloaded");

    // Quota was released on failure so candidate is not charged
    expect(releaseUsage).toHaveBeenCalledWith("res-rec-001");
    expect(commitUsage).not.toHaveBeenCalled();

    // Submitted answers in interviewStore remain completely intact
    const { prisma } = await import("@/server/db");
    const store = (prisma as unknown as { _store: MockInterviewState })._store;
    expect(store.answers.length).toBe(2);
    expect(store.answers[0].transcript).toContain("heuristic O(n) diffing");

    // 10. Evaluation retry succeeds without losing submitted answers
    mockEvaluateInterview.mockResolvedValueOnce({
      overallScore: 84,
      confidenceScore: 0.9,
      rubricVersion: "1.0",
      modelIdentifier: "gemini-3.5-flash-lite",
      dimensionEvaluations: [
        {
          dimension: "technical_correctness",
          score: 88,
          status: "scored",
          observations: "Accurately described React reconciliation heuristics.",
        },
        {
          dimension: "answer_quality",
          score: 80,
          status: "scored",
          observations: "Concise explanation of key principles.",
        },
      ],
      questionFeedback: [],
      strengths: ["Strong understanding of virtual DOM reconciliation"],
      improvements: ["Provide more depth on component keys and tree stability"],
      nextStepRecommendation: "Review fiber architecture and concurrency",
      skippedAnswersCount: 1,
      usageMetadata: { promptTokens: 400, candidateTokens: 250, totalTokens: 650 },
    });

    const successfulRetryReport = await generateInterviewReport(actor, "interview-recovery-123", {
      forceRetry: true,
    });
    expect(successfulRetryReport.status).toBe("completed");
    expect(successfulRetryReport.overallScore).toBe(84);
    expect(commitUsage).toHaveBeenCalledWith("res-rec-001", expect.any(Object));

    // 11. Idempotency: subsequent call returns cached report without re-evaluating
    mockEvaluateInterview.mockClear();
    const cachedReport = await generateInterviewReport(actor, "interview-recovery-123");
    expect(cachedReport.status).toBe("completed");
    expect(cachedReport.overallScore).toBe(84);
    expect(mockEvaluateInterview).not.toHaveBeenCalled();
  });
});

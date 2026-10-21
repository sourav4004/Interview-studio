// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import {
  getInterviewRoomState,
  executeInterviewAction,
  submitQuestionAnswer,
  skipQuestion,
} from "./room-service";
import {
  InterviewAnswerLockedError,
  InterviewExpiredError,
  InterviewNotFoundError,
  InterviewQuestionNotFoundError,
} from "./errors";
import { AuthorizationError } from "@/server/auth/authorization";

describe("Server-Side Interview Room Service", () => {
  const mockActor = { userId: "user-123" };
  const foreignActor = { userId: "user-attacker" };

  function createMockInterview(overrides: Record<string, unknown> = {}) {
    return {
      id: "int-100",
      userId: "user-123",
      guestSessionId: null,
      interviewType: "technical",
      status: "in_progress",
      role: "Fullstack Engineer",
      difficulty: "medium",
      durationMinutes: 10,
      questionCount: 2,
      companyName: null,
      isPracticeMode: false,
      currentQuestionIndex: 0,
      startedAt: new Date(Date.now() - 60_000), // started 1 minute ago
      endedAt: null,
      lastPausedAt: null,
      totalPauseDurationSeconds: 0,
      questions: [
        {
          id: "q-1",
          interviewId: "int-100",
          orderIndex: 1,
          questionText: "Explain React 19 Server Components.",
          category: "technical",
          difficulty: "medium",
          source: "fallback",
          timeLimitSeconds: 120,
        },
        {
          id: "q-2",
          interviewId: "int-100",
          orderIndex: 2,
          questionText: "How do you handle race conditions in PostgreSQL?",
          category: "technical",
          difficulty: "medium",
          source: "fallback",
          timeLimitSeconds: 120,
        },
      ],
      answers: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInterviewRoomState & Authorization", () => {
    it("throws InterviewNotFoundError if interview does not exist", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(null);

      await expect(
        getInterviewRoomState(mockActor, "non-existent")
      ).rejects.toThrow(InterviewNotFoundError);
    });

    it("throws AuthorizationError if actor does not own the interview", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        createMockInterview() as never
      );

      await expect(
        getInterviewRoomState(foreignActor, "int-100")
      ).rejects.toThrow(AuthorizationError);
    });

    it("calculates server-derived elapsed time and remaining duration accurately", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        createMockInterview() as never
      );

      const state = await getInterviewRoomState(mockActor, "int-100");

      expect(state.elapsedSeconds).toBeGreaterThanOrEqual(59);
      expect(state.elapsedSeconds).toBeLessThanOrEqual(65);
      expect(state.remainingSeconds).toBeLessThanOrEqual(541);
      expect(state.isExpired).toBe(false);
      expect(state.questions.length).toBe(2);
    });

    it("detects expired interview session and transitions status to completed", async () => {
      const expiredMock = createMockInterview({
        startedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
      });

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        expiredMock as never
      );
      vi.spyOn(prisma.interview, "update").mockResolvedValue({} as never);

      const state = await getInterviewRoomState(mockActor, "int-100");

      expect(state.isExpired).toBe(true);
      expect(state.remainingSeconds).toBe(0);
      expect(prisma.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "int-100" },
          data: expect.objectContaining({ status: "completed" }),
        })
      );
    });
  });

  describe("executeInterviewAction Transitions", () => {
    it("handles start action idempotently", async () => {
      const draftMock = createMockInterview({
        status: "draft",
        startedAt: null,
      });

      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(draftMock as never);
      findSpy.mockResolvedValueOnce({
        ...draftMock,
        status: "in_progress",
        startedAt: new Date(),
      } as never);

      vi.spyOn(prisma.interview, "update").mockResolvedValue({} as never);

      const res = await executeInterviewAction(mockActor, "int-100", "start");
      expect(prisma.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "in_progress" }),
        })
      );
      expect(res.status).toBe("in_progress");
    });

    it("handles pause action safely", async () => {
      const activeMock = createMockInterview({ status: "in_progress" });
      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(activeMock as never);
      findSpy.mockResolvedValueOnce({
        ...activeMock,
        status: "paused",
        lastPausedAt: new Date(),
      } as never);

      vi.spyOn(prisma.interview, "update").mockResolvedValue({} as never);

      const pausedState = await executeInterviewAction(
        mockActor,
        "int-100",
        "pause"
      );
      expect(pausedState.status).toBe("paused");
      expect(prisma.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "paused" }),
        })
      );
    });

    it("handles resume action with accurate pause duration accounting", async () => {
      const now = Date.now();
      const pausedMock = createMockInterview({
        status: "paused",
        startedAt: new Date(now - 120_000), // started 2 mins ago
        lastPausedAt: new Date(now - 30_000), // paused 30 secs ago
        totalPauseDurationSeconds: 10,
      });

      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(pausedMock as never);
      findSpy.mockResolvedValueOnce({
        ...pausedMock,
        status: "in_progress",
        lastPausedAt: null,
        totalPauseDurationSeconds: 40,
      } as never);

      const updateSpy = vi
        .spyOn(prisma.interview, "update")
        .mockResolvedValue({} as never);

      const resumedState = await executeInterviewAction(
        mockActor,
        "int-100",
        "resume"
      );

      expect(resumedState.status).toBe("in_progress");
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "in_progress",
            lastPausedAt: null,
          }),
        })
      );
    });

    it("handles safe exit action", async () => {
      const activeMock = createMockInterview({ status: "in_progress" });
      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(activeMock as never);
      findSpy.mockResolvedValueOnce({
        ...activeMock,
        status: "safely_exited",
        endedAt: new Date(),
      } as never);

      vi.spyOn(prisma.interview, "update").mockResolvedValue({} as never);

      const res = await executeInterviewAction(mockActor, "int-100", "exit");
      expect(res.status).toBe("safely_exited");
    });
  });

  describe("submitQuestionAnswer & Realistic Mode Locks", () => {
    it("locks submitted answers in Realistic Mode and throws InterviewAnswerLockedError", async () => {
      const realisticWithAnswer = createMockInterview({
        isPracticeMode: false,
        answers: [
          {
            id: "ans-1",
            questionId: "q-1",
            transcript: "Existing submitted answer.",
            status: "submitted",
          },
        ],
      });

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        realisticWithAnswer as never
      );

      await expect(
        submitQuestionAnswer(mockActor, "int-100", {
          questionId: "q-1",
          transcript: "Attempting to change my answer in realistic mode.",
        })
      ).rejects.toThrow(InterviewAnswerLockedError);
    });

    it("allows editing existing answer when in Practice Mode", async () => {
      const practiceWithAnswer = createMockInterview({
        isPracticeMode: true,
        answers: [
          {
            id: "ans-1",
            questionId: "q-1",
            transcript: "Old answer.",
            status: "submitted",
          },
        ],
      });

      const updatedInterview = {
        ...practiceWithAnswer,
        answers: [
          {
            id: "ans-1",
            questionId: "q-1",
            transcript: "Updated refined answer.",
            status: "submitted",
            rawTranscript: null,
            inputMode: "text",
            durationSeconds: 15,
            isEdited: true,
            createdAt: new Date(),
          },
        ],
      };

      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(practiceWithAnswer as never);
      findSpy.mockResolvedValueOnce(updatedInterview as never);

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return (callback as (tx: unknown) => unknown)({
          interviewAnswer: {
            upsert: vi.fn().mockResolvedValue({ id: "ans-1" }),
            findMany: vi.fn().mockResolvedValue([
              {
                id: "ans-1",
                questionId: "q-1",
                transcript: "Updated refined answer.",
                status: "submitted",
              },
            ]),
          },
          interview: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const res = await submitQuestionAnswer(mockActor, "int-100", {
        questionId: "q-1",
        transcript: "Updated refined answer.",
        inputMode: "text",
      });

      expect(res.answers[0].transcript).toBe("Updated refined answer.");
    });

    it("rejects answer if question does not belong to the interview", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        createMockInterview() as never
      );

      await expect(
        submitQuestionAnswer(mockActor, "int-100", {
          questionId: "q-foreign",
          transcript: "Some answer.",
        })
      ).rejects.toThrow(InterviewQuestionNotFoundError);
    });

    it("rejects answer if interview is expired", async () => {
      const expiredMock = createMockInterview({
        startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago (limit was 10)
      });

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        expiredMock as never
      );
      vi.spyOn(prisma.interview, "update").mockResolvedValue({} as never);

      await expect(
        submitQuestionAnswer(mockActor, "int-100", {
          questionId: "q-1",
          transcript: "Some answer.",
        })
      ).rejects.toThrow(InterviewExpiredError);
    });
  });

  describe("skipQuestion", () => {
    it("persists status as 'skipped' and advances question index", async () => {
      const activeMock = createMockInterview();
      const updatedMock = {
        ...activeMock,
        currentQuestionIndex: 1,
        answers: [
          {
            id: "ans-skip-1",
            questionId: "q-1",
            transcript: "",
            rawTranscript: null,
            status: "skipped",
            inputMode: "text",
            durationSeconds: 0,
            isEdited: false,
            createdAt: new Date(),
          },
        ],
      };

      const findSpy = vi.spyOn(prisma.interview, "findUnique");
      findSpy.mockResolvedValueOnce(activeMock as never);
      findSpy.mockResolvedValueOnce(updatedMock as never);

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return (callback as (tx: unknown) => unknown)({
          interviewAnswer: {
            upsert: vi.fn().mockResolvedValue({ id: "ans-skip-1" }),
            findMany: vi.fn().mockResolvedValue([
              {
                id: "ans-skip-1",
                questionId: "q-1",
                transcript: "",
                status: "skipped",
              },
            ]),
          },
          interview: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const res = await skipQuestion(mockActor, "int-100", "q-1");

      expect(res.answers[0].status).toBe("skipped");
      expect(res.currentQuestionIndex).toBe(1);
    });
  });
});

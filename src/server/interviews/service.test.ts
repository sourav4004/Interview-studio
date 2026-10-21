// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAndInitializeInterview, getInterviewById } from "./service";
import { InterviewConfigurationError } from "./errors";
import { ConsentRequiredError } from "@/server/consent/errors";
import { UsageLimitExceededError } from "@/server/usage/errors";
import { AuthorizationError } from "@/server/auth/authorization";
import { MockAiProviderAdapter } from "@/server/ai/mock-adapter";

// Mock dependencies
vi.mock("@/server/consent/service", () => ({
  assertRequiredAiConsent: vi.fn(),
}));

vi.mock("@/server/usage/service", () => ({
  reserveUsage: vi.fn(),
  commitUsage: vi.fn(),
  releaseUsage: vi.fn(),
}));

vi.mock("@/server/db", () => {
  return {
    prisma: {
      guestSession: {
        findUnique: vi.fn(),
      },
      interview: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      interviewQuestion: {
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
      usageRecord: {
        update: vi.fn(),
      },
      idempotencyKey: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) =>
        callback({
          interview: {
            create: vi.fn().mockImplementation(({ data }) => ({
              id: "interview-123",
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            })),
          },
          interviewQuestion: {
            createMany: vi.fn().mockResolvedValue({ count: 3 }),
            findMany: vi.fn().mockImplementation(({ where }) => [
              {
                id: "q-1",
                interviewId: where.interviewId,
                orderIndex: 1,
                questionText: "First generated question for testing purposes?",
                category: "Technical",
                difficulty: "medium",
                source: "gemini",
                timeLimitSeconds: 120,
              },
              {
                id: "q-2",
                interviewId: where.interviewId,
                orderIndex: 2,
                questionText: "Second generated question for testing purposes?",
                category: "Technical",
                difficulty: "medium",
                source: "gemini",
                timeLimitSeconds: 120,
              },
              {
                id: "q-3",
                interviewId: where.interviewId,
                orderIndex: 3,
                questionText: "Third generated question for testing purposes?",
                category: "Technical",
                difficulty: "medium",
                source: "gemini",
                timeLimitSeconds: 120,
              },
            ]),
          },
          usageRecord: {
            update: vi.fn(),
          },
          idempotencyKey: {
            create: vi.fn(),
            update: vi.fn(),
          },
        })
      ),
    },
  };
});

import { assertRequiredAiConsent } from "@/server/consent/service";
import { reserveUsage, commitUsage, releaseUsage } from "@/server/usage/service";
import { prisma } from "@/server/db";

describe("Interview Setup & Generation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration & Input Validation", () => {
    it("rejects invalid interview mode", async () => {
      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "invalid-mode" as unknown as "technical",
            role: "Frontend Engineer",
            difficulty: "easy",
            durationMinutes: 10,
          }
        )
      ).rejects.toThrow(InterviewConfigurationError);
    });

    it("rejects empty or missing role", async () => {
      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "technical",
            role: " ",
            difficulty: "medium",
            durationMinutes: 10,
          }
        )
      ).rejects.toThrow(InterviewConfigurationError);
    });

    it("rejects invalid duration values", async () => {
      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "technical",
            role: "Backend Engineer",
            difficulty: "medium",
            durationMinutes: 15 as unknown as 10, // Only 5, 10, 20 allowed
          }
        )
      ).rejects.toThrow(InterviewConfigurationError);
    });

    it("rejects resume mode if resume context is missing or too short", async () => {
      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "resume",
            role: "Software Engineer",
            difficulty: "medium",
            durationMinutes: 10,
            resumeText: "Short",
          }
        )
      ).rejects.toThrow(/Resume context.*is required/i);
    });

    it("rejects company mode if both company name and job context are missing", async () => {
      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "company",
            role: "Software Engineer",
            difficulty: "medium",
            durationMinutes: 10,
          }
        )
      ).rejects.toThrow(/company name or job description is required/i);
    });
  });

  describe("Consent Enforcement", () => {
    it("blocks registered user when required consent is missing or withdrawn", async () => {
      vi.mocked(assertRequiredAiConsent).mockRejectedValueOnce(
        new ConsentRequiredError("ai_questions")
      );

      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "technical",
            role: "DevOps Engineer",
            difficulty: "easy",
            durationMinutes: 5,
          }
        )
      ).rejects.toThrow(ConsentRequiredError);

      expect(reserveUsage).not.toHaveBeenCalled();
    });

    it("blocks guest session when guest consent has not been granted", async () => {
      vi.mocked(prisma.guestSession.findUnique).mockResolvedValueOnce({
        id: "guest-123",
        tokenHash: "hash-123",
        expiresAt: new Date(Date.now() + 100000),
        consentAiQuestions: false, // Not granted!
        consentAiEvaluation: true,
        consentResumeProcessing: false,
      } as unknown as Awaited<ReturnType<typeof prisma.guestSession.findUnique>>);

      await expect(
        createAndInitializeInterview(
          { guestSessionId: "guest-123" },
          {
            mode: "technical",
            role: "DevOps Engineer",
            difficulty: "easy",
            durationMinutes: 5,
          }
        )
      ).rejects.toThrow(/Explicit consent for AI question generation is required/i);
    });

    it("blocks guest session when guest session has expired", async () => {
      vi.mocked(prisma.guestSession.findUnique).mockResolvedValueOnce({
        id: "guest-123",
        tokenHash: "hash-123",
        expiresAt: new Date(Date.now() - 1000), // Expired!
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
      } as unknown as Awaited<ReturnType<typeof prisma.guestSession.findUnique>>);

      await expect(
        createAndInitializeInterview(
          { guestSessionId: "guest-123" },
          {
            mode: "technical",
            role: "DevOps Engineer",
            difficulty: "easy",
            durationMinutes: 5,
          }
        )
      ).rejects.toThrow(/Guest session has expired/i);
    });
  });

  describe("Usage Quota Enforcement", () => {
    it("stops immediately without invoking AI if usage reservation fails", async () => {
      vi.mocked(assertRequiredAiConsent).mockResolvedValueOnce();
      vi.mocked(reserveUsage).mockRejectedValueOnce(
        new UsageLimitExceededError(10, 0)
      );

      const mockAi = new MockAiProviderAdapter();
      const generateSpy = vi.spyOn(mockAi, "generateQuestions");

      await expect(
        createAndInitializeInterview(
          { userId: "user-1" },
          {
            mode: "technical",
            role: "Frontend Engineer",
            difficulty: "easy",
            durationMinutes: 10,
          },
          { aiProvider: mockAi }
        )
      ).rejects.toThrow(UsageLimitExceededError);

      expect(generateSpy).not.toHaveBeenCalled();
    });
  });

  describe("Primary AI Generation vs Fallback Bank", () => {
    it("creates interview with source=gemini and commits usage on AI success", async () => {
      vi.mocked(assertRequiredAiConsent).mockResolvedValueOnce();
      vi.mocked(reserveUsage).mockResolvedValueOnce({
        id: "res-123",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      });

      const mockAi = new MockAiProviderAdapter({
        model: "gemini-3.5-flash-lite",
      });

      const interview = await createAndInitializeInterview(
        { userId: "user-1" },
        {
          mode: "technical",
          role: "Full Stack Engineer",
          difficulty: "medium",
          durationMinutes: 10,
          questionCount: 3,
        },
        { aiProvider: mockAi }
      );

      expect(interview.id).toBe("interview-123");
      expect(commitUsage).toHaveBeenCalledWith("res-123", expect.anything());
      expect(releaseUsage).not.toHaveBeenCalled();
    });

    it("falls back to reviewed question bank, sets source=fallback, and releases reservation on AI failure", async () => {
      vi.mocked(assertRequiredAiConsent).mockResolvedValueOnce();
      vi.mocked(reserveUsage).mockResolvedValueOnce({
        id: "res-123",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      });

      const mockAi = new MockAiProviderAdapter({
        shouldFail: true,
        failureError: new Error("Gemini 503 Overloaded"),
      });

      const interview = await createAndInitializeInterview(
        { userId: "user-1" },
        {
          mode: "behavioral",
          role: "Engineering Manager Intern",
          difficulty: "easy",
          durationMinutes: 10,
          questionCount: 3,
        },
        { aiProvider: mockAi }
      );

      expect(interview.id).toBe("interview-123");
      // Failed AI generation must NOT consume user's quota: releaseUsage must be called
      expect(releaseUsage).toHaveBeenCalledWith("res-123");
      expect(commitUsage).not.toHaveBeenCalled();
    });
  });

  describe("getInterviewById Authorization", () => {
    it("allows owner user to view interview", async () => {
      vi.mocked(prisma.interview.findUnique).mockResolvedValueOnce({
        id: "interview-123",
        userId: "user-1",
        guestSessionId: null,
        interviewType: "technical",
        status: "in_progress",
        role: "Frontend Engineer",
        difficulty: "medium",
        durationMinutes: 10,
        questionCount: 3,
        companyName: null,
        questionSource: "gemini",
        modelIdentifier: "gemini-3.5-flash-lite",
        promptVersion: "1.0",
        schemaVersion: "1.0",
        createdAt: new Date(),
        questions: [],
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.interview.findUnique>>>);

      const interview = await getInterviewById({ userId: "user-1" }, "interview-123");
      expect(interview.id).toBe("interview-123");
    });

    it("rejects unauthorized user attempting to access someone else's interview", async () => {
      vi.mocked(prisma.interview.findUnique).mockResolvedValueOnce({
        id: "interview-123",
        userId: "user-1", // Owned by user-1
        guestSessionId: null,
        questions: [],
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.interview.findUnique>>>);

      await expect(
        getInterviewById({ userId: "different-user" }, "interview-123")
      ).rejects.toThrow(AuthorizationError);
    });
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import {
  generateInterviewReport,
  getInterviewReport,
  setEvaluationAiAdapter,
  resetEvaluationAiAdapter,
} from "./service";
import { MockAiProviderAdapter } from "@/server/ai/mock-adapter";
import * as consentModule from "@/server/consent";
import * as usageModule from "@/server/usage";
import { AuthorizationError } from "@/server/auth/authorization";
import { ConsentRequiredError } from "@/server/consent/errors";
import { InterviewReportNotFoundError } from "./errors";

vi.mock("@/server/consent");
vi.mock("@/server/usage");

describe("Interview Evaluation Service", () => {
  const mockActor = { userId: "user-123" };
  const mockInterviewId = "int-100";

  const mockInterviewRecord = {
    id: mockInterviewId,
    userId: "user-123",
    guestSessionId: null,
    interviewType: "technical",
    status: "in_progress",
    role: "Backend Engineer",
    difficulty: "medium",
    durationMinutes: 10,
    questionCount: 2,
    companyName: null,
    jobDescription: null,
    resumeText: null,
    questions: [
      {
        id: "q-1",
        orderIndex: 0,
        questionText: "Explain indexing in PostgreSQL.",
        category: "Databases",
        difficulty: "medium",
        answer: {
          id: "ans-1",
          transcript: "B-Tree indexes provide logarithmic lookup time.",
          status: "submitted",
          inputMode: "speech",
          isEdited: false,
          durationSeconds: 30,
        },
      },
      {
        id: "q-2",
        orderIndex: 1,
        questionText: "What is connection pooling?",
        category: "Databases",
        difficulty: "medium",
        answer: {
          id: "ans-2",
          transcript: "",
          status: "skipped",
          inputMode: "text",
          isEdited: false,
          durationSeconds: 0,
        },
      },
    ],
    report: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEvaluationAiAdapter();
  });

  describe("getInterviewReport", () => {
    it("throws InterviewReportNotFoundError if interview does not exist", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(null);

      await expect(getInterviewReport(mockActor, "non-existent")).rejects.toThrow(
        InterviewReportNotFoundError
      );
    });

    it("throws AuthorizationError if actor does not own the interview", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue({
        ...mockInterviewRecord,
        userId: "different-user",
        report: null,
      } as never);

      await expect(getInterviewReport(mockActor, mockInterviewId)).rejects.toThrow(
        AuthorizationError
      );
    });

    it("returns formatted report summary when report exists and actor is authorized", async () => {
      const mockReport = {
        id: "rep-1",
        interviewId: mockInterviewId,
        userId: "user-123",
        guestSessionId: null,
        status: "completed",
        overallScore: 82,
        summary: "Good performance overall.",
        scoreExplanation: "Contextual explanation.",
        strengths: ["Strong technical fundamentals"],
        improvements: ["Mention composite indexes"],
        primaryRecommendation: "Practice system design.",
        dimensionScores: [],
        questionFeedback: [],
        modelIdentifier: "gemini-3.5-flash-lite",
        promptVersion: "1.0",
        rubricVersion: "1.0",
        schemaVersion: "1.0",
        evaluatedAnswersCount: 1,
        skippedAnswersCount: 1,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue({
        ...mockInterviewRecord,
        report: mockReport,
      } as never);

      const result = await getInterviewReport(mockActor, mockInterviewId);
      expect(result.id).toBe("rep-1");
      expect(result.overallScore).toBe(82);
      expect(result.status).toBe("completed");
    });
  });

  describe("generateInterviewReport", () => {
    it("fails closed if user lacks required ai_evaluation consent", async () => {
      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        mockInterviewRecord as never
      );
      vi.mocked(consentModule.assertConsent).mockRejectedValue(
        new ConsentRequiredError("ai_evaluation")
      );

      await expect(
        generateInterviewReport(mockActor, mockInterviewId)
      ).rejects.toThrow(ConsentRequiredError);
    });

    it("returns existing report idempotently if already completed and not forceRetry", async () => {
      vi.mocked(consentModule.assertConsent).mockResolvedValue();

      const existingReport = {
        id: "rep-completed",
        interviewId: mockInterviewId,
        userId: "user-123",
        guestSessionId: null,
        status: "completed",
        overallScore: 88,
        summary: "Already completed.",
        scoreExplanation: "Explanation.",
        strengths: ["Great responses"],
        improvements: ["More depth"],
        primaryRecommendation: "Next step.",
        dimensionScores: [],
        questionFeedback: [],
        modelIdentifier: "gemini-3.5-flash-lite",
        promptVersion: "1.0",
        rubricVersion: "1.0",
        schemaVersion: "1.0",
        evaluatedAnswersCount: 2,
        skippedAnswersCount: 0,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue({
        ...mockInterviewRecord,
        report: existingReport,
      } as never);

      const mockAi = new MockAiProviderAdapter();
      const evaluateSpy = vi.spyOn(mockAi, "evaluateInterview");
      setEvaluationAiAdapter(mockAi);

      const result = await generateInterviewReport(mockActor, mockInterviewId);

      expect(result.id).toBe("rep-completed");
      expect(result.status).toBe("completed");
      expect(evaluateSpy).not.toHaveBeenCalled();
      expect(usageModule.reserveUsage).not.toHaveBeenCalled();
    });

    it("runs complete evaluation pipeline, reserves quota, commits usage, and saves report", async () => {
      vi.mocked(consentModule.assertConsent).mockResolvedValue();
      vi.mocked(usageModule.reserveUsage).mockResolvedValue({
        id: "res-123",
        userId: "user-123",
        guestSessionId: null,
        interviewId: mockInterviewId,
        action: "evaluation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      });
      vi.mocked(usageModule.commitUsage).mockResolvedValue({} as never);

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        mockInterviewRecord as never
      );

      const upsertSpy = vi.spyOn(prisma.interviewReport, "upsert").mockResolvedValue({
        id: "rep-new",
        interviewId: mockInterviewId,
        userId: "user-123",
        guestSessionId: null,
        status: "processing",
        overallScore: null,
        summary: null,
        scoreExplanation: null,
        strengths: [],
        improvements: [],
        primaryRecommendation: null,
        dimensionScores: [],
        questionFeedback: [],
        modelIdentifier: null,
        promptVersion: null,
        rubricVersion: null,
        schemaVersion: null,
        evaluatedAnswersCount: 0,
        skippedAnswersCount: 0,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const updatedReportRecord = {
        id: "rep-new",
        interviewId: mockInterviewId,
        userId: "user-123",
        guestSessionId: null,
        status: "completed",
        overallScore: 82,
        summary: "Candidate demonstrated solid foundational knowledge.",
        scoreExplanation: "Explanation text.",
        strengths: ["Clear terminology"],
        improvements: ["Add trade-offs"],
        primaryRecommendation: "Practice system design.",
        dimensionScores: [],
        questionFeedback: [],
        modelIdentifier: "mock-gemini-3.5-flash-lite",
        promptVersion: "1.0",
        rubricVersion: "1.0",
        schemaVersion: "1.0",
        evaluatedAnswersCount: 1,
        skippedAnswersCount: 1,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return (callback as (tx: unknown) => unknown)({
          interviewReport: {
            update: vi.fn().mockResolvedValue(updatedReportRecord),
          },
          interview: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const mockAi = new MockAiProviderAdapter();
      setEvaluationAiAdapter(mockAi);

      const result = await generateInterviewReport(mockActor, mockInterviewId);

      expect(usageModule.reserveUsage).toHaveBeenCalledWith(
        { userId: "user-123" },
        "evaluation",
        mockInterviewId
      );
      expect(upsertSpy).toHaveBeenCalled();
      expect(usageModule.commitUsage).toHaveBeenCalledWith("res-123", expect.anything());
      expect(result.status).toBe("completed");
      expect(result.overallScore).toBe(82);
    });

    it("safely releases quota and marks report failed on AI evaluation error", async () => {
      vi.mocked(consentModule.assertConsent).mockResolvedValue();
      vi.mocked(usageModule.reserveUsage).mockResolvedValue({
        id: "res-123",
        userId: "user-123",
        guestSessionId: null,
        interviewId: mockInterviewId,
        action: "evaluation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      });
      vi.mocked(usageModule.releaseUsage).mockResolvedValue({} as never);

      vi.spyOn(prisma.interview, "findUnique").mockResolvedValue(
        mockInterviewRecord as never
      );
      vi.spyOn(prisma.interviewReport, "upsert").mockResolvedValue({
        id: "rep-proc",
        interviewId: mockInterviewId,
        status: "processing",
        dimensionScores: [],
        questionFeedback: [],
        strengths: [],
        improvements: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      vi.spyOn(prisma.interviewReport, "update").mockResolvedValue({
        id: "rep-proc",
        interviewId: mockInterviewId,
        userId: "user-123",
        guestSessionId: null,
        status: "failed",
        overallScore: null,
        summary: null,
        scoreExplanation: null,
        strengths: [],
        improvements: [],
        primaryRecommendation: null,
        dimensionScores: [],
        questionFeedback: [],
        modelIdentifier: null,
        promptVersion: null,
        rubricVersion: null,
        schemaVersion: null,
        evaluatedAnswersCount: 0,
        skippedAnswersCount: 0,
        failureReason: "Simulated AI crash",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const failingAi = new MockAiProviderAdapter({
        shouldFail: true,
        failureError: new Error("Simulated AI crash"),
      });
      setEvaluationAiAdapter(failingAi);

      const result = await generateInterviewReport(mockActor, mockInterviewId);

      expect(usageModule.releaseUsage).toHaveBeenCalledWith("res-123");
      expect(result.status).toBe("failed");
      expect(result.failureReason).toContain("Simulated AI crash");
    });
  });
});

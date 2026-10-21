// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as evaluationService from "@/server/evaluation/service";
import * as sessionModule from "@/server/auth/session";
import type { AuthenticatedSession } from "@/server/auth/session";
import type { InterviewReportSummary } from "@/server/evaluation/types";
import { InterviewReportNotFoundError } from "@/server/evaluation/errors";
import { ConsentRequiredError } from "@/server/consent/errors";
import { UsageLimitExceededError } from "@/server/usage/errors";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/server/auth/session");
vi.mock("@/server/guest");
vi.mock("@/server/evaluation/service");

describe("Interview Report API Routes", () => {
  const mockParams = Promise.resolve({ id: "int-123" });

  const mockUserSession: AuthenticatedSession = {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "sess-1",
      userId: "user-1",
      token: "token-1",
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockReportSummary: InterviewReportSummary = {
    id: "rep-1",
    interviewId: "int-123",
    userId: "user-1",
    guestSessionId: null,
    status: "completed",
    overallScore: 85,
    summary: "Solid overall performance.",
    scoreExplanation: "Explanation of score.",
    strengths: ["Clear terminology"],
    improvements: ["More trade-offs"],
    primaryRecommendation: "Practice system design.",
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/interviews/[id]/report", () => {
    it("returns 401 Unauthorized when actor is not authenticated", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 404 when report has not been generated yet", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(evaluationService.getInterviewReport).mockRejectedValue(
        new InterviewReportNotFoundError("int-123")
      );

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("NotFound");
    });

    it("returns 200 with report summary when actor is authorized", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(evaluationService.getInterviewReport).mockResolvedValue(mockReportSummary);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.report.id).toBe("rep-1");
      expect(json.report.overallScore).toBe(85);
    });
  });

  describe("POST /api/interviews/[id]/report", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report", {
        method: "POST",
      });
      const res = await POST(req, { params: mockParams });

      expect(res.status).toBe(401);
    });

    it("returns 403 when ai_evaluation consent is missing", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(evaluationService.generateInterviewReport).mockRejectedValue(
        new ConsentRequiredError("ai_evaluation")
      );

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report", {
        method: "POST",
      });
      const res = await POST(req, { params: mockParams });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("ConsentRequired");
    });

    it("returns 429 when usage quota limit is exceeded", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(evaluationService.generateInterviewReport).mockRejectedValue(
        new UsageLimitExceededError(10, 0)
      );

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report", {
        method: "POST",
      });
      const res = await POST(req, { params: mockParams });

      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toBe("QuotaExceeded");
    });

    it("returns 200 with generated report on success", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(evaluationService.generateInterviewReport).mockResolvedValue(mockReportSummary);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRetry: false }),
      });
      const res = await POST(req, { params: mockParams });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.report.overallScore).toBe(85);
    });
  });
});

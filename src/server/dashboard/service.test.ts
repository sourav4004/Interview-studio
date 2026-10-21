// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInterviewHistory, getDashboardAnalytics } from "./service";
import { AuthorizationError, SecurityActor } from "@/server/auth/authorization";
import { getUserConsent } from "@/server/consent/service";
import { prisma } from "@/server/db";

// Mock prisma
vi.mock("@/server/db", () => {
  return {
    prisma: {
      interview: {
        count: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      interviewReport: {
        findMany: vi.fn(),
      },
      consentAuditLog: {
        findFirst: vi.fn(),
      },
      personalizationProfile: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

// Mock consent service
vi.mock("@/server/consent/service", () => {
  return {
    getUserConsent: vi.fn(),
  };
});

describe("Dashboard & Interview History Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserConsent).mockResolvedValue({
      ai_questions: true,
      ai_evaluation: true,
      resume_processing: false,
      saved_resume: false,
      personalization: true,
      noticeVersion: "1.0",
      updatedAt: new Date(),
    });
    vi.mocked(prisma.consentAuditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.personalizationProfile.findUnique).mockResolvedValue(null);
  });

  describe("getInterviewHistory", () => {
    it("throws AuthorizationError when actor has neither userId nor guestSessionId", async () => {
      await expect(
        getInterviewHistory({} as unknown as SecurityActor)
      ).rejects.toThrow(AuthorizationError);
    });

    it("queries interviews for registered user with bounded pagination and status filtering", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(25);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: "interview-1",
          interviewType: "technical",
          status: "completed",
          role: "Frontend Engineer",
          difficulty: "medium",
          durationMinutes: 10,
          questionCount: 8,
          companyName: "Acme Corp",
          createdAt: new Date("2026-10-18T10:00:00Z"),
          startedAt: new Date("2026-10-18T10:01:00Z"),
          endedAt: new Date("2026-10-18T10:11:00Z"),
          report: {
            id: "report-1",
            status: "completed",
            overallScore: 84,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T10:12:00Z"),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.findMany>>);

      const result = await getInterviewHistory(
        { userId: "user-123" },
        { limit: 10, offset: 0, mode: "technical", status: "completed" }
      );

      expect(prisma.interview.count).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          interviewType: "technical",
          status: "completed",
        },
      });

      expect(prisma.interview.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          interviewType: "technical",
          status: "completed",
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
        select: expect.any(Object),
      });

      expect(result.pagination).toEqual({
        total: 25,
        limit: 10,
        offset: 0,
        hasMore: true,
      });
      expect(result.interviews).toHaveLength(1);
      expect(result.interviews[0].report?.overallScore).toBe(84);
    });

    it("enforces safe upper bound of 50 for limit", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);

      await getInterviewHistory({ userId: "user-123" }, { limit: 100 });

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it("queries interviews for guest session with userId: null check", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: "interview-guest-1",
          interviewType: "behavioral",
          status: "in_progress",
          role: "Product Manager",
          difficulty: "easy",
          durationMinutes: 5,
          questionCount: 4,
          companyName: null,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          report: null,
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.findMany>>);

      const result = await getInterviewHistory({
        guestSessionId: "guest-abc",
      });

      expect(prisma.interview.count).toHaveBeenCalledWith({
        where: {
          guestSessionId: "guest-abc",
          userId: null,
        },
      });
      expect(result.interviews[0].report).toBeNull();
    });
  });

  describe("getDashboardAnalytics", () => {
    it("throws AuthorizationError for unauthenticated actors", async () => {
      await expect(
        getDashboardAnalytics({} as unknown as SecurityActor)
      ).rejects.toThrow(AuthorizationError);
    });

    it("handles 0 completed reports: empty state with no synthetic scores", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(2); // 2 started, none completed
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: "int-1",
          interviewType: "technical",
          status: "in_progress",
          role: "SWE Intern",
          difficulty: "easy",
          durationMinutes: 10,
          questionCount: 8,
          companyName: null,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          report: null,
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.findMany>>);
      vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([
        { interviewType: "technical", _count: { _all: 2 } },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.groupBy>>);
      vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([]); // 0 reports

      const analytics = await getDashboardAnalytics({ userId: "user-1" });

      expect(analytics.metrics.totalCompleted).toBe(0);
      expect(analytics.metrics.totalStarted).toBe(2);
      expect(analytics.metrics.recentScore).toBeNull();
      expect(analytics.metrics.averageScore).toBeNull();
      expect(analytics.metrics.strongestDimension).toBeNull();
      expect(analytics.trends.hasComparableData).toBe(false);
      expect(analytics.trends.scoreTrajectory).toHaveLength(0);
      expect(analytics.trends.minimumDataNotice).toContain("first diagnostic interview");
    });

    it("handles 1 completed report: baseline result without claiming progress or drawing a trend line", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: "int-1",
          interviewType: "technical",
          status: "completed",
          role: "Backend Engineer",
          difficulty: "medium",
          durationMinutes: 10,
          questionCount: 8,
          companyName: null,
          createdAt: new Date("2026-10-18T10:00:00Z"),
          startedAt: null,
          endedAt: null,
          report: {
            id: "rep-1",
            status: "completed",
            overallScore: 82,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T10:15:00Z"),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.findMany>>);
      vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([
        { interviewType: "technical", _count: { _all: 1 } },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.groupBy>>);

      vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 82,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T10:15:00Z"),
          dimensionScores: [
            {
              dimension: "technical_correctness",
              label: "Technical Correctness",
              score: 85,
              weight: 0.35,
              status: "scored",
              explanation: "Good depth",
              evidence: "Evidence quote",
            },
            {
              dimension: "answer_structure",
              label: "Answer Structure",
              score: 75,
              weight: 0.2,
              status: "scored",
              explanation: "Acceptable structure",
              evidence: "Evidence quote",
            },
          ],
          interview: {
            id: "int-1",
            interviewType: "technical",
            role: "Backend Engineer",
            difficulty: "medium",
            createdAt: new Date("2026-10-18T10:00:00Z"),
            endedAt: new Date("2026-10-18T10:10:00Z"),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

      const analytics = await getDashboardAnalytics({ userId: "user-1" });

      expect(analytics.metrics.totalCompleted).toBe(1);
      expect(analytics.metrics.recentScore).toBe(82);
      expect(analytics.metrics.averageScore).toBe(82);
      expect(analytics.metrics.strongestDimension?.dimension).toBe("technical_correctness");
      expect(analytics.metrics.strongestDimension?.averageScore).toBe(85);
      // Minimum data rule: 1 report is baseline only, no trend line claim
      expect(analytics.trends.hasComparableData).toBe(false);
      expect(analytics.trends.scoreTrajectory).toHaveLength(1);
      expect(analytics.trends.minimumDataNotice).toContain(
        "Complete at least one more interview to unlock comparative score trends"
      );
    });

    it("handles 2+ completed reports: chronological trendline and truthful score changes", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([
        { interviewType: "technical", _count: { _all: 2 } },
      ] as unknown as Awaited<ReturnType<typeof prisma.interview.groupBy>>);

      vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 70,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-10T10:00:00Z"),
          dimensionScores: [
            {
              dimension: "answer_quality",
              score: 70,
              status: "scored",
            },
          ],
          interview: {
            id: "int-1",
            interviewType: "technical",
            role: "Junior Dev",
            difficulty: "easy",
            createdAt: new Date("2026-10-10T09:00:00Z"),
            endedAt: new Date("2026-10-10T09:10:00Z"),
          },
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          overallScore: 85,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T10:00:00Z"),
          dimensionScores: [
            {
              dimension: "answer_quality",
              score: 90,
              status: "scored",
            },
          ],
          interview: {
            id: "int-2",
            interviewType: "technical",
            role: "Junior Dev",
            difficulty: "medium",
            createdAt: new Date("2026-10-18T09:00:00Z"),
            endedAt: new Date("2026-10-18T09:10:00Z"),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

      const analytics = await getDashboardAnalytics({ userId: "user-1" });

      expect(analytics.metrics.totalCompleted).toBe(2);
      expect(analytics.metrics.recentScore).toBe(85);
      expect(analytics.metrics.averageScore).toBe(78); // (70 + 85) / 2 = 77.5 -> rounded 78
      expect(analytics.trends.hasComparableData).toBe(true);
      expect(analytics.trends.scoreTrajectory).toHaveLength(2);
      expect(analytics.trends.scoreTrajectory[0].overallScore).toBe(70);
      expect(analytics.trends.scoreTrajectory[1].overallScore).toBe(85);
      expect(analytics.trends.trendSummary).toContain("observed change of +15 points");
    });

    it("never penalizes not_applicable and insufficient_evidence dimension scores as zero", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);

      vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 80,
          rubricVersion: "1.0",
          createdAt: new Date(),
          dimensionScores: [
            {
              dimension: "technical_correctness",
              score: null,
              status: "not_applicable",
            },
            {
              dimension: "resume_consistency",
              score: null,
              status: "insufficient_evidence",
            },
            {
              dimension: "answer_quality",
              score: 80,
              status: "scored",
            },
          ],
          interview: {
            id: "int-1",
            interviewType: "behavioral",
            role: "Manager",
            difficulty: "medium",
            createdAt: new Date(),
            endedAt: new Date(),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

      const analytics = await getDashboardAnalytics({ userId: "user-1" });

      const techDim = analytics.trends.dimensionAggregates.find(
        (d) => d.dimension === "technical_correctness"
      );
      const resumeDim = analytics.trends.dimensionAggregates.find(
        (d) => d.dimension === "resume_consistency"
      );
      const answerDim = analytics.trends.dimensionAggregates.find(
        (d) => d.dimension === "answer_quality"
      );

      // Must be null, NOT zero!
      expect(techDim?.averageScore).toBeNull();
      expect(techDim?.scoredCount).toBe(0);
      expect(resumeDim?.averageScore).toBeNull();
      expect(resumeDim?.scoredCount).toBe(0);

      // Only genuinely scored dimensions have numbers
      expect(answerDim?.averageScore).toBe(80);
      expect(answerDim?.scoredCount).toBe(1);
    });

    it("isolates guest session queries and prevents cross-user leakage", async () => {
      vi.mocked(prisma.interview.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
      vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([]);

      await getDashboardAnalytics({ guestSessionId: "guest-test-session" });

      expect(prisma.interview.count).toHaveBeenCalledWith({
        where: {
          guestSessionId: "guest-test-session",
          userId: null,
        },
      });

      expect(prisma.interviewReport.findMany).toHaveBeenCalledWith({
        where: {
          guestSessionId: "guest-test-session",
          userId: null,
          status: "completed",
          overallScore: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: expect.any(Object),
      });
    });

    describe("Audit: Recommendation Personalization Consent", () => {
      const mockSingleCompletedReport = [
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 88,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T10:00:00Z"),
          dimensionScores: [
            {
              dimension: "technical_correctness",
              score: 90,
              status: "scored",
            },
            {
              dimension: "answer_structure",
              score: 75,
              status: "scored",
            },
          ],
          interview: {
            id: "int-1",
            interviewType: "technical",
            role: "SWE",
            difficulty: "medium",
            createdAt: new Date(),
            endedAt: new Date(),
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>;

      it("derives personalized recommendation when personalization consent is granted and 3+ post-consent reports exist", async () => {
        const grantDate = new Date("2026-10-18T10:00:00Z");

        vi.mocked(prisma.interview.count).mockResolvedValueOnce(3);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);

        const mockThreeReports = [
          {
            id: "rep-1",
            interviewId: "int-1",
            overallScore: 70,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T11:00:00Z"),
            dimensionScores: [
              { dimension: "technical_correctness", score: 65, status: "scored", feedback: "Bug in loop" },
              { dimension: "communication_speech", score: 85, status: "scored", feedback: "Clear" },
            ],
            interview: {
              id: "int-1",
              interviewType: "technical",
              role: "SWE",
              difficulty: "medium",
              endedAt: new Date("2026-10-18T10:55:00Z"),
              createdAt: new Date("2026-10-18T10:45:00Z"),
            },
          },
          {
            id: "rep-2",
            interviewId: "int-2",
            overallScore: 72,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T12:00:00Z"),
            dimensionScores: [
              { dimension: "technical_correctness", score: 68, status: "scored", feedback: "Edge case missed" },
              { dimension: "communication_speech", score: 88, status: "scored", feedback: "Concise" },
            ],
            interview: {
              id: "int-2",
              interviewType: "technical",
              role: "SWE",
              difficulty: "medium",
              endedAt: new Date("2026-10-18T11:55:00Z"),
              createdAt: new Date("2026-10-18T11:45:00Z"),
            },
          },
          {
            id: "rep-3",
            interviewId: "int-3",
            overallScore: 75,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T13:00:00Z"),
            dimensionScores: [
              { dimension: "technical_correctness", score: 70, status: "scored", feedback: "Complexity sub-optimal" },
              { dimension: "communication_speech", score: 86, status: "scored", feedback: "Engaged" },
            ],
            interview: {
              id: "int-3",
              interviewType: "technical",
              role: "SWE",
              difficulty: "hard",
              endedAt: new Date("2026-10-18T12:55:00Z"),
              createdAt: new Date("2026-10-18T12:45:00Z"),
            },
          },
        ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>;

        // Dashboard queries eligibleReports first, then getOrCompilePersonalizationProfile queries eligible reports again
        vi.mocked(prisma.interviewReport.findMany)
          .mockResolvedValueOnce(mockThreeReports)
          .mockResolvedValueOnce(mockThreeReports);

        vi.mocked(getUserConsent).mockResolvedValue({
          ai_questions: true,
          ai_evaluation: true,
          resume_processing: false,
          saved_resume: false,
          personalization: true, // Consent actively granted
          noticeVersion: "1.0",
          updatedAt: new Date(),
        });

        vi.mocked(prisma.consentAuditLog.findFirst).mockResolvedValue({
          id: "log-1",
          userId: "user-with-consent",
          purpose: "personalization",
          action: "granted",
          noticeVersion: "1.0",
          timestamp: grantDate,
        } as unknown as Awaited<ReturnType<typeof prisma.consentAuditLog.findFirst>>);

        vi.mocked(prisma.personalizationProfile.upsert).mockResolvedValue({
          id: "prof-1",
          userId: "user-with-consent",
          status: "ready",
          schemaVersion: "1.0",
          consentGrantedAt: grantDate,
          consentNoticeVersion: "1.0",
          eligibleReportCount: 3,
          eligibleReportIds: ["rep-1", "rep-2", "rep-3"],
          compiledAt: new Date(),
          lastRefreshedAt: new Date(),
          profileData: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Awaited<ReturnType<typeof prisma.personalizationProfile.upsert>>);

        const analytics = await getDashboardAnalytics({ userId: "user-with-consent" });

        expect(analytics.recommendation.isPersonalized).toBe(true);
        expect(analytics.recommendation.category).toBe("personalized");
        expect(analytics.recommendation.personalizationStatus).toBe("ready");
        expect(analytics.recommendation.primaryAction).toBeDefined();
        expect(analytics.recommendation.primaryAction?.title).toContain("Technical");
      });

      it("returns general guidance and does not derive from history when personalization consent is disabled", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce(mockSingleCompletedReport);

        vi.mocked(getUserConsent).mockResolvedValueOnce({
          ai_questions: true,
          ai_evaluation: true,
          resume_processing: false,
          saved_resume: false,
          personalization: false, // Consent disabled
          noticeVersion: "1.0",
          updatedAt: new Date(),
        });

        const analytics = await getDashboardAnalytics({ userId: "user-without-consent" });

        expect(analytics.recommendation.isPersonalized).toBe(false);
        expect(analytics.recommendation.category).toBe("general");
        expect(analytics.recommendation.personalizationStatus).toBe("disabled");
        expect(analytics.recommendation.guidance).toContain(
          "Personalization is off"
        );
      });

      it("returns general guidance when consent record is missing (defaults closed)", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce(mockSingleCompletedReport);

        vi.mocked(getUserConsent).mockResolvedValueOnce({
          ai_questions: false,
          ai_evaluation: false,
          resume_processing: false,
          saved_resume: false,
          personalization: false, // Missing record defaults to false
          noticeVersion: "1.0",
          updatedAt: new Date(0),
        });

        const analytics = await getDashboardAnalytics({ userId: "user-missing-consent" });

        expect(analytics.recommendation.isPersonalized).toBe(false);
        expect(analytics.recommendation.category).toBe("general");
      });

      it("returns general guidance when consent is withdrawn", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce(mockSingleCompletedReport);

        vi.mocked(getUserConsent).mockResolvedValueOnce({
          ai_questions: true,
          ai_evaluation: true,
          resume_processing: false,
          saved_resume: false,
          personalization: false, // Explicitly withdrawn
          noticeVersion: "1.0",
          updatedAt: new Date(),
        });

        const analytics = await getDashboardAnalytics({ userId: "user-withdrawn-consent" });

        expect(analytics.recommendation.isPersonalized).toBe(false);
        expect(analytics.recommendation.category).toBe("general");
      });

      it("fails closed to general guidance when consent service throws an error", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce(mockSingleCompletedReport);

        vi.mocked(getUserConsent).mockRejectedValueOnce(new Error("Database connection error"));

        const analytics = await getDashboardAnalytics({ userId: "user-error" });

        expect(analytics.recommendation.isPersonalized).toBe(false);
        expect(analytics.recommendation.category).toBe("general");
      });

      it("always returns non-personalized general guidance for guest sessions", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);
        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce(mockSingleCompletedReport);

        const analytics = await getDashboardAnalytics({ guestSessionId: "guest-test-123" });

        // Guest sessions never invoke getUserConsent
        expect(getUserConsent).not.toHaveBeenCalled();
        expect(analytics.recommendation.isPersonalized).toBe(false);
        expect(analytics.recommendation.category).toBe("general");
      });
    });

    describe("Audit: Cross-Mode Trends & Rubric Versions", () => {
      it("handles mixed-mode reports without conflating baseline progression across different modes", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(2);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([
          { interviewType: "technical", _count: { _all: 1 } },
          { interviewType: "behavioral", _count: { _all: 1 } },
        ] as unknown as Awaited<ReturnType<typeof prisma.interview.groupBy>>);

        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
          {
            id: "rep-1",
            interviewId: "int-1",
            overallScore: 65,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-10T10:00:00Z"),
            dimensionScores: [],
            interview: {
              id: "int-1",
              interviewType: "technical",
              role: "SWE",
              difficulty: "easy",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
          {
            id: "rep-2",
            interviewId: "int-2",
            overallScore: 90,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-12T10:00:00Z"),
            dimensionScores: [],
            interview: {
              id: "int-2",
              interviewType: "behavioral",
              role: "SWE",
              difficulty: "medium",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
        ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

        const analytics = await getDashboardAnalytics({ userId: "user-1" });

        expect(analytics.trends.hasComparableData).toBe(true);
        // Must NOT claim an observed progression from 65 to 90 as baseline change
        expect(analytics.trends.trendSummary).not.toContain("from your baseline");
        expect(analytics.trends.trendSummary).toContain("multiple interview modes");
        expect(analytics.trends.trendSummary).toContain("filter by individual mode");
      });

      it("handles reports with mixed rubric versions by flagging differing rubric versions and preserving historical scores without recalculation", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(2);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);

        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
          {
            id: "rep-1",
            interviewId: "int-1",
            overallScore: 75,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            dimensionScores: [],
            interview: {
              id: "int-1",
              interviewType: "technical",
              role: "SWE",
              difficulty: "easy",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
          {
            id: "rep-2",
            interviewId: "int-2",
            overallScore: 85,
            rubricVersion: "2.0",
            createdAt: new Date("2026-10-18T10:00:00Z"),
            dimensionScores: [],
            interview: {
              id: "int-2",
              interviewType: "technical",
              role: "SWE",
              difficulty: "easy",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
        ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

        const analytics = await getDashboardAnalytics({ userId: "user-1" });

        // Historical scores are preserved
        expect(analytics.trends.scoreTrajectory[0].overallScore).toBe(75);
        expect(analytics.trends.scoreTrajectory[0].rubricVersion).toBe("1.0");
        expect(analytics.trends.scoreTrajectory[1].overallScore).toBe(85);
        expect(analytics.trends.scoreTrajectory[1].rubricVersion).toBe("2.0");

        // Notice notes multiple rubric versions
        expect(analytics.trends.minimumDataNotice).toContain("multiple rubric versions");
        expect(analytics.trends.minimumDataNotice).toContain("v1.0");
        expect(analytics.trends.minimumDataNotice).toContain("v2.0");
        expect(analytics.trends.minimumDataNotice).toContain("not recalculated");
      });
    });

    describe("Audit: Strongest Dimension Safeguards", () => {
      it("returns null for strongest dimension if fewer than 2 dimensions are evaluated (insufficient evidence)", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);

        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
          {
            id: "rep-1",
            interviewId: "int-1",
            overallScore: 80,
            rubricVersion: "1.0",
            createdAt: new Date(),
            dimensionScores: [
              {
                dimension: "technical_correctness",
                score: 80,
                status: "scored",
              },
              // All other dimensions are not_applicable or insufficient_evidence
            ],
            interview: {
              id: "int-1",
              interviewType: "technical",
              role: "SWE",
              difficulty: "medium",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
        ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

        const analytics = await getDashboardAnalytics({ userId: "user-1" });

        // Cannot declare a strongest dimension when only 1 dimension was evaluated
        expect(analytics.metrics.strongestDimension).toBeNull();
      });

      it("returns null for strongest dimension if top dimensions have tied scores (no unique universal strength)", async () => {
        vi.mocked(prisma.interview.count).mockResolvedValueOnce(1);
        vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.interview.groupBy).mockResolvedValueOnce([]);

        vi.mocked(prisma.interviewReport.findMany).mockResolvedValueOnce([
          {
            id: "rep-1",
            interviewId: "int-1",
            overallScore: 85,
            rubricVersion: "1.0",
            createdAt: new Date(),
            dimensionScores: [
              {
                dimension: "technical_correctness",
                score: 85,
                status: "scored",
              },
              {
                dimension: "answer_structure",
                score: 85, // Tied with technical_correctness
                status: "scored",
              },
            ],
            interview: {
              id: "int-1",
              interviewType: "technical",
              role: "SWE",
              difficulty: "medium",
              createdAt: new Date(),
              endedAt: new Date(),
            },
          },
        ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

        const analytics = await getDashboardAnalytics({ userId: "user-1" });

        // Tied scores must return null neutral fallback rather than an arbitrary winner
        expect(analytics.metrics.strongestDimension).toBeNull();
      });
    });
  });
});

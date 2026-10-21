// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOrCompilePersonalizationProfile,
  purgePersonalizationProfile,
} from "./service";
import { compilePersonalizationProfile } from "./compiler";
import { ValidatedEligibleReport } from "./eligibility";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";

describe("Milestone 9 - Cross-Session Personalization Service", () => {
  const mockUserId = "candidate-uuid-101";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCompilePersonalizationProfile", () => {
    it("returns guest_restricted when candidate is an unauthenticated guest", async () => {
      const result = await getOrCompilePersonalizationProfile({
        userId: null,
        guestSessionId: "guest-session-uuid",
      });

      expect(result.status).toBe("guest_restricted");
      expect(result.data).toBeNull();
      expect(result.eligibleReportCount).toBe(0);
      expect(result.requiredReportCount).toBe(3);
    });

    it("returns disabled when authenticated candidate has not granted personalization consent", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-1",
        userId: mockUserId,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.userConsent.findUnique>>);

      const result = await getOrCompilePersonalizationProfile({
        userId: mockUserId,
        guestSessionId: null,
      });

      expect(result.status).toBe("disabled");
      expect(result.data).toBeNull();
    });

    it("returns insufficient_evidence when candidate has granted consent but has fewer than 3 post-consent reports", async () => {
      const consentGrantDate = new Date("2026-10-18T10:00:00Z");

      // 1. Consent check: granted in UserConsent
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-1",
        userId: mockUserId,
        consentPersonalization: true,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.userConsent.findUnique>>);

      // 2. Audit log active grant check
      vi.spyOn(prisma.consentAuditLog, "findFirst").mockResolvedValueOnce({
        id: "log-1",
        userId: mockUserId,
        guestSessionId: null,
        purpose: "personalization",
        action: "granted",
        noticeVersion: "1.0",
        timestamp: consentGrantDate,
        ipAddress: null,
        userAgent: null,
      } as unknown as Awaited<ReturnType<typeof prisma.consentAuditLog.findFirst>>);

      // 3. Find eligible reports: only 2 completed post-consent
      vi.spyOn(prisma.interviewReport, "findMany").mockResolvedValueOnce([
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 82,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T11:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "Software Engineer",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T10:55:00Z"),
          },
          dimensionScores: [],
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          overallScore: 78,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T12:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "Software Engineer",
            difficulty: "hard",
            endedAt: new Date("2026-10-18T11:55:00Z"),
          },
          dimensionScores: [],
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

      const result = await getOrCompilePersonalizationProfile({
        userId: mockUserId,
        guestSessionId: null,
      });

      expect(result.status).toBe("insufficient_evidence");
      expect(result.data).toBeNull();
      expect(result.eligibleReportCount).toBe(2);
      expect(result.requiredReportCount).toBe(3);
    });

    it("strictly excludes pre-consent reports from the 3-session threshold", async () => {
      const consentGrantDate = new Date("2026-10-18T10:00:00Z");

      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-1",
        userId: mockUserId,
        consentPersonalization: true,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.userConsent.findUnique>>);

      vi.spyOn(prisma.consentAuditLog, "findFirst").mockResolvedValueOnce({
        id: "log-1",
        userId: mockUserId,
        guestSessionId: null,
        purpose: "personalization",
        action: "granted",
        noticeVersion: "1.0",
        timestamp: consentGrantDate,
        ipAddress: null,
        userAgent: null,
      } as unknown as Awaited<ReturnType<typeof prisma.consentAuditLog.findFirst>>);

      const findManySpy = vi.spyOn(prisma.interviewReport, "findMany") as unknown as {
        mockImplementation: (fn: (args: Prisma.InterviewReportFindManyArgs) => Promise<unknown>) => void;
      };

      findManySpy.mockImplementation(async (args: Prisma.InterviewReportFindManyArgs) => {
        const whereObj = args?.where as { createdAt?: { gte?: Date } };
        const gteTime = whereObj?.createdAt?.gte;
        expect(gteTime).toEqual(consentGrantDate);
        return [
          {
            id: "rep-post-1",
            interviewId: "int-1",
            overallScore: 85,
            rubricVersion: "1.0",
            createdAt: new Date("2026-10-18T11:00:00Z"),
            interview: {
              interviewType: "technical",
              role: "Frontend Engineer",
              difficulty: "medium",
              endedAt: new Date("2026-10-18T10:55:00Z"),
            },
            dimensionScores: [],
          },
        ];
      });

      const result = await getOrCompilePersonalizationProfile({
        userId: mockUserId,
        guestSessionId: null,
      });

      expect(result.status).toBe("insufficient_evidence");
      expect(result.eligibleReportCount).toBe(1);
    });

    it("compiles, validates, caches, and returns ready profile when >= 3 post-consent reports exist", async () => {
      const consentGrantDate = new Date("2026-10-18T10:00:00Z");

      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValue({
        id: "c-1",
        userId: mockUserId,
        consentPersonalization: true,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.userConsent.findUnique>>);

      vi.spyOn(prisma.consentAuditLog, "findFirst").mockResolvedValue({
        id: "log-1",
        userId: mockUserId,
        guestSessionId: null,
        purpose: "personalization",
        action: "granted",
        noticeVersion: "1.0",
        timestamp: consentGrantDate,
        ipAddress: null,
        userAgent: null,
      } as unknown as Awaited<ReturnType<typeof prisma.consentAuditLog.findFirst>>);

      // No cached profile
      vi.spyOn(prisma.personalizationProfile, "findUnique").mockResolvedValueOnce(null);

      // 3 eligible reports
      const mockReports = [
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 70,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T11:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "Full Stack Engineer",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T10:50:00Z"),
          },
          dimensionScores: [
            { dimension: "technical_correctness", score: 65, status: "scored", feedback: "Missing concurrency handling" },
            { dimension: "communication_speech", score: 85, status: "scored", feedback: "Clear verbal articulation" },
          ],
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          overallScore: 72,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T12:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "Full Stack Engineer",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T11:50:00Z"),
          },
          dimensionScores: [
            { dimension: "technical_correctness", score: 68, status: "scored", feedback: "Edge cases omitted" },
            { dimension: "communication_speech", score: 88, status: "scored", feedback: "Good structure" },
          ],
        },
        {
          id: "rep-3",
          interviewId: "int-3",
          overallScore: 75,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T13:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "Full Stack Engineer",
            difficulty: "hard",
            endedAt: new Date("2026-10-18T12:50:00Z"),
          },
          dimensionScores: [
            { dimension: "technical_correctness", score: 70, status: "scored", feedback: "Logic flaw in binary search" },
            { dimension: "communication_speech", score: 86, status: "scored", feedback: "Active listening" },
          ],
        },
      ];

      vi.spyOn(prisma.interviewReport, "findMany").mockResolvedValueOnce(
        mockReports as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>
      );

      // Upsert mock
      const upsertSpy = vi.spyOn(prisma.personalizationProfile, "upsert").mockResolvedValueOnce({
        id: "prof-1",
        userId: mockUserId,
        status: "ready",
        schemaVersion: "1.0",
        consentGrantedAt: consentGrantDate,
        consentNoticeVersion: "1.0",
        eligibleReportCount: 3,
        eligibleReportIds: ["rep-1", "rep-2", "rep-3"],
        compiledAt: new Date(),
        lastRefreshedAt: new Date(),
        profileData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.personalizationProfile.upsert>>);

      const result = await getOrCompilePersonalizationProfile({
        userId: mockUserId,
        guestSessionId: null,
      });

      expect(result.status).toBe("ready");
      expect(result.data).not.toBeNull();
      expect(result.eligibleReportCount).toBe(3);
      expect(upsertSpy).toHaveBeenCalledTimes(1);

      // Verify recurring patterns: communication_speech is strength (3 obs, avg 86.3 >= 80)
      const strength = result.data?.recurringStrengths.find(
        (s) => s.dimension === "communication_speech"
      );
      expect(strength).toBeDefined();
      expect(strength?.observationCount).toBe(3);

      // technical_correctness is recurring improvement (3 obs, avg 67.7 < 75)
      const improvement = result.data?.recurringImprovementAreas.find(
        (i) => i.dimension === "technical_correctness"
      );
      expect(improvement).toBeDefined();
      expect(improvement?.observationCount).toBe(3);

      // Primary recommendation targets technical_correctness
      expect(result.data?.primaryRecommendation?.dimension).toBe("technical_correctness");
      expect(result.data?.primaryRecommendation?.supportingReportIds).toEqual([
        "rep-1",
        "rep-2",
        "rep-3",
      ]);
    });

    it("aborts persistence if consent is withdrawn while compiling (race condition safety)", async () => {
      const consentGrantDate = new Date("2026-10-18T10:00:00Z");

      // Initial consent check passes
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-1",
        userId: mockUserId,
        consentPersonalization: true,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.userConsent.findUnique>>);

      vi.spyOn(prisma.consentAuditLog, "findFirst")
        .mockResolvedValueOnce({
          id: "log-1",
          userId: mockUserId,
          guestSessionId: null,
          purpose: "personalization",
          action: "granted",
          noticeVersion: "1.0",
          timestamp: consentGrantDate,
          ipAddress: null,
          userAgent: null,
        } as unknown as Awaited<ReturnType<typeof prisma.consentAuditLog.findFirst>>)
        .mockResolvedValueOnce(null); // second call during pre-commit check (withdrawn)

      vi.spyOn(prisma.personalizationProfile, "findUnique").mockResolvedValueOnce(null);

      vi.spyOn(prisma.interviewReport, "findMany").mockResolvedValueOnce([
        {
          id: "rep-1",
          interviewId: "int-1",
          overallScore: 80,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T11:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "SWE",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T10:55:00Z"),
          },
          dimensionScores: [{ dimension: "technical_correctness", score: 80, status: "scored" }],
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          overallScore: 82,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T12:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "SWE",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T11:55:00Z"),
          },
          dimensionScores: [{ dimension: "technical_correctness", score: 82, status: "scored" }],
        },
        {
          id: "rep-3",
          interviewId: "int-3",
          overallScore: 84,
          rubricVersion: "1.0",
          createdAt: new Date("2026-10-18T13:00:00Z"),
          interview: {
            interviewType: "technical",
            role: "SWE",
            difficulty: "medium",
            endedAt: new Date("2026-10-18T12:55:00Z"),
          },
          dimensionScores: [{ dimension: "technical_correctness", score: 84, status: "scored" }],
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.interviewReport.findMany>>);

      const upsertSpy = vi.spyOn(prisma.personalizationProfile, "upsert");

      const result = await getOrCompilePersonalizationProfile({
        userId: mockUserId,
        guestSessionId: null,
      });

      expect(result.status).toBe("disabled");
      expect(result.data).toBeNull();
      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });

  describe("purgePersonalizationProfile", () => {
    it("deletes personalization profile records for the specified user", async () => {
      const deleteSpy = vi
        .spyOn(prisma.personalizationProfile, "deleteMany")
        .mockResolvedValueOnce({ count: 1 } as unknown as Awaited<ReturnType<typeof prisma.personalizationProfile.deleteMany>>);

      await purgePersonalizationProfile(mockUserId);

      expect(deleteSpy).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });
  });

  describe("compilePersonalizationProfile deterministic logic", () => {
    it("requires at least 2 observations for a recurring pattern (single observation is not recurring)", () => {
      const reports = [
        {
          id: "rep-1",
          interviewId: "int-1",
          interviewMode: "technical",
          role: "Developer",
          difficulty: "medium",
          overallScore: 85,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T10:00:00Z"),
          dimensionScores: [
            { dimension: "technical_correctness", score: 60, status: "scored", feedback: "Single weak score" },
            { dimension: "communication_speech", score: 90, status: "scored", feedback: "Great articulation" },
          ],
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          interviewMode: "technical",
          role: "Developer",
          difficulty: "medium",
          overallScore: 88,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T11:00:00Z"),
          dimensionScores: [
            { dimension: "technical_correctness", score: 85, status: "scored", feedback: "Back to normal" },
            { dimension: "communication_speech", score: 92, status: "scored", feedback: "Clear and structured" },
          ],
        },
        {
          id: "rep-3",
          interviewId: "int-3",
          interviewMode: "technical",
          role: "Developer",
          difficulty: "medium",
          overallScore: 86,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T12:00:00Z"),
          dimensionScores: [
            { dimension: "technical_correctness", score: 85, status: "scored", feedback: "Solid" },
            { dimension: "communication_speech", score: 91, status: "scored", feedback: "Eloquent" },
          ],
        },
      ];

      const profile = compilePersonalizationProfile(
        mockUserId,
        new Date(),
        reports as unknown as ValidatedEligibleReport[]
      );
      expect(profile).not.toBeNull();

      // Communication has 3 observations, avg 91 >= 80 -> recurring strength
      expect(profile!.recurringStrengths.some((s) => s.dimension === "communication_speech")).toBe(true);

      // Technical correctness avg is (60 + 85 + 85)/3 = 76.7 (not < 75), and only 1 weak score
      expect(profile!.recurringImprovementAreas.some((i) => i.dimension === "technical_correctness")).toBe(false);
    });

    it("does not penalize unmeasured dimensions as zero in aggregates", () => {
      const reports = [
        {
          id: "rep-1",
          interviewId: "int-1",
          interviewMode: "technical",
          role: "Developer",
          difficulty: "medium",
          overallScore: 90,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T10:00:00Z"),
          dimensionScores: [{ dimension: "technical_correctness", score: 90, status: "scored" }],
        },
        {
          id: "rep-2",
          interviewId: "int-2",
          interviewMode: "behavioral",
          role: "Developer",
          difficulty: "medium",
          overallScore: 92,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T11:00:00Z"),
          // No technical_correctness in behavioral interview
          dimensionScores: [{ dimension: "communication_speech", score: 92, status: "scored" }],
        },
        {
          id: "rep-3",
          interviewId: "int-3",
          interviewMode: "technical",
          role: "Developer",
          difficulty: "medium",
          overallScore: 88,
          rubricVersion: "1.0",
          completedAt: new Date("2026-10-18T12:00:00Z"),
          dimensionScores: [{ dimension: "technical_correctness", score: 88, status: "scored" }],
        },
      ];

      const profile = compilePersonalizationProfile(
        mockUserId,
        new Date(),
        reports as unknown as ValidatedEligibleReport[]
      );
      expect(profile).not.toBeNull();

      const techEvidence = profile!.dimensionAggregates.find(
        (d) => d.dimension === "technical_correctness"
      );
      expect(techEvidence).toBeDefined();
      expect(techEvidence?.observationCount).toBe(2);
      // Average should be (90 + 88) / 2 = 89, NOT (90 + 0 + 88) / 3 = 59.3
      expect(techEvidence?.averageScore).toBe(89);
    });
  });
});

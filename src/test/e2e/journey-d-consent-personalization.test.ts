// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCompilePersonalizationProfile } from "@/server/personalization/service";
import { grantConsent, withdrawConsent } from "@/server/consent/service";

interface MockConsentRecord {
  userId: string;
  consentAiQuestions: boolean;
  consentAiEvaluation: boolean;
  consentResumeProcessing: boolean;
  consentSavedResume: boolean;
  consentPersonalization: boolean;
  noticeVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAuditLog {
  id: string;
  userId: string;
  purpose: string;
  action: string;
  noticeVersion: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

// In-memory store
vi.mock("@/server/db", () => {
  const userConsents = new Map<string, MockConsentRecord>();
  const auditLogs: MockAuditLog[] = [];
  const profiles = new Map<string, Record<string, unknown>>();
  const reports = new Map<string, Record<string, unknown>>();

  const mockPrisma = {
    userConsent: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => userConsents.get(where.userId) || null),
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => userConsents.get(where.userId) || null),
      upsert: vi.fn().mockImplementation(async ({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        let rec = userConsents.get(where.userId);
        if (!rec) {
          rec = {
            userId: where.userId,
            consentAiQuestions: false,
            consentAiEvaluation: false,
            consentResumeProcessing: false,
            consentSavedResume: false,
            consentPersonalization: false,
            noticeVersion: "1.0",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          } as MockConsentRecord;
        } else {
          Object.assign(rec, update, { updatedAt: new Date() });
        }
        userConsents.set(where.userId, rec);
        return rec;
      }),
    },
    consentAuditLog: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Omit<MockAuditLog, "id" | "timestamp"> & { timestamp?: Date } }) => {
        const log: MockAuditLog = {
          id: `log-${auditLogs.length + 1}`,
          timestamp: data.timestamp || new Date(),
          ...data,
        };
        auditLogs.push(log);
        return log;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where, orderBy }: { where: Partial<MockAuditLog>; orderBy?: { timestamp: string } }) => {
        const filtered = auditLogs.filter((l) => {
          if (where.userId && l.userId !== where.userId) return false;
          if (where.purpose && l.purpose !== where.purpose) return false;
          if (where.action && l.action !== where.action) return false;
          return true;
        });
        if (orderBy?.timestamp === "desc") {
          filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        }
        return filtered[0] || null;
      }),
    },
    personalizationProfile: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => profiles.get(where.userId) || null),
      deleteMany: vi.fn().mockImplementation(async ({ where }: { where: { userId?: string } }) => {
        let count = 0;
        if (where.userId && profiles.has(where.userId)) {
          profiles.delete(where.userId);
          count++;
        }
        return { count };
      }),
      upsert: vi.fn().mockImplementation(async ({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        let p = profiles.get(where.userId);
        if (!p) {
          p = { id: `prof-${Math.random()}`, userId: where.userId, ...create, createdAt: new Date() };
        } else {
          Object.assign(p, update, { updatedAt: new Date() });
        }
        profiles.set(where.userId, p);
        return p;
      }),
    },
    interviewReport: {
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { userId?: string; status?: string; interview?: { endedAt?: { gte?: Date } } } }) => {
        const results: Record<string, unknown>[] = [];
        for (const rep of reports.values()) {
          if (where.userId && rep.userId !== where.userId) continue;
          if (where.status && rep.status !== where.status) continue;
          if (where.interview?.endedAt?.gte) {
            const intData = rep.interview as { endedAt?: Date } | undefined;
            const endedAt = intData?.endedAt || (rep.createdAt as Date);
            if (endedAt < where.interview.endedAt.gte) continue;
          }
          results.push(rep);
        }
        return results;
      }),
    },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
    _storage: {
      userConsents,
      auditLogs,
      profiles,
      reports,
    },
  };

  return { prisma: mockPrisma };
});

describe("Milestone 10 — Journey D: Consent and Personalization", () => {
  const candidateA = { userId: "usr-consent-candA" };
  const candidateB = { userId: "usr-consent-candB" };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/server/db");
    const storage = (prisma as unknown as {
      _storage: {
        userConsents: Map<string, unknown>;
        auditLogs: unknown[];
        profiles: Map<string, unknown>;
        reports: Map<string, unknown>;
      };
    })._storage;
    storage.userConsents.clear();
    storage.auditLogs.length = 0;
    storage.profiles.clear();
    storage.reports.clear();
  });

  it("enforces default-off, 3-report threshold, user scoping, immediate withdrawal purge, and re-consent boundary", async () => {
    // 1. Verify personalization defaults to off
    const initialProfile = await getOrCompilePersonalizationProfile(candidateA);
    expect(initialProfile.status).toBe("disabled");
    expect(initialProfile.isPersonalized).toBe(false);
    expect(initialProfile.fallbackGuidance).toContain("Personalization is off");

    // 2. Grant personalization consent
    await grantConsent(candidateA.userId, ["personalization"], {
      noticeVersion: "1.0",
      ipAddress: "127.0.0.1",
    });

    // 3. Add 1 post-consent report (fewer than 3 threshold)
    const { prisma } = await import("@/server/db");
    const rep1 = {
      id: "rep-001",
      userId: candidateA.userId,
      status: "completed",
      overallScore: 82,
      createdAt: new Date(),
      dimensionEvaluations: [
        { dimension: "technical_correctness", score: 85, status: "scored", observations: "Strong coding." },
        { dimension: "answer_quality", score: 80, status: "scored", observations: "Good depth." },
      ],
      strengths: ["Strong problem decomposition"],
      improvements: ["Elaborate on edge cases"],
      nextStepRecommendation: "Practice system design fundamentals",
      interview: {
        id: "int-001",
        interviewType: "technical",
        role: "Software Engineer",
        difficulty: "medium",
        endedAt: new Date(),
      },
    };
    const storage = (prisma as unknown as {
      _storage: {
        reports: Map<string, unknown>;
        profiles: Map<string, unknown>;
      };
    })._storage;
    storage.reports.set(rep1.id, rep1);

    const insufficientProfile = await getOrCompilePersonalizationProfile(candidateA);
    expect(insufficientProfile.status).toBe("insufficient_evidence");
    expect(insufficientProfile.isPersonalized).toBe(false);
    expect(insufficientProfile.eligibleReportCount).toBe(1);
    expect(insufficientProfile.requiredReportCount).toBe(3);
    expect(insufficientProfile.fallbackGuidance).toContain("1 of 3 completed");

    // 4. Add candidate B's report (User Scoping Check)
    const repB = {
      id: "rep-candB",
      userId: candidateB.userId,
      status: "completed",
      overallScore: 95,
      createdAt: new Date(),
      dimensionEvaluations: [
        { dimension: "technical_correctness", score: 95, status: "scored", observations: "Candidate B." },
      ],
      strengths: ["Candidate B strength"],
      improvements: [],
      nextStepRecommendation: "Advanced topics",
      interview: {
        id: "int-candB",
        interviewType: "technical",
        role: "Staff Engineer",
        difficulty: "hard",
        endedAt: new Date(),
      },
    };
    storage.reports.set(repB.id, repB);

    // Candidate A's profile is strictly scoped to candidate A
    const scopedProfile = await getOrCompilePersonalizationProfile(candidateA);
    expect(scopedProfile.eligibleReportCount).toBe(1); // Still 1, NOT 2

    // 5. Add 2 more reports for candidate A (reaching exactly 3 post-consent reports)
    const rep2 = {
      id: "rep-002",
      userId: candidateA.userId,
      status: "completed",
      overallScore: 84,
      createdAt: new Date(),
      dimensionEvaluations: [
        { dimension: "technical_correctness", score: 88, status: "scored", observations: "Algorithms." },
        { dimension: "answer_quality", score: 82, status: "scored", observations: "Clear depth." },
      ],
      strengths: ["Algorithm clarity"],
      improvements: ["Time complexity analysis"],
      nextStepRecommendation: "Review dynamic programming",
      interview: {
        id: "int-002",
        interviewType: "technical",
        role: "Software Engineer",
        difficulty: "medium",
        endedAt: new Date(),
      },
    };
    const rep3 = {
      id: "rep-003",
      userId: candidateA.userId,
      status: "completed",
      overallScore: 86,
      createdAt: new Date(),
      dimensionEvaluations: [
        { dimension: "technical_correctness", score: 86, status: "scored", observations: "Concurrency." },
        { dimension: "answer_quality", score: 85, status: "scored", observations: "Solid reasoning." },
      ],
      strengths: ["Concurrency principles"],
      improvements: ["Mention memory consistency models"],
      nextStepRecommendation: "Explore distributed systems",
      interview: {
        id: "int-003",
        interviewType: "technical",
        role: "Software Engineer",
        difficulty: "medium",
        endedAt: new Date(),
      },
    };
    storage.reports.set(rep2.id, rep2);
    storage.reports.set(rep3.id, rep3);

    const compiledProfile = await getOrCompilePersonalizationProfile(candidateA);
    expect(compiledProfile.status).toBe("ready");
    expect(compiledProfile.isPersonalized).toBe(true);
    expect(compiledProfile.eligibleReportCount).toBe(3);
    expect(compiledProfile.data).not.toBeNull();
    expect(compiledProfile.data?.primaryRecommendation).toBeDefined();

    // 6. Withdraw consent and verify immediate profile purge
    await withdrawConsent(candidateA.userId, ["personalization"], {
      noticeVersion: "1.0",
      ipAddress: "127.0.0.1",
    });

    // Profile record in DB is immediately purged
    expect(storage.profiles.has(candidateA.userId)).toBe(false);

    // Profile retrieval immediately returns disabled
    const afterWithdrawal = await getOrCompilePersonalizationProfile(candidateA);
    expect(afterWithdrawal.status).toBe("disabled");
    expect(afterWithdrawal.isPersonalized).toBe(false);

    // 7. Re-consent starts a new eligibility window
    // Now grant consent again at current time
    await grantConsent(candidateA.userId, ["personalization"], {
      noticeVersion: "1.0",
      ipAddress: "127.0.0.1",
    });

    // Even though candidate A has 3 historical reports in DB, they were completed BEFORE this fresh grant timestamp
    // Therefore, eligibleReportCount is 0, NOT 3!
    const reconsentProfile = await getOrCompilePersonalizationProfile(candidateA);
    expect(reconsentProfile.status).toBe("insufficient_evidence");
    expect(reconsentProfile.isPersonalized).toBe(false);
    expect(reconsentProfile.eligibleReportCount).toBe(0);
    expect(reconsentProfile.fallbackGuidance).toContain("0 of 3 completed");
  });
});

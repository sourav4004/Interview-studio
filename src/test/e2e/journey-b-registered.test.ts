// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentSession, ABSOLUTE_SESSION_MAX_AGE_MS } from "@/server/auth/session";
import { assertResourceAccess, AuthorizationError } from "@/server/auth/authorization";
import { getDashboardAnalytics, getInterviewHistory } from "@/server/dashboard/service";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock Better Auth
const mockGetSession = vi.fn();
const mockRevokeSession = vi.fn();

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
    },
  },
}));

// Mock Prisma database
vi.mock("@/server/db", () => {
  const users = new Map<string, Record<string, unknown>>();
  const interviews = new Map<string, Record<string, unknown>>();
  const reports = new Map<string, Record<string, unknown>>();

  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => users.get(where.id) || null),
      },
      interview: {
        findMany: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          const results: Record<string, unknown>[] = [];
          for (const item of interviews.values()) {
            if (where.userId && item.userId === where.userId) {
              results.push(item);
            }
          }
          return results;
        }),
        count: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          let count = 0;
          for (const item of interviews.values()) {
            if (where.userId && item.userId === where.userId) {
              count++;
            }
          }
          return count;
        }),
        groupBy: vi.fn().mockImplementation(async () => [
          {
            interviewType: "technical",
            _count: {
              _all: 1,
            },
          },
        ]),
      },
      interviewReport: {
        findMany: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          const results: Record<string, unknown>[] = [];
          for (const item of reports.values()) {
            if (where.userId && item.userId === where.userId) {
              results.push({
                ...item,
                interview: {
                  role: "Backend Engineer",
                  interviewType: "technical",
                  difficulty: "medium",
                  createdAt: new Date(),
                },
              });
            }
          }
          return results;
        }),
      },
      userConsent: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      personalizationProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      consentAuditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      _storage: {
        users,
        interviews,
        reports,
      },
    },
  };
});

describe("Milestone 10 — Journey B: Registered Candidate End-to-End", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles registration verification, session timeouts, interview completion, dashboard updates, and isolation", async () => {
    const candidateA = {
      id: "usr-candidate-001",
      email: "candidate.a@college.edu",
      name: "Candidate Alpha",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 1. Session verification & active login
    mockGetSession.mockResolvedValue({
      user: candidateA,
      session: {
        id: "sess-001",
        userId: candidateA.id,
        token: "tok-valid-alpha",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day sliding idle
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const activeSession = await getCurrentSession();
    expect(activeSession).not.toBeNull();
    expect(activeSession?.user.id).toBe(candidateA.id);
    expect(activeSession?.user.emailVerified).toBe(true);

    // 2. Absolute 30-day session cutoff verification
    mockGetSession.mockResolvedValue({
      user: candidateA,
      session: {
        id: "sess-expired-absolute",
        userId: candidateA.id,
        token: "tok-old",
        expiresAt: new Date(Date.now() + 10000),
        createdAt: new Date(Date.now() - (ABSOLUTE_SESSION_MAX_AGE_MS + 60000)), // 30 days + 1 min ago
        updatedAt: new Date(),
      },
    });

    const expiredCutoffSession = await getCurrentSession();
    expect(expiredCutoffSession).toBeNull();
    expect(mockRevokeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { token: "tok-old" },
      })
    );

    // 3. Candidate A starts and completes an interview
    const { prisma } = await import("@/server/db");
    const interviewA = {
      id: "interview-reg-001",
      userId: candidateA.id,
      guestSessionId: null,
      interviewType: "technical",
      role: "Backend Engineer",
      difficulty: "medium",
      status: "completed",
      durationMinutes: 10,
      questionCount: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
      report: {
        id: "report-reg-001",
        status: "completed",
        overallScore: 88,
        createdAt: new Date(),
      },
    };

    const storage = (prisma as unknown as { _storage: { interviews: Map<string, unknown>; reports: Map<string, unknown> } })._storage;
    storage.interviews.set(interviewA.id, interviewA);
    storage.reports.set(interviewA.report.id, {
      ...interviewA.report,
      interviewId: interviewA.id,
      userId: candidateA.id,
      guestSessionId: null,
      dimensionEvaluations: [
        {
          dimension: "technical_correctness",
          score: 90,
          status: "scored",
          observations: "Demonstrated strong knowledge of concurrency.",
        },
        {
          dimension: "answer_quality",
          score: 86,
          status: "scored",
          observations: "Clear architecture explanations.",
        },
      ],
      strengths: ["Strong backend concepts"],
      improvements: ["Elaborate on database indexing"],
      nextStepRecommendation: "Review database query optimization",
    });

    // 4. Verify candidate A's dashboard analytics and history update
    const dashboardA = await getDashboardAnalytics({ userId: candidateA.id });
    expect(dashboardA.metrics.totalCompleted).toBe(1);
    expect(dashboardA.metrics.recentScore).toBe(88);
    expect(dashboardA.metrics.averageScore).toBe(88);

    const historyA = await getInterviewHistory({ userId: candidateA.id }, { limit: 10, offset: 0 });
    expect(historyA.interviews.length).toBe(1);
    expect(historyA.interviews[0].id).toBe(interviewA.id);
    expect(historyA.interviews[0].report?.overallScore).toBe(88);

    // 5. Verify refresh / data persistence consistency
    const reloadedDashboard = await getDashboardAnalytics({ userId: candidateA.id });
    expect(reloadedDashboard.metrics.totalCompleted).toBe(1);
    expect(reloadedDashboard.metrics.recentScore).toBe(88);

    // 6. Cross-user isolation: Candidate B cannot access Candidate A's interview or report
    const candidateB = { id: "usr-candidate-002", email: "candidate.b@college.edu" };

    // Querying Candidate B's history produces 0 items
    const historyB = await getInterviewHistory({ userId: candidateB.id }, { limit: 10, offset: 0 });
    expect(historyB.interviews.length).toBe(0);

    // Direct resource ownership assertion fails when candidate B tries to access candidate A's interview
    expect(() =>
      assertResourceAccess({ userId: candidateB.id }, { userId: interviewA.userId })
    ).toThrow(AuthorizationError);

    // Direct resource ownership assertion passes for candidate A
    expect(() =>
      assertResourceAccess({ userId: candidateA.id }, { userId: interviewA.userId })
    ).not.toThrow();
  });
});

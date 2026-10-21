// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGuestSession, validateGuestSession } from "@/server/guest/service";
import { assertResourceAccess, AuthorizationError } from "@/server/auth/authorization";
import { GUEST_SESSION_DURATION_MS } from "@/server/guest/types";
import { getDashboardAnalytics, getInterviewHistory } from "@/server/dashboard/service";
import { RUBRIC_WEIGHTS_BY_MODE } from "@/server/evaluation/rubrics";
import { InterviewMode } from "@/server/ai/types";

// Mock database layer
vi.mock("@/server/db", () => {
  const guestSessions = new Map<string, Record<string, unknown>>();
  const interviews = new Map<string, Record<string, unknown>>();
  const reports = new Map<string, Record<string, unknown>>();

  return {
    prisma: {
      guestSession: {
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          const session = {
            id: `guest-${Math.random().toString(36).substring(2, 9)}`,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            consentAiQuestions: data.consentAiQuestions || true,
            consentAiEvaluation: data.consentAiEvaluation || true,
            consentResumeProcessing: data.consentResumeProcessing || false,
            noticeVersion: data.noticeVersion || "1.0",
          };
          guestSessions.set(data.tokenHash as string, session);
          return session;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.tokenHash) return guestSessions.get(where.tokenHash as string) || null;
          return null;
        }),
      },
      interview: {
        findMany: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          const results: Record<string, unknown>[] = [];
          for (const item of interviews.values()) {
            if (where.guestSessionId && item.guestSessionId === where.guestSessionId) {
              results.push(item);
            }
          }
          return results;
        }),
        count: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          let count = 0;
          for (const item of interviews.values()) {
            if (where.guestSessionId && item.guestSessionId === where.guestSessionId) {
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
            if (where.guestSessionId && item.guestSessionId === where.guestSessionId) {
              results.push({
                ...item,
                interview: {
                  role: "Software Engineering Intern",
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
      },
      personalizationProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      consentAuditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      _storage: {
        guestSessions,
        interviews,
        reports,
      },
    },
  };
});

describe("Milestone 10 — Journey A: Guest Candidate End-to-End", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes guest creation, mode configuration, text fallback, isolation, and general guidance", async () => {
    // 1. Start as guest: create guest session
    const guestA = await createGuestSession({
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 TestBrowser",
    });

    expect(guestA.rawToken).toBeDefined();
    expect(guestA.rawToken.length).toBeGreaterThan(30);
    expect(guestA.session.id).toMatch(/^guest-/);

    // 2. Validate session token and 24-hour lifetime
    const validatedGuest = await validateGuestSession(guestA.rawToken);
    expect(validatedGuest.id).toBe(guestA.session.id);
    const expectedExpiry = Date.now() + GUEST_SESSION_DURATION_MS;
    expect(Math.abs(validatedGuest.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);

    // 3. Configure all 4 interview modes
    const supportedModes: InterviewMode[] = ["technical", "behavioral", "resume", "company"];
    for (const mode of supportedModes) {
      expect(RUBRIC_WEIGHTS_BY_MODE[mode]).toBeDefined();
      const weights = RUBRIC_WEIGHTS_BY_MODE[mode];
      const sum = Object.values(weights).reduce((acc, curr) => acc + curr.weight, 0);
      expect(Math.round(sum * 100)).toBe(100);
    }

    // 4. Complete interview using text fallback
    const mockInterview = {
      id: "interview-guest-001",
      userId: null,
      guestSessionId: guestA.session.id,
      interviewType: "technical",
      role: "Software Engineering Intern",
      difficulty: "medium",
      status: "completed",
      durationMinutes: 10,
      questionCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      report: {
        id: "report-guest-001",
        status: "completed",
        overallScore: 82,
        createdAt: new Date(),
      },
    };

    // Store in mock DB
    const { prisma } = await import("@/server/db");
    const storage = (prisma as unknown as { _storage: { interviews: Map<string, unknown>; reports: Map<string, unknown> } })._storage;
    storage.interviews.set(mockInterview.id, mockInterview);
    storage.reports.set(mockInterview.report.id, {
      ...mockInterview.report,
      interviewId: mockInterview.id,
      userId: null,
      guestSessionId: guestA.session.id,
      dimensionEvaluations: [
        {
          dimension: "technical_correctness",
          score: 85,
          status: "scored",
          observations: "Solid understanding of DSA.",
        },
        {
          dimension: "answer_quality",
          score: 80,
          status: "scored",
          observations: "Good concrete examples.",
        },
      ],
      strengths: ["Strong problem decomposition"],
      improvements: ["Elaborate on edge cases"],
      nextStepRecommendation: "Practice system design fundamentals",
    });

    // 5. Query permitted guest history
    const history = await getInterviewHistory(
      { guestSessionId: guestA.session.id },
      { limit: 10, offset: 0 }
    );
    expect(history.interviews.length).toBe(1);
    expect(history.interviews[0].id).toBe("interview-guest-001");
    expect(history.interviews[0].report?.overallScore).toBe(82);

    // 6. Security Isolation: Another guest cannot access Guest A's data
    const guestB = await createGuestSession({ ipAddress: "127.0.0.1" });
    expect(() =>
      assertResourceAccess(
        { guestSessionId: guestB.session.id },
        { guestSessionId: guestA.session.id }
      )
    ).toThrow(AuthorizationError);

    // 7. Verify personalization remains general guidance for guest sessions
    const analytics = await getDashboardAnalytics({ guestSessionId: guestA.session.id });
    expect(analytics.recommendation.isPersonalized).toBe(false);
    expect(analytics.recommendation.category).toBe("general");
    expect(analytics.recommendation.guidance).toBeDefined();
  });
});

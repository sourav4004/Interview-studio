// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as actorModule from "@/server/auth/actor";
import * as dashboardService from "@/server/dashboard";

vi.mock("@/server/auth/actor");
vi.mock("@/server/dashboard");

describe("GET /api/interviews/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when request lacks valid authentication", async () => {
    vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
      userId: null,
      guestSessionId: null,
      isAuthenticated: false,
    });

    const req = new NextRequest("http://localhost:3000/api/interviews/dashboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 200 with dashboard analytics when authorized", async () => {
    vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
      userId: "user-123",
      guestSessionId: null,
      isAuthenticated: true,
    });

    const mockAnalytics: dashboardService.DashboardAnalytics = {
      metrics: {
        totalCompleted: 3,
        totalStarted: 4,
        recentScore: 88,
        averageScore: 82,
        strongestDimension: {
          dimension: "technical_correctness",
          label: "Technical Correctness",
          averageScore: 90,
        },
        modeCounts: {
          technical: 2,
          behavioral: 1,
          resume: 1,
          company: 0,
        },
      },
      recentInterviews: [],
      trends: {
        hasComparableData: true,
        minimumDataNotice: "Notice",
        trendSummary: "Summary",
        scoreTrajectory: [],
        dimensionAggregates: [],
      },
      recommendation: {
        isPersonalized: true,
        category: "personalized",
        guidance: "Your technical depth is solid.",
        lastUpdated: new Date("2026-10-18T10:00:00Z"),
      },
    };

    vi.spyOn(dashboardService, "getDashboardAnalytics").mockResolvedValueOnce(
      mockAnalytics
    );

    const req = new NextRequest("http://localhost:3000/api/interviews/dashboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.metrics.totalCompleted).toBe(3);
    expect(body.data.metrics.recentScore).toBe(88);
  });
});

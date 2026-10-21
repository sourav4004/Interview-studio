// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as actorModule from "@/server/auth/actor";
import * as dashboardService from "@/server/dashboard";

vi.mock("@/server/auth/actor");
vi.mock("@/server/dashboard");

describe("GET /api/interviews/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when request is not authenticated", async () => {
    vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
      userId: null,
      guestSessionId: null,
      isAuthenticated: false,
    });

    const req = new NextRequest("http://localhost:3000/api/interviews/history");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Authentication required");
  });

  it("parses query parameters and returns 200 with history results", async () => {
    vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
      userId: "user-1",
      guestSessionId: null,
      isAuthenticated: true,
    });

    const mockResult: dashboardService.HistoryResult = {
      interviews: [
        {
          id: "int-1",
          interviewType: "technical",
          status: "completed",
          role: "Cloud Engineer",
          difficulty: "hard",
          durationMinutes: 20,
          questionCount: 8,
          companyName: null,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          report: {
            id: "rep-1",
            status: "completed",
            overallScore: 90,
            rubricVersion: "1.0",
            createdAt: new Date(),
          },
        },
      ],
      pagination: {
        total: 1,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    };

    vi.spyOn(dashboardService, "getInterviewHistory").mockResolvedValueOnce(
      mockResult
    );

    const req = new NextRequest(
      "http://localhost:3000/api/interviews/history?limit=10&offset=0&mode=technical&status=completed"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.interviews).toHaveLength(1);
    expect(dashboardService.getInterviewHistory).toHaveBeenCalledWith(
      { userId: "user-1", guestSessionId: null, isAuthenticated: true },
      { limit: 10, offset: 0, mode: "technical", status: "completed" }
    );
  });
});

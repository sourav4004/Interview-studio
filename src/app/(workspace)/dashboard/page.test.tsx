import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

describe("Candidate Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders welcoming banner and 'Start Interview' CTA", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          metrics: {
            totalCompleted: 0,
            totalStarted: 0,
            recentScore: null,
            averageScore: null,
            strongestDimension: null,
            modeCounts: { technical: 0, behavioral: 0, resume: 0, company: 0 },
          },
          recentInterviews: [],
          trends: {
            hasComparableData: false,
            minimumDataNotice: "Notice",
            trendSummary: "Summary",
            scoreTrajectory: [],
            dimensionAggregates: [],
          },
          recommendation: {
            isPersonalized: false,
            category: "general",
            guidance: "Take a 10-minute diagnostic Technical or Behavioral interview.",
            lastUpdated: new Date("2026-10-18T10:00:00Z"),
          },
        },
      }),
    } as Response);

    render(<DashboardPage />);

    expect(
      screen.getByText("Candidate Placement Dashboard")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start interview/i })
    ).toBeInTheDocument();
  });

  it("renders metrics, trends, and recent interviews when data is returned", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          metrics: {
            totalCompleted: 2,
            totalStarted: 3,
            recentScore: 84,
            averageScore: 80,
            strongestDimension: {
              dimension: "technical_correctness",
              label: "Technical Correctness",
              averageScore: 88,
            },
            modeCounts: { technical: 2, behavioral: 1, resume: 0, company: 0 },
          },
          recentInterviews: [
            {
              id: "int-1",
              interviewType: "technical",
              status: "completed",
              role: "Full Stack Developer",
              difficulty: "medium",
              durationMinutes: 10,
              questionCount: 8,
              companyName: "Google",
              createdAt: new Date("2026-10-18T10:00:00Z"),
              startedAt: null,
              endedAt: null,
              report: {
                id: "rep-1",
                status: "completed",
                overallScore: 84,
                rubricVersion: "1.0",
                createdAt: new Date("2026-10-18T10:15:00Z"),
              },
            },
          ],
          trends: {
            hasComparableData: true,
            minimumDataNotice: "Notice",
            trendSummary: "Observed trajectory",
            scoreTrajectory: [
              {
                interviewId: "int-0",
                role: "Dev",
                mode: "technical",
                difficulty: "easy",
                completedAt: new Date("2026-10-10"),
                overallScore: 76,
                rubricVersion: "1.0",
              },
              {
                interviewId: "int-1",
                role: "Full Stack Developer",
                mode: "technical",
                difficulty: "medium",
                completedAt: new Date("2026-10-18"),
                overallScore: 84,
                rubricVersion: "1.0",
              },
            ],
            dimensionAggregates: [],
          },
          recommendation: {
            isPersonalized: true,
            category: "personalized",
            guidance: "Your technical depth is solid. Schedule a Behavioral simulation next.",
            lastUpdated: new Date("2026-10-18T10:15:00Z"),
          },
        },
      }),
    } as Response);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("84")).toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
      expect(screen.getByText("Full Stack Developer")).toBeInTheDocument();
      expect(screen.getByText("Google")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /view report/i })).toBeInTheDocument();
    });
  });

  it("displays recoverable error banner with retry option on API failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Database temporarily unavailable" }),
    } as Response);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load dashboard analytics")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Database temporarily unavailable")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });
});

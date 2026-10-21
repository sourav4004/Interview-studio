import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import HistoryPage from "./page";

describe("Interview History Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders history header and Start Interview action", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        interviews: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      }),
    } as Response);

    render(<HistoryPage />);

    expect(
      screen.getByRole("heading", { name: "Interview History" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start interview/i })
    ).toBeInTheDocument();
  });

  it("renders interview items with mode, role, status, and View Report button when completed", async () => {
    const mockData = {
      success: true,
      interviews: [
        {
          id: "int-101",
          interviewType: "technical",
          status: "completed",
          role: "Systems Architect",
          difficulty: "hard",
          durationMinutes: 20,
          questionCount: 8,
          companyName: "Amazon",
          createdAt: "2026-10-18T10:00:00.000Z",
          startedAt: null,
          endedAt: null,
          report: {
            id: "rep-101",
            status: "completed",
            overallScore: 92,
            rubricVersion: "1.0",
            createdAt: "2026-10-18T10:25:00.000Z",
          },
        },
        {
          id: "int-102",
          interviewType: "behavioral",
          status: "in_progress",
          role: "Product Manager",
          difficulty: "medium",
          durationMinutes: 10,
          questionCount: 5,
          companyName: null,
          createdAt: "2026-10-18T11:00:00.000Z",
          startedAt: null,
          endedAt: null,
          report: null,
        },
      ],
      pagination: { total: 2, limit: 10, offset: 0, hasMore: false },
    };

    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response)
    );

    render(<HistoryPage />);

    expect(await screen.findByText("Systems Architect")).toBeInTheDocument();
    expect(await screen.findByText("Amazon")).toBeInTheDocument();
    expect(await screen.findByText("92 / 100")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /view report for systems architect/i })
    ).toBeInTheDocument();

    expect(await screen.findByText("Product Manager")).toBeInTheDocument();
    expect(await screen.findByText("No score yet")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /resume interview for product manager/i })
    ).toBeInTheDocument();
  });

  it("displays helpful empty state when no interviews match", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        interviews: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No interviews match the selected criteria")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /start an interview/i })
      ).toBeInTheDocument();
    });
  });

  it("triggers refetch when mode filter buttons are clicked", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        interviews: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      }),
    } as Response);

    render(<HistoryPage />);

    const behavioralBtn = screen.getByRole("button", { name: "Behavioral" });
    fireEvent.click(behavioralBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("mode=behavioral"),
        expect.any(Object)
      );
    });
  });

  it("displays recoverable error banner with retry option on API failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to connect to database" }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load interview history")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Failed to connect to database")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });
});

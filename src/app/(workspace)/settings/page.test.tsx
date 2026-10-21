import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SettingsPage from "./page";

describe("Candidate Settings Page - Privacy & Personalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders settings with disabled personalization and enables opt-in on grant", async () => {
    // Initial fetch: consent off
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          personalization: false,
          consentGrantedAt: null,
          eligibleReportCount: 0,
          requiredReportCount: 3,
          savedResume: false,
        },
      }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Account & Privacy Settings")).toBeInTheDocument();
      expect(screen.getByText("Personalization Off")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /enable personalization/i })).toBeInTheDocument();
    });

    // Mock POST grant call
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          action: "granted",
          personalization: true,
          eligibleReportCount: 0,
          requiredReportCount: 3,
        },
      }),
    } as Response);

    // Mock subsequent fetchConsent call
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          personalization: true,
          consentGrantedAt: "2026-10-19T10:00:00.000Z",
          eligibleReportCount: 0,
          requiredReportCount: 3,
          savedResume: false,
        },
      }),
    } as Response);

    fireEvent.click(screen.getByRole("button", { name: /enable personalization/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "personalization", action: "grant" }),
      });
      expect(screen.getByText(/Historical-data personalization enabled/i)).toBeInTheDocument();
    });
  });

  it("displays progress counter when enabled and confirms withdrawal with immediate purge", async () => {
    // Initial fetch: consent on, 2 of 3 reports completed
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          personalization: true,
          consentGrantedAt: "2026-10-19T08:00:00.000Z",
          eligibleReportCount: 2,
          requiredReportCount: 3,
          savedResume: false,
        },
      }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Personalization Active")).toBeInTheDocument();
      expect(screen.getByText("Post-Consent Evidence Progress")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /withdraw personalization consent/i })).toBeInTheDocument();
    });

    // Click withdraw -> opens confirmation dialog
    fireEvent.click(screen.getByRole("button", { name: /withdraw personalization consent/i }));

    expect(screen.getByText("Confirm Consent Withdrawal & Profile Purge")).toBeInTheDocument();
    expect(
      screen.getByText(/Withdrawing consent will immediately delete your personalization profile/i)
    ).toBeInTheDocument();

    // Mock POST withdraw call
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          action: "withdrawn",
          personalization: false,
          purged: true,
        },
      }),
    } as Response);

    // Mock subsequent fetchConsent
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          personalization: false,
          consentGrantedAt: null,
          eligibleReportCount: 0,
          requiredReportCount: 3,
          savedResume: false,
        },
      }),
    } as Response);

    fireEvent.click(screen.getByRole("button", { name: /confirm & purge profile/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "personalization", action: "withdraw" }),
      });
      expect(screen.getByText(/Personalization consent withdrawn/i)).toBeInTheDocument();
    });
  });

  it("displays error banner on failure and retries on click", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to connect to database" }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Failed to connect to database")).toBeInTheDocument();
    });

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          personalization: false,
          consentGrantedAt: null,
          eligibleReportCount: 0,
          requiredReportCount: 3,
          savedResume: false,
        },
      }),
    } as Response);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Personalization Off")).toBeInTheDocument();
    });
  });
});

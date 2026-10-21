import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StartInterviewWizardPage from "./page";

describe("Start Interview Wizard UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders Step 1 with role input, modes, and difficulty selection by default", () => {
    render(<StartInterviewWizardPage />);

    expect(screen.getByRole("heading", { name: /start interview wizard/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1: choose role & interview mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target role \/ job title/i)).toBeInTheDocument();
    expect(screen.getByText("Technical Interview")).toBeInTheDocument();
    expect(screen.getByText("HR & Behavioral")).toBeInTheDocument();
    expect(screen.getByText("Resume-Based")).toBeInTheDocument();
    expect(screen.getByText("Company-Specific")).toBeInTheDocument();
  });

  it("prevents advancing if role is empty and displays accessible error", async () => {
    render(<StartInterviewWizardPage />);

    const roleInput = screen.getByLabelText(/target role \/ job title/i);
    fireEvent.change(roleInput, { target: { value: "" } });

    const nextBtn = screen.getByRole("button", { name: /next: duration & questions/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/please enter a target role/i)).toBeInTheDocument();
    expect(screen.queryByText(/step 2: duration & question count/i)).not.toBeInTheDocument();
  });

  it("preserves state when navigating forward and backward", async () => {
    render(<StartInterviewWizardPage />);

    // Step 1: change role and mode
    const roleInput = screen.getByLabelText(/target role \/ job title/i);
    fireEvent.change(roleInput, { target: { value: "Data Engineering Intern" } });

    const behavioralBtn = screen.getByText("HR & Behavioral");
    fireEvent.click(behavioralBtn);

    const nextBtn = screen.getByRole("button", { name: /next: duration & questions/i });
    fireEvent.click(nextBtn);

    // Step 2
    expect(screen.getByText(/step 2: duration & question count/i)).toBeInTheDocument();

    // Click back
    const backBtn = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backBtn);

    // Verify Step 1 values remained intact
    expect(screen.getByDisplayValue("Data Engineering Intern")).toBeInTheDocument();
  });

  it("enforces required AI consent before permitting submission in Step 4", async () => {
    render(<StartInterviewWizardPage />);

    // Step 1 -> 2
    fireEvent.click(screen.getByRole("button", { name: /next: duration & questions/i }));

    // Step 2 -> 3
    fireEvent.click(screen.getByRole("button", { name: /next: context & resume/i }));

    // Step 3 -> 4
    fireEvent.click(screen.getByRole("button", { name: /next: consent & review/i }));

    expect(screen.getByText(/step 4: privacy disclosures & review/i)).toBeInTheDocument();

    // Attempt submission without checking required consent
    const submitBtn = screen.getByRole("button", { name: /generate & start interview/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/explicit consent for ai question generation and evaluation is required/i)
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("successfully submits when valid and renders initialized interview questions", async () => {
    const mockInterview = {
      id: "int-abc",
      interviewType: "technical",
      role: "Software Engineering Intern",
      difficulty: "medium",
      durationMinutes: 10,
      questionCount: 2,
      questionSource: "gemini",
      questions: [
        {
          id: "q-1",
          questionText: "What are the trade-offs of microservices vs monolithic architecture?",
          category: "Architecture",
          timeLimitSeconds: 120,
        },
        {
          id: "q-2",
          questionText: "How do database indexes improve query execution speed?",
          category: "Databases",
          timeLimitSeconds: 120,
        },
      ],
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: mockInterview }),
    } as unknown as Response);

    render(<StartInterviewWizardPage />);

    // Step 1 -> 2
    fireEvent.click(screen.getByRole("button", { name: /next: duration & questions/i }));

    // Step 2 -> 3
    fireEvent.click(screen.getByRole("button", { name: /next: context & resume/i }));

    // Step 3 -> 4
    fireEvent.click(screen.getByRole("button", { name: /next: consent & review/i }));

    // Step 4: Check required consent
    const consentCheckbox = screen.getByLabelText(/required: ai question generation & evaluation/i);
    fireEvent.click(consentCheckbox);

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /generate & start interview/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/interview session initialized!/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/what are the trade-offs of microservices vs monolithic architecture\?/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/source: gemini ai/i)).toBeInTheDocument();
  });
});

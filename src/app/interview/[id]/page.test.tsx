import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InterviewRoomPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "int-test-1" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("InterviewRoomPage Full Integration", () => {
  const mockRoomData = {
    id: "int-test-1",
    userId: "user-1",
    guestSessionId: null,
    interviewType: "technical",
    status: "draft",
    role: "Fullstack Developer Intern",
    difficulty: "medium",
    durationMinutes: 10,
    questionCount: 2,
    companyName: null,
    isPracticeMode: false,
    currentQuestionIndex: 0,
    startedAt: null,
    endedAt: null,
    lastPausedAt: null,
    totalPauseDurationSeconds: 0,
    elapsedSeconds: 0,
    remainingSeconds: 600,
    isExpired: false,
    questions: [
      {
        id: "q-1",
        orderIndex: 1,
        questionText: "How does the virtual DOM improve React performance?",
        category: "Frontend",
        difficulty: "medium",
        source: "fallback",
        timeLimitSeconds: 120,
      },
      {
        id: "q-2",
        orderIndex: 2,
        questionText: "Explain indexing strategies for large databases.",
        category: "Databases",
        difficulty: "hard",
        source: "fallback",
        timeLimitSeconds: 120,
      },
    ],
    answers: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    if (typeof window !== "undefined" && typeof window.sessionStorage?.clear === "function") {
      window.sessionStorage.clear();
    }
  });

  it("loads and displays Ready state with pre-flight guidelines", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: mockRoomData }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    // Initially displays entering interview room
    expect(screen.getByText(/entering interview room\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /ready for your fullstack developer intern interview/i,
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/explicit microphone activation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start interview now/i })
    ).toBeInTheDocument();
  });

  it("starts interview session and displays active question and controls", async () => {
    // 1. Initial GET
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: mockRoomData }),
    } as unknown as Response);

    // 2. Start POST
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        interview: {
          ...mockRoomData,
          status: "in_progress",
          startedAt: new Date().toISOString(),
        },
      }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start interview now/i })).toBeInTheDocument();
    });

    // Click Start Interview
    fireEvent.click(screen.getByRole("button", { name: /start interview now/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/how does the virtual dom improve react performance\?/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip question/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("allows entering text answer and submitting to server", async () => {
    const inProgressRoom = {
      ...mockRoomData,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: inProgressRoom }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/how does the virtual dom improve react performance\?/i)
      ).toBeInTheDocument();
    });

    // Switch to Text Fallback mode
    const textModeBtn = screen.getByRole("button", { name: /text fallback/i });
    fireEvent.click(textModeBtn);

    // Type answer
    const textarea = screen.getByLabelText(/answer transcript and editor/i);
    fireEvent.change(textarea, {
      target: {
        value: "The virtual DOM batches updates and computes minimal DOM diffs.",
      },
    });

    // Mock answer submission POST
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        interview: {
          ...inProgressRoom,
          currentQuestionIndex: 1,
          answers: [
            {
              id: "ans-1",
              questionId: "q-1",
              transcript: "The virtual DOM batches updates...",
              status: "submitted",
            },
          ],
        },
      }),
    } as unknown as Response);

    // Confirm & Submit
    const submitBtn = screen.getByRole("button", { name: /confirm & submit/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Moves to question 2
      expect(
        screen.getByText(/explain indexing strategies for large databases\./i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
  });

  it("handles skipping a question with deliberate confirmation dialog", async () => {
    const inProgressRoom = {
      ...mockRoomData,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: inProgressRoom }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /skip question/i })).toBeInTheDocument();
    });

    // Click Skip Question
    fireEvent.click(screen.getByRole("button", { name: /skip question/i }));

    // Confirmation dialog should open
    expect(screen.getByText(/skip this question\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/skipped questions will be labeled as unanswered/i)
    ).toBeInTheDocument();

    // Mock skip POST
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        interview: {
          ...inProgressRoom,
          currentQuestionIndex: 1,
          answers: [
            {
              id: "ans-skip-1",
              questionId: "q-1",
              transcript: "",
              status: "skipped",
            },
          ],
        },
      }),
    } as unknown as Response);

    // Confirm skip
    const confirmSkipBtn = screen.getByRole("button", { name: /yes, skip question/i });
    fireEvent.click(confirmSkipBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/explain indexing strategies for large databases\./i)
      ).toBeInTheDocument();
    });
  });

  it("handles network failure gracefully by retaining draft in sessionStorage and showing retry banner", async () => {
    const inProgressRoom = {
      ...mockRoomData,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: inProgressRoom }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/how does the virtual dom improve react performance\?/i)
      ).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/answer transcript and editor/i);
    fireEvent.change(textarea, {
      target: { value: "My important answer text" },
    });

    // Simulate network failure on POST
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error("Failed to fetch (offline)")
    );

    const submitBtn = screen.getByRole("button", { name: /confirm & submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/your answer is saved locally\. click 'confirm & submit' to retry\./i)
    ).toBeInTheDocument();
    // Answer text is preserved
    expect(textarea).toHaveValue("My important answer text");
  });

  it("handles exit confirmation dialog and transitions to safely exited state", async () => {
    const inProgressRoom = {
      ...mockRoomData,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ interview: inProgressRoom }),
    } as unknown as Response);

    render(<InterviewRoomPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /exit/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /exit/i }));

    expect(screen.getByText(/exit interview session\?/i)).toBeInTheDocument();

    // Mock exit POST
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        interview: {
          ...inProgressRoom,
          status: "safely_exited",
        },
      }),
    } as unknown as Response);

    fireEvent.click(screen.getByRole("button", { name: /yes, exit session/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /interview safely exited/i })
      ).toBeInTheDocument();
    });
  });
});

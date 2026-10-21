import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import InterviewReportPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "int-123" }),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Interview Report Page Component", () => {
  const mockCompletedReport = {
    id: "rep-1",
    interviewId: "int-123",
    userId: "user-1",
    guestSessionId: null,
    status: "completed",
    overallScore: 84,
    summary: "The candidate demonstrated solid conceptual clarity and articulate communication.",
    scoreExplanation: "This score assesses responses across 2 questions.",
    strengths: ["Strong technical fundamentals", "Clear communication style"],
    improvements: ["Discuss edge cases earlier", "Elaborate on trade-offs"],
    primaryRecommendation: "Focus on deepening concurrency patterns.",
    dimensionScores: [
      {
        dimension: "answer_quality",
        label: "Answer Quality & Depth",
        score: 85,
        weight: 0.2,
        status: "scored",
        explanation: "Good depth of answers.",
        evidence: "Candidate explained concepts accurately.",
      },
      {
        dimension: "technical_correctness",
        label: "Technical Correctness",
        score: 90,
        weight: 0.35,
        status: "scored",
        explanation: "Precise terminology.",
        evidence: "Correct terminology used throughout.",
      },
      {
        dimension: "resume_consistency",
        label: "Resume Consistency",
        score: null,
        weight: 0,
        status: "not_applicable",
        explanation: "Resume consistency is not applicable to technical interview simulations.",
        evidence: "",
      },
    ],
    questionFeedback: [
      {
        questionId: "q-1",
        orderIndex: 0,
        questionText: "What is an index in PostgreSQL?",
        category: "Databases",
        candidateAnswer: "An index is a B-tree data structure that speeds up lookups.",
        answerStatus: "submitted",
        score: 85,
        explanation: "Accurate explanation of B-Trees.",
        evidence: "Cited B-tree logarithmic search time.",
        strengths: ["Clear terminology"],
        improvements: ["Mention composite indexes"],
        exampleAnswer: "A comprehensive answer explains B-Tree indexing and write trade-offs.",
      },
    ],
    modelIdentifier: "gemini-3.5-flash-lite",
    promptVersion: "1.0",
    rubricVersion: "1.0",
    schemaVersion: "1.0",
    evaluatedAnswersCount: 1,
    skippedAnswersCount: 0,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders report not generated state when API returns 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "NotFound" }),
    } as Response);

    render(<InterviewReportPage />);

    await waitFor(() => {
      expect(screen.getByText(/Interview Finished — Generate Your Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Generate Performance Report/i)).toBeInTheDocument();
    });
  });

  it("renders evaluating state when report status is processing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        report: {
          id: "rep-1",
          status: "processing",
        },
      }),
    } as Response);

    render(<InterviewReportPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/AI Interviewer Is Evaluating Your Responses/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Evaluation in progress/i)).toBeInTheDocument();
    });
  });

  it("renders failure recovery state when report status is failed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        report: {
          id: "rep-1",
          status: "failed",
          failureReason: "Gemini quota exceeded.",
        },
      }),
    } as Response);

    render(<InterviewReportPage />);

    await waitFor(() => {
      expect(screen.getByText(/Evaluation Could Not Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Gemini quota exceeded/i)).toBeInTheDocument();
      expect(screen.getByText(/Retry Evaluation/i)).toBeInTheDocument();
    });
  });

  it("renders full report with score, dimensions, strengths, and print button when completed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        report: mockCompletedReport,
      }),
    } as Response);

    render(<InterviewReportPage />);

    await waitFor(() => {
      expect(screen.getByText(/Interview Performance Report/i)).toBeInTheDocument();
      expect(screen.getByText("84")).toBeInTheDocument();
      expect(screen.getByText(/Proficient/i)).toBeInTheDocument();
      expect(screen.getByText(/Print \/ Save as PDF/i)).toBeInTheDocument();
    });

    // Check dimensions
    expect(screen.getByText(/Answer Quality & Depth/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Correctness/i)).toBeInTheDocument();
    expect(screen.getByText("Not Applicable")).toBeInTheDocument();

    // Check Strengths & Improvements
    expect(screen.getByText(/Strong technical fundamentals/i)).toBeInTheDocument();
    expect(screen.getByText(/Discuss edge cases earlier/i)).toBeInTheDocument();

    // Check Primary recommendation
    expect(screen.getByText(/Focus on deepening concurrency patterns/i)).toBeInTheDocument();

    // Check Question feedback
    expect(screen.getByText(/What is an index in PostgreSQL\?/i)).toBeInTheDocument();
    expect(screen.getByText(/"An index is a B-tree data structure that speeds up lookups\."/i)).toBeInTheDocument();
    expect(screen.getByText(/A comprehensive answer explains B-Tree indexing/i)).toBeInTheDocument();

    // Check Print button interaction
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const printBtn = screen.getByText(/Print \/ Save as PDF/i);
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });
});

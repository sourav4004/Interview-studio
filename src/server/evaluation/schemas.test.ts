// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  RawModelEvaluationResponseSchema,
  validateAndCalibrateEvaluation,
} from "./schemas";
import { InterviewEvaluationRequest } from "./types";

describe("Evaluation Schemas & Calibration", () => {
  const mockValidPayload = {
    summary: "Solid overall performance with clear domain knowledge.",
    strengths: ["Clear technical definitions", "Systematic reasoning"],
    improvements: ["Expand on trade-offs", "Provide concrete benchmarks"],
    primaryRecommendation: "Practice explaining asynchronous concurrency models.",
    dimensionScores: [
      {
        dimension: "answer_quality",
        score: 85,
        status: "scored",
        explanation: "Good depth of answers.",
        evidence: "Candidate explained indexing correctly.",
      },
      {
        dimension: "technical_correctness",
        score: 90,
        status: "scored",
        explanation: "Accurate terminology.",
        evidence: "B-Tree references were precise.",
      },
      {
        dimension: "relevance_completeness",
        score: 80,
        status: "scored",
        explanation: "Addressed the prompt directly.",
        evidence: "Covered all questions.",
      },
      {
        dimension: "answer_structure",
        score: 75,
        status: "scored",
        explanation: "Logical flow.",
        evidence: "Clear beginning and conclusion.",
      },
      {
        dimension: "communication_speech",
        score: 85,
        status: "scored",
        explanation: "Professional articulate delivery.",
        evidence: "Good vocabulary.",
      },
      {
        dimension: "resume_consistency",
        score: null,
        status: "not_applicable",
        explanation: "No resume provided.",
        evidence: "",
      },
    ],
    questionFeedback: [
      {
        questionId: "q-1",
        score: 88,
        explanation: "Strong explanation of database indexes.",
        evidence: "Mentioned B-trees and write amplification.",
        strengths: ["Accurate terminology"],
        improvements: ["Mention composite index ordering"],
        exampleAnswer: "A comprehensive answer would detail both B-Tree and Hash indexes.",
      },
    ],
  };

  const mockRequest: InterviewEvaluationRequest = {
    interviewId: "int-100",
    mode: "technical",
    role: "Backend Engineer",
    difficulty: "medium",
    questions: [
      {
        id: "q-1",
        orderIndex: 0,
        questionText: "What is an index in SQL?",
        category: "Databases",
        difficulty: "medium",
        answer: {
          transcript: "An index is a data structure like a B-tree that speeds up lookups.",
          status: "submitted",
          inputMode: "speech",
          isEdited: false,
          durationSeconds: 45,
        },
      },
    ],
  };

  it("validates valid model JSON with RawModelEvaluationResponseSchema", () => {
    const result = RawModelEvaluationResponseSchema.safeParse(mockValidPayload);
    expect(result.success).toBe(true);
  });

  it("fails validation when required fields are missing", () => {
    const invalidPayload = {
      summary: "Short",
      strengths: [],
    };
    const result = RawModelEvaluationResponseSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("calibrates evaluation result with mode weights and overall score", () => {
    const result = validateAndCalibrateEvaluation(
      mockValidPayload,
      mockRequest,
      "gemini-3.5-flash-lite",
      "1.0"
    );

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.evaluatedAnswersCount).toBe(1);
    expect(result.skippedAnswersCount).toBe(0);
    expect(result.dimensionScores.length).toBe(6);

    const technicalDim = result.dimensionScores.find(
      (d) => d.dimension === "technical_correctness"
    );
    expect(technicalDim?.status).toBe("scored");
    expect(technicalDim?.score).toBe(90);

    const resumeDim = result.dimensionScores.find(
      (d) => d.dimension === "resume_consistency"
    );
    expect(resumeDim?.status).toBe("not_applicable");
    expect(resumeDim?.score).toBe(null);
  });

  it("marks skipped questions truthfully in questionFeedback", () => {
    const requestWithSkipped: InterviewEvaluationRequest = {
      ...mockRequest,
      questions: [
        {
          id: "q-1",
          orderIndex: 0,
          questionText: "What is an index in SQL?",
          category: "Databases",
          difficulty: "medium",
          answer: {
            transcript: "",
            status: "skipped",
            inputMode: "text",
            isEdited: false,
            durationSeconds: 0,
          },
        },
      ],
    };

    const result = validateAndCalibrateEvaluation(
      mockValidPayload,
      requestWithSkipped,
      "gemini-3.5-flash-lite",
      "1.0"
    );

    expect(result.skippedAnswersCount).toBe(1);
    expect(result.evaluatedAnswersCount).toBe(0);
    expect(result.questionFeedback[0].answerStatus).toBe("skipped");
    expect(result.questionFeedback[0].score).toBe(null);
    expect(result.questionFeedback[0].explanation).toContain("skipped");
  });
});

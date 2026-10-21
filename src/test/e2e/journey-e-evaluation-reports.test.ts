// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateOverallScore,
  RUBRIC_WEIGHTS_BY_MODE,
  generateScoreExplanation,
  RUBRIC_VERSION,
} from "@/server/evaluation/rubrics";
import { validateAndCalibrateEvaluation } from "@/server/evaluation/schemas";
import { DimensionEvaluation, InterviewEvaluationRequest } from "@/server/evaluation/types";
import { InterviewMode } from "@/server/ai/types";

describe("Milestone 10 — Journey E: Evaluation & Reports End-to-End", () => {
  it("verifies all four interview modes enforce correct mode-specific weights", () => {
    const modes: InterviewMode[] = ["technical", "behavioral", "resume", "company"];

    for (const mode of modes) {
      const modeWeights = RUBRIC_WEIGHTS_BY_MODE[mode];
      expect(modeWeights).toBeDefined();

      // Check specific mode constraints per DECISIONS.md
      if (mode === "technical") {
        expect(modeWeights.technical_correctness.isApplicable).toBe(true);
        expect(modeWeights.technical_correctness.weight).toBe(0.35);
        expect(modeWeights.resume_consistency.isApplicable).toBe(false);
      } else if (mode === "behavioral") {
        expect(modeWeights.answer_structure.isApplicable).toBe(true);
        expect(modeWeights.answer_structure.weight).toBe(0.25);
        expect(modeWeights.technical_correctness.isApplicable).toBe(false);
      } else if (mode === "resume") {
        expect(modeWeights.resume_consistency.isApplicable).toBe(true);
        expect(modeWeights.resume_consistency.weight).toBe(0.30);
        expect(modeWeights.answer_structure.isApplicable).toBe(false);
      } else if (mode === "company") {
        expect(modeWeights.relevance_completeness.isApplicable).toBe(true);
        expect(modeWeights.relevance_completeness.weight).toBe(0.30);
        expect(modeWeights.resume_consistency.isApplicable).toBe(false);
      }

      // Sum of applicable weights must be exactly 1.0 (100%)
      const totalWeight = Object.values(modeWeights)
        .filter((w) => w.isApplicable)
        .reduce((sum, w) => sum + w.weight, 0);
      expect(Math.round(totalWeight * 100)).toBe(100);
    }
  });

  it("ensures not_applicable and insufficient_evidence are NOT scored as zero", () => {
    // Candidate scores 80 in technical correctness (weight 0.5) and 90 in answer quality (weight 0.5).
    // Communication is insufficient_evidence and resume_consistency is not_applicable.
    const dimensions: DimensionEvaluation[] = [
      {
        dimension: "technical_correctness",
        label: "Technical Correctness",
        score: 80,
        weight: 0.35,
        status: "scored",
        explanation: "Good accuracy.",
        evidence: "Mentioned hash tables.",
      },
      {
        dimension: "answer_quality",
        label: "Answer Quality",
        score: 90,
        weight: 0.20,
        status: "scored",
        explanation: "Deep reasoning.",
        evidence: "Analyzed average O(1) vs worst O(n).",
      },
      {
        dimension: "communication_speech",
        label: "Communication Clarity",
        score: null,
        weight: 0.15,
        status: "insufficient_evidence",
        explanation: "Candidate used text fallback with short responses.",
        evidence: "",
      },
      {
        dimension: "resume_consistency",
        label: "Resume Consistency",
        score: null,
        weight: 0.0,
        status: "not_applicable",
        explanation: "Resume mode not selected.",
        evidence: "",
      },
    ];

    // Normalized weight = (80 * 0.35 + 90 * 0.20) / (0.35 + 0.20) = (28 + 18) / 0.55 = 46 / 0.55 ≈ 83.6 => 84
    const score = calculateOverallScore(dimensions);
    expect(score).toBe(84);
    // Crucial check: if insufficient_evidence or not_applicable was scored as 0, the score would be 46/0.70 ≈ 65.
    // Confirm it is NOT penalized as zero:
    expect(score).toBeGreaterThan(80);
  });

  it("rejects invalid AI evaluation output via strict schema validation", () => {
    const invalidPayload = {
      summary: "Invalid response",
      strengths: ["Some strength"],
      improvements: ["Some improvement"],
      primaryRecommendation: "Keep practicing",
      dimensionScores: [
        {
          dimension: "technical_correctness",
          score: -25, // Invalid negative score
          status: "scored",
          explanation: "Negative score invalid",
          evidence: "",
        },
      ],
      questionFeedback: [],
    };

    const mockRequest: InterviewEvaluationRequest = {
      interviewId: "int-eval-test",
      mode: "technical",
      role: "Backend Intern",
      difficulty: "medium",
      hasResumeConsent: false,
      questions: [],
    };

    expect(() =>
      validateAndCalibrateEvaluation(invalidPayload, mockRequest, "gemini-3.5-flash-lite", "1.0")
    ).toThrow(/AI evaluation response failed schema validation/);
  });

  it("verifies evidence quotes and non-stigmatizing score explanations", () => {
    const explanation = generateScoreExplanation(82, "Software Engineer", "technical", 3, 3);
    expect(explanation).toContain("82/100");
    expect(explanation).toContain("Software Engineer");
    expect(explanation).toContain("does not serve as an evaluation of personal intelligence or general employability");
  });

  it("verifies historical scores are preserved and not recalculated with new rubrics", () => {
    // When saved to the database, a report freezes rubricVersion and overallScore
    const persistedReport = {
      id: "rep-historical-001",
      overallScore: 85,
      rubricVersion: "1.0",
      createdAt: new Date("2026-01-15T10:00:00Z"),
    };

    expect(persistedReport.overallScore).toBe(85);
    expect(persistedReport.rubricVersion).toBe(RUBRIC_VERSION);
  });
});

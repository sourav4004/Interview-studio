// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  RUBRIC_WEIGHTS_BY_MODE,
  calculateOverallScore,
  generateScoreExplanation,
} from "./rubrics";
import { DimensionEvaluation } from "./types";
import { InterviewMode } from "@/server/ai/types";

describe("Evaluation Rubrics & Dimension Weighting", () => {
  const modes: InterviewMode[] = ["technical", "behavioral", "resume", "company"];

  it("verifies that weights sum to 1.0 for each mode across applicable dimensions", () => {
    for (const mode of modes) {
      const modeConfig = RUBRIC_WEIGHTS_BY_MODE[mode];
      const sum = Object.values(modeConfig)
        .filter((c) => c.isApplicable)
        .reduce((acc, c) => acc + c.weight, 0);

      expect(Math.round(sum * 100) / 100).toBe(1.0);
    }
  });

  it("marks technical_correctness not applicable for behavioral mode", () => {
    expect(RUBRIC_WEIGHTS_BY_MODE.behavioral.technical_correctness.isApplicable).toBe(false);
    expect(RUBRIC_WEIGHTS_BY_MODE.behavioral.technical_correctness.weight).toBe(0);
  });

  it("marks resume_consistency applicable only for resume mode by default", () => {
    expect(RUBRIC_WEIGHTS_BY_MODE.resume.resume_consistency.isApplicable).toBe(true);
    expect(RUBRIC_WEIGHTS_BY_MODE.resume.resume_consistency.weight).toBe(0.3);
    expect(RUBRIC_WEIGHTS_BY_MODE.technical.resume_consistency.isApplicable).toBe(false);
  });

  describe("calculateOverallScore", () => {
    it("returns 0 when no dimensions are scored", () => {
      const dims: DimensionEvaluation[] = [
        {
          dimension: "technical_correctness",
          label: "Technical Correctness",
          score: null,
          weight: 0.35,
          status: "not_applicable",
          explanation: "",
          evidence: "",
        },
      ];
      expect(calculateOverallScore(dims)).toBe(0);
    });

    it("calculates exact weighted average when all applicable dimensions are scored", () => {
      const dims: DimensionEvaluation[] = [
        {
          dimension: "technical_correctness",
          label: "Technical",
          score: 80,
          weight: 0.5,
          status: "scored",
          explanation: "",
          evidence: "",
        },
        {
          dimension: "answer_quality",
          label: "Quality",
          score: 90,
          weight: 0.5,
          status: "scored",
          explanation: "",
          evidence: "",
        },
      ];
      // 80*0.5 + 90*0.5 = 85
      expect(calculateOverallScore(dims)).toBe(85);
    });

    it("normalizes remaining weights when one dimension is insufficient_evidence", () => {
      const dims: DimensionEvaluation[] = [
        {
          dimension: "technical_correctness",
          label: "Technical",
          score: 80,
          weight: 0.5,
          status: "scored",
          explanation: "",
          evidence: "",
        },
        {
          dimension: "answer_quality",
          label: "Quality",
          score: null,
          weight: 0.5,
          status: "insufficient_evidence",
          explanation: "Insufficient text",
          evidence: "",
        },
      ];
      // Only technical is scored, so normalized weight is 1.0 -> score = 80
      expect(calculateOverallScore(dims)).toBe(80);
    });
  });

  describe("generateScoreExplanation", () => {
    it("explains non-evaluable session when 0 questions are answered", () => {
      const explanation = generateScoreExplanation(0, "Software Engineer", "technical", 0, 5);
      expect(explanation).toContain("No questions were answered");
      expect(explanation).toContain("insufficient evidence");
    });

    it("generates contextualized explanation without stigmatizing language", () => {
      const explanation = generateScoreExplanation(82, "Software Engineer", "technical", 4, 5);
      expect(explanation).toContain("82/100");
      expect(explanation).toContain("4 of 5 questions");
      expect(explanation).toContain("does not serve as an evaluation of personal intelligence");
    });
  });
});

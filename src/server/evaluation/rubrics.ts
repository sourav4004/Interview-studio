/**
 * Interview Evaluation Rubrics & Dimension Weighting.
 *
 * Implements:
 * - Versioned rubrics per PRODUCT_SPEC.md (Section 7: Evaluation).
 * - Interview-mode-specific weight matrix.
 * - Explicit marking of non-applicable dimensions rather than scoring them zero.
 * - Distinction between insufficient evidence and poor performance.
 * - Truthful score normalization and standard contextual explanations.
 *
 * References:
 * - PRODUCT_SPEC.md (Scores estimate performance on the given interview,
 *   never intelligence, personality, or employability)
 * - DECISIONS.md (Versioned rubrics, evidence-grounded evaluation)
 */

import { InterviewMode } from "@/server/ai/types";
import { DimensionEvaluation, EvaluationDimension } from "./types";

export const RUBRIC_VERSION = "1.0";

export interface DimensionConfig {
  dimension: EvaluationDimension;
  label: string;
  description: string;
}

export const DIMENSION_CONFIGS: Record<EvaluationDimension, DimensionConfig> = {
  answer_quality: {
    dimension: "answer_quality",
    label: "Answer Quality & Depth",
    description: "Evaluates the depth, reasoning, conceptual accuracy, and substance of responses.",
  },
  technical_correctness: {
    dimension: "technical_correctness",
    label: "Technical Correctness",
    description: "Evaluates factual accuracy of technical concepts, problem-solving, and domain terminology.",
  },
  relevance_completeness: {
    dimension: "relevance_completeness",
    label: "Relevance & Completeness",
    description: "Evaluates whether the candidate directly addressed the prompt and covered all key aspects.",
  },
  answer_structure: {
    dimension: "answer_structure",
    label: "Answer Structure & Coherence",
    description: "Evaluates logical flow, conciseness, and structural frameworks (e.g., STAR framework for behavioral questions).",
  },
  communication_speech: {
    dimension: "communication_speech",
    label: "Communication & Clarity",
    description: "Evaluates clarity, articulate delivery, professional tone, and expression within the transcript evidence.",
  },
  resume_consistency: {
    dimension: "resume_consistency",
    label: "Resume Consistency",
    description: "Evaluates whether claims, experiences, and technical projects align with stated resume context.",
  },
};

/**
 * Baseline dimension weights by interview mode.
 * Weights must sum to 1.0 across applicable dimensions for each mode.
 */
export const RUBRIC_WEIGHTS_BY_MODE: Record<
  InterviewMode,
  Record<EvaluationDimension, { isApplicable: boolean; weight: number }>
> = {
  technical: {
    technical_correctness: { isApplicable: true, weight: 0.35 },
    answer_quality: { isApplicable: true, weight: 0.20 },
    relevance_completeness: { isApplicable: true, weight: 0.15 },
    answer_structure: { isApplicable: true, weight: 0.15 },
    communication_speech: { isApplicable: true, weight: 0.15 },
    resume_consistency: { isApplicable: false, weight: 0.00 },
  },
  behavioral: {
    answer_structure: { isApplicable: true, weight: 0.25 },
    communication_speech: { isApplicable: true, weight: 0.25 },
    answer_quality: { isApplicable: true, weight: 0.25 },
    relevance_completeness: { isApplicable: true, weight: 0.25 },
    technical_correctness: { isApplicable: false, weight: 0.00 },
    resume_consistency: { isApplicable: false, weight: 0.00 },
  },
  resume: {
    resume_consistency: { isApplicable: true, weight: 0.30 },
    technical_correctness: { isApplicable: true, weight: 0.20 },
    answer_quality: { isApplicable: true, weight: 0.20 },
    relevance_completeness: { isApplicable: true, weight: 0.15 },
    communication_speech: { isApplicable: true, weight: 0.15 },
    answer_structure: { isApplicable: false, weight: 0.00 },
  },
  company: {
    relevance_completeness: { isApplicable: true, weight: 0.30 },
    technical_correctness: { isApplicable: true, weight: 0.20 },
    answer_quality: { isApplicable: true, weight: 0.20 },
    answer_structure: { isApplicable: true, weight: 0.15 },
    communication_speech: { isApplicable: true, weight: 0.15 },
    resume_consistency: { isApplicable: false, weight: 0.00 },
  },
};

/**
 * Computes the overall score (0-100) from dimension evaluations.
 * - Non-applicable and insufficient-evidence dimensions are omitted from weighting
 *   rather than penalizing the candidate as 0.
 * - Remaining applicable weights are normalized to sum to 100%.
 */
export function calculateOverallScore(dimensions: DimensionEvaluation[]): number {
  const scoredDimensions = dimensions.filter(
    (d) => d.status === "scored" && typeof d.score === "number" && d.weight > 0
  );

  if (scoredDimensions.length === 0) {
    return 0;
  }

  const totalScoredWeight = scoredDimensions.reduce((sum, d) => sum + d.weight, 0);

  if (totalScoredWeight <= 0) {
    return 0;
  }

  const weightedSum = scoredDimensions.reduce((sum, d) => {
    return sum + (d.score as number) * (d.weight / totalScoredWeight);
  }, 0);

  return Math.min(100, Math.max(0, Math.round(weightedSum)));
}

/**
 * Generates an objective, non-stigmatizing explanation of the score.
 * Mandated by PRODUCT_SPEC.md: Scores must never represent intelligence or employability.
 */
export function generateScoreExplanation(
  overallScore: number,
  role: string,
  mode: InterviewMode,
  answeredCount: number,
  totalQuestions: number
): string {
  if (answeredCount === 0) {
    return "No questions were answered during this interview session. Skipping all questions does not reflect on your technical capability, but leaves insufficient evidence to compute an evaluation score.";
  }

  const completionRatio = `${answeredCount} of ${totalQuestions} questions`;

  let tier = "shows strong alignment with expectations";
  if (overallScore < 50) {
    tier = "identifies foundational concepts requiring further review and preparation";
  } else if (overallScore < 75) {
    tier = "demonstrates solid baseline knowledge with targeted opportunities for structural refinement";
  }

  return `This score (${overallScore}/100) assesses candidate responses across ${completionRatio} for a ${mode} ${role} interview simulation. Overall performance ${tier}. It reflects specific response depth, structure, and accuracy demonstrated during this session, and does not serve as an evaluation of personal intelligence or general employability.`;
}

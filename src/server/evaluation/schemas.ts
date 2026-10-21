/**
 * Interview Evaluation Zod Schemas & Validation.
 *
 * Implements:
 * - Versioned Zod validation schemas for AI evaluation outputs.
 * - Strict checking of scores (0-100), statuses, explanations, and evidence grounding.
 * - Safe sanitization against model hallucination or malformed JSON payloads.
 *
 * References:
 * - ARCHITECTURE.md (Section 6: AI provider boundary)
 * - DECISIONS.md (Strict output validation, structured JSON schemas)
 */

import { z } from "zod";
import {
  DIMENSION_CONFIGS,
  RUBRIC_VERSION,
  RUBRIC_WEIGHTS_BY_MODE,
  calculateOverallScore,
  generateScoreExplanation,
} from "./rubrics";
import {
  DimensionEvaluation,
  EvaluationDimension,
  InterviewEvaluationRequest,
  InterviewEvaluationResult,
  QuestionEvaluation,
} from "./types";

export const EVALUATION_SCHEMA_VERSION = "1.0";

const RawDimensionSchema = z.object({
  dimension: z.enum([
    "answer_quality",
    "technical_correctness",
    "relevance_completeness",
    "answer_structure",
    "communication_speech",
    "resume_consistency",
  ]),
  score: z.number().min(0).max(100).nullable(),
  status: z.enum(["scored", "not_applicable", "insufficient_evidence"]),
  explanation: z.string().min(3),
  evidence: z.string().default(""),
});

const RawQuestionFeedbackSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(0).max(100).nullable(),
  explanation: z.string().min(3),
  evidence: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  exampleAnswer: z.string().nullable().optional(),
});

export const RawModelEvaluationResponseSchema = z.object({
  summary: z.string().min(10),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  primaryRecommendation: z.string().min(5),
  dimensionScores: z.array(RawDimensionSchema),
  questionFeedback: z.array(RawQuestionFeedbackSchema),
});

export type RawModelEvaluationResponse = z.infer<
  typeof RawModelEvaluationResponseSchema
>;

/**
 * Normalizes minor model formatting variations (e.g. snake_case keys or aliases)
 * before strict Zod validation.
 */
function normalizeRawEvaluation(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;

  const summary = raw.summary ?? raw.executive_summary ?? raw.overview;
  const strengths = raw.strengths ?? raw.key_strengths;
  const improvements =
    raw.improvements ?? raw.priority_improvement_areas ?? raw.areas_for_improvement;
  const primaryRecommendation =
    raw.primaryRecommendation ?? raw.primary_recommendation ?? raw.recommendation;
  const rawDimensions = raw.dimensionScores ?? raw.dimensions ?? raw.dimension_scores;
  const rawFeedback = raw.questionFeedback ?? raw.question_feedback ?? raw.questions_feedback;

  const dimensionScores = Array.isArray(rawDimensions)
    ? rawDimensions.map((d: Record<string, unknown>) => {
        if (!d || typeof d !== "object") return d;
        let status = d.status;
        if (!status) {
          if (d.score === null || d.score === undefined) status = "insufficient_evidence";
          else status = "scored";
        }
        return {
          dimension: d.dimension,
          score: d.score,
          status,
          explanation: d.explanation ?? d.description ?? d.feedback ?? "Evaluated based on submitted answer.",
          evidence: d.evidence ?? d.quote ?? "",
        };
      })
    : rawDimensions;

  const questionFeedback = Array.isArray(rawFeedback)
    ? rawFeedback.map((q: Record<string, unknown>) => {
        if (!q || typeof q !== "object") return q;
        return {
          questionId: q.questionId ?? q.question_id ?? q.id,
          score: q.score,
          explanation: q.explanation ?? q.feedback ?? "Response evaluated.",
          evidence: q.evidence ?? q.quote ?? "",
          strengths: Array.isArray(q.strengths)
            ? q.strengths
            : Array.isArray(q.key_strengths)
            ? q.key_strengths
            : [],
          improvements: Array.isArray(q.improvements)
            ? q.improvements
            : Array.isArray(q.priority_improvements)
            ? q.priority_improvements
            : [],
          exampleAnswer: q.exampleAnswer ?? q.example_answer ?? null,
        };
      })
    : rawFeedback;

  return {
    summary,
    strengths,
    improvements,
    primaryRecommendation,
    dimensionScores,
    questionFeedback,
  };
}

/**
 * Validates, calibrates, and completes raw AI evaluation output.
 * Ensures all dimensions have proper labels, weights, and normalized overall scores.
 */
export function validateAndCalibrateEvaluation(
  rawJson: unknown,
  request: InterviewEvaluationRequest,
  modelIdentifier: string,
  promptVersion: string
): InterviewEvaluationResult {
  const normalized = normalizeRawEvaluation(rawJson);
  const parsed = RawModelEvaluationResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`AI evaluation response failed schema validation: ${errorDetails}`);
  }

  const rawData = parsed.data;
  const modeWeights = RUBRIC_WEIGHTS_BY_MODE[request.mode];

  // 1. Process and calibrate all 6 dimensions
  const allDimensions: EvaluationDimension[] = [
    "answer_quality",
    "technical_correctness",
    "relevance_completeness",
    "answer_structure",
    "communication_speech",
    "resume_consistency",
  ];

  const dimensionScores: DimensionEvaluation[] = allDimensions.map((dim) => {
    const weightConfig = modeWeights[dim];
    const rawDim = rawData.dimensionScores.find((d) => d.dimension === dim);
    const config = DIMENSION_CONFIGS[dim];

    // Check if mode explicitly excludes dimension or resume consent is missing
    const isModeApplicable =
      weightConfig.isApplicable &&
      (dim !== "resume_consistency" || Boolean(request.hasResumeConsent && request.resumeText));

    if (!isModeApplicable) {
      return {
        dimension: dim,
        label: config.label,
        score: null,
        weight: 0,
        status: "not_applicable",
        explanation: `${config.label} is not applicable to ${request.mode} interview simulations.`,
        evidence: "",
      };
    }

    if (!rawDim || rawDim.status === "not_applicable") {
      return {
        dimension: dim,
        label: config.label,
        score: null,
        weight: 0,
        status: "not_applicable",
        explanation: "Dimension was not applicable for the candidate responses.",
        evidence: "",
      };
    }

    if (rawDim.status === "insufficient_evidence" || rawDim.score === null) {
      return {
        dimension: dim,
        label: config.label,
        score: null,
        weight: weightConfig.weight,
        status: "insufficient_evidence",
        explanation: rawDim.explanation || "Insufficient answer text available to evaluate this dimension.",
        evidence: rawDim.evidence || "",
      };
    }

    return {
      dimension: dim,
      label: config.label,
      score: Math.min(100, Math.max(0, Math.round(rawDim.score))),
      weight: weightConfig.weight,
      status: "scored",
      explanation: rawDim.explanation,
      evidence: rawDim.evidence,
    };
  });

  // 2. Map Question Feedback with original question context
  let evaluatedAnswersCount = 0;
  let skippedAnswersCount = 0;

  const questionFeedback: QuestionEvaluation[] = request.questions.map((q) => {
    const answer = q.answer;
    const isSubmitted = answer?.status === "submitted" && answer.transcript.trim().length > 0;
    const isSkipped = answer?.status === "skipped";

    if (isSubmitted) {
      evaluatedAnswersCount++;
    } else {
      skippedAnswersCount++;
    }

    const rawFeedback = rawData.questionFeedback.find((f) => f.questionId === q.id);

    if (!isSubmitted) {
      return {
        questionId: q.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        category: q.category,
        candidateAnswer: answer?.transcript || "",
        answerStatus: isSkipped ? "skipped" : "unanswered",
        score: null,
        explanation: isSkipped
          ? "This question was skipped by the candidate. Skipped questions are marked unanswered and are not treated as incorrect."
          : "No answer was recorded for this question.",
        evidence: "",
        strengths: [],
        improvements: ["Practice answering questions in this topic area to build response confidence."],
        exampleAnswer: rawFeedback?.exampleAnswer || null,
      };
    }

    return {
      questionId: q.id,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      category: q.category,
      candidateAnswer: answer.transcript,
      answerStatus: "submitted",
      score: rawFeedback?.score !== undefined && rawFeedback.score !== null
        ? Math.min(100, Math.max(0, Math.round(rawFeedback.score)))
        : null,
      explanation: rawFeedback?.explanation || "Response evaluated based on provided transcript.",
      evidence: rawFeedback?.evidence || "",
      strengths: rawFeedback?.strengths || [],
      improvements: rawFeedback?.improvements || [],
      exampleAnswer: rawFeedback?.exampleAnswer || null,
    };
  });

  // 3. Compute overall score & explanation
  const overallScore = calculateOverallScore(dimensionScores);
  const scoreExplanation = generateScoreExplanation(
    overallScore,
    request.role,
    request.mode,
    evaluatedAnswersCount,
    request.questions.length
  );

  return {
    overallScore,
    summary: rawData.summary,
    scoreExplanation,
    dimensionScores,
    strengths: rawData.strengths,
    improvements: rawData.improvements,
    primaryRecommendation: rawData.primaryRecommendation,
    questionFeedback,
    modelIdentifier,
    promptVersion,
    rubricVersion: RUBRIC_VERSION,
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    evaluatedAnswersCount,
    skippedAnswersCount,
  };
}

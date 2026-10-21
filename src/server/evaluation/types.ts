/**
 * Evaluation & Report Domain Types.
 *
 * Defines domain contracts, rubric structures, and report types per:
 * - PRODUCT_SPEC.md (Section 7: Evaluation, Section 8: Report)
 * - ARCHITECTURE.md (Section 3: evaluation, reports)
 * - DECISIONS.md (Versioned rubrics, strict validation, evidence grounding)
 */

import { TokenUsageMetadata } from "@/server/usage/types";
import { InterviewDifficulty, InterviewMode } from "@/server/ai/types";

export type EvaluationDimension =
  | "answer_quality"
  | "technical_correctness"
  | "relevance_completeness"
  | "answer_structure"
  | "communication_speech"
  | "resume_consistency";

export type DimensionStatus = "scored" | "not_applicable" | "insufficient_evidence";

export interface DimensionEvaluation {
  dimension: EvaluationDimension;
  label: string;
  score: number | null; // 0-100, null if not_applicable or insufficient_evidence
  weight: number; // 0.0 to 1.0 (weights sum to 1.0 across applicable dimensions)
  status: DimensionStatus;
  explanation: string;
  evidence: string;
}

export interface QuestionEvaluation {
  questionId: string;
  orderIndex: number;
  questionText: string;
  category: string | null;
  candidateAnswer: string;
  answerStatus: "submitted" | "skipped" | "unanswered";
  score: number | null; // 0-100, null if skipped/unanswered
  explanation: string;
  evidence: string;
  strengths: string[];
  improvements: string[];
  exampleAnswer: string | null; // Illustrative stronger answer or framework
}

export interface InterviewEvaluationResult {
  overallScore: number; // 0-100 weighted score
  summary: string;
  scoreExplanation: string;
  dimensionScores: DimensionEvaluation[];
  strengths: string[];
  improvements: string[];
  primaryRecommendation: string;
  questionFeedback: QuestionEvaluation[];
  modelIdentifier: string;
  promptVersion: string;
  rubricVersion: string;
  schemaVersion: string;
  evaluatedAnswersCount: number;
  skippedAnswersCount: number;
  usageMetadata?: TokenUsageMetadata;
}

export interface InterviewEvaluationRequest {
  interviewId: string;
  mode: InterviewMode;
  role: string;
  difficulty: InterviewDifficulty;
  companyName?: string | null;
  jobDescription?: string | null;
  resumeText?: string | null;
  hasResumeConsent?: boolean;
  questions: Array<{
    id: string;
    orderIndex: number;
    questionText: string;
    category: string | null;
    difficulty: string | null;
    answer: {
      transcript: string;
      status: "submitted" | "skipped" | "unanswered";
      inputMode: "speech" | "text" | "mixed";
      isEdited: boolean;
      durationSeconds: number | null;
    } | null;
  }>;
}

export interface ReportActor {
  userId?: string | null;
  guestSessionId?: string | null;
}

export interface InterviewReportSummary {
  id: string;
  interviewId: string;
  userId: string | null;
  guestSessionId: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  overallScore: number | null;
  summary: string | null;
  scoreExplanation: string | null;
  strengths: string[];
  improvements: string[];
  primaryRecommendation: string | null;
  dimensionScores: DimensionEvaluation[];
  questionFeedback: QuestionEvaluation[];
  modelIdentifier: string | null;
  promptVersion: string | null;
  rubricVersion: string | null;
  schemaVersion: string | null;
  evaluatedAnswersCount: number;
  skippedAnswersCount: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

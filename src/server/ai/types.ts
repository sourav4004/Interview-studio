/**
 * AI Provider Adapter Types.
 *
 * Defines replaceable server-side provider contracts per ARCHITECTURE.md (Section 6).
 */

import { TokenUsageMetadata } from "@/server/usage/types";
import type {
  InterviewEvaluationRequest,
  InterviewEvaluationResult,
} from "@/server/evaluation/types";

export type InterviewMode = "technical" | "behavioral" | "resume" | "company";

export type InterviewDifficulty = "easy" | "medium" | "hard";

export interface QuestionGenerationRequest {
  mode: InterviewMode;
  role: string;
  difficulty: InterviewDifficulty;
  questionCount: number;
  durationMinutes: number;
  companyName?: string;
  jobDescription?: string;
  resumeText?: string;
}

export interface GeneratedQuestion {
  questionText: string;
  category: string;
  difficulty: InterviewDifficulty;
  timeLimitSeconds?: number;
}

export interface QuestionGenerationResponse {
  questions: GeneratedQuestion[];
  modelIdentifier: string;
  promptVersion: string;
  schemaVersion: string;
  usageMetadata?: TokenUsageMetadata;
}

export interface AiProviderAdapter {
  readonly providerName: string;
  generateQuestions(
    request: QuestionGenerationRequest
  ): Promise<QuestionGenerationResponse>;
  evaluateInterview(
    request: InterviewEvaluationRequest
  ): Promise<InterviewEvaluationResult>;
}


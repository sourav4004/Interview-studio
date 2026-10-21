/**
 * Mock AI Provider Adapter for deterministic testing.
 */

import {
  AiProviderAdapter,
  GeneratedQuestion,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
} from "./types";
import { PROMPT_VERSION } from "./prompts";
import { SCHEMA_VERSION } from "./schemas";
import { validateAndCalibrateEvaluation } from "@/server/evaluation/schemas";
import type {
  InterviewEvaluationRequest,
  InterviewEvaluationResult,
} from "@/server/evaluation/types";

export class MockAiProviderAdapter implements AiProviderAdapter {
  public readonly providerName = "mock-gemini";
  public readonly modelIdentifier: string;
  private shouldFail: boolean;
  private failureError: Error | null;
  private customQuestions: GeneratedQuestion[] | null;
  private customEvaluation: InterviewEvaluationResult | null;

  constructor(options: {
    model?: string;
    shouldFail?: boolean;
    failureError?: Error;
    customQuestions?: GeneratedQuestion[];
    customEvaluation?: InterviewEvaluationResult;
  } = {}) {
    this.modelIdentifier = options.model || "mock-gemini-3.5-flash-lite";
    this.shouldFail = options.shouldFail ?? false;
    this.failureError = options.failureError ?? null;
    this.customQuestions = options.customQuestions ?? null;
    this.customEvaluation = options.customEvaluation ?? null;
  }

  public setFailure(fail: boolean, error?: Error): void {
    this.shouldFail = fail;
    this.failureError = error ?? (fail ? new Error("Mock AI Provider failure") : null);
  }

  public setCustomQuestions(questions: GeneratedQuestion[]): void {
    this.customQuestions = questions;
  }

  public setCustomEvaluation(evaluation: InterviewEvaluationResult | null): void {
    this.customEvaluation = evaluation;
  }

  public async generateQuestions(
    request: QuestionGenerationRequest
  ): Promise<QuestionGenerationResponse> {
    if (this.shouldFail) {
      throw this.failureError || new Error("Mock AI Provider failure");
    }

    if (this.customQuestions) {
      return {
        questions: this.customQuestions.slice(0, request.questionCount),
        modelIdentifier: this.modelIdentifier,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        usageMetadata: {
          promptTokens: 200,
          completionTokens: 150,
          totalTokens: 350,
          model: this.modelIdentifier,
        },
      };
    }

    const questions: GeneratedQuestion[] = [];
    for (let i = 1; i <= request.questionCount; i++) {
      questions.push({
        questionText: `Generated ${request.difficulty} question #${i} for ${request.role} (${request.mode} mode)?`,
        category: request.mode,
        difficulty: request.difficulty,
        timeLimitSeconds: 120,
      });
    }

    return {
      questions,
      modelIdentifier: this.modelIdentifier,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      usageMetadata: {
        promptTokens: 250,
        completionTokens: 180,
        totalTokens: 430,
        model: this.modelIdentifier,
      },
    };
  }

  public async evaluateInterview(
    request: InterviewEvaluationRequest
  ): Promise<InterviewEvaluationResult> {
    if (this.shouldFail) {
      throw this.failureError || new Error("Mock AI Provider evaluation failure");
    }

    if (this.customEvaluation) {
      return this.customEvaluation;
    }

    const mockRaw = {
      summary: `Candidate demonstrated solid foundational knowledge for the ${request.role} role.`,
      strengths: [
        "Clear technical reasoning on core questions",
        "Good communication structure and terminology",
      ],
      improvements: [
        "Provide more depth when discussing trade-offs",
        "Expand on real-world constraints and edge cases",
      ],
      primaryRecommendation:
        "Practice system design fundamentals and concrete behavioral STAR responses.",
      dimensionScores: [
        {
          dimension: "answer_quality",
          score: 80,
          status: "scored",
          explanation: "Substantive answers provided with clear reasoning.",
          evidence: "Candidate referenced key concepts directly.",
        },
        {
          dimension: "technical_correctness",
          score: request.mode === "behavioral" ? null : 85,
          status: request.mode === "behavioral" ? "not_applicable" : "scored",
          explanation:
            request.mode === "behavioral"
              ? "Technical correctness is not applicable for behavioral interviews."
              : "Accurate usage of domain terminology and concepts.",
          evidence:
            request.mode === "behavioral"
              ? ""
              : "Correct explanations of database and backend principles.",
        },
        {
          dimension: "relevance_completeness",
          score: 75,
          status: "scored",
          explanation: "Addressed primary aspects of the prompts.",
          evidence: "Covered the requested topic areas directly.",
        },
        {
          dimension: "answer_structure",
          score: 70,
          status: "scored",
          explanation: "Clear flow from problem to solution.",
          evidence: "Logical progression in explanations.",
        },
        {
          dimension: "communication_speech",
          score: 80,
          status: "scored",
          explanation: "Articulate and professional delivery.",
          evidence: "Cohesive sentence structure in transcripts.",
        },
        {
          dimension: "resume_consistency",
          score: null,
          status: "not_applicable",
          explanation: "Resume context not evaluated for this session.",
          evidence: "",
        },
      ],
      questionFeedback: request.questions.map((q) => ({
        questionId: q.id,
        score:
          q.answer?.status === "submitted" && q.answer.transcript.trim()
            ? 80
            : null,
        explanation:
          q.answer?.status === "submitted" && q.answer.transcript.trim()
            ? "Good explanation with accurate concepts."
            : "Question was skipped by candidate.",
        evidence: q.answer?.transcript ? q.answer.transcript.slice(0, 50) : "",
        strengths: ["Clear terminology"],
        improvements: ["Add concrete examples"],
        exampleAnswer:
          "A stronger response would outline the key trade-offs first, then detail the implementation.",
      })),
    };

    const evaluated = validateAndCalibrateEvaluation(
      mockRaw,
      request,
      this.modelIdentifier,
      "1.0"
    );

    evaluated.usageMetadata = {
      promptTokens: 500,
      completionTokens: 350,
      totalTokens: 850,
      model: this.modelIdentifier,
    };

    return evaluated;
  }
}


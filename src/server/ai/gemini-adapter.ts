/**
 * Server-Side Google Gemini AI Provider Adapter.
 *
 * Implements:
 * - Replaceable AiProviderAdapter contract.
 * - Server-only credential resolution from process.env.GEMINI_API_KEY.
 * - Dynamic model configuration via GEMINI_MODEL (defaults to "gemini-3.5-flash-lite").
 * - Native structured JSON generation.
 * - Strict schema validation and duplicate elimination.
 * - 15-second request timeouts and bounded retries for transient errors.
 * - Total key sanitization so secrets are never exposed in errors or logs.
 *
 * References:
 * - ARCHITECTURE.md (Section 6: AI provider boundary)
 * - DECISIONS.md (Replaceable provider adapter, structured output)
 */

import {
  AiProviderAdapter,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
} from "./types";
import {
  AiGenerationTimeoutError,
  AiProviderError,
  AiQuotaExhaustedError,
  AiResponseValidationError,
} from "./errors";
import {
  PROMPT_VERSION,
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
} from "./prompts";
import {
  QuestionSetSchema,
  SCHEMA_VERSION,
  validateAndDeduplicateQuestions,
} from "./schemas";
import {
  EVALUATION_PROMPT_VERSION,
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationPrompt,
} from "@/server/evaluation/prompts";
import { validateAndCalibrateEvaluation } from "@/server/evaluation/schemas";
import type {
  InterviewEvaluationRequest,
  InterviewEvaluationResult,
} from "@/server/evaluation/types";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Gemini provider adapter cannot be imported into client-side code."
  );
}

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
}

export class GeminiProviderAdapter implements AiProviderAdapter {
  public readonly providerName = "google-gemini";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetch: typeof fetch;

  constructor(options: GeminiAdapterOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    this.model = options.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    this.timeoutMs =
      options.timeoutMs ??
      (process.env.GEMINI_TIMEOUT_MS
        ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10)
        : DEFAULT_TIMEOUT_MS);
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.fetch = options.fetchFn ?? globalThis.fetch;
  }

  public async generateQuestions(
    request: QuestionGenerationRequest
  ): Promise<QuestionGenerationResponse> {
    if (!this.apiKey || this.apiKey === "replace-me") {
      throw new AiProviderError(
        "Gemini API key is not configured. Set GEMINI_API_KEY in server environment."
      );
    }

    const userPrompt = buildQuestionGenerationPrompt(request);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: QUESTION_GENERATION_SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms
        const backoffMs = Math.pow(2, attempt - 1) * 500;
        await new Promise((res) => setTimeout(res, backoffMs));
      }

      try {
        const response = await this.executeGeminiRequest(payload);
        return this.parseAndValidateResponse(response, request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Quota exhaustion is non-retryable
        if (error instanceof AiQuotaExhaustedError) {
          throw error;
        }

        // Response validation error is non-retryable
        if (error instanceof AiResponseValidationError) {
          throw error;
        }

        // If error is not retryable and we haven't reached max retries, check status
        if (error instanceof AiProviderError && !error.isRetryable) {
          throw error;
        }
      }
    }

    throw lastError || new AiProviderError("Failed to generate questions after retries.");
  }

  private async executeGeminiRequest(payload: unknown): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await this.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AiQuotaExhaustedError();
        }

        const isRetryable = response.status >= 500 && response.status < 600;
        let errorDetails = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body?.error?.message) {
            // Strip any sensitive endpoint / token reflections
            errorDetails = body.error.message.replace(this.apiKey, "[REDACTED_API_KEY]");
          }
        } catch {
          // Ignore JSON parse error on non-OK response
        }

        throw new AiProviderError(
          `Gemini API returned error (${response.status}): ${errorDetails}`,
          { statusCode: response.status, isRetryable }
        );
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      if (
        (error instanceof Error && error.name === "AbortError") ||
        controller.signal.aborted
      ) {
        throw new AiGenerationTimeoutError(this.timeoutMs);
      }
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(
        `Gemini network communication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { isRetryable: true }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseAndValidateResponse(
    rawResponse: Record<string, unknown>,
    request: QuestionGenerationRequest
  ): QuestionGenerationResponse {
    const candidates = rawResponse?.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> };
    }> | undefined;
    const candidateText = candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== "string") {
      throw new AiResponseValidationError(
        "Gemini API returned empty or missing candidate text payload."
      );
    }

    let parsedJson: unknown;
    try {
      // Strip markdown code fences if model wrapped the JSON
      const cleanJson = candidateText.replace(/^```json\s*|\s*```$/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
    } catch {
      throw new AiResponseValidationError(
        "Gemini response could not be parsed as valid JSON."
      );
    }

    const parseResult = QuestionSetSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      );
      throw new AiResponseValidationError(
        "Gemini JSON payload did not conform to question schema",
        issues
      );
    }

    // Enforce question count, unique questions, and difficulty consistency
    const validatedQuestions = validateAndDeduplicateQuestions(
      parseResult.data.questions,
      request.questionCount
    );

    // Extract token usage metadata if provided by Gemini
    const rawUsage = rawResponse?.usageMetadata as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    } | undefined;

    const usageMetadata = rawUsage
      ? {
          promptTokens: rawUsage.promptTokenCount,
          completionTokens: rawUsage.candidatesTokenCount,
          totalTokens: rawUsage.totalTokenCount,
          model: this.model,
        }
      : undefined;

    return {
      questions: validatedQuestions,
      modelIdentifier: this.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      usageMetadata,
    };
  }

  public async evaluateInterview(
    request: InterviewEvaluationRequest
  ): Promise<InterviewEvaluationResult> {
    if (!this.apiKey || this.apiKey === "replace-me") {
      throw new AiProviderError(
        "Gemini API key is not configured. Set GEMINI_API_KEY in server environment."
      );
    }

    const userPrompt = buildEvaluationPrompt(request);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: EVALUATION_SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.pow(2, attempt - 1) * 500;
        await new Promise((res) => setTimeout(res, backoffMs));
      }

      try {
        const response = await this.executeGeminiRequest(payload);
        return this.parseAndValidateEvaluationResponse(response, request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof AiQuotaExhaustedError) {
          throw error;
        }

        const isLastAttempt = attempt === this.maxRetries;
        if (isLastAttempt) {
          break;
        }
      }
    }

    throw lastError || new AiProviderError("Gemini evaluation request failed after retries.");
  }

  private parseAndValidateEvaluationResponse(
    rawResponse: Record<string, unknown>,
    request: InterviewEvaluationRequest
  ): InterviewEvaluationResult {
    const candidates = rawResponse?.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> };
    }> | undefined;
    const candidateText = candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== "string") {
      throw new AiResponseValidationError(
        "Gemini API returned empty or missing evaluation text payload."
      );
    }

    let parsedJson: unknown;
    try {
      const cleanJson = candidateText.replace(/^```json\s*|\s*```$/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
    } catch {
      throw new AiResponseValidationError(
        "Gemini evaluation response could not be parsed as valid JSON."
      );
    }

    const result = validateAndCalibrateEvaluation(
      parsedJson,
      request,
      this.model,
      EVALUATION_PROMPT_VERSION
    );

    // Extract token usage metadata if provided
    const rawUsage = rawResponse?.usageMetadata as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    } | undefined;

    if (rawUsage) {
      result.usageMetadata = {
        promptTokens: rawUsage.promptTokenCount,
        completionTokens: rawUsage.candidatesTokenCount,
        totalTokens: rawUsage.totalTokenCount,
        model: this.model,
      };
    }

    return result;
  }
}


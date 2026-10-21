/**
 * AI Provider Adapter Errors.
 * Sanitized to never expose provider secrets or confidential prompts in logs.
 */

export class AiProviderError extends Error {
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;

  constructor(message: string, options: { statusCode?: number; isRetryable?: boolean } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.statusCode = options.statusCode;
    this.isRetryable = options.isRetryable ?? false;
  }
}

export class AiGenerationTimeoutError extends AiProviderError {
  constructor(timeoutMs: number) {
    super(`AI question generation timed out after ${timeoutMs}ms.`, {
      isRetryable: true,
    });
    this.name = "AiGenerationTimeoutError";
  }
}

export class AiResponseValidationError extends AiProviderError {
  public readonly validationIssues: string[];

  constructor(message: string, issues: string[] = []) {
    super(`${message}${issues.length > 0 ? `: ${issues.join("; ")}` : ""}`, {
      isRetryable: false,
    });
    this.name = "AiResponseValidationError";
    this.validationIssues = issues;
  }
}

export class AiQuotaExhaustedError extends AiProviderError {
  constructor() {
    super("AI provider quota exhausted. Please try again later or use standard fallback.", {
      statusCode: 429,
      isRetryable: false,
    });
    this.name = "AiQuotaExhaustedError";
  }
}

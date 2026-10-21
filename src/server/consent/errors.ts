/**
 * Consent error types.
 *
 * References:
 * - SECURITY_PRIVACY.md: Fail closed when consent is missing or service unavailable.
 */

export class ConsentRequiredError extends Error {
  public readonly purpose: string;

  constructor(purpose: string, message?: string) {
    super(
      message ||
        `Explicit consent required for purpose '${purpose}' before AI processing can proceed.`
    );
    this.name = "ConsentRequiredError";
    this.purpose = purpose;
  }
}

export class ConsentUnavailableError extends Error {
  constructor(message = "Consent service is unavailable. Failing closed.") {
    super(message);
    this.name = "ConsentUnavailableError";
  }
}

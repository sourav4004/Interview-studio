/**
 * Idempotency errors.
 */

export class IdempotencyConflictError extends Error {
  public readonly key: string;
  public readonly scope: string;

  constructor(key: string, scope: string, message?: string) {
    super(
      message ||
        `Operation with idempotency key '${key}' in scope '${scope}' is currently in progress. Retry shortly.`
    );
    this.name = "IdempotencyConflictError";
    this.key = key;
    this.scope = scope;
  }
}

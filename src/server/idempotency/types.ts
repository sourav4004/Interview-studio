/**
 * Idempotency types and constants.
 *
 * References:
 * - AGENTS.md: Use idempotency for quotas, report generation, deletion, email/webhooks, and background jobs.
 * - DECISIONS.md: Idempotent quota reservations, report generation, email/webhook processing, and deletion workflows.
 */

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds in-flight concurrency lock

export type IdempotencyStatus = "started" | "completed" | "failed";

export interface IdempotencyOptions {
  key: string;
  scope: string;
  userId?: string | null;
  guestSessionId?: string | null;
  ttlMs?: number;
  lockTimeoutMs?: number;
}

export interface IdempotencyExecutionResult<T> {
  result: T;
  replayed: boolean;
  status: IdempotencyStatus;
  key: string;
  scope: string;
}

/**
 * Server-Side Idempotency Safeguards Service.
 *
 * Guarantees that critical operations (quota reservation, report generation,
 * background tasks, deletion workflows, retry operations) execute exactly once
 * per client key within the scope, returning cached deterministic results on retries.
 *
 * References:
 * - AGENTS.md (Idempotency rules)
 * - DECISIONS.md (Security and reliability)
 * - ARCHITECTURE.md (Request flow & state transitions)
 */

import { prisma } from "@/server/db";
import {
  DEFAULT_IDEMPOTENCY_TTL_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  IdempotencyExecutionResult,
  IdempotencyOptions,
} from "./types";
import { IdempotencyConflictError } from "./errors";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Idempotency service cannot be imported into client-side code."
  );
}

/**
 * Wraps an asynchronous operation with transactional idempotency guarantees.
 * Returns cached results for completed keys and blocks concurrent in-flight retries.
 */
export async function withIdempotency<T>(
  options: IdempotencyOptions,
  operationFn: () => Promise<T>
): Promise<IdempotencyExecutionResult<T>> {
  const {
    key,
    scope,
    userId = null,
    guestSessionId = null,
    ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  } = options;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // 1. Check or acquire idempotency record in an isolated transaction
  const existing = await prisma.$transaction(async (tx) => {
    const record = await tx.idempotencyKey.findUnique({
      where: {
        key_scope: { key, scope },
      },
    });

    if (!record) {
      // Create new record with started status
      await tx.idempotencyKey.create({
        data: {
          key,
          scope,
          userId,
          guestSessionId,
          status: "started",
          lockedAt: now,
          expiresAt,
        },
      });
      return null;
    }

    // Record exists: check status
    if (record.status === "completed") {
      return record;
    }

    if (record.status === "started") {
      const lockAge = now.getTime() - record.lockedAt.getTime();
      if (lockAge < lockTimeoutMs) {
        // Active in-flight operation: reject concurrent collision
        throw new IdempotencyConflictError(key, scope);
      }
      // Stale lock: update lock timestamp and retry
      await tx.idempotencyKey.update({
        where: { id: record.id },
        data: {
          lockedAt: now,
          expiresAt,
          userId: userId || record.userId,
          guestSessionId: guestSessionId || record.guestSessionId,
        },
      });
      return null;
    }

    // Previous attempt failed: allow fresh retry
    await tx.idempotencyKey.update({
      where: { id: record.id },
      data: {
        status: "started",
        lockedAt: now,
        expiresAt,
        userId: userId || record.userId,
        guestSessionId: guestSessionId || record.guestSessionId,
      },
    });
    return null;
  });

  // 2. If a completed result exists, replay the stored response
  if (existing && existing.status === "completed") {
    let parsedResult: T;
    try {
      parsedResult = existing.responseBody
        ? (JSON.parse(existing.responseBody) as T)
        : (undefined as unknown as T);
    } catch {
      parsedResult = undefined as unknown as T;
    }

    return {
      result: parsedResult,
      replayed: true,
      status: "completed",
      key,
      scope,
    };
  }

  // 3. Execute the actual underlying operation
  try {
    const result = await operationFn();

    // Persist completed result
    await prisma.idempotencyKey.update({
      where: {
        key_scope: { key, scope },
      },
      data: {
        status: "completed",
        responseBody: result !== undefined ? JSON.stringify(result) : null,
      },
    });

    return {
      result,
      replayed: false,
      status: "completed",
      key,
      scope,
    };
  } catch (error) {
    // Record failed state to unlock subsequent retries
    try {
      await prisma.idempotencyKey.update({
        where: {
          key_scope: { key, scope },
        },
        data: {
          status: "failed",
        },
      });
    } catch {
      // Ignore database cleanup failure if connection dropped
    }

    throw error;
  }
}

/**
 * Clean up expired idempotency keys beyond their retention window.
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  return result.count;
}

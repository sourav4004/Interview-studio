/**
 * Usage Tracking & Atomic Quota Reservation Service.
 *
 * Implements:
 * - Atomic usage-reservation before starting AI operations.
 * - Rolling 24-hour quota allowance check for users and guest sessions.
 * - Concurrency protection: in-flight reservations count against quota.
 * - Safe release: failed starts do not consume quota.
 * - Token metadata recording on completion.
 *
 * References:
 * - ARCHITECTURE.md (Section 3: usage, Section 4: usage reservation)
 * - DECISIONS.md (Idempotent quota reservations and state transitions)
 */

import { prisma } from "@/server/db";
import {
  TokenUsageMetadata,
  UsageAction,
  UsageActor,
  UsageAllowanceStatus,
  UsageReservation,
  getDailyQuotaLimit,
} from "./types";
import {
  UsageInvalidActorError,
  UsageLimitExceededError,
  UsageReservationNotFoundError,
} from "./errors";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Usage service cannot be imported into client-side code."
  );
}

const ROLLING_WINDOW_HOURS = 24;

/**
 * Validates actor identity and extracts target filter.
 */
function getActorFilter(actor: UsageActor) {
  if (actor.userId) {
    return { userId: actor.userId, isGuest: false };
  }
  if (actor.guestSessionId) {
    return { guestSessionId: actor.guestSessionId, isGuest: true };
  }
  throw new UsageInvalidActorError();
}

/**
 * Evaluates current consumption against configured daily quota.
 */
export async function checkUsageAllowance(
  actor: UsageActor
): Promise<UsageAllowanceStatus> {
  const { isGuest, ...whereActor } = getActorFilter(actor);
  const limit = getDailyQuotaLimit(isGuest);

  const windowStart = new Date(
    Date.now() - ROLLING_WINDOW_HOURS * 60 * 60 * 1000
  );

  // Both committed usage and active in-flight reservations count against quota
  const activeRecords = await prisma.usageRecord.findMany({
    where: {
      ...whereActor,
      createdAt: { gte: windowStart },
      status: { in: ["reserved", "committed"] },
    },
    select: { unitsReserved: true },
  });

  const consumed = activeRecords.reduce((sum, r) => sum + r.unitsReserved, 0);
  const remaining = Math.max(0, limit - consumed);

  return {
    allowed: consumed < limit,
    limit,
    consumed,
    remaining,
  };
}

/**
 * Atomically reserves a unit of usage quota for an AI action.
 * Throws UsageLimitExceededError if quota is reached.
 */
export async function reserveUsage(
  actor: UsageActor,
  action: UsageAction,
  interviewId?: string | null
): Promise<UsageReservation> {
  const { isGuest, ...whereActor } = getActorFilter(actor);
  const limit = getDailyQuotaLimit(isGuest);

  return await prisma.$transaction(async (tx) => {
    const windowStart = new Date(
      Date.now() - ROLLING_WINDOW_HOURS * 60 * 60 * 1000
    );

    // Sum active usage within transaction to prevent race conditions
    const activeRecords = await tx.usageRecord.findMany({
      where: {
        ...whereActor,
        createdAt: { gte: windowStart },
        status: { in: ["reserved", "committed"] },
      },
      select: { unitsReserved: true },
    });

    const consumed = activeRecords.reduce((sum, r) => sum + r.unitsReserved, 0);
    if (consumed >= limit) {
      throw new UsageLimitExceededError(limit, 0);
    }

    const created = await tx.usageRecord.create({
      data: {
        userId: actor.userId || null,
        guestSessionId: actor.guestSessionId || null,
        interviewId: interviewId || null,
        action,
        status: "reserved",
        unitsReserved: 1,
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      guestSessionId: created.guestSessionId,
      interviewId: created.interviewId,
      action: created.action as UsageAction,
      status: created.status as "reserved",
      unitsReserved: created.unitsReserved,
      createdAt: created.createdAt,
    };
  });
}

/**
 * Commits a usage reservation upon successful operation completion.
 * Attaches token usage metadata if available from the provider.
 */
export async function commitUsage(
  reservationId: string,
  metadata?: TokenUsageMetadata
): Promise<UsageReservation> {
  try {
    const updated = await prisma.usageRecord.update({
      where: { id: reservationId },
      data: {
        status: "committed",
        promptTokens: metadata?.promptTokens,
        completionTokens: metadata?.completionTokens,
        totalTokens: metadata?.totalTokens,
        model: metadata?.model,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      guestSessionId: updated.guestSessionId,
      interviewId: updated.interviewId,
      action: updated.action as UsageAction,
      status: updated.status as "committed",
      unitsReserved: updated.unitsReserved,
      createdAt: updated.createdAt,
    };
  } catch {
    throw new UsageReservationNotFoundError(reservationId);
  }
}

/**
 * Releases a usage reservation if the operation failed.
 * Released reservations do not consume the user's quota.
 */
export async function releaseUsage(
  reservationId: string,
  interviewId?: string | null
): Promise<UsageReservation> {
  try {
    const updated = await prisma.usageRecord.update({
      where: { id: reservationId },
      data: {
        status: "released",
        ...(interviewId !== undefined ? { interviewId } : {}),
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      guestSessionId: updated.guestSessionId,
      interviewId: updated.interviewId,
      action: updated.action as UsageAction,
      status: updated.status as "released",
      unitsReserved: updated.unitsReserved,
      createdAt: updated.createdAt,
    };
  } catch {
    throw new UsageReservationNotFoundError(reservationId);
  }
}

/**
 * Helper to execute an operation within an atomic usage reservation envelope.
 * Automatically releases quota if the operation throws.
 */
export async function withUsageReservation<T>(
  actor: UsageActor,
  action: UsageAction,
  operation: (reservation: UsageReservation) => Promise<{ result: T; metadata?: TokenUsageMetadata; interviewId?: string }>,
  options: { interviewId?: string } = {}
): Promise<T> {
  const reservation = await reserveUsage(actor, action, options.interviewId);

  try {
    const outcome = await operation(reservation);
    await commitUsage(reservation.id, outcome.metadata);
    return outcome.result;
  } catch (error) {
    // Release reservation so failed attempt does not consume user's allowance
    try {
      await releaseUsage(reservation.id);
    } catch {
      // Safe cleanup fallback
    }
    throw error;
  }
}

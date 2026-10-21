/**
 * Server-Side Guest Session Management Service.
 *
 * Implements cryptographically secure, expiring guest session primitives with:
 * - Hashed token database storage (SHA-256)
 * - Strict expiry enforcement (default 24 hours)
 * - Server-side resource ownership assertions
 * - Purpose-specific consent tracking for temporary guest sessions
 * - Safe cleanup of expired guest sessions
 *
 * References:
 * - SECURITY_PRIVACY.md (Hashed guest storage, server ownership)
 * - PRODUCT_SPEC.md (Section 3: Continue as guest, temporary report validity)
 */

import { prisma } from "@/server/db";
import {
  GUEST_SESSION_DURATION_MS,
  GuestSessionContext,
  GuestSessionData,
  GuestSessionWithToken,
} from "./types";
import { generateGuestToken, hashGuestToken } from "./crypto";
import {
  GuestSessionExpiredError,
  GuestSessionNotFoundError,
  GuestUnauthorizedError,
} from "./errors";
import { CURRENT_NOTICE_VERSION } from "@/server/consent/types";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Guest session service cannot be imported into client-side code."
  );
}

/**
 * Creates a new expiring guest session.
 * Generates an opaque random token for the client, while persisting only its SHA-256 hash.
 */
export async function createGuestSession(
  context: GuestSessionContext = {},
  durationMs: number = GUEST_SESSION_DURATION_MS
): Promise<GuestSessionWithToken> {
  const rawToken = generateGuestToken();
  const tokenHash = hashGuestToken(rawToken);
  const expiresAt = new Date(Date.now() + durationMs);

  const session = await prisma.guestSession.create({
    data: {
      tokenHash,
      expiresAt,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      noticeVersion: CURRENT_NOTICE_VERSION,
    },
  });

  return {
    rawToken,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      consentAiQuestions: session.consentAiQuestions,
      consentAiEvaluation: session.consentAiEvaluation,
      consentResumeProcessing: session.consentResumeProcessing,
      noticeVersion: session.noticeVersion,
    },
  };
}

/**
 * Validates a guest token against hashed database storage and verifies expiration.
 * Throws GuestSessionNotFoundError if invalid, or GuestSessionExpiredError if expired.
 */
export async function validateGuestSession(
  rawToken: string
): Promise<GuestSessionData> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    throw new GuestSessionNotFoundError();
  }

  const tokenHash = hashGuestToken(rawToken);
  const session = await prisma.guestSession.findUnique({
    where: { tokenHash },
  });

  if (!session) {
    throw new GuestSessionNotFoundError();
  }

  const now = new Date();
  if (session.expiresAt <= now) {
    throw new GuestSessionExpiredError();
  }

  return {
    id: session.id,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    consentAiQuestions: session.consentAiQuestions,
    consentAiEvaluation: session.consentAiEvaluation,
    consentResumeProcessing: session.consentResumeProcessing,
    noticeVersion: session.noticeVersion,
  };
}

/**
 * Asserts that a guest token is valid and specifically owns the requested guest resource.
 */
export async function assertGuestOwnership(
  rawToken: string,
  resourceGuestId: string
): Promise<GuestSessionData> {
  const session = await validateGuestSession(rawToken);

  if (session.id !== resourceGuestId) {
    throw new GuestUnauthorizedError(
      "Guest session does not match resource ownership."
    );
  }

  return session;
}

/**
 * Grants required AI processing consent for a temporary guest session.
 */
export async function grantGuestConsent(
  rawToken: string,
  purposes: Array<"ai_questions" | "ai_evaluation" | "resume_processing">,
  context: GuestSessionContext = {}
): Promise<GuestSessionData> {
  const session = await validateGuestSession(rawToken);
  if (purposes.length === 0) return session;

  const updateData: Record<string, boolean> = {};
  if (purposes.includes("ai_questions")) updateData.consentAiQuestions = true;
  if (purposes.includes("ai_evaluation")) updateData.consentAiEvaluation = true;
  if (purposes.includes("resume_processing")) updateData.consentResumeProcessing = true;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.guestSession.update({
      where: { id: session.id },
      data: updateData,
    });

    for (const purpose of purposes) {
      await tx.consentAuditLog.create({
        data: {
          guestSessionId: session.id,
          purpose,
          action: "granted",
          noticeVersion: session.noticeVersion,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
        },
      });
    }

    return {
      id: updated.id,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ipAddress: updated.ipAddress,
      userAgent: updated.userAgent,
      consentAiQuestions: updated.consentAiQuestions,
      consentAiEvaluation: updated.consentAiEvaluation,
      consentResumeProcessing: updated.consentResumeProcessing,
      noticeVersion: updated.noticeVersion,
    };
  });
}

/**
 * Immediately withdraws AI processing consent for a temporary guest session.
 */
export async function withdrawGuestConsent(
  rawToken: string,
  purposes: Array<"ai_questions" | "ai_evaluation" | "resume_processing">,
  context: GuestSessionContext = {}
): Promise<GuestSessionData> {
  const session = await validateGuestSession(rawToken);
  if (purposes.length === 0) return session;

  const updateData: Record<string, boolean> = {};
  if (purposes.includes("ai_questions")) updateData.consentAiQuestions = false;
  if (purposes.includes("ai_evaluation")) updateData.consentAiEvaluation = false;
  if (purposes.includes("resume_processing")) updateData.consentResumeProcessing = false;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.guestSession.update({
      where: { id: session.id },
      data: updateData,
    });

    for (const purpose of purposes) {
      await tx.consentAuditLog.create({
        data: {
          guestSessionId: session.id,
          purpose,
          action: "withdrawn",
          noticeVersion: session.noticeVersion,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
        },
      });
    }

    return {
      id: updated.id,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ipAddress: updated.ipAddress,
      userAgent: updated.userAgent,
      consentAiQuestions: updated.consentAiQuestions,
      consentAiEvaluation: updated.consentAiEvaluation,
      consentResumeProcessing: updated.consentResumeProcessing,
      noticeVersion: updated.noticeVersion,
    };
  });
}

/**
 * Clean up expired guest sessions from the database.
 * Cascades to associated audit logs and idempotency keys via foreign key constraints.
 */
export async function cleanupExpiredGuestSessions(): Promise<number> {
  const result = await prisma.guestSession.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  return result.count;
}

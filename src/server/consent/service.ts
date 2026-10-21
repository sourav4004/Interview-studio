/**
 * Server-Side Consent Management and Enforcement Service.
 *
 * Implements purpose-specific consent persistence, auditable history, and
 * server-side enforcement boundaries as mandated by:
 * - SECURITY_PRIVACY.md (Principles, Consent purposes, Consent enforcement)
 * - DECISIONS.md (Privacy and consent)
 * - AGENTS.md (Check consent at request, job, retry, and persistence boundaries)
 */

import { prisma } from "@/server/db";
import {
  ConsentPurpose,
  CURRENT_NOTICE_VERSION,
  ConsentAuditContext,
  UserConsentState,
  ConsentAuditRecord,
} from "./types";
import { ConsentRequiredError, ConsentUnavailableError } from "./errors";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Consent service cannot be imported into client-side code."
  );
}

/**
 * Mapping between domain consent purposes and database model column names.
 */
const PURPOSE_FIELD_MAP: Record<ConsentPurpose, keyof {
  consentAiQuestions: boolean;
  consentAiEvaluation: boolean;
  consentResumeProcessing: boolean;
  consentSavedResume: boolean;
  consentPersonalization: boolean;
}> = {
  ai_questions: "consentAiQuestions",
  ai_evaluation: "consentAiEvaluation",
  resume_processing: "consentResumeProcessing",
  saved_resume: "consentSavedResume",
  personalization: "consentPersonalization",
};

/**
 * Retrieves the current authoritative consent state for a user.
 * Returns safe defaults (all false) if no consent record has been established yet.
 */
export async function getUserConsent(userId: string): Promise<UserConsentState> {
  try {
    const record = await prisma.userConsent.findUnique({
      where: { userId },
    });

    if (!record) {
      return {
        ai_questions: false,
        ai_evaluation: false,
        resume_processing: false,
        saved_resume: false,
        personalization: false,
        noticeVersion: CURRENT_NOTICE_VERSION,
        updatedAt: new Date(0),
      };
    }

    return {
      ai_questions: record.consentAiQuestions,
      ai_evaluation: record.consentAiEvaluation,
      resume_processing: record.consentResumeProcessing,
      saved_resume: record.consentSavedResume,
      personalization: record.consentPersonalization,
      noticeVersion: record.noticeVersion,
      updatedAt: record.updatedAt,
    };
  } catch (error) {
    // Fail closed if database or consent service is unreachable
    console.error("Failed to query user consent state:", error instanceof Error ? error.message : "Unknown error");
    throw new ConsentUnavailableError();
  }
}

/**
 * Grants consent for one or more specific purposes atomically.
 * Updates current consent state and logs an immutable audit trail entry for each purpose.
 */
export async function grantConsent(
  userId: string,
  purposes: ConsentPurpose[],
  context: ConsentAuditContext = {}
): Promise<UserConsentState> {
  if (purposes.length === 0) {
    return getUserConsent(userId);
  }

  const noticeVersion = context.noticeVersion || CURRENT_NOTICE_VERSION;
  const updatePayload: Record<string, boolean | string> = {
    noticeVersion,
  };

  for (const purpose of purposes) {
    const fieldName = PURPOSE_FIELD_MAP[purpose];
    updatePayload[fieldName] = true;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Upsert user consent state
      const updated = await tx.userConsent.upsert({
        where: { userId },
        create: {
          userId,
          noticeVersion,
          ...updatePayload,
        },
        update: updatePayload,
      });

      // 2. Insert audit log records for each granted purpose
      for (const purpose of purposes) {
        await tx.consentAuditLog.create({
          data: {
            userId,
            purpose,
            action: "granted",
            noticeVersion,
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null,
          },
        });
      }

      return {
        ai_questions: updated.consentAiQuestions,
        ai_evaluation: updated.consentAiEvaluation,
        resume_processing: updated.consentResumeProcessing,
        saved_resume: updated.consentSavedResume,
        personalization: updated.consentPersonalization,
        noticeVersion: updated.noticeVersion,
        updatedAt: updated.updatedAt,
      };
    });
  } catch (error) {
    if (error instanceof ConsentUnavailableError) throw error;
    console.error("Failed to grant consent:", error instanceof Error ? error.message : "Unknown error");
    throw new ConsentUnavailableError("Unable to record consent decision. Failing closed.");
  }
}

/**
 * Immediately withdraws consent for one or more specific purposes.
 * Withdrawal blocks subsequent processing immediately and records an audit log.
 * Never silently reactivates withdrawn consent.
 */
export async function withdrawConsent(
  userId: string,
  purposes: ConsentPurpose[],
  context: ConsentAuditContext = {}
): Promise<UserConsentState> {
  if (purposes.length === 0) {
    return getUserConsent(userId);
  }

  const noticeVersion = context.noticeVersion || CURRENT_NOTICE_VERSION;
  const updatePayload: Record<string, boolean> = {};

  for (const purpose of purposes) {
    const fieldName = PURPOSE_FIELD_MAP[purpose];
    updatePayload[fieldName] = false;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.userConsent.upsert({
        where: { userId },
        create: {
          userId,
          noticeVersion,
          ...updatePayload,
        },
        update: updatePayload,
      });

      for (const purpose of purposes) {
        await tx.consentAuditLog.create({
          data: {
            userId,
            purpose,
            action: "withdrawn",
            noticeVersion,
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null,
          },
        });
      }

      // Atomically and idempotently purge personalization profile if personalization consent is withdrawn
      if (purposes.includes("personalization")) {
        await tx.personalizationProfile.deleteMany({
          where: { userId },
        });
      }

      return {
        ai_questions: updated.consentAiQuestions,
        ai_evaluation: updated.consentAiEvaluation,
        resume_processing: updated.consentResumeProcessing,
        saved_resume: updated.consentSavedResume,
        personalization: updated.consentPersonalization,
        noticeVersion: updated.noticeVersion,
        updatedAt: updated.updatedAt,
      };
    });
  } catch (error) {
    if (error instanceof ConsentUnavailableError) throw error;
    console.error("Failed to withdraw consent:", error instanceof Error ? error.message : "Unknown error");
    throw new ConsentUnavailableError("Unable to process consent withdrawal. Failing closed.");
  }
}

/**
 * Asserts that consent for a specific purpose is actively granted.
 * Throws ConsentRequiredError if not granted, or ConsentUnavailableError if unreachable.
 */
export async function assertConsent(
  userId: string,
  purpose: ConsentPurpose
): Promise<void> {
  const consent = await getUserConsent(userId);
  if (!consent[purpose]) {
    throw new ConsentRequiredError(purpose);
  }
}

/**
 * Enforces all required AI processing consents before interview processing can proceed.
 * - Always requires: ai_questions and ai_evaluation.
 * - If hasResume is true: also requires resume_processing.
 */
export async function assertRequiredAiConsent(
  userId: string,
  options: { hasResume?: boolean } = {}
): Promise<void> {
  const consent = await getUserConsent(userId);

  if (!consent.ai_questions) {
    throw new ConsentRequiredError(
      "ai_questions",
      "Explicit consent for AI question generation is required before starting an interview."
    );
  }

  if (!consent.ai_evaluation) {
    throw new ConsentRequiredError(
      "ai_evaluation",
      "Explicit consent for AI answer evaluation is required before starting an interview."
    );
  }

  if (options.hasResume && !consent.resume_processing) {
    throw new ConsentRequiredError(
      "resume_processing",
      "Explicit consent for resume content processing is required to use resume context in an interview."
    );
  }
}

/**
 * Retrieves the immutable consent audit history for a user.
 */
export async function getConsentAuditTrail(
  userId: string
): Promise<ConsentAuditRecord[]> {
  try {
    const logs = await prisma.consentAuditLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      guestSessionId: log.guestSessionId,
      purpose: log.purpose as ConsentPurpose,
      action: log.action as "granted" | "withdrawn",
      noticeVersion: log.noticeVersion,
      timestamp: log.timestamp,
    }));
  } catch (error) {
    console.error("Failed to fetch consent audit trail:", error instanceof Error ? error.message : "Unknown error");
    throw new ConsentUnavailableError();
  }
}

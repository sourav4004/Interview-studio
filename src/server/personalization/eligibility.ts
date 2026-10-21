/**
 * Personalization Consent & Report Eligibility Service.
 *
 * Enforces strict consent gating and post-consent eligibility boundaries per:
 * - PRODUCT_SPEC.md (Section 10: Personalization)
 * - SECURITY_PRIVACY.md (Purpose 5: Historical Data Personalization)
 * - DECISIONS.md (3+ eligible post-consent interviews required)
 */

import { prisma } from "@/server/db";
import { getUserConsent } from "@/server/consent/service";
import { DimensionEvaluation } from "@/server/evaluation/types";
import { InterviewMode } from "@/server/ai/types";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Personalization eligibility cannot be imported into client-side code."
  );
}

export interface ActiveConsentState {
  isGranted: boolean;
  grantedAt: Date | null;
  noticeVersion: string;
}

export interface ValidatedEligibleReport {
  id: string;
  interviewId: string;
  interviewMode: InterviewMode;
  role: string;
  difficulty: string;
  overallScore: number;
  rubricVersion: string;
  dimensionScores: DimensionEvaluation[];
  completedAt: Date;
}

/**
 * Retrieves the authoritative active personalization consent grant and its timestamp.
 * Returns isGranted: false if consent is missing, disabled, withdrawn, or if the
 * post-consent grant timestamp cannot be reliably established from the audit log (fail closed).
 */
export async function getActivePersonalizationConsent(
  userId: string
): Promise<ActiveConsentState> {
  try {
    const consentState = await getUserConsent(userId);

    if (!consentState.personalization) {
      return {
        isGranted: false,
        grantedAt: null,
        noticeVersion: consentState.noticeVersion,
      };
    }

    // Query the immutable audit log for the most recent grant timestamp
    const latestGrant = await prisma.consentAuditLog.findFirst({
      where: {
        userId,
        purpose: "personalization",
        action: "granted",
      },
      orderBy: { timestamp: "desc" },
    });

    if (!latestGrant) {
      // Fail closed: cannot establish an authoritative post-consent boundary without audit record
      return {
        isGranted: false,
        grantedAt: null,
        noticeVersion: consentState.noticeVersion,
      };
    }

    return {
      isGranted: true,
      grantedAt: latestGrant.timestamp,
      noticeVersion: latestGrant.noticeVersion,
    };
  } catch (error) {
    console.error(
      "Failed to verify personalization consent grant:",
      error instanceof Error ? error.message : "Unknown error"
    );
    // Fail closed on error
    return {
      isGranted: false,
      grantedAt: null,
      noticeVersion: "1.0",
    };
  }
}

/**
 * Retrieves all eligible completed interview reports for the user.
 * Strictly enforces that:
 * 1. The report belongs to the authorized user.
 * 2. The report status is "completed" with a valid overall score.
 * 3. The underlying interview is "completed".
 * 4. Both the interview completion and report creation occurred AT OR AFTER the active consent grant.
 * 5. Dimension evaluation payloads are valid and conform to schema.
 */
export async function getEligibleReportsForPersonalization(
  userId: string,
  grantedAt: Date
): Promise<ValidatedEligibleReport[]> {
  const rawReports = await prisma.interviewReport.findMany({
    where: {
      userId,
      status: "completed",
      overallScore: { not: null },
      createdAt: { gte: grantedAt },
      interview: {
        userId,
        status: "completed",
        endedAt: { gte: grantedAt },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      interviewId: true,
      overallScore: true,
      rubricVersion: true,
      dimensionScores: true,
      createdAt: true,
      interview: {
        select: {
          interviewType: true,
          role: true,
          difficulty: true,
          endedAt: true,
        },
      },
    },
  });

  const validated: ValidatedEligibleReport[] = [];

  for (const item of rawReports) {
    if (typeof item.overallScore !== "number" || isNaN(item.overallScore)) {
      continue;
    }

    const rawDimensions = item.dimensionScores as unknown;
    const dimensionList: DimensionEvaluation[] = Array.isArray(rawDimensions)
      ? (rawDimensions as DimensionEvaluation[])
      : [];

    validated.push({
      id: item.id,
      interviewId: item.interviewId,
      interviewMode: item.interview.interviewType as InterviewMode,
      role: item.interview.role,
      difficulty: item.interview.difficulty,
      overallScore: item.overallScore,
      rubricVersion: item.rubricVersion ?? "1.0",
      dimensionScores: dimensionList,
      completedAt: item.createdAt,
    });
  }

  return validated;
}

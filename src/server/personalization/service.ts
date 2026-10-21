/**
 * Server-Side Personalization Profile Service.
 *
 * Coordinates consent verification, eligibility checks, deterministic compilation,
 * and safe persistence/refresh workflows per:
 * - PRODUCT_SPEC.md (Section 9: Dashboard, Section 10: Personalization)
 * - SECURITY_PRIVACY.md (Purpose 5: Historical Data Personalization)
 * - DECISIONS.md (Deterministic aggregation, strict evidence grounding, atomic purge)
 */

import { prisma } from "@/server/db";
import { SecurityActor } from "@/server/auth/authorization";
import {
  ActiveConsentState,
  getActivePersonalizationConsent,
  getEligibleReportsForPersonalization,
} from "./eligibility";
import {
  compilePersonalizationProfile,
  MINIMUM_ELIGIBLE_REPORTS,
} from "./compiler";
import { PersonalizationProfileResult, PersonalizationProfileData } from "./types";
import { personalizationProfileDataSchema } from "./schemas";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Personalization service cannot be imported into client-side code."
  );
}

/**
 * Retrieves the candidate's personalization profile or compiles a fresh one
 * if new eligible reports are detected.
 *
 * Strictly enforces:
 * 1. Registered user authorization (guest sessions receive general guidance only).
 * 2. Active personalization consent grant verification.
 * 3. Minimum 3 eligible completed reports whose interviews completed post-consent.
 * 4. Re-checking consent boundary before persisting any profile.
 */
export async function getOrCompilePersonalizationProfile(
  actor: SecurityActor,
  options?: { forceRefresh?: boolean }
): Promise<PersonalizationProfileResult> {
  // 1. Authorization: Only registered users can have a personalization profile
  if (!actor.userId) {
    return {
      status: "guest_restricted",
      schemaVersion: "1.0",
      isPersonalized: false,
      eligibleReportCount: 0,
      requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
      consentGrantedAt: null,
      lastRefreshedAt: null,
      data: null,
      fallbackGuidance:
        "Take a diagnostic Technical or Behavioral interview to benchmark your foundational skills.",
    };
  }

  const userId = actor.userId;

  // 2. Authoritative consent check
  const consentState: ActiveConsentState = await getActivePersonalizationConsent(userId);

  if (!consentState.isGranted || !consentState.grantedAt) {
    return {
      status: "disabled",
      schemaVersion: "1.0",
      isPersonalized: false,
      eligibleReportCount: 0,
      requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
      consentGrantedAt: null,
      lastRefreshedAt: null,
      data: null,
      fallbackGuidance:
        "Personalization is off. Enable Historical Data Personalization in Settings to receive tailored guidance based on completed simulations.",
    };
  }

  const grantedAt = consentState.grantedAt;

  // 3. Query eligible post-consent reports
  const eligibleReports = await getEligibleReportsForPersonalization(userId, grantedAt);

  if (eligibleReports.length < MINIMUM_ELIGIBLE_REPORTS) {
    return {
      status: "insufficient_evidence",
      schemaVersion: "1.0",
      isPersonalized: false,
      eligibleReportCount: eligibleReports.length,
      requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
      consentGrantedAt: grantedAt,
      lastRefreshedAt: null,
      data: null,
      fallbackGuidance: `Personalization is active. Complete ${MINIMUM_ELIGIBLE_REPORTS} post-consent simulations to unlock tailored guidance (${eligibleReports.length} of ${MINIMUM_ELIGIBLE_REPORTS} completed).`,
    };
  }

  // 4. Check for existing stored profile to avoid unnecessary recompilation
  const storedProfile = await prisma.personalizationProfile.findUnique({
    where: { userId },
  });

  const isStoredProfileCurrent =
    storedProfile &&
    storedProfile.status === "ready" &&
    storedProfile.consentGrantedAt.getTime() === grantedAt.getTime() &&
    storedProfile.eligibleReportCount === eligibleReports.length &&
    !options?.forceRefresh;

  if (isStoredProfileCurrent) {
    try {
      const parsedData = personalizationProfileDataSchema.parse(
        storedProfile.profileData
      );

      return {
        status: "ready",
        schemaVersion: storedProfile.schemaVersion,
        isPersonalized: true,
        eligibleReportCount: storedProfile.eligibleReportCount,
        requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
        consentGrantedAt: storedProfile.consentGrantedAt,
        lastRefreshedAt: storedProfile.lastRefreshedAt,
        data: parsedData,
        fallbackGuidance: null,
      };
    } catch {
      // If stored profile data is corrupted, fall through to recompile cleanly
    }
  }

  // 5. Deterministic compilation
  const compiledData: PersonalizationProfileData | null = compilePersonalizationProfile(
    userId,
    grantedAt,
    eligibleReports
  );

  if (!compiledData) {
    return {
      status: "insufficient_evidence",
      schemaVersion: "1.0",
      isPersonalized: false,
      eligibleReportCount: eligibleReports.length,
      requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
      consentGrantedAt: grantedAt,
      lastRefreshedAt: null,
      data: null,
      fallbackGuidance:
        "Insufficient evaluation evidence across dimensions to generate tailored guidance.",
    };
  }

  // 6. Pre-commit consent re-verification boundary (prevents race with withdrawal)
  const recheckConsent = await getActivePersonalizationConsent(userId);
  if (
    !recheckConsent.isGranted ||
    recheckConsent.grantedAt?.getTime() !== grantedAt.getTime()
  ) {
    // Consent was withdrawn or changed in flight; fail closed immediately without persisting
    return {
      status: "disabled",
      schemaVersion: "1.0",
      isPersonalized: false,
      eligibleReportCount: 0,
      requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
      consentGrantedAt: null,
      lastRefreshedAt: null,
      data: null,
      fallbackGuidance:
        "Personalization is off. Enable Historical Data Personalization in Settings to receive tailored guidance.",
    };
  }

  // 7. Persist or update the compiled profile
  const now = new Date();
  const reportIds = eligibleReports.map((r) => r.id);

  const savedProfile = await prisma.personalizationProfile.upsert({
    where: { userId },
    create: {
      userId,
      status: "ready",
      schemaVersion: "1.0",
      consentGrantedAt: grantedAt,
      consentNoticeVersion: consentState.noticeVersion,
      eligibleReportCount: eligibleReports.length,
      eligibleReportIds: reportIds,
      compiledAt: now,
      lastRefreshedAt: now,
      profileData: compiledData as unknown as object,
    },
    update: {
      status: "ready",
      consentGrantedAt: grantedAt,
      consentNoticeVersion: consentState.noticeVersion,
      eligibleReportCount: eligibleReports.length,
      eligibleReportIds: reportIds,
      lastRefreshedAt: now,
      profileData: compiledData as unknown as object,
    },
  });

  return {
    status: "ready",
    schemaVersion: savedProfile.schemaVersion,
    isPersonalized: true,
    eligibleReportCount: savedProfile.eligibleReportCount,
    requiredReportCount: MINIMUM_ELIGIBLE_REPORTS,
    consentGrantedAt: savedProfile.consentGrantedAt,
    lastRefreshedAt: savedProfile.lastRefreshedAt,
    data: compiledData,
    fallbackGuidance: null,
  };
}

/**
 * Idempotently purges the candidate's personalization profile and derived data.
 * Called automatically when personalization consent is withdrawn.
 */
export async function purgePersonalizationProfile(userId: string): Promise<void> {
  try {
    await prisma.personalizationProfile.deleteMany({
      where: { userId },
    });
  } catch (error) {
    console.error(
      "Failed to purge personalization profile:",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

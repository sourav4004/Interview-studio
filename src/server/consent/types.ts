/**
 * Consent types and definitions.
 *
 * References:
 * - SECURITY_PRIVACY.md (Section: Consent purposes and enforcement)
 * - PRODUCT_SPEC.md (Section 3: Core user journey)
 */

export const CURRENT_NOTICE_VERSION = "1.0";

/**
 * The 5 purpose-specific consent categories defined in SECURITY_PRIVACY.md:
 * 1. ai_questions: Generate interview questions from relevant supplied information (Required for AI interview)
 * 2. ai_evaluation: Evaluate answers and generate reports (Required for AI report)
 * 3. resume_processing: Process resume content for the current interview (Required when resume supplied)
 * 4. saved_resume: Store a resume for future interviews (Optional, opt-in, off by default)
 * 5. personalization: Use permitted historical interview data for personalization (Optional, opt-in, off by default)
 */
export const CONSENT_PURPOSES = [
  "ai_questions",
  "ai_evaluation",
  "resume_processing",
  "saved_resume",
  "personalization",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_ACTIONS = ["granted", "withdrawn"] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

export interface ConsentAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  noticeVersion?: string;
}

export interface UserConsentState {
  ai_questions: boolean;
  ai_evaluation: boolean;
  resume_processing: boolean;
  saved_resume: boolean;
  personalization: boolean;
  noticeVersion: string;
  updatedAt: Date;
}

export interface ConsentAuditRecord {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  purpose: ConsentPurpose;
  action: ConsentAction;
  noticeVersion: string;
  timestamp: Date;
}

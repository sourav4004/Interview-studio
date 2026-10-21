/**
 * Guest session types and constants.
 *
 * References:
 * - PRODUCT_SPEC.md (Section 3: Continue as guest, temporary report validity)
 * - SECURITY_PRIVACY.md (Secure expiring guest sessions, hashed token storage)
 */

export const GUEST_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface GuestSessionData {
  id: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  consentAiQuestions: boolean;
  consentAiEvaluation: boolean;
  consentResumeProcessing: boolean;
  noticeVersion: string;
}

export interface GuestSessionWithToken {
  session: GuestSessionData;
  rawToken: string; // Transmitted only to client once; never stored in db
}

export interface GuestSessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

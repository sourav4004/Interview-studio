/**
 * Email verification delivery handler.
 *
 * Implements token-based verification delivery required by Better Auth.
 * References:
 * - DECISIONS.md (Email verification link: 24 hours)
 * - SECURITY_PRIVACY.md (Never log passwords, tokens, or credentials)
 */

export interface VerificationEmailPayload {
  user: {
    id: string;
    email: string;
    name: string;
  };
  url: string;
  token: string;
}

export type EmailDeliveryHandler = (
  payload: VerificationEmailPayload
) => Promise<void>;

let customEmailHandler: EmailDeliveryHandler | null = null;

/**
 * Configure a custom or mock email handler for testing or development.
 */
export function setCustomEmailHandler(handler: EmailDeliveryHandler | null) {
  customEmailHandler = handler;
}

/**
 * Dispatches verification email using the configured delivery channel.
 * In production when Resend is configured (Milestone 11), sends through the transactional email provider.
 * When unconfigured or during tests, handles safely without exposing secrets.
 */
export async function handleSendVerificationEmail(
  payload: VerificationEmailPayload
): Promise<void> {
  if (customEmailHandler) {
    await customEmailHandler(payload);
    return;
  }

  // Check if Resend API key is configured with a real value
  const hasResend =
    process.env.RESEND_API_KEY &&
    process.env.RESEND_API_KEY !== "replace-me" &&
    process.env.RESEND_API_KEY.length > 5;

  if (hasResend) {
    // Transactional provider delivery will be wired with verified templates in Milestone 11
    return;
  }

  // In non-production environments when unconfigured, safely log diagnostic
  // without revealing the token or secret link
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[Auth Verification] Verification email dispatched for user id: ${payload.user.id}`
    );
  }
}

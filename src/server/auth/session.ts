/**
 * Server-Side Session Retrieval.
 *
 * Implements server-side session resolution for Next.js App Router Server Components
 * and Server Actions using React cache for request deduplication.
 *
 * Validates:
 * 1. Better Auth session token validity and 7-day idle timeout.
 * 2. 30-day absolute session lifetime cutoff (DECISIONS.md & SECURITY_PRIVACY.md).
 */

import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * 30-day absolute session maximum lifetime in milliseconds.
 * Sessions older than this from their creation timestamp are terminated.
 * References: DECISIONS.md, SECURITY_PRIVACY.md
 */
export const ABSOLUTE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  session: SessionData;
}

/**
 * Server-side session retrieval using React cache.
 * Evaluates both Better Auth sliding idle expiration (7 days) and
 * enforced absolute lifetime (30 days from creation).
 */
export const getCurrentSession = cache(
  async (): Promise<AuthenticatedSession | null> => {
    try {
      const requestHeaders = await headers();
      const sessionResult = await auth.api.getSession({
        headers: requestHeaders,
      });

      if (!sessionResult || !sessionResult.session || !sessionResult.user) {
        return null;
      }

      // Check 30-day absolute session lifetime
      const sessionCreatedAt = new Date(sessionResult.session.createdAt).getTime();
      const now = Date.now();
      if (now - sessionCreatedAt > ABSOLUTE_SESSION_MAX_AGE_MS) {
        // Revoke expired session in background
        try {
          await auth.api.revokeSession({
            body: { token: sessionResult.session.token },
            headers: requestHeaders,
          });
        } catch {
          // Ignore revocation cleanup errors
        }
        return null;
      }

      return sessionResult as unknown as AuthenticatedSession;
    } catch {
      return null;
    }
  }
);

/**
 * Security Actor Resolution Helper.
 *
 * Resolves the calling actor identity (registered User or GuestSession) from:
 * 1. Better Auth session (validated userId).
 * 2. Or 'x-guest-token' header / 'guest_token' cookie (validated guestSessionId).
 *
 * Enforces server-side authorization boundaries and zero trust.
 */

import { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { getCurrentSession } from "@/server/auth/session";
import { validateGuestSession } from "@/server/guest";
import { SecurityActor } from "@/server/auth/authorization";

export interface ResolvedActor extends SecurityActor {
  rawGuestToken?: string;
  isAuthenticated: boolean;
}

/**
 * Resolves actor from an incoming NextRequest (used in API Route Handlers).
 */
export async function resolveRequestActor(req: NextRequest): Promise<ResolvedActor> {
  const cookieStore = await cookies();
  const session = await getCurrentSession();
  const userId: string | null = session?.user?.id || null;
  let guestSessionId: string | null = null;
  let rawGuestToken: string | undefined = undefined;

  if (!userId) {
    rawGuestToken =
      req.headers.get("x-guest-token") ||
      cookieStore.get("guest_token")?.value ||
      undefined;

    if (rawGuestToken) {
      try {
        const validated = await validateGuestSession(rawGuestToken);
        guestSessionId = validated.id;
      } catch {
        // Token invalid or expired
      }
    }
  }

  return {
    userId,
    guestSessionId,
    rawGuestToken,
    isAuthenticated: Boolean(userId || guestSessionId),
  };
}

/**
 * Resolves actor in Server Components or Server Actions (without explicit NextRequest).
 */
export async function resolveServerActor(): Promise<ResolvedActor> {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const session = await getCurrentSession();
  const userId: string | null = session?.user?.id || null;
  let guestSessionId: string | null = null;
  let rawGuestToken: string | undefined = undefined;

  if (!userId) {
    rawGuestToken =
      requestHeaders.get("x-guest-token") ||
      cookieStore.get("guest_token")?.value ||
      undefined;

    if (rawGuestToken) {
      try {
        const validated = await validateGuestSession(rawGuestToken);
        guestSessionId = validated.id;
      } catch {
        // Token invalid or expired
      }
    }
  }

  return {
    userId,
    guestSessionId,
    rawGuestToken,
    isAuthenticated: Boolean(userId || guestSessionId),
  };
}

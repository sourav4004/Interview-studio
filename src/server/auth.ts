/**
 * Better Auth Server Configuration.
 *
 * Integrates Better Auth with PostgreSQL via Prisma ORM adapter.
 * Configured according to ARCHITECTURE.md, DECISIONS.md, and SECURITY_PRIVACY.md:
 * - Email & Password authentication (min 8 chars, max 128 chars)
 * - Email verification with 24-hour token lifetime
 * - Google Sign-In configuration (active only when valid credentials are provided)
 * - 7-day idle session lifetime and 1-day rolling refresh
 * - Secure cookie attributes (HttpOnly, SameSite=Lax, Secure in production)
 * - 5-session limit enforced per user on session creation
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./db";
import { handleSendVerificationEmail } from "./auth/email";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Better Auth server instance cannot be imported into client-side code."
  );
}

const isProduction = process.env.NODE_ENV === "production";
const appUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

// Fallback development secret; in production environment BETTER_AUTH_SECRET must be supplied
const secret =
  process.env.BETTER_AUTH_SECRET ||
  "ai-interviewer-local-development-secret-key-min-32-chars";

if (
  isProduction &&
  (!process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET === "replace-with-a-long-random-secret")
) {
  console.warn(
    "[Security Warning]: BETTER_AUTH_SECRET is not defined or is using a placeholder. Configure a secure secret before deploying to production."
  );
}


// Google OAuth configuration: enabled only when real non-placeholder credentials exist (Requirement 5)
const hasGoogleOAuth = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== "replace-me" &&
    process.env.GOOGLE_CLIENT_SECRET !== "replace-me"
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: appUrl,
  secret: secret,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours token lifetime (DECISIONS.md)
    sendVerificationEmail: async (data) => {
      await handleSendVerificationEmail(data);
    },
  },
  socialProviders: {
    ...(hasGoogleOAuth
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7-day idle session duration (604,800 seconds)
    updateAge: 60 * 60 * 24, // 1-day rolling update threshold (86,400 seconds)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Enforce maximum 5 active sessions per user (DECISIONS.md & SECURITY_PRIVACY.md)
          const MAX_ACTIVE_SESSIONS = 5;
          try {
            const activeSessions = await prisma.session.findMany({
              where: { userId: session.userId },
              orderBy: { createdAt: "desc" },
            });
            if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
              const toPrune = activeSessions.slice(MAX_ACTIVE_SESSIONS - 1);
              await prisma.session.deleteMany({
                where: { id: { in: toPrune.map((s) => s.id) } },
              });
            }
          } catch {
            // Safe logging without exposing secret session tokens or user details
            console.error("Session limit enforcement error in databaseHooks");
          }
          return { data: session };
        },
      },
    },
  },
});

export type Auth = typeof auth;

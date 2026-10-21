/**
 * Better Auth Client for React & Next.js.
 *
 * Provides typed authentication hooks (signIn, signUp, signOut, useSession)
 * for client-side components without bundling server secrets.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;

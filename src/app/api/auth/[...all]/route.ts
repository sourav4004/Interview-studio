/**
 * Better Auth Next.js App Router Catch-all Route Handler.
 *
 * Exposes Better Auth REST endpoints (/api/auth/sign-in/email, /api/auth/sign-up/email, etc.)
 */

import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);

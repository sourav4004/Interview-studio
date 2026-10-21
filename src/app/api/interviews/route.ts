/**
 * Route Handler: POST /api/interviews
 *
 * Initializes an interview session:
 * 1. Resolves authenticated user or secure guest session.
 * 2. Applies affirmative consent grants if provided in request.
 * 3. Enforces server-side validation, consent, and usage quota.
 * 4. Calls interview creation service with idempotency safeguards.
 * 5. Returns created interview summary.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/server/auth/session";
import {
  createGuestSession,
  grantGuestConsent,
  validateGuestSession,
} from "@/server/guest";
import { grantConsent } from "@/server/consent";
import { ConsentPurpose } from "@/server/consent/types";
import { createAndInitializeInterview } from "@/server/interviews/service";
import { ConsentRequiredError } from "@/server/consent/errors";
import { UsageLimitExceededError } from "@/server/usage/errors";
import { InterviewConfigurationError } from "@/server/interviews/errors";
import { IdempotencyConflictError } from "@/server/idempotency/errors";

// Route Segment Config: allow up to 60s for AI question generation on Vercel (Hobby max 60s, Pro up to 300s)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();

    // 1. Resolve actor (registered user or guest session)
    const session = await getCurrentSession();
    const userId: string | null = session?.user?.id || null;
    let guestSessionId: string | null = null;
    let guestTokenToSet: string | null = null;

    if (!userId) {
      let rawGuestToken =
        req.headers.get("x-guest-token") ||
        cookieStore.get("guest_token")?.value;

      if (rawGuestToken) {
        try {
          const validated = await validateGuestSession(rawGuestToken);
          guestSessionId = validated.id;
        } catch {
          // Token expired or invalid; create fresh guest session
          rawGuestToken = undefined;
        }
      }

      if (!rawGuestToken) {
        const newGuest = await createGuestSession({
          ipAddress: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined,
        });
        rawGuestToken = newGuest.rawToken;
        guestSessionId = newGuest.session.id;
        guestTokenToSet = newGuest.rawToken;
      }

      // 2. If client supplied consent updates for guest, record them
      if (body.consents && rawGuestToken) {
        const purposesToGrant: Array<"ai_questions" | "ai_evaluation" | "resume_processing"> = [];
        if (body.consents.aiQuestions) purposesToGrant.push("ai_questions");
        if (body.consents.aiEvaluation) purposesToGrant.push("ai_evaluation");
        if (body.consents.resumeProcessing) purposesToGrant.push("resume_processing");

        if (purposesToGrant.length > 0) {
          await grantGuestConsent(rawGuestToken, purposesToGrant, {
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          });
        }
      }
    } else {
      // 2. If client supplied consent updates for registered user, record them
      if (body.consents) {
        const purposesToGrant: ConsentPurpose[] = [];
        if (body.consents.aiQuestions) purposesToGrant.push("ai_questions");
        if (body.consents.aiEvaluation) purposesToGrant.push("ai_evaluation");
        if (body.consents.resumeProcessing) purposesToGrant.push("resume_processing");
        if (body.consents.savedResume) purposesToGrant.push("saved_resume");
        if (body.consents.personalization) purposesToGrant.push("personalization");

        if (purposesToGrant.length > 0) {
          await grantConsent(userId, purposesToGrant, {
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          });
        }
      }
    }

    // 3. Create and initialize interview
    const interview = await createAndInitializeInterview(
      { userId, guestSessionId },
      {
        mode: body.mode,
        role: body.role,
        difficulty: body.difficulty,
        durationMinutes: body.durationMinutes,
        questionCount: body.questionCount,
        companyName: body.companyName,
        jobDescription: body.jobDescription,
        resumeText: body.resumeText,
        idempotencyKey: body.idempotencyKey,
      }
    );

    const response = NextResponse.json({ interview }, { status: 201 });

    // Set cookie if fresh guest session was minted
    if (guestTokenToSet) {
      response.cookies.set("guest_token", guestTokenToSet, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });
      response.headers.set("x-guest-token", guestTokenToSet);
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof InterviewConfigurationError) {
      return NextResponse.json(
        { error: "ValidationError", message: error.message, issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof ConsentRequiredError) {
      return NextResponse.json(
        { error: "ConsentRequired", purpose: error.purpose, message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof UsageLimitExceededError) {
      return NextResponse.json(
        { error: "QuotaExceeded", message: error.message, limit: error.limit },
        { status: 429 }
      );
    }

    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: "Conflict", message: error.message },
        { status: 409 }
      );
    }

    console.error(
      "Interview creation endpoint failure:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "InternalError", message: "Failed to initialize interview session." },
      { status: 500 }
    );
  }
}

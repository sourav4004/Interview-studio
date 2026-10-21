/**
 * Route Handler: /api/interviews/[id]/report
 *
 * GET: Retrieves existing evaluation report for an authorized actor.
 * POST: Triggers or retries AI evaluation for an interview session.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/server/auth/session";
import { validateGuestSession } from "@/server/guest";
import {
  getInterviewReport,
  generateInterviewReport,
  InterviewReportNotFoundError,
  InterviewNotReadyForEvaluationError,
} from "@/server/evaluation";
import { AuthorizationError } from "@/server/auth/authorization";
import { ConsentRequiredError } from "@/server/consent/errors";
import { UsageLimitExceededError } from "@/server/usage/errors";

async function resolveActor(req: NextRequest) {
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

// Route Segment Config: allow up to 60s for AI evaluation and scoring on Vercel (Hobby max 60s, Pro up to 300s)
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await resolveActor(req);

    if (!actor.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in or active guest session required." },
        { status: 401 }
      );
    }

    const report = await getInterviewReport(
      { userId: actor.userId, guestSessionId: actor.guestSessionId },
      id
    );

    return NextResponse.json({ report }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof InterviewReportNotFoundError) {
      return NextResponse.json(
        { error: "NotFound", message: error.message },
        { status: 404 }
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "Forbidden", message: error.message },
        { status: 403 }
      );
    }

    console.error("GET /api/interviews/[id]/report error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "InternalError", message: "Failed to retrieve evaluation report." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await resolveActor(req);

    if (!actor.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in or active guest session required." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const forceRetry = Boolean(body?.forceRetry);

    const report = await generateInterviewReport(
      { userId: actor.userId, guestSessionId: actor.guestSessionId },
      id,
      {
        forceRetry,
        guestRawToken: actor.rawGuestToken,
      }
    );

    return NextResponse.json({ report }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof ConsentRequiredError) {
      return NextResponse.json(
        { error: "ConsentRequired", message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof UsageLimitExceededError) {
      return NextResponse.json(
        { error: "QuotaExceeded", message: error.message },
        { status: 429 }
      );
    }

    if (error instanceof InterviewReportNotFoundError) {
      return NextResponse.json(
        { error: "NotFound", message: error.message },
        { status: 404 }
      );
    }

    if (error instanceof InterviewNotReadyForEvaluationError) {
      return NextResponse.json(
        { error: "NotReady", message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "Forbidden", message: error.message },
        { status: 403 }
      );
    }

    console.error("POST /api/interviews/[id]/report error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "InternalError", message: "Failed to generate evaluation report." },
      { status: 500 }
    );
  }
}

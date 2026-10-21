/**
 * Route Handler: POST /api/interviews/[id]/state
 *
 * Executes interview lifecycle state transitions (start, pause, resume, exit, expire)
 * with server-side actor authorization and idempotency.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/server/auth/session";
import { validateGuestSession } from "@/server/guest";
import { executeInterviewAction } from "@/server/interviews/room-service";
import { InterviewStateActionSchema } from "@/server/interviews/schemas";
import {
  InterviewExpiredError,
  InterviewNotFoundError,
  InterviewStateTransitionError,
} from "@/server/interviews/errors";
import { AuthorizationError } from "@/server/auth/authorization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();

    const session = await getCurrentSession();
    const userId: string | null = session?.user?.id || null;
    let guestSessionId: string | null = null;

    if (!userId) {
      const rawGuestToken =
        req.headers.get("x-guest-token") ||
        cookieStore.get("guest_token")?.value;

      if (rawGuestToken) {
        try {
          const validated = await validateGuestSession(rawGuestToken);
          guestSessionId = validated.id;
        } catch {
          // Token expired or invalid
        }
      }
    }

    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in or active guest session required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = InterviewStateActionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: parseResult.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const updatedState = await executeInterviewAction(
      { userId, guestSessionId },
      id,
      parseResult.data.action
    );

    return NextResponse.json({ interview: updatedState }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof InterviewNotFoundError) {
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

    if (
      error instanceof InterviewStateTransitionError ||
      error instanceof InterviewExpiredError
    ) {
      return NextResponse.json(
        { error: "InvalidStateTransition", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "InternalError", message: "Failed to transition interview state." },
      { status: 500 }
    );
  }
}

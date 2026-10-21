/**
 * Route Handler: GET /api/interviews/[id]
 *
 * Retrieves an existing interview session ensuring server-side ownership.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/server/auth/session";
import { validateGuestSession } from "@/server/guest";
import { getInterviewRoomState } from "@/server/interviews/room-service";
import { InterviewNotFoundError } from "@/server/interviews/errors";
import { AuthorizationError } from "@/server/auth/authorization";

export async function GET(
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

    const interview = await getInterviewRoomState({ userId, guestSessionId }, id);
    return NextResponse.json({ interview }, { status: 200 });
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

    return NextResponse.json(
      { error: "InternalError", message: "Failed to retrieve interview session." },
      { status: 500 }
    );
  }
}

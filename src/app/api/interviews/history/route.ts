/**
 * Route Handler: GET /api/interviews/history
 *
 * Retrieves paginated interview history for the authenticated candidate or guest session.
 * Enforces server-side ownership isolation, data minimization, and query bounds.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestActor } from "@/server/auth/actor";
import { getInterviewHistory } from "@/server/dashboard";
import { InterviewMode } from "@/server/ai/types";

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveRequestActor(req);

    if (!actor.isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required to view interview history.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 10;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : 0;

    const rawMode = searchParams.get("mode") ?? "all";
    const mode = ["technical", "behavioral", "resume", "company"].includes(rawMode)
      ? (rawMode as InterviewMode)
      : "all";

    const rawStatus = searchParams.get("status") ?? "all";
    const status = rawStatus || "all";

    const result = await getInterviewHistory(actor, {
      limit: isNaN(limit) ? 10 : limit,
      offset: isNaN(offset) ? 0 : offset,
      mode,
      status,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

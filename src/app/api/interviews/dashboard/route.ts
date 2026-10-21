/**
 * Route Handler: GET /api/interviews/dashboard
 *
 * Retrieves dashboard metrics, recent sessions, and verified performance trends
 * for the authenticated candidate or guest session.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestActor } from "@/server/auth/actor";
import { getDashboardAnalytics } from "@/server/dashboard";

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveRequestActor(req);

    if (!actor.isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required to view dashboard metrics.",
        },
        { status: 401 }
      );
    }

    const analytics = await getDashboardAnalytics(actor);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard data";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

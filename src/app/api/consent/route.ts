/**
 * Route Handler: /api/consent
 *
 * Manages purpose-specific user consent states, including opt-in and withdrawal
 * for Historical-Data Personalization per:
 * - PRODUCT_SPEC.md (Section 10: Personalization)
 * - SECURITY_PRIVACY.md (Purpose 5: Historical Data Personalization)
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestActor } from "@/server/auth/actor";
import { getUserConsent, grantConsent, withdrawConsent } from "@/server/consent/service";
import {
  getActivePersonalizationConsent,
  getEligibleReportsForPersonalization,
} from "@/server/personalization";
import { z } from "zod";

const updateConsentSchema = z.object({
  purpose: z.enum(["personalization", "saved_resume"]),
  action: z.enum(["grant", "withdraw"]),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveRequestActor(req);

    if (!actor.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required to view consent settings.",
        },
        { status: 401 }
      );
    }

    const consentState = await getUserConsent(actor.userId);
    const activeGrant = await getActivePersonalizationConsent(actor.userId);

    let eligibleReportCount = 0;
    if (activeGrant.isGranted && activeGrant.grantedAt) {
      const eligibleReports = await getEligibleReportsForPersonalization(
        actor.userId,
        activeGrant.grantedAt
      );
      eligibleReportCount = eligibleReports.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        personalization: consentState.personalization,
        consentGrantedAt: activeGrant.grantedAt,
        eligibleReportCount,
        requiredReportCount: 3,
        savedResume: consentState.saved_resume,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load consent settings";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveRequestActor(req);

    if (!actor.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required to update consent settings.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateConsentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid consent update payload.",
        },
        { status: 400 }
      );
    }

    const { purpose, action } = parseResult.data;

    if (action === "grant") {
      await grantConsent(actor.userId, [purpose]);
    } else {
      await withdrawConsent(actor.userId, [purpose]);
    }

    return NextResponse.json({
      success: true,
      message: `Consent for ${purpose} ${action === "grant" ? "granted" : "withdrawn"} successfully.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update consent settings";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

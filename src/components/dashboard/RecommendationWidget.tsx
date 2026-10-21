"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  FileText,
  Compass,
  Target,
  ChevronDown,
  ChevronUp,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DashboardRecommendation } from "@/server/dashboard/types";

interface RecommendationWidgetProps {
  recommendation: DashboardRecommendation;
}

export function RecommendationWidget({ recommendation }: RecommendationWidgetProps) {
  const [showSecondary, setShowSecondary] = useState(false);
  const { primaryAction, secondaryRecommendations } = recommendation;
  const isPersonalized = recommendation.isPersonalized && !!primaryAction;

  const startUrl = isPersonalized && primaryAction?.suggestedMode
    ? `/start-interview?mode=${encodeURIComponent(primaryAction.suggestedMode)}&difficulty=${encodeURIComponent(
        primaryAction.suggestedDifficulty ?? "medium"
      )}&duration=${encodeURIComponent(primaryAction.suggestedDurationMinutes ?? 10)}`
    : "/start-interview";

  const eligibleCount = recommendation.eligibleReportCount ?? 0;
  const requiredCount = recommendation.requiredReportCount ?? 3;
  const progressPercent = Math.min(100, Math.round((eligibleCount / requiredCount) * 100));

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0 shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-indigo-950">
              Recommended Next Step
            </h4>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                isPersonalized ? "text-violet-700" : "text-indigo-600"
              }`}
            >
              {isPersonalized
                ? "Personalized Recommendation"
                : recommendation.personalizationStatus === "insufficient_evidence"
                ? "Calibration In Progress"
                : "General Placement Guidance"}
            </span>
          </div>
        </div>

        {isPersonalized ? (
          <Badge variant="primary" className="text-[10px] shrink-0 gap-1">
            <ShieldCheck className="h-3 w-3" />
            Adaptive
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Standard
          </Badge>
        )}
      </div>

      {/* Case 1: Fully Personalized Recommendation */}
      {isPersonalized && primaryAction ? (
        <div className="space-y-3.5">
          {/* Action Title & Focus Badges */}
          <div className="space-y-1.5">
            <h5 className="text-sm font-bold text-[#171827]">
              {primaryAction.title}
            </h5>
            {primaryAction.recommendedFocusAreas && primaryAction.recommendedFocusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {primaryAction.recommendedFocusAreas.map((area: string) => (
                  <span
                    key={area}
                    className="inline-flex items-center text-[10px] font-medium bg-indigo-100/70 text-indigo-800 px-2 py-0.5 rounded-full"
                  >
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Activity & Goal */}
          <div className="space-y-2 text-xs">
            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900 mb-1">
                <Compass className="h-3.5 w-3.5 text-indigo-600" />
                <span>Practice Activity</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {primaryAction.practiceActivity}
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900 mb-1">
                <Target className="h-3.5 w-3.5 text-indigo-600" />
                <span>Target Goal</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {primaryAction.suggestedPracticeGoal}
              </p>
            </div>
          </div>

          {/* Suggested Setup Config */}
          {primaryAction.suggestedMode && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Mode
                </span>
                <span className="font-semibold text-slate-800 capitalize">
                  {primaryAction.suggestedMode}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Difficulty
                </span>
                <span className="font-semibold text-slate-800 capitalize">
                  {primaryAction.suggestedDifficulty ?? "medium"}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Duration
                </span>
                <span className="font-semibold text-slate-800">
                  {primaryAction.suggestedDurationMinutes ?? 10} min
                </span>
              </div>
            </div>
          )}

          {/* Rationale & Grounding Evidence */}
          <div className="space-y-2 text-xs">
            <p className="text-slate-600 leading-relaxed italic bg-slate-50/70 border border-slate-200/60 rounded-lg p-2.5">
              &ldquo;{primaryAction.whySelected}&rdquo;
            </p>

            {primaryAction.supportingReportIds.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  Supporting Evidence ({primaryAction.supportingReportIds.length} verified reports):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {primaryAction.supportingReportIds.map((reportId, idx) => (
                    <Link
                      key={reportId}
                      href={`/interview/${reportId}/report`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2 py-0.5 rounded shadow-2xs hover:bg-indigo-50/60 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Report #{idx + 1} ({reportId.slice(0, 6)}…)</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secondary Recommendations Accordion */}
          {secondaryRecommendations && secondaryRecommendations.length > 0 && (
            <div className="pt-1 border-t border-indigo-100">
              <button
                type="button"
                onClick={() => setShowSecondary(!showSecondary)}
                className="w-full flex items-center justify-between text-xs font-semibold text-indigo-700 hover:text-indigo-900 py-1"
              >
                <span>Alternative Practice ({secondaryRecommendations.length})</span>
                {showSecondary ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showSecondary && (
                <div className="mt-2 space-y-2">
                  {secondaryRecommendations.map((sec, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-white/95 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{sec.title}</span>
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {sec.suggestedMode ?? sec.skill}
                        </Badge>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {sec.practiceActivity}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : recommendation.personalizationStatus === "insufficient_evidence" ? (
        /* Case 2: Personalization Granted, Calibrating (Insufficient Reports) */
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
              <span>Personalization Active — Calibrating</span>
              <span>
                {eligibleCount} of {requiredCount} completed
              </span>
            </div>
            {/* Honest Progress Bar */}
            <div className="w-full bg-amber-200/70 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              We require at least 3 completed simulations post-consent to identify recurring patterns before generating cross-session recommendations. Pre-consent sessions are excluded per privacy policy.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-700 block">
              General Placement Practice:
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">
              {recommendation.guidance}
            </p>
          </div>
        </div>
      ) : recommendation.personalizationStatus === "disabled" ? (
        /* Case 3: Personalization Disabled by Candidate */
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Cross-Session Personalization is Off
              </span>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
              >
                <Settings className="h-3 w-3" />
                Settings
              </Link>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Enable personalization in Settings to unlock adaptive interview recommendations tailored to your recurring strengths and growth areas.
            </p>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            {recommendation.guidance}
          </p>
        </div>
      ) : (
        /* Case 4: Guest or Default Guidance */
        <div className="space-y-3">
          <p className="text-xs text-slate-700 leading-relaxed">
            {recommendation.guidance}
          </p>
        </div>
      )}

      {/* Footer CTA */}
      <div className="border-t border-indigo-100 pt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">
          {isPersonalized
            ? `Personalized (${new Date(recommendation.lastUpdated).toLocaleDateString()})`
            : `General guidance (${new Date(recommendation.lastUpdated).toLocaleDateString()})`}
        </span>
        <Link href={startUrl}>
          <Button size="sm" className="gap-1 text-xs shadow-xs">
            <span>{isPersonalized ? "Practice Recommendation" : "Practice Now"}</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { DimensionAggregate } from "@/server/dashboard/types";
import { BarChart3, HelpCircle, CheckCircle2 } from "lucide-react";

interface DimensionComparisonProps {
  dimensions: DimensionAggregate[];
}

export function DimensionComparison({ dimensions }: DimensionComparisonProps) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[#171827]">
            Evaluation Dimensions
          </h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Benchmark performance across the 6 core interview dimensions
        </p>
      </div>

      <div className="space-y-4">
        {dimensions.map((dim) => {
          const hasScore = dim.averageScore !== null && dim.scoredCount > 0;
          const percentage = hasScore ? Math.min(Math.max(dim.averageScore!, 0), 100) : 0;

          // Determine the most common non-scored status if not scored
          const latestStatus =
            dim.trend.length > 0
              ? dim.trend[dim.trend.length - 1].status
              : "not_applicable";

          return (
            <div key={dim.dimension} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span>{dim.label}</span>
                  {hasScore && (
                    <span className="text-[11px] font-normal text-slate-600">
                      ({dim.scoredCount} session{dim.scoredCount === 1 ? "" : "s"})
                    </span>
                  )}
                </div>

                <div>
                  {hasScore ? (
                    <span className="font-bold text-indigo-700">
                      {dim.averageScore} / 100
                    </span>
                  ) : latestStatus === "insufficient_evidence" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <HelpCircle className="h-3 w-3" />
                      Insufficient Evidence
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Not Evaluated
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar Gauge */}
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={hasScore ? dim.averageScore! : undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${dim.label} benchmark score: ${hasScore ? `${dim.averageScore} out of 100` : "Not evaluated"}`}
              >
                {hasScore ? (
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-200/50" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-3 flex items-center gap-1.5 text-[11px] text-slate-600">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>
          Dimensions are evaluated only where evidence exists. Non-applicable dimensions are never penalized as zero.
        </span>
      </div>
    </div>
  );
}

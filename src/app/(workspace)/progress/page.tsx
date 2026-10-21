"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { DimensionComparison } from "@/components/dashboard/DimensionComparison";
import { DashboardAnalytics } from "@/server/dashboard/types";

function getSafeStorageItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function ProgressPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProgressData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const guestToken = getSafeStorageItem("guest_token");
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const res = await fetch("/api/interviews/dashboard", {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to load performance metrics.");
      }

      const responseJson = await res.json();
      setData(responseJson.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load progress.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchProgressData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchProgressData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-[#171827]">
              Performance Progress &amp; Benchmarks
            </h2>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Track interview score trajectories across technical, communication, and behavioral dimensions.
          </p>
        </div>

        <Link href="/start-interview">
          <Button size="sm" className="gap-1.5 shadow-xs">
            <PlayCircle className="h-4 w-4" />
            <span>Start Interview</span>
          </Button>
        </Link>
      </div>

      {/* Truthful Analytics Policy Banner */}
      <div className="bg-[#EEF2FF] border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-sm text-[#171827]">
          <p className="font-semibold text-[#3730A3]">Truthful Analytics Policy</p>
          <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
            Per PRODUCT_SPEC.md and SECURITY_PRIVACY.md, analytics require at least two completed comparable interviews for a score trajectory. Progress metrics are never fabricated, and non-evaluated dimensions are never penalized as zero.
          </p>
        </div>
      </div>

      {/* Recoverable Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load progress data</p>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchProgressData}
            className="shrink-0 gap-1 bg-white hover:bg-rose-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="h-64 rounded-xl border border-slate-200 bg-slate-100/60" />
          <div className="h-64 rounded-xl border border-slate-200 bg-slate-100/60" />
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ScoreTrendChart
              scoreTrajectory={data.trends.scoreTrajectory}
              minimumDataNotice={data.trends.minimumDataNotice}
              trendSummary={data.trends.trendSummary}
            />

            {/* Mode Distribution Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Practice Mode Distribution</CardTitle>
                <CardDescription>
                  Total sessions initiated across each interview mode
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { mode: "technical", label: "Technical", count: data.metrics.modeCounts.technical },
                    { mode: "behavioral", label: "Behavioral", count: data.metrics.modeCounts.behavioral },
                    { mode: "resume", label: "Resume", count: data.metrics.modeCounts.resume },
                    { mode: "company", label: "Company", count: data.metrics.modeCounts.company },
                  ].map((m) => (
                    <div
                      key={m.mode}
                      className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 text-center"
                    >
                      <span className="text-xs text-slate-500 font-medium capitalize block">
                        {m.label}
                      </span>
                      <span className="text-xl font-bold text-[#171827] mt-1 block">
                        {m.count}
                      </span>
                      <span className="text-[10px] text-slate-400">sessions</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <DimensionComparison dimensions={data.trends.dimensionAggregates} />
          </div>
        </div>
      )}
    </div>
  );
}

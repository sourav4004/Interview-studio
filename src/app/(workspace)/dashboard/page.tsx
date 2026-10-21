"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PlayCircle,
  Award,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  RefreshCw,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { DimensionComparison } from "@/components/dashboard/DimensionComparison";
import { RecentInterviewsList } from "@/components/dashboard/RecentInterviewsList";
import { RecommendationWidget } from "@/components/dashboard/RecommendationWidget";
import { DashboardAnalytics } from "@/server/dashboard/types";

function getSafeStorageItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to load candidate dashboard metrics."
        );
      }

      const responseJson = await res.json();
      setData(responseJson.data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading the dashboard.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchDashboardData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-[#171827]">
              Candidate Placement Dashboard
            </h2>
            <Badge variant="primary">Verified History</Badge>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl">
            Track your simulation trajectory, review dimension evaluations, and practice campus placement interviews.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/start-interview">
            <Button size="sm" className="gap-1.5 shadow-xs">
              <PlayCircle className="h-4 w-4" />
              <span>Start Interview</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Recoverable Error State */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load dashboard analytics</p>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDashboardData}
            className="shrink-0 gap-1 bg-white hover:bg-rose-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-slate-200 bg-slate-100/60"
              />
            ))}
          </div>
          <div className="h-64 rounded-xl border border-slate-200 bg-slate-100/60" />
          <div className="h-48 rounded-xl border border-slate-200 bg-slate-100/60" />
        </div>
      )}

      {/* Main Dashboard Content */}
      {data && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Completed Sessions"
              value={data.metrics.totalCompleted}
              description={`${data.metrics.totalStarted} total simulations initiated`}
              icon={CheckCircle2}
              badge={data.metrics.totalCompleted > 0 ? "Active" : "New"}
              badgeVariant={data.metrics.totalCompleted > 0 ? "success" : "secondary"}
            />

            <StatCard
              title="Latest Score"
              value={data.metrics.recentScore}
              unit="/ 100"
              description={
                data.metrics.recentScore !== null
                  ? "From your most recent completed report"
                  : "No completed reports yet"
              }
              icon={Award}
              accent={data.metrics.recentScore !== null}
            />

            <StatCard
              title="Average Score"
              value={data.metrics.averageScore}
              unit="/ 100"
              description={
                data.metrics.averageScore !== null
                  ? `Across ${data.metrics.totalCompleted} completed sessions`
                  : "Requires at least 1 completed interview"
              }
              icon={TrendingUp}
            />

            <StatCard
              title="Strongest Skill"
              value={
                data.metrics.strongestDimension
                  ? data.metrics.strongestDimension.averageScore
                  : null
              }
              unit={data.metrics.strongestDimension ? "/ 100" : undefined}
              description={
                data.metrics.strongestDimension
                  ? `${data.metrics.strongestDimension.label} (relative strength)`
                  : "Insufficient comparative dimension evidence"
              }
              icon={BarChart2}
              badge={data.metrics.strongestDimension ? "Relative Strength" : undefined}
              badgeVariant="primary"
            />
          </div>

          {/* Performance Trends Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ScoreTrendChart
                scoreTrajectory={data.trends.scoreTrajectory}
                minimumDataNotice={data.trends.minimumDataNotice}
                trendSummary={data.trends.trendSummary}
              />

              <RecentInterviewsList interviews={data.recentInterviews} />
            </div>

            <div className="space-y-6">
              <DimensionComparison dimensions={data.trends.dimensionAggregates} />

              <RecommendationWidget recommendation={data.recommendation} />

              {/* Truthful Analytics & Privacy Notice */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  <span>Truthful Analytics Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Scores and trajectories are computed solely from verified completed sessions. Trends are never synthetic, and non-evaluated dimensions are never penalized as zero.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

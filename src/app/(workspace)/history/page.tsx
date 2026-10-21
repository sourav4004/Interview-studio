"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  History,
  FileText,
  PlayCircle,
  Filter,
  CheckCircle2,
  Clock,
  HelpCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HistoryResult } from "@/server/dashboard/types";
import { InterviewMode } from "@/server/ai/types";

function getSafeStorageItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters and pagination state
  const [modeFilter, setModeFilter] = useState<InterviewMode | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(0);
  const pageSize = 10;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const guestToken = getSafeStorageItem("guest_token");
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
        mode: modeFilter,
        status: statusFilter,
      });

      const res = await fetch(`/api/interviews/history?${params.toString()}`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to load interview history.");
      }

      const data = await res.json();
      setHistoryData({
        interviews: data.interviews,
        pagination: data.pagination,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load history.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [page, modeFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchHistory();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchHistory]);

  const handleModeChange = (mode: InterviewMode | "all") => {
    setModeFilter(mode);
    setPage(0); // Reset to first page
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(0); // Reset to first page
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="primary" className="gap-1">
            <Clock className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case "evaluating":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            Evaluating
          </Badge>
        );
      case "safely_exited":
        return (
          <Badge variant="secondary" className="gap-1">
            <HelpCircle className="h-3 w-3" />
            Safely Exited
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="secondary" className="gap-1 text-rose-700 bg-rose-50 border-rose-200">
            <AlertCircle className="h-3 w-3" />
            Incomplete
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const total = historyData?.pagination.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : page * pageSize + 1;
  const endItem = Math.min((page + 1) * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-[#171827]">
              Interview History
            </h2>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            View all past interview sessions, verify progress, and access evaluation reports.
          </p>
        </div>

        <Link href="/start-interview">
          <Button size="sm" className="gap-1.5 shadow-xs">
            <PlayCircle className="h-4 w-4" />
            <span>Start Interview</span>
          </Button>
        </Link>
      </div>

      {/* Recoverable Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load interview history</p>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchHistory}
            className="shrink-0 gap-1 bg-white hover:bg-rose-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Mode:</span>
          </div>
          {(
            [
              { key: "all", label: "All Modes" },
              { key: "technical", label: "Technical" },
              { key: "behavioral", label: "Behavioral" },
              { key: "resume", label: "Resume" },
              { key: "company", label: "Company" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleModeChange(m.key)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                modeFilter === m.key
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-select" className="text-xs font-semibold text-slate-500">
            Status:
          </label>
          <select
            id="status-select"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="safely_exited">Safely Exited</option>
            <option value="failed">Incomplete / Failed</option>
          </select>
        </div>
      </div>

      {/* History Items Container */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Practice Sessions</CardTitle>
            {historyData && (
              <span className="text-xs text-slate-500">
                Total: {total} interview{total === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading && !historyData ? (
            <div className="p-8 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : !historyData || historyData.interviews.length === 0 ? (
            <div className="py-14 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                No interviews match the selected criteria
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {modeFilter !== "all" || statusFilter !== "all"
                  ? "Try resetting your filters to see all available sessions."
                  : "Completed interviews and evaluation reports will appear here as you practice."}
              </p>
              <div className="pt-2">
                <Link href="/start-interview">
                  <Button size="sm" className="gap-1.5">
                    <PlayCircle className="h-4 w-4" />
                    <span>Start an Interview</span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyData.interviews.map((item) => {
                const hasCompletedReport =
                  item.report?.status === "completed" &&
                  typeof item.report.overallScore === "number";

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#171827]">
                          {item.role}
                        </span>
                        <Badge variant="secondary" className="capitalize text-xs font-medium">
                          {item.interviewType}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {item.difficulty}
                        </Badge>
                        {getStatusBadge(item.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span>•</span>
                        <span>{item.durationMinutes} minutes</span>
                        <span>•</span>
                        <span>{item.questionCount} questions</span>
                        {item.companyName && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              {item.companyName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                      {hasCompletedReport ? (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-semibold text-slate-600 block">
                              Score
                            </span>
                            <span className="text-lg font-bold text-indigo-700">
                              {item.report!.overallScore} / 100
                            </span>
                          </div>
                          <Link href={`/interview/${item.id}/report`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              aria-label={`View report for ${item.role}`}
                            >
                              <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              <span>View Report</span>
                            </Button>
                          </Link>
                        </div>
                      ) : item.status === "in_progress" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 italic">No score yet</span>
                          <Link href={`/interview/${item.id}`}>
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs"
                              aria-label={`Resume interview for ${item.role}`}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span>Resume</span>
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 italic">Unfinished session</span>
                          <Link href={`/interview/${item.id}/report`}>
                            <Button size="sm" variant="outline" className="text-xs text-slate-600">
                              <span>Check Status</span>
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Bounded Pagination Controls */}
        {total > 0 && (
          <div className="border-t border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{startItem}</span> to{" "}
              <span className="font-semibold text-slate-800">{endItem}</span> of{" "}
              <span className="font-semibold text-slate-800">{total}</span> interviews
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </Button>

              <span className="px-2 font-medium text-slate-700">
                Page {page + 1} of {Math.max(totalPages, 1)}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

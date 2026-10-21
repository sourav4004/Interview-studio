"use client";

import React from "react";
import Link from "next/link";
import { InterviewListItem } from "@/server/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Clock,
  ArrowRight,
  FileText,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface RecentInterviewsListProps {
  interviews: InterviewListItem[];
}

export function RecentInterviewsList({ interviews }: RecentInterviewsListProps) {
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

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[#171827]">
              Recent Interviews
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Your most recent simulation sessions and evaluation results
          </p>
        </div>

        <Link href="/history">
          <Button variant="outline" size="sm" className="text-xs gap-1 text-indigo-600 hover:text-indigo-800">
            <span>View All History</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              No practice sessions recorded yet
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Start an interview simulation to practice answering questions, get evaluated by AI, and track your progress.
            </p>
          </div>
          <Link href="/start-interview">
            <Button size="sm" className="gap-1.5">
              <PlayCircle className="h-4 w-4" />
              <span>Start First Interview</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {interviews.map((item) => {
            const hasCompletedReport =
              item.report?.status === "completed" &&
              typeof item.report.overallScore === "number";

            return (
              <div
                key={item.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#171827]">
                      {item.role}
                    </span>
                    <Badge variant="secondary" className="capitalize text-[11px]">
                      {item.interviewType}
                    </Badge>
                    <Badge variant="secondary" className="capitalize text-[11px]">
                      {item.difficulty}
                    </Badge>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span>•</span>
                    <span>{item.durationMinutes} mins</span>
                    <span>•</span>
                    <span>{item.questionCount} questions</span>
                    {item.companyName && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-slate-600">
                          {item.companyName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  {hasCompletedReport ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Score</span>
                        <span className="text-base font-bold text-indigo-700">
                          {item.report!.overallScore} / 100
                        </span>
                      </div>
                      <Link href={`/interview/${item.id}/report`}>
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <FileText className="h-3.5 w-3.5 text-indigo-600" />
                          <span>View Report</span>
                        </Button>
                      </Link>
                    </div>
                  ) : item.status === "in_progress" ? (
                    <Link href={`/interview/${item.id}`}>
                      <Button size="sm" className="gap-1 text-xs">
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/interview/${item.id}/report`}>
                      <Button size="sm" variant="outline" className="text-xs text-slate-600">
                        <span>Check Status</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

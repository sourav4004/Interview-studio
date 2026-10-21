"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Award,
  Target,
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  Sparkles,
  Info,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InterviewReportSummary } from "@/server/evaluation/types";

function getSafeStorageItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function InterviewReportPage() {
  const params = useParams<{ id: string }>();
  const interviewId = params?.id;

  const [report, setReport] = useState<InterviewReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReport = useCallback(async () => {
    if (!interviewId) return;

    try {
      const guestToken = getSafeStorageItem("guest_token");
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const res = await fetch(`/api/interviews/${interviewId}/report`, {
        headers,
        cache: "no-store",
      });

      if (res.status === 404) {
        // No report generated yet
        setReport(null);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load report.");
      }

      const data = await res.json();
      setReport(data.report);

      // Expand all questions by default for easy review
      if (data.report?.questionFeedback) {
        const initialExpanded: Record<string, boolean> = {};
        for (const q of data.report.questionFeedback) {
          initialExpanded[q.questionId] = true;
        }
        setExpandedQuestions(initialExpanded);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load report.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  const handleGenerateReport = async (forceRetry = false) => {
    if (!interviewId) return;

    try {
      setIsGenerating(true);
      setErrorMessage(null);

      const guestToken = getSafeStorageItem("guest_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const res = await fetch(`/api/interviews/${interviewId}/report`, {
        method: "POST",
        headers,
        body: JSON.stringify({ forceRetry }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to start evaluation.");
      }

      setReport(data.report);

      // If status is completed immediately, initialize expanded questions
      if (data.report?.status === "completed" && data.report?.questionFeedback) {
        const initialExpanded: Record<string, boolean> = {};
        for (const q of data.report.questionFeedback) {
          initialExpanded[q.questionId] = true;
        }
        setExpandedQuestions(initialExpanded);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate report.";
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchReport();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchReport]);

  // Poll while report status is processing or pending
  useEffect(() => {
    if (report?.status === "processing" || report?.status === "pending") {
      pollingRef.current = setTimeout(() => {
        fetchReport();
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [report?.status, fetchReport]);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // 1. Initial Page Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Loading Evaluation Report...</p>
        <p className="text-xs text-slate-500 mt-1">Fetching session analysis and validated scores</p>
      </div>
    );
  }

  // 2. Report is Currently Evaluating (Processing State)
  if (report?.status === "processing" || report?.status === "pending" || isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-[#EEF2FF]/40 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-[#171827]">AI Interviewer Is Evaluating Your Responses</h1>
        <p className="text-sm text-slate-600 max-w-md mt-2 mb-6 leading-relaxed">
          Your submitted transcripts are being calibrated against mode-specific rubrics. Technical correctness, structure, relevance, and communication are being synthesized into your report.
        </p>
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
          <span>Evaluation in progress • This page updates automatically</span>
        </div>
      </div>
    );
  }

  // 3. Evaluation Failure State (Recoverable)
  if (report?.status === "failed") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-[#171827]">Evaluation Could Not Complete</h1>
        <p className="text-sm text-slate-600 max-w-md mt-1 mb-2">
          {report.failureReason || errorMessage || "A transient issue occurred while evaluating your answers."}
        </p>
        <p className="text-xs text-slate-500 max-w-md mb-6">
          Your submitted answers are safely preserved in PostgreSQL. You have not been charged any usage quota for this attempt.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => handleGenerateReport(true)}
            isLoading={isGenerating}
            className="bg-[#4F46E5] hover:bg-indigo-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            <span>Retry Evaluation</span>
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Report Not Yet Generated (Ready to Trigger)
  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
          <Award className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-[#171827]">Interview Finished — Generate Your Report</h1>
        <p className="text-sm text-slate-600 max-w-md mt-2 mb-6">
          Your answers have been securely persisted. Click below to generate your detailed rubric breakdown, dimension scores, and personalized improvement roadmap.
        </p>
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 max-w-md">
            {errorMessage}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => handleGenerateReport(false)}
            isLoading={isGenerating}
            className="bg-[#4F46E5] hover:bg-indigo-700 px-8"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span>Generate Performance Report</span>
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Later</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 5. COMPLETED REPORT VIEW
  const overallScore = report.overallScore ?? 0;
  const scoreBadgeColor =
    overallScore >= 75
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : overallScore >= 50
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar (Hidden in print) */}
      <header className="print:hidden border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
            Evaluation Report
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Print / Save as PDF</span>
          </Button>
          <Link href="/start-interview">
            <Button variant="primary" size="sm" className="bg-[#4F46E5] hover:bg-indigo-700 text-xs">
              Start New Interview
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Report Document Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-10 space-y-8 print:p-0 print:space-y-6">
        {/* Document Header */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                  Validated Evaluation
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(report.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171827] tracking-tight">
                Interview Performance Report
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Evaluated {report.evaluatedAnswersCount} responses ({report.skippedAnswersCount} skipped) • Model: {report.modelIdentifier || "Gemini"} • Rubric v{report.rubricVersion}
              </p>
            </div>

            {/* Overall Score Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 min-w-[160px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Score</span>
              <div className="flex items-baseline gap-1 my-0.5">
                <span className="text-4xl font-extrabold text-indigo-700">{overallScore}</span>
                <span className="text-sm font-bold text-slate-400">/ 100</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreBadgeColor}`}>
                {overallScore >= 75 ? "Proficient" : overallScore >= 50 ? "Developing" : "Needs Review"}
              </span>
            </div>
          </div>

          {/* Contextual Score Explanation Notice */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">About this Evaluation Score</p>
              <p className="leading-relaxed">{report.scoreExplanation}</p>
            </div>
          </div>

          {/* Executive Summary */}
          {report.summary && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Executive Summary</h2>
              <p className="text-sm text-slate-700 leading-relaxed bg-white rounded-xl">
                {report.summary}
              </p>
            </div>
          )}
        </section>

        {/* Six Dimensions Breakdown Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#171827] flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <span>Dimension Breakdown</span>
            </h2>
            <span className="text-xs text-slate-500">Evaluated on 6 standard dimensions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.dimensionScores.map((dim) => {
              const isScored = dim.status === "scored";
              const isNotApplicable = dim.status === "not_applicable";
              const isInsufficient = dim.status === "insufficient_evidence";

              return (
                <div
                  key={dim.dimension}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#171827]">{dim.label}</h3>
                      {isScored && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-extrabold text-indigo-700">{dim.score}</span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                      )}
                      {isNotApplicable && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Not Applicable
                        </span>
                      )}
                      {isInsufficient && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Insufficient Data
                        </span>
                      )}
                    </div>

                    {isScored && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                    )}

                    <p className="text-xs text-slate-600 leading-relaxed pt-1">{dim.explanation}</p>
                  </div>

                  {dim.evidence && (
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <strong className="text-slate-700">Observed Evidence: </strong>
                      <span className="italic">{dim.evidence}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Strengths & Improvements Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Strengths */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#171827] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Key Strengths</span>
            </h2>
            <ul className="space-y-2.5">
              {report.strengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Priority Improvements */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#171827] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Priority Improvements</span>
            </h2>
            <ul className="space-y-2.5">
              {report.improvements.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Primary Recommended Next Step */}
        {report.primaryRecommendation && (
          <section className="bg-gradient-to-br from-indigo-50 to-[#EEF2FF]/60 border border-indigo-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Recommended Next Step</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {report.primaryRecommendation}
            </p>
            <div className="pt-2 print:hidden">
              <Link href="/start-interview">
                <Button variant="primary" size="sm" className="bg-[#4F46E5] hover:bg-indigo-700 text-xs">
                  Practice Next Simulation
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Question-by-Question Deep Dive */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#171827] flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Question-by-Question Review</span>
            </h2>
            <span className="text-xs text-slate-500">
              {report.questionFeedback.length} Questions Evaluated
            </span>
          </div>

          <div className="space-y-4">
            {report.questionFeedback.map((q) => {
              const isExpanded = expandedQuestions[q.questionId] ?? true;
              const isSkipped = q.answerStatus === "skipped";

              return (
                <div
                  key={q.questionId}
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all"
                >
                  {/* Card Header Accordion */}
                  <div
                    onClick={() => toggleQuestion(q.questionId)}
                    className="p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">
                          Q{q.orderIndex + 1}
                        </span>
                        {q.category && (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {q.category}
                          </span>
                        )}
                        {isSkipped ? (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Skipped
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Submitted
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#171827] pt-0.5">
                        {q.questionText}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {q.score !== null && (
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-indigo-700">{q.score}</span>
                          <span className="text-xs text-slate-400">/100</span>
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label="Toggle details"
                        className="text-slate-400 hover:text-slate-600 print:hidden"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Body Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4 text-xs">
                      {/* Candidate Answer */}
                      <div className="space-y-1">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Your Response
                        </span>
                        <div className="bg-slate-50 p-3 rounded-xl text-slate-800 leading-relaxed border border-slate-100 italic">
                          {q.candidateAnswer ? `"${q.candidateAnswer}"` : "(No answer provided)"}
                        </div>
                      </div>

                      {/* Explanation & Evidence */}
                      <div className="space-y-1">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Evaluation & Evidence
                        </span>
                        <p className="text-slate-700 leading-relaxed">{q.explanation}</p>
                        {q.evidence && (
                          <p className="text-[11px] text-slate-500">
                            <strong>Observed Citation:</strong> {q.evidence}
                          </p>
                        )}
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {q.strengths.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px]">
                              Response Strengths
                            </span>
                            <ul className="space-y-1">
                              {q.strengths.map((s, i) => (
                                <li key={i} className="text-slate-600 flex items-start gap-1.5">
                                  <span className="text-emerald-500">•</span>
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {q.improvements.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-indigo-700 uppercase tracking-wider text-[10px]">
                              How to Elevate
                            </span>
                            <ul className="space-y-1">
                              {q.improvements.map((imp, i) => (
                                <li key={i} className="text-slate-600 flex items-start gap-1.5">
                                  <span className="text-indigo-500">•</span>
                                  <span>{imp}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Example Stronger Response */}
                      {q.exampleAnswer && (
                        <div className="mt-3 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                          <span className="font-bold text-indigo-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Illustrative Stronger Response / Approach</span>
                          </span>
                          <p className="text-slate-700 leading-relaxed">{q.exampleAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Privacy, Ethics & Methodology Disclaimer */}
        <footer className="border-t border-slate-200 pt-6 text-[11px] text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Privacy & Ethical AI Notice</span>
          </div>
          <p className="leading-relaxed">
            This report was produced using Gemini under your explicit AI evaluation consent. Scores evaluate performance on the specific mock questions in this simulation only and are not calibrated as tests of intelligence, psychological traits, or universal hiring likelihood. Raw answers and reports are private to your account.
          </p>
        </footer>
      </main>
    </div>
  );
}

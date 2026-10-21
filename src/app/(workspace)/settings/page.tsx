"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Shield,
  User,
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Info,
} from "lucide-react";

interface ConsentApiResponse {
  personalization: boolean;
  consentGrantedAt: string | null;
  eligibleReportCount: number;
  requiredReportCount: number;
  savedResume: boolean;
}

export default function SettingsPage() {
  const [data, setData] = useState<ConsentApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const fetchConsent = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetch("/api/consent", { cache: "no-store" });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to load consent settings.");
      }

      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchConsent();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchConsent]);

  const handleGrantPersonalization = async () => {
    try {
      setUpdating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "personalization",
          action: "grant",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update consent decision.");
      }

      setSuccessMessage(
        "Historical-data personalization enabled. Complete 3 post-consent simulations to unlock tailored guidance."
      );
      await fetchConsent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update consent.");
    } finally {
      setUpdating(false);
    }
  };

  const handleWithdrawPersonalization = async () => {
    try {
      setUpdating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "personalization",
          action: "withdraw",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to withdraw consent.");
      }

      setSuccessMessage(
        "Personalization consent withdrawn. Your profile and derived metrics have been purged immediately."
      );
      setShowWithdrawConfirm(false);
      await fetchConsent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to withdraw consent.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#171827]">
            Account &amp; Privacy Settings
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage your account identity, granular consent preferences, and data privacy controls.
          </p>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-800 flex items-start gap-2.5"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to update settings</p>
              <p className="text-[11px] text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchConsent}
            className="shrink-0 text-xs bg-white hover:bg-rose-50"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Consent & Personalization Card */}
        <Card className="border-indigo-100 shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base font-bold text-[#171827]">
                  Purpose-Specific Consent
                </CardTitle>
              </div>
              {data && (
                <Badge variant={data.personalization ? "success" : "secondary"}>
                  {data.personalization ? "Personalization Active" : "Personalization Off"}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Granular controls governing how your interview evaluation history is processed.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Historical-Data Personalization Setting */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-[#171827]">
                      Historical-Data Personalization
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    When enabled, the system analyzes your completed interview evaluation reports to identify recurring strengths, improvement patterns, and tailored next practice steps.
                  </p>
                </div>
              </div>

              {/* Truthful Privacy Guardrails List */}
              <div className="rounded-lg bg-white p-3 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Post-Consent Requirement:</strong> At least 3 completed simulations evaluated <em>after</em> consent is granted are required to establish an evidence-based profile.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>No Audio/Video Retention:</strong> Raw microphone audio and camera feeds are processed transiently in-browser and never retained for personalization.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Instant Profile Purge:</strong> Withdrawing consent immediately purges your stored profile and purpose-specific metrics.
                  </span>
                </div>
              </div>

              {/* Progress counter when enabled */}
              {data?.personalization && (
                <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-indigo-950 block">
                      Post-Consent Evidence Progress
                    </span>
                    <span className="text-indigo-800 text-[11px]">
                      {data.eligibleReportCount >= data.requiredReportCount
                        ? `Threshold met (${data.eligibleReportCount} eligible reports). Active profile unlocked.`
                        : `${data.eligibleReportCount} of ${data.requiredReportCount} required simulations completed since consent.`}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-indigo-700 bg-white px-2.5 py-1 rounded border border-indigo-200">
                    {data.eligibleReportCount} / {data.requiredReportCount}
                  </span>
                </div>
              )}

              {/* Withdrawal Confirmation Dialog */}
              {showWithdrawConfirm && (
                <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/90 space-y-2 text-xs">
                  <p className="font-semibold text-rose-950">
                    Confirm Consent Withdrawal &amp; Profile Purge
                  </p>
                  <p className="text-rose-800 text-[11px] leading-relaxed">
                    Withdrawing consent will immediately delete your personalization profile, purge derived metric summaries, and reset your 3-simulation eligibility window. Your past interview reports remain accessible under standard retention policy.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleWithdrawPersonalization}
                      disabled={updating}
                      className="text-xs h-7"
                    >
                      {updating ? "Purging..." : "Confirm & Purge Profile"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowWithdrawConfirm(false)}
                      disabled={updating}
                      className="text-xs h-7 bg-white"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent Saved Resume Notice */}
            <div className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/30">
              <div className="pr-4">
                <p className="text-sm font-medium text-[#171827]">
                  Persistent Saved Resume
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Off by default. Resumes uploaded during interview setup are processed solely for the active session unless persistent storage is authorized.
                </p>
              </div>
              <Badge variant="outline">Disabled</Badge>
            </div>
          </CardContent>

          <CardFooter className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-slate-500">
              Authoritative status managed per SECURITY_PRIVACY.md
            </span>
            <div className="flex items-center gap-2">
              {loading ? (
                <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading...</span>
                </Button>
              ) : data?.personalization ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={updating || showWithdrawConfirm}
                  className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 text-xs"
                >
                  Withdraw Personalization Consent
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleGrantPersonalization}
                  disabled={updating}
                  className="gap-1.5 text-xs shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Enable Personalization</span>
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Profile & Auth */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base font-bold text-[#171827]">
                Account &amp; Security
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Registered user credentials and authenticated session management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div>
                <p className="text-sm font-medium text-[#171827]">Active Session</p>
                <p className="text-xs text-slate-500">
                  Protected with encrypted session cookies and server-side authorization.
                </p>
              </div>
              <Badge variant="outline">Verified</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Data Export & Deletion */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <CardTitle className="text-base font-bold text-red-950">
                Data Rights &amp; Deletion
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Download personal transcripts and reports or request complete account erasure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              In accordance with SECURITY_PRIVACY.md, deletion revokes active access immediately
              and executes idempotent, retryable cleanup workflows.
            </p>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Scheduled: Milestone 11</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" />
                Export Data
              </Button>
              <Button variant="destructive" size="sm" disabled className="text-xs">
                Delete Account
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

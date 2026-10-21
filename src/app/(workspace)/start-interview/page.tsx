"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { HelperText, ErrorMessage } from "@/components/ui/FormHelper";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import type { InterviewSummary } from "@/server/interviews/types";
import {
  Code2,
  Users,
  FileText,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  Info,
} from "lucide-react";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardFormState {
  mode: "technical" | "behavioral" | "resume" | "company";
  role: string;
  difficulty: "easy" | "medium" | "hard";
  durationMinutes: 5 | 10 | 20;
  questionCount: number;
  companyName: string;
  jobDescription: string;
  resumeText: string;
  // Consents
  consentAi: boolean;
  consentResume: boolean;
  consentSavedResume: boolean;
  consentPersonalization: boolean;
}

const INITIAL_FORM_STATE: WizardFormState = {
  mode: "technical",
  role: "Software Engineering Intern",
  difficulty: "medium",
  durationMinutes: 10,
  questionCount: 8,
  companyName: "",
  jobDescription: "",
  resumeText: "",
  consentAi: false,
  consentResume: false,
  consentSavedResume: false,
  consentPersonalization: false,
};

const MODE_OPTIONS = [
  {
    id: "technical" as const,
    title: "Technical Interview",
    description: "CS fundamentals, algorithms, system concepts, and role-specific technical depth.",
    icon: Code2,
  },
  {
    id: "behavioral" as const,
    title: "HR & Behavioral",
    description: "STAR framework questions evaluating leadership, teamwork, conflicts, and growth.",
    icon: Users,
  },
  {
    id: "resume" as const,
    title: "Resume-Based",
    description: "Targeted questions analyzing your projects, tech stack trade-offs, and metrics.",
    icon: FileText,
  },
  {
    id: "company" as const,
    title: "Company-Specific",
    description: "Simulations reflecting target company culture, engineering ethos, and domain.",
    icon: Building2,
  },
];

export default function StartInterviewWizardPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdInterview, setCreatedInterview] = useState<InterviewSummary | null>(null);

  const updateField = <K extends keyof WizardFormState>(
    field: K,
    value: WizardFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setSubmitError(null);
  };

  const validateStep = (currentStep: WizardStep): boolean => {
    const stepErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!form.role || form.role.trim().length < 2) {
        stepErrors.role = "Please enter a target role (at least 2 characters).";
      }
    }

    if (currentStep === 2) {
      if (form.questionCount < 3 || form.questionCount > 15) {
        stepErrors.questionCount = "Question count must be between 3 and 15.";
      }
    }

    if (currentStep === 3) {
      if (form.mode === "resume" && (!form.resumeText || form.resumeText.trim().length < 20)) {
        stepErrors.resumeText = "Resume context (at least 20 characters) is required for resume-based interviews.";
      }
      if (form.mode === "company" && !form.companyName.trim() && !form.jobDescription.trim()) {
        stepErrors.companyName = "Please provide either target company name or job context.";
      }
      if (form.jobDescription.length > 10000) {
        stepErrors.jobDescription = "Job context must not exceed 10,000 characters.";
      }
      if (form.resumeText.length > 20000) {
        stepErrors.resumeText = "Resume text must not exceed 20,000 characters.";
      }
    }

    if (currentStep === 4) {
      if (!form.consentAi) {
        stepErrors.consentAi = "Explicit consent for AI question generation and evaluation is required.";
      }
      if (form.resumeText.trim().length > 0 && !form.consentResume) {
        stepErrors.consentResume = "Explicit consent for resume processing is required when resume context is provided.";
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4) as WizardStep);
    }
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError(null);
    setStep((prev) => Math.max(prev - 1, 1) as WizardStep);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = `create_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: form.mode,
          role: form.role,
          difficulty: form.difficulty,
          durationMinutes: form.durationMinutes,
          questionCount: form.questionCount,
          companyName: form.companyName || undefined,
          jobDescription: form.jobDescription || undefined,
          resumeText: form.resumeText || undefined,
          idempotencyKey,
          consents: {
            aiQuestions: form.consentAi,
            aiEvaluation: form.consentAi,
            resumeProcessing: form.consentResume,
            savedResume: form.consentSavedResume,
            personalization: form.consentPersonalization,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issues && Array.isArray(data.issues)) {
          setSubmitError(data.issues.join(". "));
        } else {
          setSubmitError(data.message || "Failed to initialize interview.");
        }
        setIsSubmitting(false);
        return;
      }

      setCreatedInterview(data.interview);
      setStep(5);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "A network error occurred while communicating with the server."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, resumeText: "File size exceeds the 4 MB limit." }));
      return;
    }

    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        updateField("resumeText", text.slice(0, 20000));
      };
      reader.readAsText(file);
    } else {
      // PDF or other formatted document notice
      updateField("resumeText", `[Uploaded file: ${file.name} (${Math.round(file.size / 1024)} KB). Paste extracted text below for full fidelity].`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#171827]">
            Start Interview Wizard
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Configure your target role, difficulty, interview type, and privacy preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary">Milestone 5 Ready</Badge>
        </div>
      </div>

      {/* Progress Stepper */}
      {step < 5 && (
        <nav aria-label="Wizard Steps" className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
          <ol className="grid grid-cols-4 gap-2 text-center text-xs font-medium">
            <li className={`flex flex-col items-center gap-1 ${step >= 1 ? "text-[#4F46E5] font-semibold" : "text-slate-400"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? "bg-[#EEF2FF] text-[#4F46E5] border border-indigo-300" : "bg-slate-100 text-slate-400"}`}>
                1
              </div>
              <span className="hidden sm:inline">Role & Mode</span>
            </li>
            <li className={`flex flex-col items-center gap-1 ${step >= 2 ? "text-[#4F46E5] font-semibold" : "text-slate-400"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-[#EEF2FF] text-[#4F46E5] border border-indigo-300" : "bg-slate-100 text-slate-400"}`}>
                2
              </div>
              <span className="hidden sm:inline">Duration & Questions</span>
            </li>
            <li className={`flex flex-col items-center gap-1 ${step >= 3 ? "text-[#4F46E5] font-semibold" : "text-slate-400"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? "bg-[#EEF2FF] text-[#4F46E5] border border-indigo-300" : "bg-slate-100 text-slate-400"}`}>
                3
              </div>
              <span className="hidden sm:inline">Context & Resume</span>
            </li>
            <li className={`flex flex-col items-center gap-1 ${step >= 4 ? "text-[#4F46E5] font-semibold" : "text-slate-400"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 4 ? "bg-[#EEF2FF] text-[#4F46E5] border border-indigo-300" : "bg-slate-100 text-slate-400"}`}>
                4
              </div>
              <span className="hidden sm:inline">Consent & Review</span>
            </li>
          </ol>
        </nav>
      )}

      {/* Global Error Banner */}
      {submitError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Setup Failed</p>
            <p className="text-xs text-red-800 mt-0.5">{submitError}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Mode & Role */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Choose Role & Interview Mode</CardTitle>
            <CardDescription>
              Select the interview domain and target job title for this session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="role-input" required>
                Target Role / Job Title
              </Label>
              <Input
                id="role-input"
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
                error={Boolean(errors.role)}
                errorMessageId="role-error"
                placeholder="e.g. Frontend Developer Intern, Backend Engineer, SDE-1"
                maxLength={100}
              />
              {errors.role ? (
                <ErrorMessage id="role-error">{errors.role}</ErrorMessage>
              ) : (
                <HelperText id="role-helper">
                  Contextualizes technical topics and difficulty for your campus round.
                </HelperText>
              )}
            </div>

            <div>
              <Label required>Interview Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = form.mode === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => updateField("mode", opt.id)}
                      className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#4F46E5] bg-[#EEF2FF]/60 shadow-sm ring-1 ring-[#4F46E5]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[#4F46E5] text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-sm text-[#171827]">
                          {opt.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label required>Difficulty Level</Label>
              <div className="grid grid-cols-3 gap-3 mt-1.5">
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <button
                    type="button"
                    key={diff}
                    onClick={() => updateField("difficulty", diff)}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                      form.difficulty === diff
                        ? "border-[#4F46E5] bg-[#4F46E5] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={handleNext}>
              <span>Next: Duration & Questions</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: Duration & Questions */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Duration & Question Count</CardTitle>
            <CardDescription>
              Set interview time limits and pacing parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label required>Duration Preset</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1.5">
                {[
                  { value: 5 as const, title: "5 Minutes", subtitle: "Speed Practice (3-5 questions)" },
                  { value: 10 as const, title: "10 Minutes", subtitle: "Standard Campus Round (6-10 questions)" },
                  { value: 20 as const, title: "20 Minutes", subtitle: "Comprehensive Mock (10-15 questions)" },
                ].map((dur) => (
                  <button
                    type="button"
                    key={dur.value}
                    onClick={() => {
                      updateField("durationMinutes", dur.value);
                      if (dur.value === 5 && form.questionCount > 6) updateField("questionCount", 4);
                      if (dur.value === 10 && (form.questionCount < 6 || form.questionCount > 10)) updateField("questionCount", 8);
                      if (dur.value === 20 && form.questionCount < 10) updateField("questionCount", 12);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      form.durationMinutes === dur.value
                        ? "border-[#4F46E5] bg-[#EEF2FF]/60 ring-1 ring-[#4F46E5]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold text-sm text-[#171827] block">
                      {dur.title}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      {dur.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="question-count-slider" required>
                  Question Count: <span className="text-[#4F46E5] font-bold">{form.questionCount}</span>
                </Label>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  ~{Math.round((form.durationMinutes * 60) / form.questionCount)}s per question
                </span>
              </div>
              <input
                id="question-count-slider"
                type="range"
                min="3"
                max="15"
                step="1"
                value={form.questionCount}
                onChange={(e) => updateField("questionCount", parseInt(e.target.value, 10))}
                className="w-full accent-[#4F46E5] h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Min: 3 questions</span>
                <span>Default: 8 questions</span>
                <span>Max: 15 questions</span>
              </div>
              {errors.questionCount && (
                <ErrorMessage id="question-count-error">{errors.questionCount}</ErrorMessage>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Timer runs only during active speaking/thinking. Pausing between questions stops the timer. No answers are automatically submitted when time expires.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back</span>
            </Button>
            <Button onClick={handleNext}>
              <span>Next: Context & Resume</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Context & Resume */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Optional Context & Resume</CardTitle>
            <CardDescription>
              Provide relevant job description, target company, or resume text to tailor question depth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.mode === "company" && (
              <div className="space-y-4 p-4 rounded-xl border border-indigo-100 bg-[#EEF2FF]/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#3730A3] uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>Company-Specific Parameters</span>
                </div>
                <div>
                  <Label htmlFor="company-name" required={form.mode === "company"}>
                    Target Company Name
                  </Label>
                  <Input
                    id="company-name"
                    value={form.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    error={Boolean(errors.companyName)}
                    errorMessageId="company-error"
                    placeholder="e.g. Google, Amazon, Microsoft, Infosys"
                    maxLength={100}
                  />
                  {errors.companyName && (
                    <ErrorMessage id="company-error">{errors.companyName}</ErrorMessage>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label htmlFor="job-description">
                      Job Description or Team Context (Optional)
                    </Label>
                    <span className="text-xs text-slate-400">
                      {form.jobDescription.length} / 10,000 chars
                    </span>
                  </div>
                  <Textarea
                    id="job-description"
                    rows={4}
                    value={form.jobDescription}
                    onChange={(e) => updateField("jobDescription", e.target.value.slice(0, 10000))}
                    placeholder="Paste job posting requirements, key competencies, or team focus areas..."
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="resume-text" required={form.mode === "resume"}>
                  Resume Text Context {form.mode !== "resume" && "(Optional)"}
                </Label>
                <span className="text-xs text-slate-400">
                  {form.resumeText.length} / 20,000 chars
                </span>
              </div>
              <div className="mb-2">
                <input
                  type="file"
                  id="resume-file-input"
                  accept=".txt,.pdf"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#EEF2FF] file:text-[#4F46E5] hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
              <Textarea
                id="resume-text"
                rows={6}
                value={form.resumeText}
                onChange={(e) => updateField("resumeText", e.target.value.slice(0, 20000))}
                error={Boolean(errors.resumeText)}
                errorMessageId="resume-error"
                placeholder="Paste key projects, technologies, and achievements from your resume..."
              />
              {errors.resumeText ? (
                <ErrorMessage id="resume-error">{errors.resumeText}</ErrorMessage>
              ) : (
                <HelperText id="resume-helper">
                  Original PDFs are never permanently stored. Text context is processed solely for question personalization and discarded per data retention policy.
                </HelperText>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back</span>
            </Button>
            <Button onClick={handleNext}>
              <span>Next: Consent & Review</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: Consent & Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Privacy Disclosures & Review</CardTitle>
            <CardDescription>
              Review your setup and provide affirmative, purpose-specific consent before generating questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Setup Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm text-[#171827]">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Interview Configuration Summary
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Mode</span>
                  <span className="font-semibold capitalize">{form.mode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Role</span>
                  <span className="font-semibold truncate block">{form.role}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Difficulty</span>
                  <span className="font-semibold capitalize">{form.difficulty}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Duration / Count</span>
                  <span className="font-semibold">{form.durationMinutes}m ({form.questionCount} questions)</span>
                </div>
              </div>
              {form.companyName && (
                <div className="pt-2 text-xs border-t border-slate-200">
                  <span className="text-slate-500">Target Company:</span>{" "}
                  <span className="font-semibold">{form.companyName}</span>
                </div>
              )}
            </div>

            {/* Purpose-Specific Consent Box */}
            <div className="border border-indigo-200 rounded-xl p-4 bg-[#EEF2FF]/40 space-y-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#4F46E5] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#171827]">
                    Purpose-Specific Privacy Disclosures
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Questions are generated using vetted AI providers or complete fallback banks. Audio/video are never permanently stored.
                  </p>
                </div>
              </div>

              {/* Required Consent 1: AI Questions & Evaluation */}
              <div className="pt-2 border-t border-indigo-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="consent-ai-checkbox"
                    checked={form.consentAi}
                    onChange={(e) => updateField("consentAi", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <div className="text-xs text-[#171827]">
                    <span className="font-semibold text-slate-900 block">
                      Required: AI Question Generation & Evaluation
                    </span>
                    <span className="text-slate-600">
                      I consent to generating interview questions and evaluating my responses using configured AI models or reviewed benchmarks.
                    </span>
                  </div>
                </label>
                {errors.consentAi && (
                  <ErrorMessage id="consent-ai-error" className="ml-7 mt-1">
                    {errors.consentAi}
                  </ErrorMessage>
                )}
              </div>

              {/* Required Consent 2 (if resume supplied): Resume Processing */}
              {form.resumeText.trim().length > 0 && (
                <div className="pt-2 border-t border-indigo-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="consent-resume-checkbox"
                      checked={form.consentResume}
                      onChange={(e) => updateField("consentResume", e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <div className="text-xs text-[#171827]">
                      <span className="font-semibold text-slate-900 block">
                        Required: Current Resume Content Processing
                      </span>
                      <span className="text-slate-600">
                        I consent to processing the supplied resume text solely to tailor questions for this practice session.
                      </span>
                    </div>
                  </label>
                  {errors.consentResume && (
                    <ErrorMessage id="consent-resume-error" className="ml-7 mt-1">
                      {errors.consentResume}
                    </ErrorMessage>
                  )}
                </div>
              )}

              {/* Optional Consents: Off by default */}
              <div className="pt-2 border-t border-indigo-100 space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Optional Preferences (Off by default)
                </span>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="consent-saved-resume-checkbox"
                    checked={form.consentSavedResume}
                    onChange={(e) => updateField("consentSavedResume", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <div className="text-xs text-slate-600">
                    <span className="font-medium text-slate-800 block">
                      Save resume for future interviews
                    </span>
                    <span>
                      Retain this resume text in your account profile to reuse across future practice rounds.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="consent-personalization-checkbox"
                    checked={form.consentPersonalization}
                    onChange={(e) => updateField("consentPersonalization", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <div className="text-xs text-slate-600">
                    <span className="font-medium text-slate-800 block">
                      Personalize future recommendations
                    </span>
                    <span>
                      Permit using historical interview trends (requires 3+ completed sessions) to recommend focused practice areas.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back</span>
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoadingIndicator size="sm" color="white" className="mr-2" />
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>Generate & Start Interview</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 5: Success & Initialized Interview View */}
      {step === 5 && createdInterview && (
        <Card className="border-emerald-200">
          <CardHeader className="bg-emerald-50/60 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-emerald-950">
                  Interview Session Initialized!
                </CardTitle>
                <CardDescription className="text-emerald-800">
                  {createdInterview.questions.length} questions prepared and validated.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="capitalize">
                {createdInterview.interviewType} Mode
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {createdInterview.difficulty} Difficulty
              </Badge>
              <Badge variant="secondary">
                {createdInterview.durationMinutes} Minutes
              </Badge>
              <Badge
                variant={
                  createdInterview.questionSource === "gemini" ? "success" : "warning"
                }
                className="capitalize"
              >
                Source: {createdInterview.questionSource === "gemini" ? "Gemini AI" : "Reviewed Fallback Bank"}
              </Badge>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>Generated Question Set (Validated & Persisted)</span>
              </h2>
              <ol className="space-y-3 list-decimal list-inside text-sm text-[#171827]">
                {createdInterview.questions.map((q) => (
                  <li key={q.id} className="p-3 bg-white rounded-lg border border-slate-200 leading-relaxed">
                    <span className="font-medium">{q.questionText}</span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {q.category && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {q.category}
                        </span>
                      )}
                      <span>Time: {q.timeLimitSeconds || 120}s</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 bg-[#EEF2FF]/40 text-xs text-[#3730A3] space-y-1">
              <p className="font-semibold">Interview Room Ready</p>
              <p>
                The question set has been verified, idempotently saved to the database, and assigned to this session. Click &quot;Enter Interview Room&quot; to begin your interactive simulation.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreatedInterview(null);
                setForm(INITIAL_FORM_STATE);
                setStep(1);
              }}
            >
              Configure Another Session
            </Button>
            <Link href={`/interview/${createdInterview.id}`}>
              <Button variant="primary">
                <span>Enter Interview Room</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

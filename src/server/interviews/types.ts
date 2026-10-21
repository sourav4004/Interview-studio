/**
 * Interview Setup & Management Types.
 *
 * References:
 * - PRODUCT_SPEC.md (Interview modes, presets, limits)
 * - ARCHITECTURE.md (Section 3: interviews)
 */

import { InterviewDifficulty, InterviewMode } from "@/server/ai/types";

export interface InterviewCreationInput {
  mode: InterviewMode;
  role: string;
  difficulty: InterviewDifficulty;
  durationMinutes: 5 | 10 | 20;
  questionCount?: number;
  companyName?: string;
  jobDescription?: string;
  resumeText?: string;
  idempotencyKey?: string;
}

export interface InterviewQuestionSummary {
  id: string;
  orderIndex: number;
  questionText: string;
  category: string | null;
  difficulty: string | null;
  source: string;
  timeLimitSeconds: number | null;
}

export interface InterviewSummary {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  interviewType: string;
  status: string;
  role: string;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  companyName: string | null;
  questionSource: string;
  modelIdentifier: string | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  createdAt: Date;
  questions: InterviewQuestionSummary[];
}

export interface InterviewAnswerSummary {
  id: string;
  questionId: string;
  transcript: string;
  rawTranscript: string | null;
  status: "submitted" | "skipped" | "unanswered";
  inputMode: "speech" | "text" | "mixed";
  durationSeconds: number | null;
  isEdited: boolean;
  createdAt: Date;
}

export interface InterviewRoomState {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  interviewType: string;
  status: string; // "draft" | "in_progress" | "paused" | "completed" | "safely_exited" | "failed"
  role: string;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  companyName: string | null;
  isPracticeMode: boolean;
  currentQuestionIndex: number;
  startedAt: Date | null;
  endedAt: Date | null;
  lastPausedAt: Date | null;
  totalPauseDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isExpired: boolean;
  questions: InterviewQuestionSummary[];
  answers: InterviewAnswerSummary[];
}

export interface SubmitAnswerInput {
  questionId: string;
  transcript: string;
  rawTranscript?: string;
  inputMode?: "speech" | "text" | "mixed";
  durationSeconds?: number;
  isEdited?: boolean;
  idempotencyKey?: string;
}

export type InterviewRoomAction = "start" | "pause" | "resume" | "exit" | "expire";


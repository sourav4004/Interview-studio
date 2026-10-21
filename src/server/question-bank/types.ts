/**
 * Reviewed Question Bank Types.
 *
 * References: ARCHITECTURE.md (Section 3: question-bank)
 */

import { GeneratedQuestion, InterviewDifficulty, InterviewMode } from "@/server/ai/types";

export interface BankQuestion {
  id: string;
  questionText: string;
  category: string;
  difficulty: InterviewDifficulty;
  mode: InterviewMode;
  tags: string[];
  timeLimitSeconds?: number;
}

export interface FallbackSelectionResult {
  questions: GeneratedQuestion[];
  bankVersion: string;
  source: "fallback";
}

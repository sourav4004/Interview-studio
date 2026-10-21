/**
 * Reviewed Fallback Question Bank Service.
 *
 * Implements:
 * - Deterministic, validated question set generation from reviewed bank.
 * - Multi-tier selection matching mode and target difficulty.
 * - Guaranteed zero duplicates and exact requested question count fulfillment.
 * - Strict source attribution ('fallback') and bank versioning ('1.0').
 *
 * References:
 * - ARCHITECTURE.md (Section 3: question-bank)
 * - DECISIONS.md (Reviewed fallback question bank)
 */

import { GeneratedQuestion, QuestionGenerationRequest } from "@/server/ai/types";
import { FallbackSelectionResult } from "./types";
import { BANK_VERSION, REVIEWED_QUESTION_BANK } from "./bank";

export function getFallbackQuestions(
  request: QuestionGenerationRequest
): FallbackSelectionResult {
  const { mode, difficulty, questionCount, companyName } = request;

  // 1. Filter bank by requested mode
  const modePool = REVIEWED_QUESTION_BANK.filter((q) => q.mode === mode);

  if (modePool.length === 0) {
    throw new Error(`No fallback questions found for interview mode: ${mode}`);
  }

  // 2. Prioritize exact difficulty match
  const primaryPool = modePool.filter((q) => q.difficulty === difficulty);

  // 3. Define secondary fallback pools from other difficulties of the same mode
  const secondaryPool = modePool.filter((q) => q.difficulty !== difficulty);

  // 4. Combine pools without duplicates
  const candidatePool = [...primaryPool, ...secondaryPool];

  if (candidatePool.length < questionCount) {
    throw new Error(
      `Insufficient fallback questions available for mode ${mode}. Requested ${questionCount}, available ${candidatePool.length}`
    );
  }

  // 5. Select exactly requested questionCount
  const selected = candidatePool.slice(0, questionCount);

  // 6. Map to GeneratedQuestion format, customizing company or role if appropriate
  const questions: GeneratedQuestion[] = selected.map((q) => {
    let questionText = q.questionText;

    if (companyName && questionText.includes("the target company")) {
      questionText = questionText.replace(/the target company/g, companyName);
    }
    if (companyName && questionText.includes("the company")) {
      questionText = questionText.replace(/the company/g, companyName);
    }

    return {
      questionText,
      category: q.category,
      difficulty: q.difficulty,
      timeLimitSeconds: q.timeLimitSeconds ?? 120,
    };
  });

  return {
    questions,
    bankVersion: BANK_VERSION,
    source: "fallback",
  };
}

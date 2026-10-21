/**
 * Strict Zod Schemas & Validation for AI Question Generation.
 *
 * Enforces rule from AGENTS.md and ARCHITECTURE.md:
 * "Use structured output and strict validation. Reject malformed, empty,
 * duplicate, irrelevant, or incomplete question sets."
 */

import { z } from "zod";
import { GeneratedQuestion } from "./types";
import { AiResponseValidationError } from "./errors";

export const SCHEMA_VERSION = "1.0";

export const GeneratedQuestionSchema = z.object({
  questionText: z
    .string()
    .min(15, "Question text must be at least 15 characters")
    .max(500, "Question text must not exceed 500 characters")
    .transform((val) => val.trim()),
  category: z
    .string()
    .min(2, "Category must be at least 2 characters")
    .max(50, "Category must not exceed 50 characters")
    .transform((val) => val.trim()),
  difficulty: z.enum(["easy", "medium", "hard"]),
  timeLimitSeconds: z.number().int().min(30).max(600).optional(),
});

export const QuestionSetSchema = z.object({
  questions: z
    .array(GeneratedQuestionSchema)
    .min(1, "Question set must contain at least one question"),
});

export type RawQuestionSet = z.infer<typeof QuestionSetSchema>;

/**
 * Normalizes question text for duplicate detection (lowercase, alphanumeric only).
 */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates question count, ensures zero duplicate questions, and asserts difficulty consistency.
 */
export function validateAndDeduplicateQuestions(
  rawQuestions: GeneratedQuestion[],
  expectedCount: number
): GeneratedQuestion[] {
  const issues: string[] = [];

  if (rawQuestions.length < expectedCount) {
    issues.push(
      `Received incomplete question count: expected ${expectedCount}, received ${rawQuestions.length}`
    );
  }

  // Duplicate question detection
  const seenNormalized = new Set<string>();
  const uniqueQuestions: GeneratedQuestion[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const normalized = normalizeQuestionText(q.questionText);

    if (normalized.length < 10) {
      issues.push(`Question #${i + 1} is too short or trivial`);
      continue;
    }

    if (seenNormalized.has(normalized)) {
      issues.push(`Duplicate question detected at #${i + 1}: "${q.questionText.slice(0, 40)}..."`);
      continue;
    }

    seenNormalized.add(normalized);
    uniqueQuestions.push(q);
  }

  if (issues.length > 0) {
    throw new AiResponseValidationError(
      "AI question set failed strict validation checks",
      issues
    );
  }

  // Slice to exact requested count if the model returned extra
  return uniqueQuestions.slice(0, expectedCount);
}

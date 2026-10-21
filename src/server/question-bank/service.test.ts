// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getFallbackQuestions } from "./service";
import { normalizeQuestionText } from "@/server/ai/schemas";
import { InterviewMode, InterviewDifficulty } from "@/server/ai/types";

describe("Reviewed Fallback Question Bank Service", () => {
  const allModes: InterviewMode[] = ["technical", "behavioral", "resume", "company"];
  const allDifficulties: InterviewDifficulty[] = ["easy", "medium", "hard"];

  for (const mode of allModes) {
    for (const difficulty of allDifficulties) {
      it(`returns a complete, valid question set for mode=${mode}, difficulty=${difficulty}`, () => {
        const result = getFallbackQuestions({
          mode,
          difficulty,
          questionCount: 5,
          durationMinutes: 10,
          role: "Software Engineering Intern",
          companyName: "Google",
        });

        expect(result.source).toBe("fallback");
        expect(result.bankVersion).toBe("1.0");
        expect(result.questions).toHaveLength(5);

        // Check for duplicates
        const seen = new Set<string>();
        for (const q of result.questions) {
          expect(q.questionText.length).toBeGreaterThanOrEqual(15);
          expect(q.category.length).toBeGreaterThanOrEqual(2);
          const normalized = normalizeQuestionText(q.questionText);
          expect(seen.has(normalized)).toBe(false);
          seen.add(normalized);
        }
      });
    }
  }

  it("contextualizes company name in company-mode questions", () => {
    const result = getFallbackQuestions({
      mode: "company",
      difficulty: "easy",
      questionCount: 3,
      durationMinutes: 5,
      role: "Backend Engineer",
      companyName: "Stripe",
    });

    const hasStripe = result.questions.some((q) => q.questionText.includes("Stripe"));
    expect(hasStripe).toBe(true);
  });

  it("handles maximum question count (15) without duplicate questions", () => {
    const result = getFallbackQuestions({
      mode: "technical",
      difficulty: "medium",
      questionCount: 15,
      durationMinutes: 20,
      role: "Full Stack Engineer",
    });

    expect(result.questions).toHaveLength(15);

    const seen = new Set<string>();
    for (const q of result.questions) {
      const normalized = normalizeQuestionText(q.questionText);
      expect(seen.has(normalized)).toBe(false);
      seen.add(normalized);
    }
  });

  it("throws an error when requested count exceeds available pool", () => {
    expect(() =>
      getFallbackQuestions({
        mode: "technical",
        difficulty: "hard",
        questionCount: 99,
        durationMinutes: 20,
        role: "Software Architect",
      })
    ).toThrow(/insufficient fallback questions/i);
  });
});

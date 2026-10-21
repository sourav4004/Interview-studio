/**
 * Interview Configuration Validation Schemas.
 *
 * Enforces limits from DECISIONS.md and SECURITY_PRIVACY.md:
 * - Resume text max 20,000 chars.
 * - Combined optional context max 10,000 chars.
 * - Durations: 5, 10, or 20 minutes.
 * - Question count: 3 to 15 questions (default 8).
 */

import { z } from "zod";

export const InterviewConfigSchema = z
  .object({
    mode: z.enum(["technical", "behavioral", "resume", "company"], {
      errorMap: () => ({ message: "Please select a valid interview mode." }),
    }),
    role: z
      .string()
      .min(2, "Target role must be at least 2 characters")
      .max(100, "Target role must not exceed 100 characters")
      .transform((val) => val.trim()),
    difficulty: z.enum(["easy", "medium", "hard"], {
      errorMap: () => ({ message: "Please select a difficulty level." }),
    }),
    durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(20)], {
      errorMap: () => ({ message: "Duration must be 5, 10, or 20 minutes." }),
    }),
    questionCount: z
      .number()
      .int("Question count must be an integer")
      .min(3, "Question count must be at least 3")
      .max(15, "Question count must not exceed 15")
      .default(8),
    companyName: z
      .string()
      .max(100, "Company name must not exceed 100 characters")
      .optional()
      .transform((val) => (val ? val.trim() : undefined)),
    jobDescription: z
      .string()
      .max(10000, "Job context must not exceed 10,000 characters")
      .optional()
      .transform((val) => (val ? val.trim() : undefined)),
    resumeText: z
      .string()
      .max(20000, "Resume text must not exceed 20,000 characters")
      .optional()
      .transform((val) => (val ? val.trim() : undefined)),
    idempotencyKey: z
      .string()
      .min(1)
      .max(128)
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Mode-specific requirements
    if (data.mode === "resume" && (!data.resumeText || data.resumeText.length < 20)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resumeText"],
        message: "Resume context (at least 20 characters) is required for a resume-based interview.",
      });
    }

    if (data.mode === "company" && !data.companyName && !data.jobDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Target company name or job description is required for a company-specific interview.",
      });
    }
  });

export type ValidatedInterviewConfig = z.infer<typeof InterviewConfigSchema>;

export const SubmitAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  transcript: z
    .string()
    .max(10000, "Answer transcript must not exceed 10,000 characters")
    .transform((val) => val.trim()),
  rawTranscript: z
    .string()
    .max(10000)
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  inputMode: z.enum(["speech", "text", "mixed"]).default("speech"),
  isEdited: z.boolean().default(false),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export type ValidatedSubmitAnswer = z.infer<typeof SubmitAnswerSchema>;

export const SkipQuestionSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export type ValidatedSkipQuestion = z.infer<typeof SkipQuestionSchema>;

export const InterviewStateActionSchema = z.object({
  action: z.enum(["start", "pause", "resume", "exit", "expire"], {
    errorMap: () => ({
      message: "Action must be one of: start, pause, resume, exit, expire.",
    }),
  }),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export type ValidatedInterviewStateAction = z.infer<
  typeof InterviewStateActionSchema
>;


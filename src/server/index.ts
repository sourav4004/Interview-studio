/**
 * Server-side module entrypoint.
 *
 * In accordance with ARCHITECTURE.md, server-side capabilities are organized
 * into modular boundaries:
 * - auth: identity, sessions, verification
 * - users: profile, preferences, account settings
 * - consent: purpose-specific consent records & enforcement
 * - interviews: lifecycle, questions, answers, session transitions
 * - question-bank: reviewed fallback questions
 * - ai: internal adapter, prompt/rubric versioning, structured schemas
 * - evaluation: rubric-based scoring, evidence assembly
 * - reports: report validation, persistence, ownership
 * - resumes: PDF extraction, redaction, text limits
 * - usage: quota reservations, idempotency
 * - jobs: durable background evaluation tasks
 * - email: transactional templates, delivery state
 * - privacy: export, deletion, retention workflows
 * - observability: privacy-safe structured logging
 *
 * Modules will be populated in subsequent milestones as vertical slices.
 */

export { prisma } from "./db";
export { auth } from "./auth";
export { getCurrentSession } from "./auth/session";
export type {
  AuthenticatedSession,
  AuthenticatedUser,
  SessionData,
} from "./auth/session";

export * from "./consent";
export * from "./guest";
export * from "./idempotency";
export * from "./auth/authorization";
export * from "./usage";
export * from "./ai";
export * from "./question-bank";
export * from "./interviews";

export const SERVER_MODULES = [
  "auth",
  "users",
  "consent",
  "interviews",
  "question-bank",
  "ai",
  "evaluation",
  "reports",
  "personalization",
  "resumes",
  "usage",
  "jobs",
  "email",
  "privacy",
  "analytics",
  "observability",
] as const;

export type ServerModule = (typeof SERVER_MODULES)[number];

/**
 * Zod Schemas for Personalization Profiles.
 *
 * Ensures all persisted structured profile payloads and derived recommendations
 * strictly satisfy schema validation before storage or display.
 */

import { z } from "zod";

export const EVALUATION_DIMENSIONS = [
  "answer_quality",
  "technical_correctness",
  "relevance_completeness",
  "answer_structure",
  "communication_speech",
  "resume_consistency",
] as const;

export const evaluationDimensionSchema = z.enum(EVALUATION_DIMENSIONS);

export const recommendationPrioritySchema = z.enum(["high", "medium", "low"]);

export const profileRecommendationSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  skill: z.string().min(1),
  dimension: evaluationDimensionSchema.optional(),
  whySelected: z.string().min(1),
  priority: recommendationPrioritySchema,
  supportingReportIds: z.array(z.string()),
  evidenceExplanation: z.string().min(1),
  practiceActivity: z.string().min(1),
  suggestedPracticeGoal: z.string().min(1),
  generatedAt: z.string(),
});

export const recurringPatternSchema = z.object({
  skill: z.string().min(1),
  dimension: evaluationDimensionSchema,
  observationCount: z.number().int().min(1),
  supportingReportIds: z.array(z.string()),
  explanation: z.string().min(1),
});

export const dimensionAggregateEvidenceSchema = z.object({
  dimension: evaluationDimensionSchema,
  label: z.string(),
  averageScore: z.number().min(0).max(100),
  observationCount: z.number().int().min(1),
  trend: z.enum(["improving", "stable", "declining", "mixed"]),
});

export const personalizationProfileDataSchema = z.object({
  recurringStrengths: z.array(recurringPatternSchema),
  recurringImprovementAreas: z.array(recurringPatternSchema),
  dimensionAggregates: z.array(dimensionAggregateEvidenceSchema),
  primaryRecommendation: profileRecommendationSchema.nullable(),
  secondaryRecommendations: z.array(profileRecommendationSchema),
  limitations: z.array(z.string()),
});

/**
 * Cross-Session Personalization & Adaptive Recommendations Domain Types.
 *
 * Implements Milestone 9 contracts per:
 * - PRODUCT_SPEC.md (Section 9: Dashboard, Section 10: Personalization)
 * - SECURITY_PRIVACY.md (Purpose 5: Historical Data Personalization)
 * - DECISIONS.md (Deterministic aggregation, strict evidence grounding)
 * - AGENTS.md (No fake progress, strictly bounded scope)
 */

import { EvaluationDimension } from "@/server/evaluation/types";

export type PersonalizationStatus =
  | "ready"
  | "insufficient_evidence"
  | "disabled"
  | "guest_restricted"
  | "stale"
  | "failed";

export type RecommendationPriority = "high" | "medium" | "low";

export interface ProfileRecommendation {
  id: string;
  title: string;
  skill: string;
  dimension?: EvaluationDimension;
  whySelected: string;
  priority: RecommendationPriority;
  supportingReportIds: string[];
  evidenceExplanation: string;
  practiceActivity: string;
  suggestedPracticeGoal: string;
  generatedAt: string;
}

export interface RecurringPattern {
  skill: string;
  dimension: EvaluationDimension;
  observationCount: number;
  supportingReportIds: string[];
  explanation: string;
}

export interface DimensionAggregateEvidence {
  dimension: EvaluationDimension;
  label: string;
  averageScore: number;
  observationCount: number;
  trend: "improving" | "stable" | "declining" | "mixed";
}

export interface PersonalizationProfileData {
  recurringStrengths: RecurringPattern[];
  recurringImprovementAreas: RecurringPattern[];
  dimensionAggregates: DimensionAggregateEvidence[];
  primaryRecommendation: ProfileRecommendation | null;
  secondaryRecommendations: ProfileRecommendation[];
  limitations: string[];
}

export interface PersonalizationProfileResult {
  status: PersonalizationStatus;
  schemaVersion: string;
  isPersonalized: boolean;
  eligibleReportCount: number;
  requiredReportCount: number; // Always 3 per specification
  consentGrantedAt: Date | null;
  lastRefreshedAt: Date | null;
  data: PersonalizationProfileData | null;
  fallbackGuidance: string | null;
}

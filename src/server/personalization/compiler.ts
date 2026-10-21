/**
 * Deterministic Personalization Profile Compiler Engine.
 *
 * Compiles evidence-grounded candidate profiles and prioritized recommendations
 * from eligible completed reports per:
 * - PRODUCT_SPEC.md (Section 10: Personalization)
 * - DECISIONS.md (Deterministic aggregation, strict evidence grounding, no hallucination)
 * - SECURITY_PRIVACY.md (Data minimization, purpose-specific derivation)
 */

import { EvaluationDimension } from "@/server/evaluation/types";
import { ALL_EVALUATION_DIMENSIONS, DIMENSION_LABELS } from "@/server/dashboard";
import { ValidatedEligibleReport } from "./eligibility";
import {
  DimensionAggregateEvidence,
  PersonalizationProfileData,
  ProfileRecommendation,
  RecurringPattern,
} from "./types";
import { personalizationProfileDataSchema } from "./schemas";

export const MINIMUM_ELIGIBLE_REPORTS = 3;

interface DimensionPrescription {
  title: string;
  activity: string;
  goal: string;
}

const DIMENSION_PRESCRIPTIONS: Record<EvaluationDimension, DimensionPrescription> = {
  technical_correctness: {
    title: "Deepen Technical Problem Solving & Trade-offs",
    activity:
      "Complete a 10-minute Hard Technical simulation focusing on runtime complexity and architectural trade-offs.",
    goal: "Achieve an 80+ score in Technical Correctness on your next technical interview.",
  },
  answer_structure: {
    title: "Adopt the STAR Framework for Structured Responses",
    activity:
      "Practice framing behavioral answers with explicit Situation, Task, Action, and Result checkpoints.",
    goal: "Score 80+ in Structure & Framework across two consecutive sessions.",
  },
  communication_speech: {
    title: "Refine Verbal Conciseness and Clarity",
    activity:
      "Practice answering behavioral questions within a strict 90-second speaking window using structured summaries.",
    goal: "Maintain clear pacing and eliminate filler explanations in your next simulation.",
  },
  relevance_completeness: {
    title: "Direct Question Addressing & Scope Management",
    activity:
      "Take 5 seconds to summarize the interviewer's prompt before delivering your structured response.",
    goal: "Ensure all prompt sub-questions are explicitly answered in confirmed answers.",
  },
  resume_consistency: {
    title: "Align Project Details with Stated Experience",
    activity:
      "Review your submitted project descriptions and practice articulating measurable outcomes and specific contributions.",
    goal: "Achieve 85+ in Resume Consistency on your next resume-based simulation.",
  },
  answer_quality: {
    title: "Elevate Response Depth & Substance",
    activity:
      "Practice providing concrete examples and measurable outcomes for each question rather than abstract statements.",
    goal: "Score 80+ in Answer Quality on your next practice simulation.",
  },
};

/**
 * Compiles a structured, evidence-grounded personalization profile from eligible reports.
 * Returns null if the minimum evidence threshold (3 eligible reports) is not met.
 */
export function compilePersonalizationProfile(
  userId: string,
  grantedAt: Date,
  eligibleReports: ValidatedEligibleReport[]
): PersonalizationProfileData | null {
  if (eligibleReports.length < MINIMUM_ELIGIBLE_REPORTS) {
    return null;
  }

  const nowIso = new Date().toISOString();

  // 1. Compile dimension-level aggregate evidence
  const dimensionAggregates: DimensionAggregateEvidence[] = [];

  for (const dimension of ALL_EVALUATION_DIMENSIONS) {
    const scoredObservations: { score: number; reportId: string }[] = [];

    for (const report of eligibleReports) {
      const match = report.dimensionScores.find((d) => d.dimension === dimension);
      if (
        match &&
        match.status === "scored" &&
        typeof match.score === "number" &&
        !isNaN(match.score)
      ) {
        scoredObservations.push({ score: match.score, reportId: report.id });
      }
    }

    if (scoredObservations.length > 0) {
      const totalSum = scoredObservations.reduce((acc, curr) => acc + curr.score, 0);
      const avg = Math.round(totalSum / scoredObservations.length);

      let trend: "improving" | "stable" | "declining" | "mixed" = "stable";
      if (scoredObservations.length >= 2) {
        const first = scoredObservations[0].score;
        const last = scoredObservations[scoredObservations.length - 1].score;
        const delta = last - first;
        if (delta > 5) {
          trend = "improving";
        } else if (delta < -5) {
          trend = "declining";
        } else {
          trend = "stable";
        }
      }

      dimensionAggregates.push({
        dimension,
        label: DIMENSION_LABELS[dimension],
        averageScore: avg,
        observationCount: scoredObservations.length,
        trend,
      });
    }
  }

  // 2. Identify recurring strengths (>= 2 observations and average >= 80)
  const recurringStrengths: RecurringPattern[] = [];
  for (const agg of dimensionAggregates) {
    if (agg.observationCount >= 2 && agg.averageScore >= 80) {
      const supportingReportIds = eligibleReports
        .filter((r) =>
          r.dimensionScores.some(
            (d) => d.dimension === agg.dimension && d.status === "scored"
          )
        )
        .map((r) => r.id);

      recurringStrengths.push({
        skill: agg.label,
        dimension: agg.dimension,
        observationCount: agg.observationCount,
        supportingReportIds,
        explanation: `Demonstrated consistent strength in ${agg.label} across ${agg.observationCount} evaluated simulations (average score: ${agg.averageScore}/100).`,
      });
    }
  }

  // 3. Identify recurring improvement areas (>= 2 observations and average < 75)
  const recurringImprovementAreas: RecurringPattern[] = [];
  for (const agg of dimensionAggregates) {
    if (agg.observationCount >= 2 && agg.averageScore < 75) {
      const supportingReportIds = eligibleReports
        .filter((r) =>
          r.dimensionScores.some(
            (d) => d.dimension === agg.dimension && d.status === "scored"
          )
        )
        .map((r) => r.id);

      recurringImprovementAreas.push({
        skill: agg.label,
        dimension: agg.dimension,
        observationCount: agg.observationCount,
        supportingReportIds,
        explanation: `Identified structural growth opportunity in ${agg.label} across ${agg.observationCount} evaluated simulations (average score: ${agg.averageScore}/100).`,
      });
    }
  }

  // 4. Derive prioritized recommendations
  // Sort dimension aggregates ascending by averageScore to identify primary focus
  const sortedDimensions = [...dimensionAggregates].sort(
    (a, b) => a.averageScore - b.averageScore
  );

  let primaryRecommendation: ProfileRecommendation | null = null;
  const secondaryRecommendations: ProfileRecommendation[] = [];

  if (sortedDimensions.length > 0) {
    const primaryDim = sortedDimensions[0];
    const prescription = DIMENSION_PRESCRIPTIONS[primaryDim.dimension];
    const supportingReportIds = eligibleReports
      .filter((r) =>
        r.dimensionScores.some(
          (d) => d.dimension === primaryDim.dimension && d.status === "scored"
        )
      )
      .map((r) => r.id);

    primaryRecommendation = {
      id: `rec-prim-${primaryDim.dimension}`,
      title: prescription.title,
      skill: primaryDim.label,
      dimension: primaryDim.dimension,
      whySelected: `Selected as primary next step because ${primaryDim.label} is your lowest average scoring area (${primaryDim.averageScore}/100 across ${primaryDim.observationCount} simulations).`,
      priority: "high",
      supportingReportIds,
      evidenceExplanation: `Observed ${primaryDim.label} average score of ${primaryDim.averageScore}/100 based on ${primaryDim.observationCount} post-consent simulations.`,
      practiceActivity: prescription.activity,
      suggestedPracticeGoal: prescription.goal,
      generatedAt: nowIso,
    };

    // Secondary recommendations (next 1-2 dimensions)
    for (let i = 1; i < Math.min(sortedDimensions.length, 3); i++) {
      const secDim = sortedDimensions[i];
      const secPrescription = DIMENSION_PRESCRIPTIONS[secDim.dimension];
      const secSupporting = eligibleReports
        .filter((r) =>
          r.dimensionScores.some(
            (d) => d.dimension === secDim.dimension && d.status === "scored"
          )
        )
        .map((r) => r.id);

      secondaryRecommendations.push({
        id: `rec-sec-${secDim.dimension}`,
        title: secPrescription.title,
        skill: secDim.label,
        dimension: secDim.dimension,
        whySelected: `Addressed as a secondary goal to strengthen ${secDim.label} (${secDim.averageScore}/100).`,
        priority: secDim.averageScore < 75 ? "medium" : "low",
        supportingReportIds: secSupporting,
        evidenceExplanation: `Observed ${secDim.label} average score of ${secDim.averageScore}/100 across ${secDim.observationCount} evaluated sessions.`,
        practiceActivity: secPrescription.activity,
        suggestedPracticeGoal: secPrescription.goal,
        generatedAt: nowIso,
      });
    }
  }

  // 5. Honest limitations documentation
  const limitations: string[] = [
    `Personalized recommendations are derived strictly from ${eligibleReports.length} completed interviews completed after your personalization consent grant on ${grantedAt.toLocaleDateString()}.`,
    "Recurring conclusions require at least two supporting observations to distinguish trends from single-session variance.",
    "Different interview modes apply calibrated rubric weights; performance trajectories reflect observed rubric criteria rather than general employability.",
  ];

  const profileData: PersonalizationProfileData = {
    recurringStrengths,
    recurringImprovementAreas,
    dimensionAggregates,
    primaryRecommendation,
    secondaryRecommendations,
    limitations,
  };

  // Strictly validate against Zod schema before returning
  return personalizationProfileDataSchema.parse(profileData);
}

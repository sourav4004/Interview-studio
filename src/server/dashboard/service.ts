/**
 * Server-Side Dashboard & Interview History Service.
 *
 * Implements Milestone 8 candidate analytics and history retrieval:
 * 1. Strict server-side authorization and ownership isolation (registered users & guest sessions).
 * 2. Data minimization: loads only summary metadata, never leaking raw transcripts or resumes.
 * 3. Minimum data rules:
 *    - 0 completed reports: empty state with helpful onboarding instructions.
 *    - 1 completed report: truthful baseline; no trendline or unearned progress claims.
 *    - >= 2 reports: chronological trendline and factual score trajectory.
 * 4. Dimension evaluation handling:
 *    - 'not_applicable' and 'insufficient_evidence' are never treated as zero.
 *    - Dimension averages only include actually scored sessions.
 * 5. Mode differentiation:
 *    - Exposes interview mode on all trajectory points to avoid conflating different rubric weights.
 *
 * References:
 * - PRODUCT_SPEC.md (Section 8: Report, Section 9: Dashboard)
 * - ARCHITECTURE.md (Section 3: Suggested module boundaries)
 * - SECURITY_PRIVACY.md (Data minimization & server-side authorization)
 * - AGENTS.md (No fake metrics, strict scope boundaries)
 */

import { prisma } from "@/server/db";
import { AuthorizationError, SecurityActor } from "@/server/auth/authorization";
import { getOrCompilePersonalizationProfile } from "@/server/personalization";
import { EvaluationDimension, DimensionEvaluation } from "@/server/evaluation/types";
import { InterviewDifficulty, InterviewMode } from "@/server/ai/types";
import {
  DashboardAnalytics,
  DashboardMetrics,
  DashboardRecommendation,
  DimensionAggregate,
  DimensionTrendPoint,
  HistoryQueryOptions,
  HistoryResult,
  InterviewListItem,
  PerformanceTrends,
  ScoreDataPoint,
} from "./types";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Dashboard service cannot be imported into client-side code."
  );
}

/**
 * Standard evaluation dimension labels for candidate displays.
 */
export const DIMENSION_LABELS: Record<EvaluationDimension, string> = {
  answer_quality: "Answer Quality",
  technical_correctness: "Technical Correctness",
  relevance_completeness: "Relevance & Scope",
  answer_structure: "Structure & Framework",
  communication_speech: "Communication Clarity",
  resume_consistency: "Resume Consistency",
};

/**
 * All 6 core evaluation dimensions in display order.
 */
export const ALL_EVALUATION_DIMENSIONS: EvaluationDimension[] = [
  "answer_quality",
  "technical_correctness",
  "relevance_completeness",
  "answer_structure",
  "communication_speech",
  "resume_consistency",
];

/**
 * Builds the strict Prisma filter for the calling actor.
 * Prevents any cross-user or unauthorized record access.
 */
function buildActorFilter(actor: SecurityActor) {
  if (actor.userId) {
    return { userId: actor.userId };
  }

  if (actor.guestSessionId) {
    return { guestSessionId: actor.guestSessionId, userId: null };
  }

  throw new AuthorizationError(
    "Authentication or an active guest session is required to access interview data."
  );
}

/**
 * Retrieves paginated interview history for the authenticated actor.
 * Filters by mode and status with bounded pagination (default 10, max 50).
 */
export async function getInterviewHistory(
  actor: SecurityActor,
  options: HistoryQueryOptions = {}
): Promise<HistoryResult> {
  const actorFilter = buildActorFilter(actor);

  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);

  // Dynamic filter conditions
  const whereClause: Record<string, unknown> = {
    ...actorFilter,
  };

  if (options.mode && options.mode !== "all") {
    whereClause.interviewType = options.mode;
  }

  if (options.status && options.status !== "all") {
    whereClause.status = options.status;
  }

  // Execute count and bounded find in parallel for efficiency
  const [total, rawInterviews] = await Promise.all([
    prisma.interview.count({ where: whereClause }),
    prisma.interview.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        interviewType: true,
        status: true,
        role: true,
        difficulty: true,
        durationMinutes: true,
        questionCount: true,
        companyName: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        report: {
          select: {
            id: true,
            status: true,
            overallScore: true,
            rubricVersion: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const interviews: InterviewListItem[] = rawInterviews.map((item) => ({
    id: item.id,
    interviewType: item.interviewType as InterviewMode,
    status: item.status,
    role: item.role,
    difficulty: item.difficulty as InterviewDifficulty,
    durationMinutes: item.durationMinutes,
    questionCount: item.questionCount,
    companyName: item.companyName,
    createdAt: item.createdAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    report: item.report
      ? {
          id: item.report.id,
          status: item.report.status as "pending" | "processing" | "completed" | "failed",
          overallScore: item.report.overallScore,
          rubricVersion: item.report.rubricVersion,
          createdAt: item.report.createdAt,
        }
      : null,
  }));

  return {
    interviews,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + interviews.length < total,
    },
  };
}

/**
 * Calculates candidate dashboard analytics and score trends based strictly on
 * persisted, completed interview reports.
 */
export async function getDashboardAnalytics(
  actor: SecurityActor
): Promise<DashboardAnalytics> {
  const actorFilter = buildActorFilter(actor);

  // 1. Fetch total started interviews, mode counts, and 5 most recent sessions
  const [totalStarted, rawRecentInterviews, rawModeGroups, eligibleReports] =
    await Promise.all([
      prisma.interview.count({ where: actorFilter }),
      prisma.interview.findMany({
        where: actorFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          interviewType: true,
          status: true,
          role: true,
          difficulty: true,
          durationMinutes: true,
          questionCount: true,
          companyName: true,
          createdAt: true,
          startedAt: true,
          endedAt: true,
          report: {
            select: {
              id: true,
              status: true,
              overallScore: true,
              rubricVersion: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.interview.groupBy({
        by: ["interviewType"],
        where: actorFilter,
        _count: { _all: true },
      }),
      // Query completed, verified reports with chronological ordering for trends
      prisma.interviewReport.findMany({
        where: {
          ...actorFilter,
          status: "completed",
          overallScore: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          interviewId: true,
          overallScore: true,
          rubricVersion: true,
          dimensionScores: true,
          createdAt: true,
          interview: {
            select: {
              id: true,
              interviewType: true,
              role: true,
              difficulty: true,
              createdAt: true,
              endedAt: true,
            },
          },
        },
      }),
    ]);

  // 2. Map mode counts
  const modeCounts: Record<InterviewMode, number> = {
    technical: 0,
    behavioral: 0,
    resume: 0,
    company: 0,
  };

  for (const group of rawModeGroups) {
    const modeKey = group.interviewType as InterviewMode;
    if (modeKey in modeCounts) {
      modeCounts[modeKey] = group._count._all;
    }
  }

  // 3. Map recent interviews
  const recentInterviews: InterviewListItem[] = rawRecentInterviews.map((item) => ({
    id: item.id,
    interviewType: item.interviewType as InterviewMode,
    status: item.status,
    role: item.role,
    difficulty: item.difficulty as InterviewDifficulty,
    durationMinutes: item.durationMinutes,
    questionCount: item.questionCount,
    companyName: item.companyName,
    createdAt: item.createdAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    report: item.report
      ? {
          id: item.report.id,
          status: item.report.status as "pending" | "processing" | "completed" | "failed",
          overallScore: item.report.overallScore,
          rubricVersion: item.report.rubricVersion,
          createdAt: item.report.createdAt,
        }
      : null,
  }));

  // 4. Process eligible reports for score trajectory and dimension aggregates
  const totalCompleted = eligibleReports.length;

  const scoreTrajectory: ScoreDataPoint[] = eligibleReports.map((report) => ({
    interviewId: report.interviewId,
    role: report.interview.role,
    mode: report.interview.interviewType as InterviewMode,
    difficulty: report.interview.difficulty as InterviewDifficulty,
    completedAt: report.createdAt,
    overallScore: report.overallScore!,
    rubricVersion: report.rubricVersion ?? "1.0",
  }));

  // 5. Aggregate dimensions safely without penalizing not_applicable / insufficient_evidence
  const dimensionAggregates: DimensionAggregate[] = ALL_EVALUATION_DIMENSIONS.map(
    (dimension) => {
      const trendPoints: DimensionTrendPoint[] = [];

      for (const report of eligibleReports) {
        const rawScores = report.dimensionScores as unknown;
        const dimensionList: DimensionEvaluation[] = Array.isArray(rawScores)
          ? (rawScores as DimensionEvaluation[])
          : [];

        const matchingEval = dimensionList.find((d) => d.dimension === dimension);

        if (matchingEval) {
          const isScored =
            matchingEval.status === "scored" &&
            typeof matchingEval.score === "number" &&
            !isNaN(matchingEval.score);

          trendPoints.push({
            interviewId: report.interviewId,
            completedAt: report.createdAt,
            score: isScored ? matchingEval.score : null,
            status: matchingEval.status ?? (isScored ? "scored" : "insufficient_evidence"),
          });
        } else {
          trendPoints.push({
            interviewId: report.interviewId,
            completedAt: report.createdAt,
            score: null,
            status: "not_applicable",
          });
        }
      }

      // Filter strictly scored points for average calculation
      const scoredPoints = trendPoints.filter(
        (p) => p.status === "scored" && typeof p.score === "number"
      );

      const averageScore =
        scoredPoints.length > 0
          ? Math.round(
              scoredPoints.reduce((sum, p) => sum + (p.score as number), 0) /
                scoredPoints.length
            )
          : null;

      return {
        dimension,
        label: DIMENSION_LABELS[dimension],
        averageScore,
        scoredCount: scoredPoints.length,
        trend: trendPoints,
      };
    }
  );

  // 6. Identify strongest dimension based strictly on evidence
  // Universal strength is never claimed on insufficient evidence or ties
  const validDimensions = dimensionAggregates.filter(
    (d): d is DimensionAggregate & { averageScore: number } =>
      d.averageScore !== null && d.scoredCount > 0
  );

  let strongestDimension: {
    dimension: EvaluationDimension;
    label: string;
    averageScore: number;
  } | null = null;

  if (validDimensions.length >= 2) {
    const sorted = [...validDimensions].sort((a, b) => b.averageScore - a.averageScore);
    // Only claim relative strength if there is a distinct leader without a tie
    if (sorted[0].averageScore > sorted[1].averageScore) {
      strongestDimension = {
        dimension: sorted[0].dimension,
        label: sorted[0].label,
        averageScore: sorted[0].averageScore,
      };
    }
  }

  // 7. Calculate overall recent and average scores
  let recentScore: number | null = null;
  let averageScore: number | null = null;

  if (totalCompleted > 0) {
    const latestReport = eligibleReports[eligibleReports.length - 1];
    recentScore = latestReport.overallScore;

    const totalSum = eligibleReports.reduce(
      (sum, r) => sum + (r.overallScore ?? 0),
      0
    );
    averageScore = Math.round(totalSum / totalCompleted);
  }

  // 8. Enforce minimum data rules and truthful trend descriptions
  let hasComparableData = false;
  let minimumDataNotice = "";
  let trendSummary = "";

  const distinctModes = new Set(eligibleReports.map((r) => r.interview.interviewType));
  const distinctRubrics = new Set(eligibleReports.map((r) => r.rubricVersion ?? "1.0"));

  if (totalCompleted === 0) {
    hasComparableData = false;
    minimumDataNotice =
      "Complete your first diagnostic interview to start your performance history.";
    trendSummary =
      "No completed interview reports available yet. Complete a session to begin tracking progress.";
  } else if (totalCompleted === 1) {
    hasComparableData = false;
    minimumDataNotice =
      "Baseline score recorded. Complete at least one more interview to unlock comparative score trends.";
    trendSummary = `Initial diagnostic interview completed with an overall score of ${recentScore}/100. Additional sessions are required to establish an observed score trajectory.`;
  } else {
    // 2 or more completed reports
    hasComparableData = true;
    const scores = eligibleReports.map((r) => r.overallScore!);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const latest = scores[scores.length - 1];

    if (distinctModes.size === 1) {
      // Single mode: baseline delta within same rubric weights is meaningful
      const firstScore = scores[0];
      const scoreDiff = latest - firstScore;
      const diffSign = scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
      const singleMode = eligibleReports[0].interview.interviewType;
      trendSummary = `Across ${totalCompleted} completed ${singleMode} sessions, your overall scores range from ${minScore} to ${maxScore} (most recent: ${latest}/100, observed change of ${diffSign} points from your baseline).`;
    } else {
      // Mixed modes: different rubric weights; do not conflate into an arbitrary baseline progression
      trendSummary = `Across ${totalCompleted} completed sessions across multiple interview modes, your overall scores range from ${minScore} to ${maxScore} (most recent: ${latest}/100). Modes use distinct rubric weights; filter by individual mode to view mode-specific trajectories.`;
    }

    if (distinctRubrics.size > 1) {
      minimumDataNotice = `Reports reflect multiple rubric versions (${Array.from(distinctRubrics).map((v) => `v${v}`).join(", ")}). Historical scores reflect original evaluation criteria and are not recalculated.`;
    } else {
      minimumDataNotice =
        "Performance trends reflect observed evaluation scores across completed simulations. Different interview modes use calibrated rubric weights.";
    }
  }

  // 9. Personalization Profile & Adaptive Recommendation (Milestone 9)
  // Strictly respects consent and the 3+ post-consent interview threshold.
  const profileResult = await getOrCompilePersonalizationProfile(actor);

  let recommendation: DashboardRecommendation;
  const latestReportDate = eligibleReports.length > 0
    ? eligibleReports[eligibleReports.length - 1].createdAt
    : new Date();

  if (profileResult.isPersonalized && profileResult.data?.primaryRecommendation) {
    const primary = profileResult.data.primaryRecommendation;
    recommendation = {
      isPersonalized: true,
      category: "personalized",
      guidance: primary.evidenceExplanation,
      lastUpdated: profileResult.lastRefreshedAt ?? latestReportDate,
      primaryAction: {
        id: primary.id,
        title: primary.title,
        skill: primary.skill,
        dimension: primary.dimension,
        whySelected: primary.whySelected,
        priority: primary.priority,
        supportingReportIds: primary.supportingReportIds,
        evidenceExplanation: primary.evidenceExplanation,
        practiceActivity: primary.practiceActivity,
        suggestedPracticeGoal: primary.suggestedPracticeGoal,
      },
      secondaryRecommendations: profileResult.data.secondaryRecommendations.map((sec) => ({
        id: sec.id,
        title: sec.title,
        skill: sec.skill,
        dimension: sec.dimension,
        whySelected: sec.whySelected,
        priority: sec.priority,
        supportingReportIds: sec.supportingReportIds,
        evidenceExplanation: sec.evidenceExplanation,
        practiceActivity: sec.practiceActivity,
        suggestedPracticeGoal: sec.suggestedPracticeGoal,
      })),
      eligibleReportCount: profileResult.eligibleReportCount,
      requiredReportCount: profileResult.requiredReportCount,
      personalizationStatus: "ready",
    };
  } else {
    // Non-personalized general guidance: does not use cross-session data or evaluation dimensions.
    const fallback =
      profileResult.fallbackGuidance ||
      (totalCompleted === 0
        ? "Take a 10-minute diagnostic Technical or Behavioral interview to benchmark your foundational communication and structure."
        : "Continue practicing across Technical and Behavioral modes to build comprehensive campus placement readiness.");

    recommendation = {
      isPersonalized: false,
      category: "general",
      guidance: fallback,
      lastUpdated: latestReportDate,
      eligibleReportCount: profileResult.eligibleReportCount,
      requiredReportCount: profileResult.requiredReportCount,
      personalizationStatus:
        profileResult.status === "insufficient_evidence"
          ? "insufficient_evidence"
          : "disabled",
    };
  }

  const metrics: DashboardMetrics = {
    totalCompleted,
    totalStarted,
    recentScore,
    averageScore,
    strongestDimension: strongestDimension
      ? {
          dimension: strongestDimension.dimension,
          label: strongestDimension.label,
          averageScore: strongestDimension.averageScore,
        }
      : null,
    modeCounts,
  };

  const trends: PerformanceTrends = {
    hasComparableData,
    minimumDataNotice,
    trendSummary,
    scoreTrajectory,
    dimensionAggregates,
  };

  return {
    metrics,
    recentInterviews,
    trends,
    recommendation,
  };
}

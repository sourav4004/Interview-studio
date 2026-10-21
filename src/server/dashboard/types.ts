/**
 * Dashboard & Interview History Domain Types.
 *
 * Defines contracts for candidate analytics, history retrieval, and score trends per:
 * - PRODUCT_SPEC.md (Section 8: Report, Section 9: Dashboard)
 * - ARCHITECTURE.md (Section 3: Suggested module boundaries)
 * - UI_UX_SPEC.md (Dashboard & History layouts)
 */

import { EvaluationDimension } from "@/server/evaluation/types";
import { InterviewDifficulty, InterviewMode } from "@/server/ai/types";

export interface InterviewListItem {
  id: string;
  interviewType: InterviewMode;
  status: string; // "draft" | "in_progress" | "paused" | "completed" | "safely_exited" | "failed"
  role: string;
  difficulty: InterviewDifficulty;
  durationMinutes: number;
  questionCount: number;
  companyName: string | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  report: {
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    overallScore: number | null;
    rubricVersion: string | null;
    createdAt: Date;
  } | null;
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  mode?: InterviewMode | "all";
  status?: string | "all";
}

export interface HistoryResult {
  interviews: InterviewListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ScoreDataPoint {
  interviewId: string;
  role: string;
  mode: InterviewMode;
  difficulty: InterviewDifficulty;
  completedAt: Date;
  overallScore: number;
  rubricVersion: string;
}

export interface DimensionTrendPoint {
  interviewId: string;
  completedAt: Date;
  score: number | null;
  status: "scored" | "not_applicable" | "insufficient_evidence";
}

export interface DimensionAggregate {
  dimension: EvaluationDimension;
  label: string;
  averageScore: number | null; // null if no scored instances
  scoredCount: number;
  trend: DimensionTrendPoint[];
}

export interface DashboardMetrics {
  /**
   * Total interviews with completed, valid evaluation reports (overallScore != null).
   * Does NOT count sessions that merely ended or failed evaluation.
   */
  totalCompleted: number;
  /**
   * Total interview sessions initiated by the candidate.
   */
  totalStarted: number;
  /**
   * Overall score (0-100) from the most recent completed interview report.
   */
  recentScore: number | null;
  /**
   * Arithmetic mean of overall scores across completed reports.
   * Null if no completed reports exist.
   */
  averageScore: number | null;
  /**
   * Dimension with the highest average score among evaluated dimensions.
   * Null if evidence is insufficient (fewer than 2 evaluated dimensions or tied scores).
   */
  strongestDimension: {
    dimension: EvaluationDimension;
    label: string;
    averageScore: number;
  } | null;
  modeCounts: Record<InterviewMode, number>;
}

export interface PerformanceTrends {
  hasComparableData: boolean; // true if >= 2 completed reports exist
  minimumDataNotice: string;
  trendSummary: string; // Accessible textual description of the observed trajectory
  scoreTrajectory: ScoreDataPoint[];
  dimensionAggregates: DimensionAggregate[];
}

export interface DashboardRecommendationAction {
  id: string;
  title: string;
  skill: string;
  dimension?: EvaluationDimension;
  whySelected: string;
  priority: "high" | "medium" | "low";
  supportingReportIds: string[];
  evidenceExplanation: string;
  practiceActivity: string;
  suggestedPracticeGoal: string;
  suggestedMode?: string;
  suggestedDifficulty?: "easy" | "medium" | "hard";
  suggestedDurationMinutes?: number;
  recommendedFocusAreas?: string[];
}

export interface DashboardRecommendation {
  /**
   * True ONLY if the candidate has actively granted 'personalization' consent
   * AND at least 3 eligible post-consent completed reports exist.
   */
  isPersonalized: boolean;
  category: "general" | "personalized";
  guidance: string;
  lastUpdated: Date;
  primaryAction?: DashboardRecommendationAction | null;
  secondaryRecommendations?: DashboardRecommendationAction[];
  eligibleReportCount?: number;
  requiredReportCount?: number;
  personalizationStatus?: "ready" | "insufficient_evidence" | "disabled" | "guest_restricted";
}

export interface DashboardAnalytics {
  metrics: DashboardMetrics;
  recentInterviews: InterviewListItem[];
  trends: PerformanceTrends;
  recommendation: DashboardRecommendation;
}


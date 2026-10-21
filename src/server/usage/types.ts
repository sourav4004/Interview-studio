/**
 * Usage Tracking & Quota Reservation Types.
 *
 * Implements atomic usage accounting and quota reservations per ARCHITECTURE.md and DECISIONS.md.
 */

export type UsageAction = "question_generation" | "evaluation";

export type UsageStatus = "reserved" | "committed" | "released";

export interface UsageActor {
  userId?: string | null;
  guestSessionId?: string | null;
}

export interface TokenUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
}

export interface UsageReservation {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  interviewId: string | null;
  action: UsageAction;
  status: UsageStatus;
  unitsReserved: number;
  createdAt: Date;
}

export interface UsageAllowanceStatus {
  allowed: boolean;
  limit: number;
  consumed: number;
  remaining: number;
}

/**
 * Configurable quota limits.
 * Overridable via environment variables without requiring code changes.
 */
export function getDailyQuotaLimit(isGuest: boolean): number {
  if (isGuest) {
    const guestLimit = process.env.GUEST_DAILY_INTERVIEW_LIMIT;
    return guestLimit ? parseInt(guestLimit, 10) : 3; // 3 interviews per 24h for guests
  }
  const userLimit = process.env.USER_DAILY_INTERVIEW_LIMIT;
  return userLimit ? parseInt(userLimit, 10) : 10; // 10 interviews per 24h for registered users
}

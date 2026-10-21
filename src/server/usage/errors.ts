/**
 * Usage Quota & Reservation Errors.
 */

export class UsageLimitExceededError extends Error {
  public readonly remaining: number;
  public readonly limit: number;

  constructor(limit: number, remaining = 0) {
    super(
      `Usage limit reached (${limit} daily allowance). Please wait before starting another interview session.`
    );
    this.name = "UsageLimitExceededError";
    this.limit = limit;
    this.remaining = remaining;
  }
}

export class UsageReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Usage reservation '${reservationId}' was not found.`);
    this.name = "UsageReservationNotFoundError";
  }
}

export class UsageInvalidActorError extends Error {
  constructor(message = "Either userId or guestSessionId must be provided for usage accounting.") {
    super(message);
    this.name = "UsageInvalidActorError";
  }
}

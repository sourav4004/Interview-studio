/**
 * Guest session errors.
 */

export class GuestSessionNotFoundError extends Error {
  constructor(message = "Guest session not found or invalid token.") {
    super(message);
    this.name = "GuestSessionNotFoundError";
  }
}

export class GuestSessionExpiredError extends Error {
  constructor(message = "Guest session has expired. Start a new guest session or register an account.") {
    super(message);
    this.name = "GuestSessionExpiredError";
  }
}

export class GuestUnauthorizedError extends Error {
  constructor(message = "Unauthorized: Guest session does not have access to this resource.") {
    super(message);
    this.name = "GuestUnauthorizedError";
  }
}

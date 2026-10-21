/**
 * Interview Domain Errors.
 */

export class InterviewConfigurationError extends Error {
  public readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(`${message}${issues.length > 0 ? `: ${issues.join("; ")}` : ""}`);
    this.name = "InterviewConfigurationError";
    this.issues = issues;
  }
}

export class InterviewCreationError extends Error {
  constructor(message = "Failed to initialize interview session.") {
    super(message);
    this.name = "InterviewCreationError";
  }
}

export class InterviewNotFoundError extends Error {
  constructor(interviewId: string) {
    super(`Interview '${interviewId}' was not found.`);
    this.name = "InterviewNotFoundError";
  }
}

export class InterviewExpiredError extends Error {
  constructor(message = "The interview session duration has expired.") {
    super(message);
    this.name = "InterviewExpiredError";
  }
}

export class InterviewAnswerLockedError extends Error {
  constructor(questionId: string) {
    super(
      `Answer for question '${questionId}' is already submitted and locked in Realistic Mode.`
    );
    this.name = "InterviewAnswerLockedError";
  }
}

export class InterviewStateTransitionError extends Error {
  constructor(fromState: string, action: string) {
    super(`Invalid interview state transition from '${fromState}' with action '${action}'.`);
    this.name = "InterviewStateTransitionError";
  }
}

export class InterviewQuestionNotFoundError extends Error {
  constructor(questionId: string, interviewId: string) {
    super(`Question '${questionId}' does not belong to interview '${interviewId}'.`);
    this.name = "InterviewQuestionNotFoundError";
  }
}


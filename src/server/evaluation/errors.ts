/**
 * Evaluation & Report Domain Errors.
 */

export class InterviewNotReadyForEvaluationError extends Error {
  constructor(message = "Interview session is not ready for evaluation.") {
    super(message);
    this.name = "InterviewNotReadyForEvaluationError";
  }
}

export class InterviewReportNotFoundError extends Error {
  constructor(interviewId: string) {
    super(`Evaluation report for interview ${interviewId} could not be found.`);
    this.name = "InterviewReportNotFoundError";
  }
}

export class EvaluationProcessingError extends Error {
  constructor(message = "An error occurred while evaluating the interview session.") {
    super(message);
    this.name = "EvaluationProcessingError";
  }
}

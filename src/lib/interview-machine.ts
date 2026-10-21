/**
 * Interview Room Finite State Machine.
 *
 * Implements Milestone 6 strict state management:
 * - Explicit testable states and transitions.
 * - Rejection of invalid transitions.
 * - Derivation of interviewer avatar states: idle, speaking, listening, processing.
 * - Safe handling of timer expiry, pausing, editing, and deliberate exit.
 *
 * References:
 * - PRODUCT_SPEC.md (Section 6: Interview room)
 * - DECISIONS.md (Controlled pause/exit, explicit start/stop)
 */

export type InterviewMachineState =
  | "ready"
  | "asking_question"
  | "listening"
  | "confirming_answer"
  | "paused"
  | "processing"
  | "completed"
  | "safely_exited";

export type InterviewMachineEvent =
  | { type: "START" }
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "START_EDITING" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SUBMIT" }
  | { type: "SKIP" }
  | { type: "PROCESSING_SUCCESS_NEXT" }
  | { type: "PROCESSING_SUCCESS_FINISH" }
  | { type: "PROCESSING_ERROR" }
  | { type: "TIMER_EXPIRED" }
  | { type: "EXIT" };

export type AvatarState = "idle" | "speaking" | "listening" | "processing";

export interface TransitionResult {
  nextState: InterviewMachineState;
  valid: boolean;
  error?: string;
}

const VALID_TRANSITIONS: Record<
  InterviewMachineState,
  Partial<Record<InterviewMachineEvent["type"], InterviewMachineState>>
> = {
  ready: {
    START: "asking_question",
    EXIT: "safely_exited",
    TIMER_EXPIRED: "completed",
  },
  asking_question: {
    START_LISTENING: "listening",
    START_EDITING: "confirming_answer",
    PAUSE: "paused",
    SKIP: "processing",
    TIMER_EXPIRED: "completed",
    EXIT: "safely_exited",
  },
  listening: {
    STOP_LISTENING: "confirming_answer",
    PAUSE: "paused",
    TIMER_EXPIRED: "completed",
    EXIT: "safely_exited",
  },
  confirming_answer: {
    START_LISTENING: "listening",
    SUBMIT: "processing",
    SKIP: "processing",
    PAUSE: "paused",
    TIMER_EXPIRED: "completed",
    EXIT: "safely_exited",
  },
  paused: {
    RESUME: "asking_question",
    EXIT: "safely_exited",
    TIMER_EXPIRED: "completed",
  },
  processing: {
    PROCESSING_SUCCESS_NEXT: "asking_question",
    PROCESSING_SUCCESS_FINISH: "completed",
    PROCESSING_ERROR: "confirming_answer",
    TIMER_EXPIRED: "completed",
  },
  completed: {},
  safely_exited: {},
};

/**
 * Checks whether an event transition is permitted from the current state.
 */
export function canTransition(
  currentState: InterviewMachineState,
  event: InterviewMachineEvent
): boolean {
  return Boolean(VALID_TRANSITIONS[currentState]?.[event.type]);
}

/**
 * Executes a state transition. Throws if invalid or returns next state.
 */
export function transitionInterviewState(
  currentState: InterviewMachineState,
  event: InterviewMachineEvent
): TransitionResult {
  const allowed = VALID_TRANSITIONS[currentState]?.[event.type];

  if (!allowed) {
    return {
      nextState: currentState,
      valid: false,
      error: `Invalid transition from state '${currentState}' with event '${event.type}'`,
    };
  }

  return {
    nextState: allowed,
    valid: true,
  };
}

/**
 * Derives the visual interviewer avatar state based on machine state and synthesis audio status.
 */
export function getAvatarVisualState(
  machineState: InterviewMachineState,
  isSpeechSynthesizing = false
): AvatarState {
  if (machineState === "processing") {
    return "processing";
  }

  if (machineState === "listening") {
    return "listening";
  }

  if (machineState === "asking_question" && isSpeechSynthesizing) {
    return "speaking";
  }

  return "idle";
}

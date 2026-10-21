import { describe, it, expect } from "vitest";
import {
  canTransition,
  transitionInterviewState,
  getAvatarVisualState,
  InterviewMachineState,
} from "./interview-machine";

describe("Interview Machine Transitions", () => {
  it("permits valid linear flow: ready -> asking_question -> listening -> confirming_answer -> processing -> asking_question", () => {
    // 1. ready -> asking_question (START)
    expect(canTransition("ready", { type: "START" })).toBe(true);
    let res = transitionInterviewState("ready", { type: "START" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("asking_question");

    // 2. asking_question -> listening (START_LISTENING)
    expect(canTransition("asking_question", { type: "START_LISTENING" })).toBe(true);
    res = transitionInterviewState("asking_question", { type: "START_LISTENING" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("listening");

    // 3. listening -> confirming_answer (STOP_LISTENING)
    expect(canTransition("listening", { type: "STOP_LISTENING" })).toBe(true);
    res = transitionInterviewState("listening", { type: "STOP_LISTENING" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("confirming_answer");

    // 4. confirming_answer -> processing (SUBMIT)
    expect(canTransition("confirming_answer", { type: "SUBMIT" })).toBe(true);
    res = transitionInterviewState("confirming_answer", { type: "SUBMIT" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("processing");

    // 5. processing -> asking_question (PROCESSING_SUCCESS_NEXT)
    expect(canTransition("processing", { type: "PROCESSING_SUCCESS_NEXT" })).toBe(true);
    res = transitionInterviewState("processing", { type: "PROCESSING_SUCCESS_NEXT" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("asking_question");
  });

  it("handles final question completion: processing -> completed", () => {
    expect(canTransition("processing", { type: "PROCESSING_SUCCESS_FINISH" })).toBe(true);
    const res = transitionInterviewState("processing", { type: "PROCESSING_SUCCESS_FINISH" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("completed");
  });

  it("handles processing error: returns to confirming_answer", () => {
    expect(canTransition("processing", { type: "PROCESSING_ERROR" })).toBe(true);
    const res = transitionInterviewState("processing", { type: "PROCESSING_ERROR" });
    expect(res.valid).toBe(true);
    expect(res.nextState).toBe("confirming_answer");
  });

  it("rejects invalid state transitions", () => {
    // Cannot jump from ready to listening or processing
    expect(canTransition("ready", { type: "START_LISTENING" })).toBe(false);
    expect(canTransition("ready", { type: "SUBMIT" })).toBe(false);

    const invalidRes = transitionInterviewState("ready", { type: "SUBMIT" });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.nextState).toBe("ready");
    expect(invalidRes.error).toBeDefined();

    // Cannot jump from listening to ready
    expect(canTransition("listening", { type: "START" })).toBe(false);

    // Terminal states reject all actions
    expect(canTransition("completed", { type: "START" })).toBe(false);
    expect(canTransition("safely_exited", { type: "START" })).toBe(false);
  });

  it("supports pausing and resuming safely", () => {
    expect(canTransition("asking_question", { type: "PAUSE" })).toBe(true);
    expect(canTransition("listening", { type: "PAUSE" })).toBe(true);
    expect(canTransition("confirming_answer", { type: "PAUSE" })).toBe(true);

    const pauseRes = transitionInterviewState("asking_question", { type: "PAUSE" });
    expect(pauseRes.nextState).toBe("paused");

    expect(canTransition("paused", { type: "RESUME" })).toBe(true);
    const resumeRes = transitionInterviewState("paused", { type: "RESUME" });
    expect(resumeRes.nextState).toBe("asking_question");
  });

  it("supports skipping questions from asking_question or confirming_answer", () => {
    expect(canTransition("asking_question", { type: "SKIP" })).toBe(true);
    const skip1 = transitionInterviewState("asking_question", { type: "SKIP" });
    expect(skip1.nextState).toBe("processing");

    expect(canTransition("confirming_answer", { type: "SKIP" })).toBe(true);
    const skip2 = transitionInterviewState("confirming_answer", { type: "SKIP" });
    expect(skip2.nextState).toBe("processing");
  });

  it("transitions safely to completed upon TIMER_EXPIRED from any non-terminal state", () => {
    const activeStates: InterviewMachineState[] = [
      "ready",
      "asking_question",
      "listening",
      "confirming_answer",
      "paused",
      "processing",
    ];

    for (const state of activeStates) {
      expect(canTransition(state, { type: "TIMER_EXPIRED" })).toBe(true);
      const res = transitionInterviewState(state, { type: "TIMER_EXPIRED" });
      expect(res.nextState).toBe("completed");
    }
  });

  it("transitions safely to safely_exited upon EXIT", () => {
    const exitStates: InterviewMachineState[] = [
      "ready",
      "asking_question",
      "listening",
      "confirming_answer",
      "paused",
    ];

    for (const state of exitStates) {
      expect(canTransition(state, { type: "EXIT" })).toBe(true);
      const res = transitionInterviewState(state, { type: "EXIT" });
      expect(res.nextState).toBe("safely_exited");
    }
  });
});

describe("Avatar Visual State Derivation", () => {
  it("derives correct visual states", () => {
    expect(getAvatarVisualState("processing", false)).toBe("processing");
    expect(getAvatarVisualState("processing", true)).toBe("processing");

    expect(getAvatarVisualState("listening", false)).toBe("listening");
    expect(getAvatarVisualState("listening", true)).toBe("listening");

    expect(getAvatarVisualState("asking_question", true)).toBe("speaking");
    expect(getAvatarVisualState("asking_question", false)).toBe("idle");

    expect(getAvatarVisualState("ready", false)).toBe("idle");
    expect(getAvatarVisualState("paused", false)).toBe("idle");
    expect(getAvatarVisualState("completed", false)).toBe("idle");
    expect(getAvatarVisualState("safely_exited", false)).toBe("idle");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InterviewTimer } from "./Timer";

describe("InterviewTimer Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats and displays remaining minutes and seconds", () => {
    render(
      <InterviewTimer
        initialRemainingSeconds={600} // 10:00
        isPaused={false}
      />
    );

    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(
      screen.getByRole("timer", { name: /interview time remaining: 10:00/i })
    ).toBeInTheDocument();
  });

  it("decrements seconds over time when not paused", () => {
    render(
      <InterviewTimer
        initialRemainingSeconds={120} // 02:00
        isPaused={false}
      />
    );

    expect(screen.getByText("02:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000); // 5 seconds
    });

    expect(screen.getByText("01:55")).toBeInTheDocument();
  });

  it("does not decrement time when isPaused is true and displays paused badge", () => {
    render(
      <InterviewTimer
        initialRemainingSeconds={120}
        isPaused={true}
      />
    );

    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(screen.getByText(/paused/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Time remains frozen
    expect(screen.getByText("02:00")).toBeInTheDocument();
  });

  it("displays low time badge when remaining seconds are 60 or less", () => {
    render(
      <InterviewTimer
        initialRemainingSeconds={45}
        isPaused={false}
      />
    );

    expect(screen.getByText("00:45")).toBeInTheDocument();
    expect(screen.getByText(/low time/i)).toBeInTheDocument();
  });

  it("triggers onExpire callback when timer reaches 0", () => {
    const onExpire = vi.fn();

    render(
      <InterviewTimer
        initialRemainingSeconds={2}
        isPaused={false}
        onExpire={onExpire}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalled();
  });
});

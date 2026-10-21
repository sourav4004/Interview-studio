import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewerAvatar } from "./Avatar";

describe("InterviewerAvatar Component", () => {
  it("renders idle state with correct accessible label", () => {
    render(<InterviewerAvatar state="idle" />);
    const avatar = screen.getByRole("img", {
      name: /ai interviewer is idle and ready/i,
    });
    expect(avatar).toBeInTheDocument();
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
  });

  it("renders speaking state with audio wave indicators", () => {
    render(<InterviewerAvatar state="speaking" />);
    expect(
      screen.getByRole("img", {
        name: /ai interviewer is speaking the question/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/speaking/i)).toBeInTheDocument();
  });

  it("renders listening state with mic on badge", () => {
    render(<InterviewerAvatar state="listening" />);
    expect(
      screen.getByRole("img", {
        name: /ai interviewer is listening to your answer/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/mic on/i)).toBeInTheDocument();
    expect(screen.getByText(/listening/i)).toBeInTheDocument();
  });

  it("renders processing state", () => {
    render(<InterviewerAvatar state="processing" />);
    expect(
      screen.getByRole("img", {
        name: /ai interviewer is processing your answer/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });
});

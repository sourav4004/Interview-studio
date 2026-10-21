import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscriptEditor } from "./TranscriptEditor";

describe("TranscriptEditor Component", () => {
  it("renders textarea with value and displays word and char counters", () => {
    const onChange = vi.fn();

    render(
      <TranscriptEditor
        value="I led a project to build an event-driven system."
        onChange={onChange}
        isListening={false}
        speechStatus="idle"
        inputMode="speech"
        onSwitchMode={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/answer transcript and editor/i);
    expect(textarea).toHaveValue("I led a project to build an event-driven system.");

    expect(screen.getByText("9 words")).toBeInTheDocument();
    expect(screen.getByText("48 / 10,000 chars")).toBeInTheDocument();
  });

  it("calls onChange when typing into the textarea", () => {
    const onChange = vi.fn();

    render(
      <TranscriptEditor
        value=""
        onChange={onChange}
        isListening={false}
        speechStatus="idle"
        inputMode="text"
        onSwitchMode={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/answer transcript and editor/i);
    fireEvent.change(textarea, { target: { value: "My answer text" } });

    expect(onChange).toHaveBeenCalledWith("My answer text");
  });

  it("displays listening indicator and interim transcript when isListening is true", () => {
    render(
      <TranscriptEditor
        value="Started text..."
        interimValue="currently saying this"
        onChange={vi.fn()}
        isListening={true}
        speechStatus="listening"
        inputMode="speech"
        onSwitchMode={vi.fn()}
      />
    );

    expect(screen.getByText(/listening to your answer\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText("currently saying this")).toBeInTheDocument();
  });

  it("displays microphone permission notice when speechErrorMessage is passed", () => {
    render(
      <TranscriptEditor
        value=""
        onChange={vi.fn()}
        isListening={false}
        speechStatus="permission_denied"
        speechErrorMessage="Microphone access was denied. Please allow microphone permissions."
        inputMode="speech"
        onSwitchMode={vi.fn()}
      />
    );

    expect(
      screen.getByText(/microphone access was denied\. please allow microphone permissions\./i)
    ).toBeInTheDocument();
  });

  it("calls onSwitchMode when clicking text fallback or speech mode buttons", () => {
    const onSwitchMode = vi.fn();

    render(
      <TranscriptEditor
        value=""
        onChange={vi.fn()}
        isListening={false}
        speechStatus="idle"
        inputMode="speech"
        onSwitchMode={onSwitchMode}
      />
    );

    const textBtn = screen.getByRole("button", { name: /text fallback/i });
    fireEvent.click(textBtn);

    expect(onSwitchMode).toHaveBeenCalledWith("text");
  });
});

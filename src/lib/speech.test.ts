import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectBrowserSpeechCapabilities,
  getFriendlySpeechErrorMessage,
  createSpeechRecognitionAdapter,
  createSpeechSynthesisAdapter,
} from "./speech";

describe("Browser Speech Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectBrowserSpeechCapabilities", () => {
    it("returns false for recognition when SpeechRecognition is absent", () => {
      // In default test jsdom environment, window.SpeechRecognition is absent
      const caps = detectBrowserSpeechCapabilities();
      expect(caps.hasSpeechRecognition).toBe(false);
    });

    it("returns true for recognition when window.SpeechRecognition exists", () => {
      const orig = (window as unknown as Record<string, unknown>).SpeechRecognition;
      (window as unknown as Record<string, unknown>).SpeechRecognition = class MockSpeech {};
      const caps = detectBrowserSpeechCapabilities();
      expect(caps.hasSpeechRecognition).toBe(true);
      (window as unknown as Record<string, unknown>).SpeechRecognition = orig;
    });
  });

  describe("getFriendlySpeechErrorMessage", () => {
    it("returns permission denied guidance", () => {
      const msg = getFriendlySpeechErrorMessage("not-allowed");
      expect(msg).toContain("Microphone access was denied");
    });

    it("returns hardware missing guidance", () => {
      const msg = getFriendlySpeechErrorMessage("audio-capture");
      expect(msg).toContain("No microphone was found");
    });

    it("returns silence guidance", () => {
      const msg = getFriendlySpeechErrorMessage("no-speech");
      expect(msg).toContain("No speech was detected");
    });

    it("returns network guidance", () => {
      const msg = getFriendlySpeechErrorMessage("network");
      expect(msg).toContain("network issue");
    });

    it("returns general friendly guidance for unknown errors", () => {
      const msg = getFriendlySpeechErrorMessage("unknown-custom");
      expect(msg).toContain("encountered an issue");
    });
  });

  describe("createSpeechRecognitionAdapter", () => {
    it("calls onError with unsupported status when speech recognition is unavailable", () => {
      const onError = vi.fn();
      const adapter = createSpeechRecognitionAdapter({ onError });

      expect(adapter.isSupported).toBe(false);
      expect(adapter.getStatus()).toBe("unsupported");

      adapter.start();
      expect(onError).toHaveBeenCalledWith(
        "unsupported",
        expect.stringContaining("Speech recognition is not supported")
      );
    });

    it("initializes and handles start, interim, final result, and stop when available", () => {
      class MockSpeechRecognition {
        static currentInstance: MockSpeechRecognition | null = null;
        continuous = false;
        interimResults = false;
        lang = "";
        onstart: (() => void) | null = null;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;

        constructor() {
          MockSpeechRecognition.currentInstance = this;
        }

        start() {
          this.onstart?.();
        }

        stop() {
          this.onend?.();
        }

        abort() {
          this.onend?.();
        }
      }

      (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

      const onStart = vi.fn();
      const onInterimResult = vi.fn();
      const onFinalResult = vi.fn();
      const onError = vi.fn();
      const onEnd = vi.fn();

      const adapter = createSpeechRecognitionAdapter({
        onStart,
        onInterimResult,
        onFinalResult,
        onError,
        onEnd,
      });

      expect(adapter.isSupported).toBe(true);

      // Start recognition
      adapter.start();
      expect(onStart).toHaveBeenCalled();
      expect(adapter.getStatus()).toBe("listening");

      const instance = MockSpeechRecognition.currentInstance;
      expect(instance).toBeDefined();

      // Simulate interim result
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          [{ transcript: "I have experience with" }],
        ],
      } as never);
      expect(onInterimResult).toHaveBeenCalledWith("I have experience with");

      // Simulate final result
      const finalResultItem = [{ transcript: "PostgreSQL and TypeScript." }] as unknown as { transcript: string; isFinal?: boolean }[];
      (finalResultItem as unknown as { isFinal: boolean }).isFinal = true;

      instance?.onresult?.({
        resultIndex: 0,
        results: [finalResultItem],
      } as never);
      expect(onFinalResult).toHaveBeenCalledWith(
        expect.stringContaining("PostgreSQL and TypeScript.")
      );

      // Stop recognition
      adapter.stop();
      expect(onEnd).toHaveBeenCalled();

      // Clean up mock
      delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    });

    it("handles permission denial event gracefully", () => {
      class MockSpeechRecognition {
        onstart: (() => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }
        stop() {}
        abort() {}
      }

      (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

      const onError = vi.fn();
      const adapter = createSpeechRecognitionAdapter({ onError });

      adapter.start();
      expect(onError).toHaveBeenCalledWith(
        "not-allowed",
        expect.stringContaining("Microphone access was denied")
      );

      delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    });
  });

  describe("createSpeechSynthesisAdapter", () => {
    it("handles synthesis speak and stop when available", () => {
      const mockSpeak = vi.fn();
      const mockCancel = vi.fn();
      const mockPause = vi.fn();
      const mockResume = vi.fn();

      (window as unknown as Record<string, unknown>).speechSynthesis = {
        speak: mockSpeak,
        cancel: mockCancel,
        pause: mockPause,
        resume: mockResume,
        speaking: false,
      };
      (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class MockUtterance {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      };

      const adapter = createSpeechSynthesisAdapter();
      expect(adapter.isSupported).toBe(true);

      const onStart = vi.fn();
      adapter.speak("What is your experience with Next.js?", { onStart });

      expect(mockCancel).toHaveBeenCalled(); // Cancels previous utterances
      expect(mockSpeak).toHaveBeenCalled();

      adapter.pause();
      expect(mockPause).toHaveBeenCalled();

      adapter.resume();
      expect(mockResume).toHaveBeenCalled();

      adapter.stop();
      expect(mockCancel).toHaveBeenCalled();

      delete (window as unknown as Record<string, unknown>).speechSynthesis;
      delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
    });
  });
});

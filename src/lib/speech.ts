/**
 * Replaceable Browser Speech Adapter.
 *
 * Implements Web Speech API detection, speech recognition, and speech synthesis:
 * - Feature detection for Web Speech API (SpeechRecognition & SpeechSynthesis).
 * - Explicit user gesture required before microphone activation (never auto-activated).
 * - Clear handling of permission denial, hardware errors, network failure, and silence.
 * - Live interim transcript streaming with final transcript accumulation.
 * - Speech synthesis question reading with cancel/stop capabilities.
 * - Safe component unmount cleanup to release microphone resources.
 *
 * References:
 * - PRODUCT_SPEC.md (Section 6: Interview room - browser-first hybrid speech with text fallback)
 * - DECISIONS.md (No permanent audio recording, explicit start/stop)
 */

export type SpeechRecognitionStatus =
  | "unsupported"
  | "idle"
  | "requesting_permission"
  | "listening"
  | "permission_denied"
  | "error";

export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onInterimResult?: (interimTranscript: string) => void;
  onFinalResult?: (finalTranscript: string) => void;
  onError?: (errorType: string, userMessage: string) => void;
  onEnd?: () => void;
}

export interface BrowserSpeechCapabilities {
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
}

interface ISpeechRecognitionResult {
  isFinal?: boolean;
  0: { transcript: string };
  length: number;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: ISpeechRecognitionResult;
  };
}

interface ISpeechRecognitionErrorEvent {
  error?: string;
}

interface ISpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

// Window typing extension for browser speech recognition APIs
interface IWindowSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => ISpeechRecognitionInstance;
}

/**
 * Checks for browser support of Web Speech Recognition and Synthesis.
 */
export function detectBrowserSpeechCapabilities(): BrowserSpeechCapabilities {
  if (typeof window === "undefined") {
    return {
      hasSpeechRecognition: false,
      hasSpeechSynthesis: false,
    };
  }

  const win = window as unknown as IWindowSpeech;
  const hasRecognition = Boolean(
    win.SpeechRecognition || win.webkitSpeechRecognition
  );
  const hasSynthesis = Boolean(
    typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
  );

  return {
    hasSpeechRecognition: hasRecognition,
    hasSpeechSynthesis: hasSynthesis,
  };
}

/**
 * Translates Web Speech error codes into friendly, non-technical instructions.
 */
export function getFriendlySpeechErrorMessage(errorType: string): string {
  switch (errorType) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Please allow microphone permissions in your browser or switch to the text editor.";
    case "audio-capture":
      return "No microphone was found on your device. Please connect a microphone or use the text editor.";
    case "no-speech":
      return "No speech was detected. You can speak again or switch to the text editor.";
    case "network":
      return "Browser speech service network issue. You can continue speaking or type your answer.";
    case "aborted":
      return "Listening was stopped.";
    default:
      return "Speech recognition encountered an issue. You can retry speaking or use the text answer fallback.";
  }
}

/**
 * Creates an instance of the browser speech recognition adapter.
 */
export function createSpeechRecognitionAdapter(
  handlers: SpeechRecognitionHandlers
) {
  const capabilities = detectBrowserSpeechCapabilities();

  if (!capabilities.hasSpeechRecognition || typeof window === "undefined") {
    return {
      isSupported: false,
      start: () => {
        handlers.onError?.(
          "unsupported",
          "Speech recognition is not supported in this browser. Please use the text answer editor."
        );
      },
      stop: () => {},
      abort: () => {},
      getStatus: (): SpeechRecognitionStatus => "unsupported",
    };
  }

  const win = window as unknown as IWindowSpeech;
  const SpeechRecognitionClass =
    win.SpeechRecognition || win.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return {
      isSupported: false,
      start: () => {},
      stop: () => {},
      abort: () => {},
      getStatus: (): SpeechRecognitionStatus => "unsupported",
    };
  }

  let recognition: ISpeechRecognitionInstance | null = null;
  let status: SpeechRecognitionStatus = "idle";
  let accumulatedFinalText = "";

  const initRecognition = () => {
    if (recognition) return recognition;

    const instance = new SpeechRecognitionClass();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      status = "listening";
      handlers.onStart?.();
    };

    instance.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          accumulatedFinalText += (accumulatedFinalText ? " " : "") + item[0].transcript.trim();
          handlers.onFinalResult?.(accumulatedFinalText);
        } else {
          interim += item[0].transcript;
        }
      }
      if (interim) {
        handlers.onInterimResult?.(interim);
      }
    };

    instance.onerror = (event: ISpeechRecognitionErrorEvent) => {
      const err = event.error || "unknown";
      if (err === "not-allowed" || err === "service-not-allowed") {
        status = "permission_denied";
      } else if (err !== "aborted" && err !== "no-speech") {
        status = "error";
      }
      const message = getFriendlySpeechErrorMessage(err);
      handlers.onError?.(err, message);
    };

    instance.onend = () => {
      if (status === "listening" || status === "requesting_permission") {
        status = "idle";
      }
      handlers.onEnd?.();
    };

    recognition = instance;
    return instance;
  };

  return {
    isSupported: true,
    start: (initialText = "") => {
      accumulatedFinalText = initialText.trim();
      status = "requesting_permission";
      try {
        const inst = initRecognition();
        inst.start();
      } catch (err: unknown) {
        const errorName = err instanceof Error ? err.name : "";
        if (errorName !== "InvalidStateError") {
          status = "error";
          handlers.onError?.(
            "start_failed",
            "Could not activate microphone. Please try again."
          );
        }
      }
    },
    stop: () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      status = "idle";
    },
    abort: () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      }
      status = "idle";
    },
    getStatus: (): SpeechRecognitionStatus => status,
  };
}

/**
 * Creates an instance of the browser speech synthesis adapter for speaking questions.
 */
export function createSpeechSynthesisAdapter() {
  const capabilities = detectBrowserSpeechCapabilities();

  if (!capabilities.hasSpeechSynthesis || typeof window === "undefined") {
    return {
      isSupported: false,
      speak: () => {},
      stop: () => {},
      pause: () => {},
      resume: () => {},
      isSpeaking: () => false,
    };
  }

  return {
    isSupported: true,
    speak: (
      text: string,
      options?: {
        onStart?: () => void;
        onEnd?: () => void;
        onError?: (err: unknown) => void;
      }
    ) => {
      try {
        window.speechSynthesis.cancel(); // Stop any pending utterances first
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          options?.onStart?.();
        };
        utterance.onend = () => {
          options?.onEnd?.();
        };
        utterance.onerror = (e) => {
          options?.onError?.(e);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        options?.onError?.(err);
      }
    },
    stop: () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    },
    pause: () => {
      try {
        window.speechSynthesis.pause();
      } catch {
        // ignore
      }
    },
    resume: () => {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    },
    isSpeaking: (): boolean => {
      try {
        return window.speechSynthesis.speaking;
      } catch {
        return false;
      }
    },
  };
}

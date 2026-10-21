"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Shield,
} from "lucide-react";
import {
  canTransition,
  getAvatarVisualState,
  InterviewMachineState,
  transitionInterviewState,
} from "@/lib/interview-machine";
import {
  createSpeechRecognitionAdapter,
  createSpeechSynthesisAdapter,
  detectBrowserSpeechCapabilities,
  SpeechRecognitionStatus,
} from "@/lib/speech";
import { InterviewRoomState } from "@/server/interviews/types";
import { InterviewerAvatar } from "@/components/interview/Avatar";
import { InterviewTimer } from "@/components/interview/Timer";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { TranscriptEditor } from "@/components/interview/TranscriptEditor";
import { ControlsBar } from "@/components/interview/ControlsBar";
import { Button } from "@/components/ui/Button";

function getSafeStorageItem(type: "local" | "session", key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = type === "local" ? window.localStorage : window.sessionStorage;
    if (storage && typeof storage.getItem === "function") {
      return storage.getItem(key);
    }
  } catch {
    return null;
  }
  return null;
}

function setSafeStorageItem(type: "local" | "session", key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    const storage = type === "local" ? window.localStorage : window.sessionStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function removeSafeStorageItem(type: "local" | "session", key: string): void {
  try {
    if (typeof window === "undefined") return;
    const storage = type === "local" ? window.localStorage : window.sessionStorage;
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export default function InterviewRoomPage() {
  const params = useParams<{ id: string }>();
  const interviewId = params?.id;

  // Server state & loading
  const [interview, setInterview] = useState<InterviewRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Machine state
  const [machineState, setMachineState] =
    useState<InterviewMachineState>("ready");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Question & Answer state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [interimAnswer, setInterimAnswer] = useState("");
  const [inputMode, setInputMode] = useState<"speech" | "text">("speech");
  const [isEdited, setIsEdited] = useState(false);

  // Speech integration state
  const [speechStatus, setSpeechStatus] =
    useState<SpeechRecognitionStatus>("idle");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [capabilities, setCapabilities] = useState({
    hasSpeechRecognition: false,
    hasSpeechSynthesis: false,
  });

  // Adapter refs for unmount cleanup
  const recognitionRef = useRef<ReturnType<
    typeof createSpeechRecognitionAdapter
  > | null>(null);
  const synthesisRef = useRef<ReturnType<
    typeof createSpeechSynthesisAdapter
  > | null>(null);

  // Detect speech capabilities on mount
  useEffect(() => {
    queueMicrotask(() => {
      const caps = detectBrowserSpeechCapabilities();
      setCapabilities(caps);
      if (!caps.hasSpeechRecognition) {
        setInputMode("text");
      }
    });
  }, []);

  // Fetch interview state from server
  const fetchRoomState = useCallback(async () => {
    if (!interviewId) return;
    try {
      setErrorMessage(null);

      // Support guest session token if stored in localStorage
      const guestToken = getSafeStorageItem("local", "guest_token");
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const res = await fetch(`/api/interviews/${interviewId}`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          errorData.message || `Failed to load interview (status ${res.status})`
        );
      }

      const data = await res.json();
      const room: InterviewRoomState = data.interview;
      setInterview(room);
      setCurrentQuestionIndex(room.currentQuestionIndex || 0);

      // Map server status to initial client machine state
      if (room.status === "completed") {
        setMachineState("completed");
      } else if (room.status === "safely_exited") {
        setMachineState("safely_exited");
      } else if (room.status === "paused") {
        setMachineState("paused");
      } else if (room.startedAt) {
        setMachineState("asking_question");
      } else {
        setMachineState("ready");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load interview session.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      if (!ignore) {
        await fetchRoomState();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchRoomState]);

  // Initialize Speech Synthesis and Recognition adapters with cleanup
  useEffect(() => {
    const synthesis = createSpeechSynthesisAdapter();
    synthesisRef.current = synthesis;

    const recognition = createSpeechRecognitionAdapter({
      onStart: () => {
        setSpeechStatus("listening");
        setSpeechError(null);
      },
      onInterimResult: (interim) => {
        setInterimAnswer(interim);
      },
      onFinalResult: (finalText) => {
        setCurrentAnswer(finalText);
        setInterimAnswer("");
      },
      onError: (_errType, msg) => {
        setSpeechStatus("error");
        setSpeechError(msg);
      },
      onEnd: () => {
        setSpeechStatus("idle");
        setInterimAnswer("");
      },
    });
    recognitionRef.current = recognition;

    return () => {
      // Unmount cleanup: release hardware resources immediately
      recognition.abort();
      synthesis.stop();
    };
  }, []);

  // Pre-populate answer if question has an existing draft or answer
  const currentQuestion = interview?.questions[currentQuestionIndex];
  useEffect(() => {
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const existing = interview?.answers.find((a) => a.questionId === qId);

    queueMicrotask(() => {
      // Check localStorage recovery draft first
      const draftKey = `draft_answer_${interviewId}_${qId}`;
      const localDraft = getSafeStorageItem("session", draftKey);

      if (localDraft) {
        setCurrentAnswer(localDraft);
        setIsEdited(true);
        return;
      }

      // Check existing answer in state
      if (existing && existing.status === "submitted") {
        setCurrentAnswer(existing.transcript);
      } else {
        setCurrentAnswer("");
        setIsEdited(false);
      }
    });
  }, [currentQuestion, interview?.answers, interviewId]);

  // Read question aloud when reaching asking_question if speech synthesis available
  const handlePlayQuestionAudio = () => {
    if (!currentQuestion || !synthesisRef.current?.isSupported) return;
    setIsSynthesizing(true);
    synthesisRef.current.speak(currentQuestion.questionText, {
      onStart: () => setIsSynthesizing(true),
      onEnd: () => setIsSynthesizing(false),
      onError: () => setIsSynthesizing(false),
    });
  };

  const handleStopQuestionAudio = () => {
    synthesisRef.current?.stop();
    setIsSynthesizing(false);
  };

  // State Machine Action Handlers
  const handleStartInterview = async () => {
    if (!canTransition(machineState, { type: "START" })) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/interviews/${interviewId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (!res.ok) {
        throw new Error("Failed to start interview session.");
      }

      const data = await res.json();
      setInterview(data.interview);
      setMachineState("asking_question");

      // Attempt to read first question aloud
      if (capabilities.hasSpeechSynthesis && data.interview.questions[0]) {
        synthesisRef.current?.speak(data.interview.questions[0].questionText, {
          onStart: () => setIsSynthesizing(true),
          onEnd: () => setIsSynthesizing(false),
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start interview session.";
      setNetworkError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartListening = () => {
    if (!recognitionRef.current?.isSupported) {
      setSpeechError(
        "Speech recognition is not supported in this browser. Please use the text editor."
      );
      setInputMode("text");
      return;
    }

    // Stop speaking if question was being read aloud
    handleStopQuestionAudio();

    const transition = transitionInterviewState(machineState, {
      type: "START_LISTENING",
    });
    if (!transition.valid) return;

    setMachineState(transition.nextState);
    recognitionRef.current.start(currentAnswer);
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
    const transition = transitionInterviewState(machineState, {
      type: "STOP_LISTENING",
    });
    if (transition.valid) {
      setMachineState(transition.nextState);
    }
  };

  const handleAnswerTextChange = (text: string) => {
    setCurrentAnswer(text);
    setIsEdited(true);

    // Save to sessionStorage for disaster recovery
    if (currentQuestion) {
      setSafeStorageItem(
        "session",
        `draft_answer_${interviewId}_${currentQuestion.id}`,
        text
      );
    }

    if (machineState === "asking_question") {
      const transition = transitionInterviewState(machineState, {
        type: "START_EDITING",
      });
      if (transition.valid) {
        setMachineState(transition.nextState);
      }
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;
    const transition = transitionInterviewState(machineState, {
      type: "SUBMIT",
    });
    if (!transition.valid) return;

    // Stop active audio
    recognitionRef.current?.stop();
    handleStopQuestionAudio();

    setMachineState("processing");
    setIsSubmitting(true);
    setNetworkError(null);

    try {
      const res = await fetch(`/api/interviews/${interviewId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          transcript: currentAnswer,
          inputMode: inputMode,
          isEdited,
          idempotencyKey: `ans_${interviewId}_${currentQuestion.id}_${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errorData.message || "Failed to submit answer.");
      }

      // Success: clean recovery draft
      removeSafeStorageItem(
        "session",
        `draft_answer_${interviewId}_${currentQuestion.id}`
      );

      const data = await res.json();
      setInterview(data.interview);

      if (data.interview.status === "completed") {
        setMachineState("completed");
      } else {
        setCurrentQuestionIndex(data.interview.currentQuestionIndex);
        setCurrentAnswer("");
        setIsEdited(false);
        setMachineState("asking_question");

        // Speak next question
        const nextQ =
          data.interview.questions[data.interview.currentQuestionIndex];
        if (capabilities.hasSpeechSynthesis && nextQ) {
          synthesisRef.current?.speak(nextQ.questionText, {
            onStart: () => setIsSynthesizing(true),
            onEnd: () => setIsSynthesizing(false),
          });
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit answer.";
      setNetworkError(
        `${message}. Your answer is saved locally. Click 'Confirm & Submit' to retry.`
      );
      setMachineState("confirming_answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!currentQuestion) return;
    recognitionRef.current?.stop();
    handleStopQuestionAudio();

    setMachineState("processing");
    setIsSubmitting(true);
    setNetworkError(null);

    try {
      const res = await fetch(`/api/interviews/${interviewId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          isSkip: true,
          idempotencyKey: `skip_${interviewId}_${currentQuestion.id}_${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errorData.message || "Failed to skip question.");
      }

      removeSafeStorageItem(
        "session",
        `draft_answer_${interviewId}_${currentQuestion.id}`
      );

      const data = await res.json();
      setInterview(data.interview);

      if (data.interview.status === "completed") {
        setMachineState("completed");
      } else {
        setCurrentQuestionIndex(data.interview.currentQuestionIndex);
        setCurrentAnswer("");
        setIsEdited(false);
        setMachineState("asking_question");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to skip question.";
      setNetworkError(message);
      setMachineState("asking_question");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    recognitionRef.current?.stop();
    handleStopQuestionAudio();

    try {
      const res = await fetch(`/api/interviews/${interviewId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });

      if (res.ok) {
        const data = await res.json();
        setInterview(data.interview);
        setMachineState("paused");
      }
    } catch {
      // Offline fallback: set machine state directly
      setMachineState("paused");
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });

      if (res.ok) {
        const data = await res.json();
        setInterview(data.interview);
        setMachineState("asking_question");
      }
    } catch {
      setMachineState("asking_question");
    }
  };

  const handleExit = async () => {
    recognitionRef.current?.stop();
    handleStopQuestionAudio();

    try {
      await fetch(`/api/interviews/${interviewId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exit" }),
      });
    } catch {
      // Continue to exit safely
    }
    setMachineState("safely_exited");
  };

  const handleTimerExpire = async () => {
    recognitionRef.current?.stop();
    handleStopQuestionAudio();

    try {
      await fetch(`/api/interviews/${interviewId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expire" }),
      });
    } catch {
      // ignore
    }
    setMachineState("completed");
  };

  // Avatar state visual derivation
  const avatarVisual = getAvatarVisualState(machineState, isSynthesizing);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">
          Entering Interview Room...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Loading validated session context and questions
        </p>
      </div>
    );
  }

  // Error Screen
  if (errorMessage || !interview) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-[#171827]">
          Unable to Load Interview
        </h1>
        <p className="text-sm text-slate-600 max-w-md mt-1 mb-6">
          {errorMessage || "The requested interview session could not be found."}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchRoomState}>
            <RotateCcw className="w-4 h-4 mr-2" />
            <span>Try Again</span>
          </Button>
          <Link href="/dashboard">
            <Button variant="primary">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // READY STATE: Introduction & Pre-Flight Check
  if (machineState === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-[#EEF2FF]/30 flex flex-col">
        {/* Room Header */}
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
              {interview.interviewType} Interview
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Preset: {interview.durationMinutes} Minutes •{" "}
            {interview.questionCount} Questions
          </div>
        </header>

        {/* Ready Overview */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-10 flex flex-col items-center justify-center space-y-8">
          <InterviewerAvatar state="idle" />

          <div className="text-center max-w-xl space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171827] tracking-tight">
              Ready for your {interview.role} Interview
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your AI interviewer will ask questions one at a time. You can
              answer using your microphone or the built-in text editor.
            </p>
          </div>

          {/* Pre-Flight Checklist */}
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Interview Environment Guidelines</span>
            </h2>
            <ul className="space-y-3 text-xs text-slate-700">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Explicit microphone activation:</strong> The microphone is
                  never automatically enabled. You choose when to speak.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Review before submitting:</strong> Transcripts are shown
                  for your review. You can edit any mistakes before confirming.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Server-enforced timer:</strong> The {interview.durationMinutes}
                  -minute countdown begins when you click Start. Pausing pauses the
                  timer.
                </span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartInterview}
              isLoading={isSubmitting}
              className="bg-[#4F46E5] hover:bg-indigo-700 px-8 py-3 text-base shadow-md hover:shadow-lg transition-all"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              <span>Start Interview Now</span>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // COMPLETED STATE
  if (machineState === "completed") {
    const answeredCount = interview.answers.filter(
      (a) => a.status === "submitted"
    ).length;
    const skippedCount = interview.answers.filter(
      (a) => a.status === "skipped"
    ).length;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-[#171827]">
          Interview Session Completed!
        </h1>
        <p className="text-sm text-slate-600 max-w-md mt-1 mb-6">
          All your answers have been safely persisted in PostgreSQL. You answered{" "}
          <strong>{answeredCount}</strong> questions
          {skippedCount > 0 && ` and skipped ${skippedCount}`}.
        </p>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs max-w-md w-full mb-6 text-left space-y-2 text-xs text-slate-600">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span>Role</span>
            <span className="font-semibold text-slate-800">{interview.role}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span>Mode</span>
            <span className="font-semibold capitalize text-slate-800">
              {interview.interviewType}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span>Status</span>
            <span className="font-semibold text-emerald-600">Completed</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/interview/${interview.id}/report`}>
            <Button
              variant="primary"
              className="bg-[#4F46E5] hover:bg-indigo-700 shadow-sm"
            >
              View Evaluation Report
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // SAFELY EXITED STATE
  if (machineState === "safely_exited") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-[#171827]">
          Interview Safely Exited
        </h1>
        <p className="text-sm text-slate-600 max-w-md mt-1 mb-6">
          Your active session was closed. Any answers you submitted prior to
          exiting have been securely preserved.
        </p>
        <Link href="/dashboard">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // ACTIVE INTERVIEW ROOM LAYOUT (asking_question, listening, confirming_answer, paused, processing)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-[#EEF2FF]/20 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase tracking-wider">
            {interview.interviewType}
          </span>
          <span className="text-sm font-bold text-[#171827] hidden sm:inline">
            {interview.role}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 hidden md:inline">
            {interview.isPracticeMode ? "Practice Mode" : "Realistic Mode"}
          </span>
        </div>

        {/* Server-derived countdown timer */}
        <div className="flex items-center gap-3">
          <InterviewTimer
            initialRemainingSeconds={interview.remainingSeconds}
            isPaused={machineState === "paused"}
            onExpire={handleTimerExpire}
          />
        </div>
      </header>

      {/* Main Room Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Network Error Banner */}
        {networkError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-900"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Network Notification</p>
              <p className="mt-0.5 text-red-800">{networkError}</p>
            </div>
          </div>
        )}

        {/* Split Grid: Avatar & Question Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: AI Avatar */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center min-h-[260px]">
            <InterviewerAvatar state={avatarVisual} />
            <div className="mt-4 text-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                AI Interviewer
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {avatarVisual === "speaking"
                  ? "Speaking question..."
                  : avatarVisual === "listening"
                  ? "Listening to your response..."
                  : avatarVisual === "processing"
                  ? "Saving answer..."
                  : "Ready and observing"}
              </p>
            </div>
          </div>

          {/* Right Column: Question Card & Answer Editor */}
          <div className="lg:col-span-8 space-y-4">
            {currentQuestion ? (
              <QuestionCard
                question={currentQuestion}
                currentIndex={currentQuestionIndex}
                totalQuestions={interview.questions.length}
                isSynthesizing={isSynthesizing}
                onPlayAudio={handlePlayQuestionAudio}
                onStopAudio={handleStopQuestionAudio}
                hasSpeechSynthesis={capabilities.hasSpeechSynthesis}
              />
            ) : null}

            {/* Answer Editor */}
            <TranscriptEditor
              value={currentAnswer}
              interimValue={interimAnswer}
              onChange={handleAnswerTextChange}
              isListening={machineState === "listening"}
              speechStatus={speechStatus}
              speechErrorMessage={speechError}
              inputMode={inputMode}
              onSwitchMode={(mode) => setInputMode(mode)}
              disabled={machineState === "paused" || isSubmitting}
            />

            {/* Action Bar */}
            <ControlsBar
              machineState={machineState}
              isListening={machineState === "listening"}
              isSubmitting={isSubmitting}
              hasAnswerText={Boolean(currentAnswer.trim().length > 0)}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              onSubmitAnswer={handleSubmitAnswer}
              onSkipQuestion={handleSkipQuestion}
              onPause={handlePause}
              onResume={handleResume}
              onExit={handleExit}
              inputMode={inputMode}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

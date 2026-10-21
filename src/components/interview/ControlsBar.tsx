"use client";

import React, { useState } from "react";
import {
  Mic,
  Square,
  Send,
  SkipForward,
  Pause,
  Play,
  LogOut,
} from "lucide-react";
import { InterviewMachineState } from "@/lib/interview-machine";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface ControlsBarProps {
  machineState: InterviewMachineState;
  isListening: boolean;
  isSubmitting: boolean;
  hasAnswerText: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onSubmitAnswer: () => void;
  onSkipQuestion: () => void;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
  inputMode: "speech" | "text";
}

export function ControlsBar({
  machineState,
  isListening,
  isSubmitting,
  hasAnswerText,
  onStartListening,
  onStopListening,
  onSubmitAnswer,
  onSkipQuestion,
  onPause,
  onResume,
  onExit,
  inputMode,
}: ControlsBarProps) {
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const isPaused = machineState === "paused";
  const isTerminal =
    machineState === "completed" || machineState === "safely_exited";

  if (isTerminal) {
    return null;
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Pause / Resume & Exit Controls */}
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResume}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Play className="w-4 h-4 mr-1.5" />
              <span>Resume Interview</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPause}
              disabled={isSubmitting}
            >
              <Pause className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Pause</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExitDialog(true)}
            disabled={isSubmitting}
            className="text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span>Exit</span>
          </Button>
        </div>

        {/* Right: Answer Interaction Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Skip Question Button */}
          {!isPaused && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSkipDialog(true)}
              disabled={isSubmitting || isListening}
            >
              <SkipForward className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Skip Question</span>
            </Button>
          )}

          {/* Speech Control: Mic Start / Done */}
          {!isPaused && inputMode === "speech" && (
            <>
              {isListening ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onStopListening}
                  className="bg-emerald-600 hover:bg-emerald-700 animate-pulse"
                >
                  <Square className="w-4 h-4 mr-1.5 fill-current" />
                  <span>Done Speaking</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onStartListening}
                  disabled={isSubmitting}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  <Mic className="w-4 h-4 mr-1.5 text-indigo-600" />
                  <span>{hasAnswerText ? "Record More" : "Start Speaking"}</span>
                </Button>
              )}
            </>
          )}

          {/* Confirm & Submit Answer Button */}
          {!isPaused && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSubmitAnswer}
              disabled={!hasAnswerText || isListening || isSubmitting}
              isLoading={isSubmitting}
              className="bg-[#4F46E5] hover:bg-indigo-700"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Confirm & Submit</span>
            </Button>
          )}
        </div>
      </div>

      {/* Skip Confirmation Dialog */}
      <Dialog
        isOpen={showSkipDialog}
        onClose={() => setShowSkipDialog(false)}
        title="Skip This Question?"
        description="Skipped questions will be labeled as unanswered. They are not counted as incorrect, but you will not receive evaluation feedback for this specific prompt."
        footer={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSkipDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowSkipDialog(false);
                onSkipQuestion();
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Yes, Skip Question
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          You can return to review this question later in Practice Mode. In
          Realistic Mode, this question remains recorded as skipped.
        </p>
      </Dialog>

      {/* Exit Confirmation Dialog */}
      <Dialog
        isOpen={showExitDialog}
        onClose={() => setShowExitDialog(false)}
        title="Exit Interview Session?"
        description="Your previously submitted answers and current progress are safely persisted in the database. Are you sure you want to end this active interview session now?"
        footer={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
            >
              Stay in Interview
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowExitDialog(false);
                onExit();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Exit Session
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Exiting ends the active interview countdown and marks your session as
          safely exited. You can view your completed answers from the dashboard.
        </p>
      </Dialog>
    </>
  );
}

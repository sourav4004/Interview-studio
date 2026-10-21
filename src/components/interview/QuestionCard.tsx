"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { InterviewQuestionSummary } from "@/server/interviews/types";

interface QuestionCardProps {
  question: InterviewQuestionSummary;
  currentIndex: number;
  totalQuestions: number;
  isSynthesizing: boolean;
  onPlayAudio?: () => void;
  onStopAudio?: () => void;
  hasSpeechSynthesis: boolean;
  className?: string;
}

export function QuestionCard({
  question,
  currentIndex,
  totalQuestions,
  isSynthesizing,
  onPlayAudio,
  onStopAudio,
  hasSpeechSynthesis,
  className = "",
}: QuestionCardProps) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Header: Progress & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {question.category && (
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg capitalize">
              {question.category}
            </span>
          )}
          {question.difficulty && (
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg capitalize">
              {question.difficulty}
            </span>
          )}
        </div>

        {/* Audio Replay Control */}
        {hasSpeechSynthesis && (
          <div>
            {isSynthesizing ? (
              <button
                type="button"
                onClick={onStopAudio}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors"
                aria-label="Stop reading question aloud"
              >
                <VolumeX className="w-3.5 h-3.5 text-violet-600" />
                <span>Stop Audio</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPlayAudio}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                aria-label="Read question aloud"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Replay Question</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Question Text */}
      <div className="space-y-1">
        <h2 className="text-lg sm:text-xl font-bold text-[#171827] leading-snug">
          {question.questionText}
        </h2>
      </div>

      {/* Progress Dots */}
      <div className="pt-2 flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: totalQuestions }).map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all ${
              idx === currentIndex
                ? "w-8 bg-[#4F46E5]"
                : idx < currentIndex
                ? "w-3 bg-indigo-200"
                : "w-3 bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

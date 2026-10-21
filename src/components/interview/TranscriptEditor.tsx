"use client";

import React from "react";
import { Mic, MicOff, Edit3, AlertCircle, FileText } from "lucide-react";
import { SpeechRecognitionStatus } from "@/lib/speech";

interface TranscriptEditorProps {
  value: string;
  interimValue?: string;
  onChange: (val: string) => void;
  isListening: boolean;
  speechStatus: SpeechRecognitionStatus;
  speechErrorMessage?: string | null;
  inputMode: "speech" | "text";
  onSwitchMode: (mode: "speech" | "text") => void;
  disabled?: boolean;
}

export function TranscriptEditor({
  value,
  interimValue = "",
  onChange,
  isListening,
  speechStatus,
  speechErrorMessage,
  inputMode,
  onSwitchMode,
  disabled = false,
}: TranscriptEditorProps) {
  const wordsCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charsCount = value.length;

  return (
    <div
      data-speech-status={speechStatus}
      className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
    >
      {/* Header with Mode Toggle & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {inputMode === "speech" ? (
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg ${
                  isListening
                    ? "bg-emerald-100 text-emerald-700 animate-pulse"
                    : "bg-indigo-50 text-indigo-700"
                }`}
              >
                {isListening ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div>
                <span className="text-sm font-semibold text-[#171827]">
                  {isListening ? "Listening to your answer..." : "Speech Answer"}
                </span>
                <p className="text-[11px] text-slate-500">
                  {isListening
                    ? "Speak clearly into your microphone"
                    : "Review or edit before confirming"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[#171827]">
                  Text Answer Editor
                </span>
                <p className="text-[11px] text-slate-500">
                  Type your complete response directly
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mode Switcher Button */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => onSwitchMode("speech")}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              inputMode === "speech"
                ? "bg-white text-indigo-700 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Speech</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode("text")}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              inputMode === "text"
                ? "bg-white text-indigo-700 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text Fallback</span>
          </button>
        </div>
      </div>

      {/* Permission Denied or Error Guidance */}
      {speechErrorMessage && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Microphone or Speech Notice</p>
            <p className="mt-0.5 text-amber-800">{speechErrorMessage}</p>
          </div>
        </div>
      )}

      {/* Live Transcript / Text Editor */}
      <div className="relative">
        <label htmlFor="answer-textarea" className="sr-only">
          Answer transcript and editor
        </label>
        <textarea
          id="answer-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 10000))}
          disabled={disabled}
          rows={6}
          placeholder={
            inputMode === "speech"
              ? isListening
                ? "Speaking... (Your live speech will appear here)"
                : "Click 'Start Speaking' below to record, or type directly into this box to edit..."
              : "Type your structured answer here (e.g. using the STAR framework or technical breakdown)..."
          }
          className="w-full p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] text-sm text-[#171827] leading-relaxed resize-y min-h-[140px] bg-slate-50/50 focus:bg-white transition-colors"
        />

        {/* Interim Streaming Transcript Overlay when speaking */}
        {isListening && interimValue && (
          <div className="mt-1 p-2 bg-emerald-50/70 border border-emerald-200/60 rounded-lg text-xs text-emerald-900 flex items-center gap-2 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-medium italic">{interimValue}</span>
          </div>
        )}
      </div>

      {/* Footer Info: Counters & Caveat */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
        <p className="text-[11px] text-slate-400">
          Browser recognition may imperfectly capture nuances. Always review
          before confirming.
        </p>
        <div className="flex items-center gap-3 tabular-nums font-medium">
          <span>{wordsCount} words</span>
          <span>{charsCount} / 10,000 chars</span>
        </div>
      </div>
    </div>
  );
}

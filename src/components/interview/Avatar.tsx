"use client";

import React from "react";
import { AvatarState } from "@/lib/interview-machine";

interface InterviewerAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InterviewerAvatar({
  state,
  className = "",
}: InterviewerAvatarProps) {
  // Label for assistive technologies
  const stateLabels: Record<AvatarState, string> = {
    idle: "AI Interviewer is idle and ready",
    speaking: "AI Interviewer is speaking the question",
    listening: "AI Interviewer is listening to your answer",
    processing: "AI Interviewer is processing your answer",
  };

  return (
    <div
      role="img"
      aria-label={stateLabels[state]}
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Outer Glow Halo based on state */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 blur-xl opacity-60 ${
          state === "speaking"
            ? "bg-gradient-to-tr from-violet-500 to-indigo-500 scale-110 animate-pulse"
            : state === "listening"
            ? "bg-gradient-to-tr from-emerald-400 to-teal-500 scale-110 animate-pulse"
            : state === "processing"
            ? "bg-gradient-to-tr from-amber-400 to-indigo-500 scale-105 animate-spin"
            : "bg-indigo-300/40 scale-95"
        }`}
      />

      {/* Main Avatar Container */}
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1.5 bg-gradient-to-b from-indigo-500 via-violet-600 to-purple-800 shadow-2xl flex items-center justify-center">
        {/* State Ring */}
        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border-2 border-white/20 relative">
          {/* Stylized SVG Avatar Face */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full transition-transform duration-500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background subtle mesh */}
            <circle cx="50" cy="50" r="48" fill="#171827" />

            {/* Neck / Shoulders */}
            <path
              d="M30 88C30 76 38 70 50 70C62 70 70 76 70 88"
              stroke="#6366F1"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M20 98C20 86 32 80 50 80C68 80 80 86 80 98"
              fill="#312E81"
              opacity="0.6"
            />

            {/* Head Silhouette */}
            <rect
              x="35"
              y="26"
              width="30"
              height="38"
              rx="15"
              fill="#4338CA"
              stroke="#818CF8"
              strokeWidth="2.5"
            />

            {/* Hair outline */}
            <path
              d="M34 36C34 25 41 20 50 20C59 20 66 25 66 36C66 38 64 36 62 36C56 36 53 30 48 30C43 30 41 36 34 36Z"
              fill="#312E81"
            />

            {/* Eyes */}
            <circle
              cx="43"
              cy="42"
              r={state === "listening" ? "3" : "2.5"}
              fill={state === "listening" ? "#34D399" : "#FFFFFF"}
              className="transition-all"
            />
            <circle
              cx="57"
              cy="42"
              r={state === "listening" ? "3" : "2.5"}
              fill={state === "listening" ? "#34D399" : "#FFFFFF"}
              className="transition-all"
            />

            {/* Mouth / Voice Wave Indicator */}
            {state === "speaking" ? (
              <g className="animate-pulse">
                <rect x="44" y="52" width="2" height="6" rx="1" fill="#A5B4FC" />
                <rect x="48" y="50" width="2" height="10" rx="1" fill="#FFFFFF" />
                <rect x="52" y="51" width="2" height="8" rx="1" fill="#C7D2FE" />
                <rect x="56" y="53" width="2" height="4" rx="1" fill="#A5B4FC" />
              </g>
            ) : state === "listening" ? (
              <path
                d="M45 54C47 57 53 57 55 54"
                stroke="#34D399"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M46 54C48 55.5 52 55.5 54 54"
                stroke="#C7D2FE"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Dynamic Audio Waves Overlay when Speaking */}
          {state === "speaking" && (
            <div className="absolute bottom-2 flex items-center justify-center gap-1">
              <span className="w-1 h-3 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-5 bg-indigo-300 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-6 bg-white rounded-full animate-bounce [animation-delay:300ms]" />
              <span className="w-1 h-4 bg-indigo-300 rounded-full animate-bounce [animation-delay:450ms]" />
              <span className="w-1 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:600ms]" />
            </div>
          )}

          {/* Listening Pulsing Micro-Dot */}
          {state === "listening" && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full px-2 py-0.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                Mic On
              </span>
            </div>
          )}

          {/* Processing Spinner Overlay */}
          {state === "processing" && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* State Status Tag */}
      <div className="mt-3 text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-xs transition-colors ${
            state === "speaking"
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : state === "listening"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : state === "processing"
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state === "speaking"
                ? "bg-violet-600"
                : state === "listening"
                ? "bg-emerald-600 animate-pulse"
                : state === "processing"
                ? "bg-amber-600 animate-spin"
                : "bg-slate-400"
            }`}
          />
          <span className="capitalize">{state}</span>
        </span>
      </div>
    </div>
  );
}

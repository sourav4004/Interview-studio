"use client";

import React, { useEffect, useState, useRef } from "react";
import { Clock, Pause } from "lucide-react";

interface InterviewTimerProps {
  initialRemainingSeconds: number;
  isPaused: boolean;
  onExpire?: () => void;
  className?: string;
}

export function InterviewTimer({
  initialRemainingSeconds,
  isPaused,
  onExpire,
  className = "",
}: InterviewTimerProps) {
  const [prevInitial, setPrevInitial] = useState(initialRemainingSeconds);
  const [secondsLeft, setSecondsLeft] = useState<number>(
    Math.max(0, initialRemainingSeconds)
  );
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Adjust state during render when prop changes (React recommended pattern)
  if (prevInitial !== initialRemainingSeconds) {
    setPrevInitial(initialRemainingSeconds);
    setSecondsLeft(Math.max(0, initialRemainingSeconds));
  }

  useEffect(() => {
    if (isPaused || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  const isLowTime = secondsLeft > 0 && secondsLeft <= 60;
  const isExpired = secondsLeft <= 0;

  return (
    <div
      role="timer"
      aria-label={`Interview time remaining: ${formattedTime}`}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
        isExpired
          ? "bg-red-50 text-red-700 border-red-200"
          : isLowTime
          ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
          : isPaused
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-white text-slate-800 border-slate-200 shadow-xs"
      } ${className}`}
    >
      {isPaused ? (
        <Pause className="w-4 h-4 text-slate-500" />
      ) : (
        <Clock
          className={`w-4 h-4 ${
            isLowTime ? "text-amber-600" : "text-indigo-600"
          }`}
        />
      )}
      <span className="tabular-nums tracking-wider">{formattedTime}</span>
      {isPaused && (
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
          Paused
        </span>
      )}
      {isLowTime && !isPaused && (
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
          Low Time
        </span>
      )}
    </div>
  );
}

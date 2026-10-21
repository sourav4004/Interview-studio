import React from "react";
import { cn } from "@/lib/utils";

export interface LoadingIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white" | "muted";
  label?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const colorClasses = {
  primary: "text-[#4F46E5]",
  white: "text-white",
  muted: "text-slate-500",
};

export function LoadingIndicator({
  size = "md",
  color = "primary",
  label = "Loading",
  className,
  ...props
}: LoadingIndicatorProps) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <svg
        className={cn("animate-spin", sizeClasses[size], colorClasses[color])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

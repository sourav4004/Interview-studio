import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperTextId?: string;
  errorMessageId?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      error = false,
      helperTextId,
      errorMessageId,
      disabled,
      ...props
    },
    ref
  ) => {
    // Construct aria-describedby based on available helper/error IDs
    const describedBy = [
      error && errorMessageId ? errorMessageId : null,
      helperTextId ? helperTextId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-[#171827] placeholder:text-slate-400 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
            : "border-slate-300 focus-visible:border-[#4F46E5] focus-visible:ring-[#4F46E5]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

import React from "react";
import { cn } from "@/lib/utils";

export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  id?: string;
}

export function HelperText({ id, className, children, ...props }: HelperTextProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      className={cn("text-xs text-slate-600 mt-1.5 leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  id?: string;
}

export function ErrorMessage({ id, className, children, ...props }: ErrorMessageProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-xs font-medium text-red-700 mt-1.5 flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </p>
  );
}

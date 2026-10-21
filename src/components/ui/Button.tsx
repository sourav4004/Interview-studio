import React from "react";
import { cn } from "@/lib/utils";
import { LoadingIndicator } from "./LoadingIndicator";

export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#4F46E5] text-white hover:bg-[#4338CA] active:bg-[#3730A3] shadow-xs focus-visible:ring-[#4F46E5]",
  secondary:
    "bg-[#EEF2FF] text-[#3730A3] hover:bg-[#E0E7FF] active:bg-[#C7D2FE] border border-indigo-200/80 focus-visible:ring-[#4F46E5]",
  outline:
    "bg-white text-[#171827] border border-slate-300 hover:bg-slate-50 active:bg-slate-100 shadow-xs focus-visible:ring-[#4F46E5]",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs focus-visible:ring-red-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-medium rounded-md gap-1.5",
  md: "px-4 py-2 text-sm font-medium rounded-lg gap-2",
  lg: "px-6 py-3 text-base font-medium rounded-lg gap-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          "inline-flex items-center justify-center transition-colors font-medium select-none cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingIndicator
              size="sm"
              color={variant === "secondary" || variant === "outline" ? "primary" : "white"}
              label="Loading..."
            />
            <span className="opacity-80">{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

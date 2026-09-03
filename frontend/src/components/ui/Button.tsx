"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "outlineBrand";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/20 active:scale-[0.98]",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 active:scale-[0.98]",
  danger: "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]",
  outline: "border border-[var(--border-default)] text-[var(--text-body)] hover:bg-[var(--surface-warm)] bg-white active:scale-[0.98]",
  outlineBrand:
    "border border-brand text-brand-dark hover:bg-brand-tint/40 bg-white active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[var(--text-xs)] px-3 py-2 gap-1.5 rounded-[var(--r-control)] min-h-[36px]",
  md: "text-[var(--text-sm)] px-4 py-2.5 gap-2 rounded-[var(--r-field)] min-h-[42px]",
  lg: "text-[var(--text-base)] px-5 py-3 gap-2.5 rounded-[var(--r-field)] min-h-[48px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex cursor-pointer items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

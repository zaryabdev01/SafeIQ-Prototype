import { HTMLAttributes } from "react";

export type BadgeTone = "indigo" | "teal" | "amber" | "red" | "slate" | "green";

const toneClasses: Record<BadgeTone, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "slate", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function severityTone(severity: string): BadgeTone {
  switch (severity) {
    case "critical":
    case "high":
      return "red";
    case "medium":
      return "amber";
    default:
      return "slate";
  }
}

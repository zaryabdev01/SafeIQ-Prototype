"use client";

import { Lock, CheckCircle2 } from "lucide-react";

export type SprintCategory = { label: string; unlocked: boolean };

/**
 * "Your Help Sprint" progress bar from the M3 Figma: light violet card with a
 * completion count, progress track, next-recommended line and category pills.
 */
export function HelpSprintBar({
  completed,
  total,
  nextLabel,
  onNext,
  categories,
}: {
  completed: number;
  total: number;
  nextLabel: string | null;
  onNext?: () => void;
  categories: SprintCategory[];
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border-soft)] bg-[var(--brand-tint-2)] px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-[var(--text-strong)]">Your Help Sprint</p>
        <p className="text-[12.5px] font-semibold text-[var(--text-soft)]">
          {completed}/{total} completed
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>

      {nextLabel ? (
        <button onClick={onNext} className="w-fit text-left text-[12.5px] font-medium text-[var(--brand-dark)] hover:underline">
          Next recommended: &ldquo;{nextLabel}&rdquo; →
        </button>
      ) : (
        <p className="text-[12.5px] font-medium text-[var(--success)]">Sprint complete — nice work.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span
            key={c.label}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
              c.unlocked
                ? "border-[var(--success-bg)] bg-[var(--success-bg)] text-[var(--success)]"
                : "border-[var(--border-default)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {c.unlocked ? <CheckCircle2 size={14} /> : <Lock size={13} />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

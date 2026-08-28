import { Check } from "lucide-react";

/**
 * Numbered progress stepper from the Figma sign-up flow: circles 1..count with
 * connector lines. `current` is the 0-based index of the active step.
 */
export function Stepper({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex items-center w-full">
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                done
                  ? "bg-brand text-white"
                  : active
                    ? "border-2 border-brand bg-white text-brand"
                    : "bg-[var(--brand-tint)] text-[var(--text-soft)]"
              }`}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </div>
            {i < count - 1 && (
              <div className={`h-[2px] flex-1 mx-1.5 rounded-full ${done ? "bg-brand" : "bg-[var(--border-default)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

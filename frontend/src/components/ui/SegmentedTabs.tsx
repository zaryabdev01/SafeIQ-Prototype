import type { LucideIcon } from "lucide-react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Warm-surface pill toggle from the Figma auth screens. Active segment is a
 * filled violet chip with white text.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className = "",
  fluid = true,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** true (default): segments stretch to fill the row. false: segments size to content. */
  fluid?: boolean;
}) {
  return (
    <div
      className={`inline-flex gap-1 rounded-[14px] border border-[#e4dfe8] bg-white p-1 ${
        fluid ? "flex w-full" : ""
      } ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] px-2 py-2.5 text-[13px] font-semibold transition-colors ${
              fluid ? "min-w-0 flex-1" : ""
            } ${
              active
                ? "bg-brand text-white shadow-[0_1px_3px_rgba(73,46,161,0.35)]"
                : "text-[var(--brand-darker)] hover:bg-[#faf8fb]"
            }`}
          >
            {Icon && (
              <Icon
                size={15}
                className={`shrink-0 ${active ? "text-white" : "text-[#9a93a1]"}`}
                strokeWidth={2}
              />
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

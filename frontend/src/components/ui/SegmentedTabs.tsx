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
      className={`inline-flex gap-1 rounded-[var(--r-field)] border border-[var(--border-default)] bg-[var(--surface-warm)] p-[5px] ${
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
            className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-control)] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
              fluid ? "min-w-0 flex-1" : ""
            } ${
              active
                ? "bg-brand text-white shadow-[0_1px_2px_rgba(31,20,38,0.1)]"
                : "text-[var(--brand-darker)] hover:text-brand"
            }`}
          >
            {Icon && <Icon size={15} className="shrink-0" />}
            <span className={fluid ? "truncate" : ""}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

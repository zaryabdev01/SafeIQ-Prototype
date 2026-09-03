import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6 sm:mb-7 flex items-start gap-3 sm:gap-4">
      {Icon && (
        <span className="mt-0.5 flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-[var(--r-field)] bg-[var(--brand-tint-2)] text-brand">
          <Icon size={22} />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-[1.25rem] sm:text-[var(--text-xl)] font-extrabold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[var(--text-xs)] sm:text-[var(--text-sm)] text-[var(--text-soft)] line-clamp-2 sm:line-clamp-none">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

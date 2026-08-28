import type { LucideIcon } from "lucide-react";

/**
 * Page heading block inside the white content panel (production Figma, M3):
 * an optional soft icon chip + ExtraBold title + soft subtitle.
 */
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
    <div className="mb-6 flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-tint-2)] text-brand">
          <Icon size={18} />
        </span>
      )}
      <div>
        <h1 className="text-[24px] font-extrabold leading-[32px] tracking-[-0.02em] text-[var(--text-strong)]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[var(--text-soft)]">{subtitle}</p>}
      </div>
    </div>
  );
}

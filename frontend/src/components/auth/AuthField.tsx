import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Auth-screen form field matching the production Figma design: 48px tall,
 * 1.5px border, 13px radius, warm-white fill, optional leading icon. Kept
 * separate from components/ui/Field.tsx so the rest of the app's inputs are
 * untouched during the milestone-by-milestone redesign.
 */

const shell =
  "flex h-12 items-center gap-2.5 rounded-[13px] border border-[#e4dfe8] bg-white px-3.5 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20";

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[14px] font-bold text-[var(--text-strong)]">{children}</span>;
}

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, hint, icon, trailing, className = "", id, ...props },
  ref,
) {
  const inputId = id ?? (label ? `f-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label htmlFor={inputId} className="flex w-full flex-col gap-[7px]">
      {label && <FieldLabel>{label}</FieldLabel>}
      <span className={shell}>
        {icon && <span className="shrink-0 text-[var(--text-soft)]">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`min-w-0 flex-1 bg-transparent text-sm text-[var(--text-strong)] placeholder:text-[#9a93a1] focus:outline-none ${className}`}
          {...props}
        />
        {trailing && <span className="shrink-0 text-[var(--text-soft)]">{trailing}</span>}
      </span>
      {hint && <span className="text-xs text-[var(--text-soft)]">{hint}</span>}
    </label>
  );
});

interface AuthSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  icon?: ReactNode;
}

export const AuthSelect = forwardRef<HTMLSelectElement, AuthSelectProps>(function AuthSelect(
  { label, hint, icon, className = "", children, id, ...props },
  ref,
) {
  const selectId = id ?? (label ? `s-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label htmlFor={selectId} className="flex w-full flex-col gap-[7px]">
      {label && <FieldLabel>{label}</FieldLabel>}
      <span className={shell}>
        {icon && <span className="shrink-0 text-[var(--text-soft)]">{icon}</span>}
        <select
          ref={ref}
          id={selectId}
          className={`min-w-0 flex-1 appearance-none bg-transparent text-sm text-[var(--text-strong)] focus:outline-none ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="shrink-0 text-[var(--text-soft)]" />
      </span>
      {hint && <span className="text-xs text-[var(--text-soft)]">{hint}</span>}
    </label>
  );
});

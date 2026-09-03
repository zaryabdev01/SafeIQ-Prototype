import { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Label({ className = "", children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-2 block text-[var(--text-sm)] font-semibold text-[var(--text-body)] ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

const fieldBase =
  "w-full rounded-[var(--r-field)] border border-[var(--border-default)] bg-white px-3.5 py-2.5 text-[var(--text-sm)] text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors min-h-[42px]";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} min-h-[100px] ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function FormRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-[var(--text-xs)] text-[var(--text-soft)]">{hint}</p>}
    </div>
  );
}

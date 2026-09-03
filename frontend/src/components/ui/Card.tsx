import { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-[var(--radius-xl)] border border-[var(--border-default)] shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:shadow-md hover:shadow-slate-900/[0.04] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-2 sm:gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

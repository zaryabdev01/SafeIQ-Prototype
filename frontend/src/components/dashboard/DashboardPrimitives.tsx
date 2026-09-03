"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

export function DashboardStatTile({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  href,
  index = 0,
}: {
  label: string;
  value: number | string;
  caption?: string;
  icon: LucideIcon;
  tone: string;
  href: string;
  index?: number;
}) {
  return (
    <Link href={href} className="block animate-page-enter interactive-lift" style={{ animationDelay: `${index * 50}ms` }}>
      <Card className="h-full hover:border-brand">
        <CardBody className="flex items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] transition-transform duration-200 group-hover:scale-105 ${tone}`}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold leading-none text-[var(--text-strong)]">{value}</p>
            <p className="mt-1 truncate text-[var(--text-xs)] text-[var(--text-soft)]">{label}</p>
            {caption && <p className="text-[10px] text-[var(--text-soft)]/80">{caption}</p>}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export function DashboardSectionTitle({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2.5 text-[var(--text-base)] font-bold text-[var(--text-strong)]">
      {Icon && (
        <span className="flex size-8 items-center justify-center rounded-[var(--r-control)] bg-[var(--brand-tint-2)] text-brand">
          <Icon size={16} />
        </span>
      )}
      {children}
    </h2>
  );
}

export function DashboardEmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-[var(--text-sm)] text-[var(--text-soft)]">{children}</p>;
}

export function DashboardInsetItem({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="rounded-[var(--r-control)] bg-[var(--surface-warm)] px-3.5 py-3 transition-colors hover:bg-[var(--brand-tint-2)]/60">
      <p className="truncate text-[var(--text-sm)] text-[var(--text-body)]">{title}</p>
      {meta && <p className="mt-0.5 text-[var(--text-xs)] text-[var(--text-soft)]">{meta}</p>}
    </div>
  );
}

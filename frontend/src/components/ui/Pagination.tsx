"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

function buildPageRange(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (page > 3) pages.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 2) pages.push("ellipsis");

  pages.push(totalPages);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  totalItems,
  pageSize,
  className = "",
  align = "between",
}: {
  /** 1-based page index */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
  align?: "between" | "center" | "end";
}) {
  if (totalItems === 0) return null;
  if (totalPages <= 1 && totalItems === undefined) return null;

  const pages = totalPages > 1 ? buildPageRange(page, totalPages) : [];
  const from = totalItems && pageSize ? Math.min(totalItems, (page - 1) * pageSize + 1) : null;
  const to = totalItems && pageSize ? Math.min(totalItems, page * pageSize) : null;

  const alignClass =
    align === "center" ? "justify-center" : align === "end" ? "justify-end" : "justify-between";

  const showNav = totalPages > 1;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-[var(--border-soft)] px-4 py-3.5 sm:px-6 sm:py-4 ${alignClass} ${className}`}
    >
      {from !== null && to !== null && totalItems !== undefined ? (
        <p className="text-[var(--text-xs)] text-[var(--text-soft)] order-last sm:order-first">
          Showing <span className="font-semibold text-[var(--text-body)]">{from}</span>–
          <span className="font-semibold text-[var(--text-body)]">{to}</span> of{" "}
          <span className="font-semibold text-[var(--text-body)]">{totalItems}</span>
        </p>
      ) : (
        <span className="hidden sm:block" />
      )}

      {showNav ? (
        <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-control)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--text-soft)] transition-colors hover:bg-[var(--brand-tint-2)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} className="px-2 text-[var(--text-sm)] text-[var(--text-soft)]">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={`min-h-10 min-w-10 rounded-[var(--r-control)] px-2.5 text-[var(--text-sm)] font-semibold transition-all duration-200 ${
                  p === page
                    ? "bg-brand text-white shadow-md shadow-brand/25"
                    : "text-[var(--text-soft)] hover:bg-[var(--brand-tint-2)] hover:text-[var(--text-body)]"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-control)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--text-soft)] transition-colors hover:bg-[var(--brand-tint-2)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} />
        </button>
        </div>
      ) : null}
    </div>
  );
}

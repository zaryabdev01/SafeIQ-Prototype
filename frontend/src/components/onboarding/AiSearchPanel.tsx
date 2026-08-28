"use client";

import { Search, Loader2 } from "lucide-react";

/**
 * The violet "Describe what you need support with" panel from the M3 Figma:
 * heading + pill search field + "Ask AI & Search" button + a filter row.
 * `filters` and `trailing` are free slots so both the mock Help-Hub branch and
 * the real-backend branch can pass their own controls.
 */
export function AiSearchPanel({
  query,
  onQueryChange,
  onSearch,
  loading = false,
  placeholder = "e.g. How do I assign a RAG to a new employee?",
  filters,
  trailing,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
  placeholder?: string;
  filters?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-[var(--radius-xl)] bg-brand p-6 text-white">
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Describe what you need support with</h2>
      <p className="mt-1 text-sm text-white/75">The assistant finds the most relevant onboarding videos for you.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-12 flex-1 items-center gap-2.5 rounded-full bg-white px-4">
          <Search size={16} className="shrink-0 text-[var(--text-soft)]" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-strong)] placeholder:text-[#9a93a1] focus:outline-none"
          />
        </div>
        <button
          onClick={onSearch}
          disabled={loading}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-brand transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Ask AI &amp; Search
        </button>
      </div>

      {(filters || trailing) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 [&_select]:h-9 [&_select]:rounded-lg [&_select]:border-0 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_select]:font-medium [&_select]:text-[var(--text-body)] [&_select]:outline-none">
          {filters}
          {trailing}
        </div>
      )}
    </div>
  );
}

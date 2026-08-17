"use client";

import { AlertTriangle } from "lucide-react";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { timeAgo } from "@/lib/format";
import type { AlertRuleChangeLogEntry, AlertSeverity } from "@/lib/types";

/**
 * Client feedback (17/08/2026, gap-analysis §6): shared display pieces for the
 * severity-driven-behaviour / scope-confirmation / change-history model, reused
 * by both the Team Member Profile's Custom Alert Rules card and the RAG's Risk
 * Rules tab so the two don't drift into inconsistent wording. Display/copy only
 * - no real notification or escalation logic runs off these fields.
 */

export const SEVERITY_BEHAVIOUR: Record<AlertSeverity, string> = {
  low: "Logged only - visible in reporting, no notification sent.",
  medium: "Notifies the assigned manager and creates a review item.",
  high: "Notifies and creates an action - stays open until acknowledged.",
  critical: "Immediate escalation to a designated safeguarding lead, with mandatory acknowledgement.",
};

export function SeverityLegend() {
  return (
    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs mb-4">
      {(Object.keys(SEVERITY_BEHAVIOUR) as AlertSeverity[]).map((s) => (
        <div key={s} className="flex items-start gap-2.5 px-3 py-2">
          <Badge tone={severityTone(s)} className="capitalize shrink-0">
            {s}
          </Badge>
          <span className="text-slate-500">{SEVERITY_BEHAVIOUR[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function ChangeLogList({ entries }: { entries?: AlertRuleChangeLogEntry[] }) {
  if (!entries || entries.length === 0) return <p className="text-xs text-slate-400 py-1.5">No history yet.</p>;
  return (
    <div className="space-y-1 text-xs pt-1">
      {entries.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-slate-500">
          <span className="truncate">{e.summary}</span>
          <span className="text-slate-400 shrink-0">
            {e.changedBy} · {timeAgo(e.changedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RuleHistory({ entries }: { entries?: AlertRuleChangeLogEntry[] }) {
  return (
    <details className="mt-1.5">
      <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">History</summary>
      <ChangeLogList entries={entries} />
    </details>
  );
}

export function GlobalScopeConfirmModal({
  open,
  onClose,
  onConfirm,
  affectedLabel,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  affectedLabel: string;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm global alert rule">
      <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 text-amber-700 text-xs p-3 mb-4">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          You&apos;re about to make this rule apply organisation-wide - affecting {affectedLabel}. This is a wider-reaching change than a
          rule scoped to one employee or one RAG, so it needs a second confirmation.
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onConfirm} disabled={busy}>
          Confirm &amp; activate globally
        </Button>
      </div>
    </Modal>
  );
}

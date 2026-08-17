"use client";

import { Check } from "lucide-react";
import type { AlertCase, AlertStage } from "@/lib/types";

/**
 * Client feedback (17/08/2026, gap-analysis §5): the flat "keyword matched"
 * alert model should be shown as its real staged pipeline. Stage is inferred
 * from existing status/message data - display only, no new detection logic.
 */
const STAGES: { key: AlertStage; label: string }[] = [
  { key: "keyword_detected", label: "Keyword detected" },
  { key: "signal_generated", label: "Signal generated" },
  { key: "context_assessment", label: "Context assessment" },
  { key: "alert_level_set", label: "Alert level set" },
  { key: "human_review", label: "Human review" },
  { key: "outcome", label: "Outcome" },
];

export function inferAlertStage(caseItem: AlertCase, hasMessages: boolean): AlertStage {
  if (caseItem.status === "closed") return "outcome";
  if (hasMessages) return "human_review";
  return "alert_level_set";
}

export function AlertStageStepper({ stage }: { stage: AlertStage }) {
  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {STAGES.map((s, i) => {
        const done = i <= currentIndex;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${done ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-400"}`}>
              {done && <Check size={10} />}
              {s.label}
            </div>
            {i < STAGES.length - 1 && <span className={`w-3 h-px ${i < currentIndex ? "bg-brand" : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

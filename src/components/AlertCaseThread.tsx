"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/format";
import { Send, CheckCircle2, KeyRound } from "lucide-react";
import type { AlertCase } from "@/lib/types";

export function AlertCaseThread({ caseItem, canClose, currentUserId }: { caseItem: AlertCase; canClose: boolean; currentUserId: string }) {
  const { users, rags, alertCaseMessages, sendAlertCaseMessage, closeAlertCase } = useApp();
  const [draft, setDraft] = useState("");

  const rag = rags.find((r) => r.id === caseItem.ragId);
  const person = users.find((u) => u.id === caseItem.userId);
  const owner = users.find((u) => u.id === caseItem.ownerId);
  const messages = alertCaseMessages.filter((m) => m.caseId === caseItem.id).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));

  function send() {
    if (!draft.trim()) return;
    sendAlertCaseMessage(caseItem.id, currentUserId, draft.trim());
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <Badge tone="red">
          <KeyRound size={11} /> &ldquo;{caseItem.keyword}&rdquo;
        </Badge>
        <span className="text-sm text-slate-700">
          {person?.name ?? "Unknown"} <span className="text-slate-400">in</span> {rag?.name ?? "a RAG"}
        </span>
        <Badge tone={caseItem.status === "open" ? "amber" : "green"} className="ml-auto">
          {caseItem.status === "open" ? "Open" : "Closed"}
        </Badge>
      </div>

      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {messages.map((m) => {
          const sender = users.find((u) => u.id === m.senderId);
          return (
            <div key={m.id} className="flex items-start gap-2.5">
              <Avatar name={sender?.name ?? "?"} color={sender?.avatarColor ?? "#94a3b8"} size={26} />
              <div className="min-w-0">
                <p className="text-xs">
                  <span className="font-medium text-slate-800">{sender?.name ?? "Unknown"}</span>{" "}
                  <span className="text-slate-400">{timeAgo(m.sentAt)}</span>
                </p>
                <p className="text-sm text-slate-700 mt-0.5">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {caseItem.status === "open" ? (
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply on this alert..." className="text-sm" />
          <Button onClick={send}>
            <Send size={14} />
          </Button>
          {canClose && (
            <Button variant="outline" onClick={() => closeAlertCase(caseItem.id, currentUserId)}>
              <CheckCircle2 size={14} /> Close
            </Button>
          )}
        </div>
      ) : (
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
          Closed by {owner?.name ?? "manager"}
          {caseItem.closedAt ? ` · ${timeAgo(caseItem.closedAt)}` : ""}
        </div>
      )}
    </div>
  );
}

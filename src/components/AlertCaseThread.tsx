"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/format";
import { Send, CheckCircle2, KeyRound, UserPlus, ListChecks, Plus, FileSearch, LifeBuoy } from "lucide-react";
import type { AlertCase } from "@/lib/types";

export function AlertCaseThread({ caseItem, canClose, currentUserId }: { caseItem: AlertCase; canClose: boolean; currentUserId: string }) {
  const {
    users,
    rags,
    alertCaseMessages,
    alertTasks,
    sendAlertCaseMessage,
    closeAlertCase,
    addAlertParticipant,
    addAlertTask,
    toggleAlertTask,
    convertAlertToIncident,
    askInternalToJoin,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskText, setTaskText] = useState("");
  const [converted, setConverted] = useState(false);
  const [askedInternal, setAskedInternal] = useState(false);

  const rag = rags.find((r) => r.id === caseItem.ragId);
  const person = users.find((u) => u.id === caseItem.userId);
  const owner = users.find((u) => u.id === caseItem.ownerId);
  const messages = alertCaseMessages.filter((m) => m.caseId === caseItem.id).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));
  const tasks = alertTasks.filter((t) => t.caseId === caseItem.id);

  const coreIds = new Set([caseItem.userId, caseItem.ownerId, ...caseItem.participantIds]);
  const participants = [...coreIds].map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  const addableUsers = users.filter((u) => u.orgId === caseItem.orgId && !coreIds.has(u.id));

  function send() {
    if (!draft.trim()) return;
    sendAlertCaseMessage(caseItem.id, currentUserId, draft.trim());
    setDraft("");
  }

  function submitParticipant() {
    if (!newParticipantId) return;
    addAlertParticipant(caseItem.id, newParticipantId);
    setNewParticipantId("");
    setAddingParticipant(false);
  }

  function submitTask() {
    if (!taskAssigneeId || !taskText.trim()) return;
    addAlertTask(caseItem.id, taskAssigneeId, taskText.trim());
    setTaskAssigneeId("");
    setTaskText("");
    setAddingTask(false);
  }

  function handleConvert() {
    convertAlertToIncident(caseItem.id, currentUserId);
    setConverted(true);
  }

  function handleAskInternal() {
    askInternalToJoin(caseItem.id);
    setAskedInternal(true);
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <Badge tone="red">
          <KeyRound size={11} /> &ldquo;{caseItem.keyword}&rdquo;
        </Badge>
        <Badge tone={severityTone(caseItem.severity)}>{caseItem.severity}</Badge>
        <span className="text-sm text-slate-700">
          {person?.name ?? "Unknown"} <span className="text-slate-400">in</span> {rag?.name || "General"}
        </span>
        <Badge tone={caseItem.status === "open" ? "amber" : "green"} className="ml-auto">
          {caseItem.status === "open" ? "Open" : "Closed"}
        </Badge>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <div className="flex -space-x-2">
          {participants.map((p) => (
            <div key={p.id} title={p.name} className="ring-2 ring-white rounded-full">
              <Avatar name={p.name} color={p.avatarColor} size={24} />
            </div>
          ))}
        </div>
        {caseItem.status === "open" && canClose && (
          <>
            {addingParticipant ? (
              <div className="flex items-center gap-1.5">
                <Select value={newParticipantId} onChange={(e) => setNewParticipantId(e.target.value)} className="!w-auto text-xs py-1">
                  <option value="">Add someone...</option>
                  {addableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" onClick={submitParticipant} disabled={!newParticipantId}>
                  Add
                </Button>
              </div>
            ) : (
              <button onClick={() => setAddingParticipant(true)} className="text-xs text-slate-400 hover:text-brand flex items-center gap-1">
                <UserPlus size={12} /> Add person
              </button>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {caseItem.status === "open" && !askedInternal && !caseItem.participantIds.includes("u-safeiq-internal") && (
            <button onClick={handleAskInternal} className="text-xs text-slate-400 hover:text-brand flex items-center gap-1">
              <LifeBuoy size={12} /> Ask internal to join
            </button>
          )}
          {caseItem.status === "open" && canClose && !caseItem.incidentId && !converted && (
            <button onClick={handleConvert} className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1">
              <FileSearch size={12} /> Turn into incident
            </button>
          )}
          {(caseItem.incidentId || converted) && <Badge tone="red">Incident opened</Badge>}
        </div>
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

      {(tasks.length > 0 || (canClose && caseItem.status === "open")) && (
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-2">
            <ListChecks size={12} /> Actions
          </p>
          <div className="space-y-1.5 mb-2">
            {tasks.map((t) => {
              const assignee = users.find((u) => u.id === t.assigneeId);
              return (
                <label key={t.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={t.done} onChange={() => toggleAlertTask(t.id)} className="rounded" />
                  <span className={t.done ? "text-slate-400 line-through" : "text-slate-700"}>{t.text}</span>
                  <span className="text-slate-400">- {assignee?.name ?? "Unknown"}</span>
                </label>
              );
            })}
          </div>
          {canClose && caseItem.status === "open" && (
            <>
              {addingTask ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)} className="!w-auto text-xs py-1">
                    <option value="">Assign to...</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="What needs doing?" className="!w-auto flex-1 text-xs py-1" />
                  <Button size="sm" onClick={submitTask} disabled={!taskAssigneeId || !taskText.trim()}>
                    Add
                  </Button>
                </div>
              ) : (
                <button onClick={() => setAddingTask(true)} className="text-xs text-slate-400 hover:text-brand flex items-center gap-1">
                  <Plus size={12} /> Add action
                </button>
              )}
            </>
          )}
        </div>
      )}

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

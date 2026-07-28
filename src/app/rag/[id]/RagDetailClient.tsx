"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ArrowLeft, UploadCloud, FileText, ChevronDown, Sparkles, BellRing, Plus, Key } from "lucide-react";

export function RagDetailClient({ ragId }: { ragId: string }) {
  const {
    rags,
    users,
    ragAssignments,
    ragQuestions,
    addDocumentToRag,
    toggleAlertCategory,
    addAlertCategory,
    answerQuestion,
    assignRagToUser,
    currentUser,
  } = useApp();

  const rag = rags.find((r) => r.id === ragId);
  const [tab, setTab] = useState("content");
  const [dragOver, setDragOver] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [justAssigned, setJustAssigned] = useState<{ userId: string; code: string } | null>(null);
  const [qSubTab, setQSubTab] = useState<"pending" | "answered">("pending");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryEmail, setNewCategoryEmail] = useState("morgan.ellis@brightcare.co.uk");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignments = useMemo(() => (rag ? ragAssignments.filter((a) => a.ragId === rag.id) : []), [ragAssignments, rag]);
  const questions = useMemo(() => (rag ? ragQuestions.filter((q) => q.ragId === rag.id) : []), [ragQuestions, rag]);
  const employees = users.filter((u) => u.role === "employee");
  const availableEmployees = employees.filter((u) => !assignments.some((a) => a.userId === u.id));

  if (!rag) return notFound();

  function ingestFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => {
      addDocumentToRag(rag!.id, {
        name: f.name,
        sizeKb: Math.max(4, Math.round(f.size / 1024)),
        addedBy: currentUser?.name ?? "Organisation",
        addedAt: new Date().toISOString(),
        note: "Initial upload",
      });
    });
  }

  function assign() {
    if (!assignUserId) return;
    const code = assignRagToUser(rag!.id, assignUserId);
    setJustAssigned({ userId: assignUserId, code });
    setAssignUserId("");
  }

  function submitReply(questionId: string) {
    if (!replyText.trim()) return;
    answerQuestion(questionId, replyText.trim());
    setReplyFor(null);
    setReplyText("");
  }

  function submitCategory() {
    if (!newCategory.trim()) return;
    addAlertCategory(rag!.id, newCategory.trim(), [newCategoryEmail]);
    setNewCategory("");
  }

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  const pendingQs = questions.filter((q) => q.status !== "answered").sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));
  const answeredQs = questions.filter((q) => q.status === "answered").sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));

  return (
    <AppShell title={rag.name} subtitle={`Access password: ${"•".repeat(rag.accessPassword.length)}`}>
      <Link href="/rag" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to RAG systems
      </Link>

      <Card>
        <Tabs
          tabs={[
            { key: "content", label: "Content", count: rag.documents.length },
            { key: "users", label: "Assigned users", count: assignments.length },
            { key: "questions", label: "Questions", count: questions.length },
            { key: "alerts", label: "Alert categories", count: rag.alertCategories.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "content" && (
          <CardBody>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                ingestFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                dragOver ? "border-brand bg-indigo-50/40" : "border-slate-300 hover:border-brand hover:bg-indigo-50/20"
              }`}
            >
              <UploadCloud size={26} className="text-brand" />
              <p className="text-sm font-medium text-slate-700">Drop files here, or click to browse</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles size={12} /> AI automatically organises content into this RAG
              </p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => ingestFiles(e.target.files)} />
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {rag.documents.map((doc) => (
                <div key={doc.id}>
                  <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} className="w-full flex items-center gap-3 py-3.5 text-left hover:bg-slate-50 rounded-lg px-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                      <p className="text-xs text-slate-400">
                        {doc.sizeKb} KB · added by {doc.addedBy} · {timeAgo(doc.addedAt)}
                      </p>
                    </div>
                    <Badge tone="slate">v{doc.versions.length}</Badge>
                    <ChevronDown size={15} className={`text-slate-300 transition-transform ${expandedDoc === doc.id ? "rotate-180" : ""}`} />
                  </button>
                  {expandedDoc === doc.id && (
                    <div className="pl-12 pb-3 space-y-1.5">
                      {[...doc.versions].reverse().map((v) => (
                        <div key={v.version} className="text-xs text-slate-500 flex items-center gap-2">
                          <Badge tone="indigo">v{v.version}</Badge>
                          {v.note} · {v.uploadedBy} · {formatDateTime(v.uploadedAt)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {rag.documents.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No content added to this RAG yet.</p>}
            </div>
          </CardBody>
        )}

        {tab === "users" && (
          <CardBody>
            {availableEmployees.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="max-w-xs">
                  <option value="">Assign someone to this RAG...</option>
                  {availableEmployees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Button onClick={assign} disabled={!assignUserId}>
                  <Plus size={14} /> Assign
                </Button>
              </div>
            )}
            {justAssigned && (
              <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs px-3 py-2.5 flex items-center gap-1.5">
                <Key size={13} /> {userName(justAssigned.userId)}&apos;s access code: <span className="font-mono font-semibold">{justAssigned.code}</span>
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {assignments.map((a) => {
                const activity = ragQuestions.filter((q) => q.ragId === rag.id && q.userId === a.userId);
                const expanded = expandedUser === a.userId;
                return (
                  <div key={a.userId}>
                    <button onClick={() => setExpandedUser(expanded ? null : a.userId)} className="w-full flex items-center gap-3 py-3.5 hover:bg-slate-50 rounded-lg px-2 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{userName(a.userId)}</p>
                        <p className="text-xs text-slate-400 font-mono">{a.accessCode}</p>
                      </div>
                      <Badge tone="slate">{activity.length} questions</Badge>
                      <ChevronDown size={15} className={`text-slate-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && (
                      <div className="pl-4 pb-3 space-y-2">
                        {activity.map((q) => (
                          <div key={q.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-slate-700">{q.text}</p>
                              <Badge tone={q.status === "answered" ? "green" : "amber"}>{q.status}</Badge>
                            </div>
                            <p className="text-slate-400 mt-1">{formatDateTime(q.askedAt)}</p>
                          </div>
                        ))}
                        {activity.length === 0 && <p className="text-xs text-slate-400 py-2">No activity yet.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {assignments.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No one is assigned to this RAG yet.</p>}
            </div>
          </CardBody>
        )}

        {tab === "questions" && (
          <CardBody>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setQSubTab("pending")}
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${qSubTab === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
              >
                Pending ({pendingQs.length})
              </button>
              <button
                onClick={() => setQSubTab("answered")}
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${qSubTab === "answered" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                Answered ({answeredQs.length})
              </button>
            </div>
            <div className="space-y-3">
              {(qSubTab === "pending" ? pendingQs : answeredQs).map((q) => (
                <div key={q.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-800">{q.text}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {userName(q.userId)} · {timeAgo(q.askedAt)}
                      </p>
                    </div>
                    <Badge tone={q.status === "answered" ? "green" : q.status === "escalated" ? "red" : "amber"}>{q.status}</Badge>
                  </div>
                  {q.answer && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">{q.answer}</p>}
                  {q.status !== "answered" && (
                    <div className="mt-2">
                      {replyFor === q.id ? (
                        <div className="space-y-2">
                          <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => submitReply(q.id)}>
                              Send answer
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReplyFor(q.id)}>
                          Answer now
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {(qSubTab === "pending" ? pendingQs : answeredQs).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nothing here yet.</p>
              )}
            </div>
          </CardBody>
        )}

        {tab === "alerts" && (
          <CardBody>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
              <BellRing size={13} /> Choose which question categories should notify your organisation immediately.
            </p>
            <div className="space-y-2 mb-5">
              {rag.alertCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm text-slate-800">{c.label}</p>
                    {c.notifyEmails.length > 0 && <p className="text-[11px] text-slate-400">Notifies {c.notifyEmails.join(", ")}</p>}
                  </div>
                  <button
                    onClick={() => toggleAlertCategory(rag.id, c.id)}
                    className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${c.enabled ? "bg-brand" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${c.enabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New alert category..." className="flex-1" />
              <Input value={newCategoryEmail} onChange={(e) => setNewCategoryEmail(e.target.value)} placeholder="Notify email" className="sm:w-56" />
              <Button onClick={submitCategory}>
                <Plus size={14} /> Add
              </Button>
            </div>
          </CardBody>
        )}
      </Card>
    </AppShell>
  );
}

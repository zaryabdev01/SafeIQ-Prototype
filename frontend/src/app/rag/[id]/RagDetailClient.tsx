"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Label } from "@/components/ui/Field";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { INTERNAL_ORG_ID } from "@/lib/mockData";
import { formatDateTime, timeAgo } from "@/lib/format";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { GlobalScopeConfirmModal, RuleHistory, SeverityLegend } from "@/components/AlertRuleGovernance";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  ChevronDown,
  Sparkles,
  BellRing,
  Plus,
  Key,
  Search,
  ShieldAlert,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  FlaskConical,
  ThumbsUp,
  ThumbsDown,
  Copy as CopyIcon,
  FileWarning,
  Building2,
  Globe2,
  Users,
  ListChecks,
  History as HistoryIcon,
  ChevronRight,
  BookOpen,
  MessageSquare as MessageSquareIcon,
} from "lucide-react";
import type { AccessLevel, AlertSeverity, ApprovalStatus, ContentType, KeywordScope, RagDocument, TeamRole, TestConfidence, TestFeedback } from "@/lib/types";

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

const CONTENT_TYPES: ContentType[] = ["Policy", "Procedure", "Guidance", "Template", "Regulation", "FAQ", "Website", "Other"];
const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  archived: "Archived",
};
const APPROVAL_TONE: Record<ApprovalStatus, "slate" | "amber" | "green"> = {
  draft: "slate",
  awaiting_approval: "amber",
  approved: "green",
  archived: "slate",
};
const CONFIDENCE_TONE: Record<TestConfidence, "green" | "amber" | "red"> = { high: "green", medium: "amber", low: "red" };
const FEEDBACK_LABEL: Record<TestFeedback, string> = {
  correct: "Correct answer",
  needs_improvement: "Needs improvement",
  wrong_source: "Wrong source used",
  missing_information: "Missing information",
};

export function RagDetailClient({ ragId }: { ragId: string }) {
  const {
    currentUser,
    rags,
    users,
    organisations,
    ragAssignments,
    ragQuestions,
    alertCases,
    ragTestResults,
    actions: allActions,
    addDocumentToRag,
    updateRagDocumentMetadata,
    toggleAlertKeyword,
    addAlertKeyword,
    removeAlertKeyword,
    setRagEscalationNote,
    answerQuestion,
    assignRagToUser,
    assignRagToOrg,
    publishRag,
    addRagTestResult,
    setTestFeedback,
  } = useApp();

  const rag = rags.find((r) => r.id === ragId);
  const [tab, setTab] = useState("overview");

  // Knowledge tab state
  const [uploadType, setUploadType] = useState<ContentType>("Policy");
  const [dragOver, setDragOver] = useState(false);
  const [reviewDocId, setReviewDocId] = useState<string | null>(null);
  const [libTypeFilter, setLibTypeFilter] = useState("");
  const [libStatusFilter, setLibStatusFilter] = useState("");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // People & access tab state
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [justAssigned, setJustAssigned] = useState<{ userId: string; code: string } | null>(null);
  const [shareOrgId, setShareOrgId] = useState("");
  const [crossOrgUserId, setCrossOrgUserId] = useState("");

  // Risk rules tab state
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordSeverity, setKeywordSeverity] = useState<AlertSeverity>("medium");
  const [keywordScope, setKeywordScope] = useState<KeywordScope>("rag");
  const [confirmingGlobalKeyword, setConfirmingGlobalKeyword] = useState(false);
  const [escalationDraft, setEscalationDraft] = useState(rag?.escalationNote ?? "");
  const [escalationSaved, setEscalationSaved] = useState(false);

  // Communications tab state
  const [qSubTab, setQSubTab] = useState<"pending" | "answered">("pending");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyAddToKnowledge, setReplyAddToKnowledge] = useState(false);
  const [qSearch, setQSearch] = useState("");
  const [qMemberFilter, setQMemberFilter] = useState("");
  const [qDateFilter, setQDateFilter] = useState("");
  const [qRiskFilter, setQRiskFilter] = useState("");

  // Test tab state
  const [testQuestion, setTestQuestion] = useState("");
  const [testing, setTesting] = useState(false);

  const assignments = useMemo(() => (rag ? ragAssignments.filter((a) => a.ragId === rag.id) : []), [ragAssignments, rag]);
  const questions = useMemo(() => (rag ? ragQuestions.filter((q) => q.ragId === rag.id) : []), [ragQuestions, rag]);
  const ragCases = useMemo(
    () => (rag ? alertCases.filter((c) => c.ragId === rag.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : []),
    [alertCases, rag]
  );
  const testResults = useMemo(
    () => (rag ? ragTestResults.filter((t) => t.ragId === rag.id).sort((a, b) => (a.testedAt < b.testedAt ? 1 : -1)) : []),
    [ragTestResults, rag]
  );
  const ragActions = useMemo(() => (rag ? allActions.filter((a) => a.ragId === rag.id) : []), [allActions, rag]);
  const isInternalRag = rag?.orgId === INTERNAL_ORG_ID;
  const employees = users.filter((u) => u.role === "employee" && u.orgId === rag?.orgId);
  const availableEmployees = employees.filter((u) => !assignments.some((a) => a.userId === u.id));
  const eligibleOwners = users.filter((u) => u.role === "employee" && u.orgId === rag?.orgId && u.teamRole && u.teamRole !== "employee");
  const crossOrgEmployees = users.filter((u) => u.role === "employee" && !assignments.some((a) => a.userId === u.id));
  const shareableOrgs = organisations.filter((o) => !rag?.sharedWithOrgIds?.includes(o.id));

  if (!rag) return notFound();

  const hasKnowledge = rag.documents.length > 0;
  const hasAccess = assignments.length > 0;
  const hasRisk = rag.alertKeywords.length > 0 || !!rag.escalationNote;
  const hasTest = testResults.length > 0;
  const steps = [true, hasKnowledge, hasAccess, hasRisk, hasTest];
  const progressPct = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  function ingestFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => {
      const possibleDuplicate = rag!.documents.some((d) => d.name.toLowerCase() === f.name.toLowerCase());
      addDocumentToRag(rag!.id, {
        name: f.name,
        sizeKb: Math.max(4, Math.round(f.size / 1024)),
        addedBy: currentUser?.name ?? "Organisation",
        addedAt: new Date().toISOString(),
        note: "Initial upload",
        contentType: uploadType,
        aiSuggestion: { contentType: uploadType, keywords: f.name.replace(/\.[a-z0-9]+$/i, "").split(/[\s_-]+/).filter(Boolean).slice(0, 4), possibleDuplicate },
      });
    });
  }

  function assign() {
    if (!assignUserId || !assignOwnerId) return;
    const code = assignRagToUser(rag!.id, assignUserId, assignOwnerId);
    setJustAssigned({ userId: assignUserId, code });
    setAssignUserId("");
    setAssignOwnerId("");
  }

  function shareWithOrg() {
    if (!shareOrgId) return;
    assignRagToOrg(rag!.id, shareOrgId);
    setShareOrgId("");
  }

  function assignCrossOrg() {
    if (!crossOrgUserId) return;
    const code = assignRagToUser(rag!.id, crossOrgUserId, "u-safeiq-internal");
    setJustAssigned({ userId: crossOrgUserId, code });
    setCrossOrgUserId("");
  }

  function submitReply(questionId: string) {
    if (!replyText.trim()) return;
    const question = questions.find((q) => q.id === questionId);
    answerQuestion(questionId, replyText.trim());
    if (replyAddToKnowledge && question) {
      // Lands in the same "content requiring review" queue as any other upload -
      // an answer doesn't join the knowledge base until someone confirms its metadata.
      addDocumentToRag(rag!.id, {
        name: question.text.slice(0, 60),
        sizeKb: 4,
        addedBy: currentUser?.name ?? "Organisation",
        addedAt: new Date().toISOString(),
        note: `Answer: ${replyText.trim()}`,
        contentType: "FAQ",
      });
    }
    setReplyFor(null);
    setReplyText("");
    setReplyAddToKnowledge(false);
  }

  function submitKeyword() {
    if (!newKeyword.trim()) return;
    if (keywordScope === "global") {
      setConfirmingGlobalKeyword(true);
      return;
    }
    createKeyword();
  }

  function createKeyword() {
    addAlertKeyword(rag!.id, newKeyword.trim(), keywordSeverity, keywordScope);
    setNewKeyword("");
    setConfirmingGlobalKeyword(false);
  }

  function saveEscalationNote() {
    setRagEscalationNote(rag!.id, escalationDraft.trim());
    setEscalationSaved(true);
    window.setTimeout(() => setEscalationSaved(false), 1600);
  }

  function runTest() {
    if (!testQuestion.trim()) return;
    setTesting(true);
    window.setTimeout(() => {
      addRagTestResult(rag!.id, testQuestion.trim());
      setTestQuestion("");
      setTesting(false);
    }, 500);
  }

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  function docName(docId: string) {
    return rag!.documents.find((d) => d.id === docId)?.name ?? "Unknown document";
  }

  const reviewQueue = rag.documents.filter((d) => d.approvalStatus === "draft");
  const libraryDocs = rag.documents.filter((d) => {
    if (libTypeFilter && d.contentType !== libTypeFilter) return false;
    if (libStatusFilter && d.approvalStatus !== libStatusFilter) return false;
    return true;
  });
  const reviewingDoc = rag.documents.find((d) => d.id === reviewDocId) ?? null;

  function riskForQuestion(questionId: string) {
    return ragCases.find((c) => c.questionId === questionId)?.severity;
  }

  const filteredQuestions = questions.filter((q) => {
    if (qSearch.trim() && !q.text.toLowerCase().includes(qSearch.trim().toLowerCase())) return false;
    if (qMemberFilter && q.userId !== qMemberFilter) return false;
    if (qDateFilter && !q.askedAt.startsWith(qDateFilter)) return false;
    if (qRiskFilter && riskForQuestion(q.id) !== qRiskFilter) return false;
    return true;
  });
  const pendingQs = filteredQuestions.filter((q) => q.status !== "answered").sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));
  const answeredQs = filteredQuestions.filter((q) => q.status === "answered").sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));

  const peopleAllocated = assignments.map((a) => {
    const acts = questions.filter((q) => q.userId === a.userId);
    const lastActivity = acts.map((q) => q.askedAt).sort().at(-1);
    return {
      userId: a.userId,
      lastActivity,
      conversations: acts.length,
      alerts: ragCases.filter((c) => c.userId === a.userId).length,
      openActions: ragActions.filter((act) => act.assigneeId === a.userId && act.status !== "completed").length,
    };
  });

  const systemEvents = [
    ...rag.documents.map((d) => ({ id: `doc-${d.id}`, text: `${d.addedBy} added "${d.name}" to Knowledge`, at: d.addedAt })),
    ...rag.alertKeywords.map((k) => ({ id: `kw-${k.id}`, text: `${k.createdBy ?? "Someone"} added risk rule "${k.keyword}"`, at: k.createdAt ?? rag.createdAt })),
    ...assignments.map((a) => ({ id: `assign-${a.userId}`, text: `${userName(a.userId)} was given access to this RAG`, at: a.assignedAt })),
    { id: "created", text: `${userName(rag.createdBy)} created this RAG`, at: rag.createdAt },
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  return (
    <AppShell title={rag.name} subtitle={`${rag.category} · Access password: ${"•".repeat(rag.accessPassword.length)}`}>
      <Link href="/rag" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to RAG systems
      </Link>

      <Card>
        <Tabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "communications", label: "Communications", count: questions.length },
            { key: "people", label: "People & access", count: assignments.length },
            { key: "knowledge", label: "Knowledge", count: rag.documents.length },
            { key: "risk", label: "Risk rules", count: rag.alertKeywords.length },
            { key: "settings", label: "Settings & testing", count: testResults.length },
            { key: "activity", label: "Activity" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "overview" && rag.status === "draft" && (
          <CardBody className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="indigo">{rag.category}</Badge>
                <Badge tone="amber">Draft · {progressPct}% complete</Badge>
              </div>
              <Button size="sm" onClick={() => publishRag(rag.id)} disabled={!hasKnowledge}>
                <Check size={13} /> Publish
              </Button>
            </div>

            <div>
              <Label>Description</Label>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3.5 py-2.5">{rag.description || "No description added yet."}</p>
            </div>

            <div>
              <Label>Setup progress</Label>
              <div className="space-y-2">
                {[
                  { label: "RAG details", done: true },
                  { label: "Add knowledge", done: hasKnowledge },
                  { label: "Set permissions", done: hasAccess },
                  { label: "Configure escalation", done: hasRisk },
                  { label: "Test and publish", done: false }, // this checklist only renders while still in draft
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    {s.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-300" />}
                    <span className={s.done ? "text-slate-700" : "text-slate-400"}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        )}

        {tab === "overview" && rag.status === "published" && (
          <CardBody className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone="indigo">{rag.category}</Badge>
              <Badge tone="green">
                <CheckCircle2 size={12} /> Live for your team
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Allocated employees", value: assignments.length, icon: Users, tab: "people" },
                { label: "Conversations", value: questions.length, icon: MessageSquareIcon, tab: "communications" },
                { label: "Pending questions", value: questions.filter((q) => q.status !== "answered").length, icon: BellRing, tab: "communications" },
                { label: "Alerts", value: ragCases.length, icon: ShieldAlert, tab: "communications" },
                { label: "Open actions", value: ragActions.filter((a) => a.status !== "completed").length, icon: ListChecks, tab: "communications" },
              ].map((s) => (
                <button key={s.label} onClick={() => setTab(s.tab)} className="rounded-lg border border-slate-200 px-3 py-3 text-left hover:border-brand transition-colors">
                  <s.icon size={15} className="text-slate-400 mb-1.5" />
                  <p className="text-lg font-semibold text-slate-900 leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </button>
              ))}
            </div>

            <div>
              <Label>People allocated to this RAG</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Last activity</th>
                      <th className="py-2 pr-3 font-medium">Conversations</th>
                      <th className="py-2 pr-3 font-medium">Alerts</th>
                      <th className="py-2 pr-3 font-medium">Open actions</th>
                      <th className="py-2 pr-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {peopleAllocated.map((p) => (
                      <tr key={p.userId}>
                        <td className="py-2.5 pr-3 text-slate-800">{userName(p.userId)}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{p.lastActivity ? timeAgo(p.lastActivity) : "No activity yet"}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{p.conversations}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{p.alerts}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{p.openActions}</td>
                        <td className="py-2.5 pr-3">
                          <Link href={`/team/${p.userId}`} className="text-brand text-xs font-medium hover:underline flex items-center gap-0.5">
                            View profile <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {peopleAllocated.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No one is assigned to this RAG yet.</p>}
              </div>
            </div>
          </CardBody>
        )}

        {tab === "knowledge" && (
          <CardBody>
            <p className="text-sm font-medium text-slate-700 mb-2">What would you like to add?</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setUploadType(t)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    uploadType === t ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:border-brand"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

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
              <p className="text-xs text-slate-400 flex items-center gap-1 text-center">
                <Sparkles size={12} /> AI will extract and suggest categories - you review everything before it becomes available.
              </p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => ingestFiles(e.target.files)} />
            </div>

            {reviewQueue.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <FileWarning size={14} className="text-amber-600" />
                  <p className="text-sm font-medium text-slate-800">Content requiring review</p>
                  <Badge tone="amber">{reviewQueue.length}</Badge>
                </div>
                <div className="space-y-2">
                  {reviewQueue.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                        <p className="text-xs text-slate-500">
                          Suggested type: {d.aiSuggestion?.contentType ?? d.contentType} · Applies to: {d.appliesTo} · Owner: {d.owner}
                          {d.aiSuggestion?.possibleDuplicate && <span className="text-red-600"> · Possible duplicate</span>}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setReviewDocId(d.id)}>
                        Review and complete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-slate-800">Content library</p>
                <div className="flex gap-2">
                  <Select value={libTypeFilter} onChange={(e) => setLibTypeFilter(e.target.value)} className="!w-auto text-xs py-1.5">
                    <option value="">All types</option>
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Select value={libStatusFilter} onChange={(e) => setLibStatusFilter(e.target.value)} className="!w-auto text-xs py-1.5">
                    <option value="">All statuses</option>
                    {(Object.keys(APPROVAL_LABEL) as ApprovalStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {APPROVAL_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-3 font-medium">Content</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Applies to</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Review date</th>
                      <th className="py-2 pr-3 font-medium">Access</th>
                      <th className="py-2 pr-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {libraryDocs.map((d) => (
                      <Fragment key={d.id}>
                        <tr>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="text-slate-800 truncate max-w-[220px]">{d.name}</span>
                              <Badge tone="slate">v{d.versions.length}</Badge>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500">{d.contentType}</td>
                          <td className="py-2.5 pr-3 text-slate-500">{d.appliesTo}</td>
                          <td className="py-2.5 pr-3">
                            <Badge tone={APPROVAL_TONE[d.approvalStatus]}>{APPROVAL_LABEL[d.approvalStatus]}</Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500">
                            {d.reviewDate && new Date(d.reviewDate) < new Date() ? (
                              <span className="text-red-600 font-medium">{d.reviewDate}</span>
                            ) : (
                              d.reviewDate ?? "-"
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500 capitalize">{d.accessLevel}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <button onClick={() => setReviewDocId(d.id)} className="text-brand text-xs font-medium hover:underline mr-2">
                              View
                            </button>
                            <button
                              onClick={() => setHistoryDocId(historyDocId === d.id ? null : d.id)}
                              className="text-slate-400 text-xs font-medium hover:text-slate-600"
                            >
                              History
                            </button>
                          </td>
                        </tr>
                        {historyDocId === d.id && (
                          <tr key={`${d.id}-history`}>
                            <td colSpan={7} className="pb-3">
                              <div className="rounded-lg bg-slate-50 px-3.5 py-2.5 space-y-1">
                                {[...d.versions].reverse().map((v) => (
                                  <div key={v.version} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                    <span>
                                      v{v.version} · {v.note}
                                    </span>
                                    <span className="text-slate-400 shrink-0">
                                      {v.uploadedBy} · {timeAgo(v.uploadedAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {libraryDocs.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No content added to this RAG yet.</p>}
              </div>
            </div>
          </CardBody>
        )}

        {tab === "people" && (
          <CardBody>
            {isInternalRag && (
              <div className="mb-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5 mb-2">
                    <Building2 size={14} /> Share with an organisation
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Select value={shareOrgId} onChange={(e) => setShareOrgId(e.target.value)} className="max-w-xs">
                      <option value="">Choose an organisation...</option>
                      {shareableOrgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" onClick={shareWithOrg} disabled={!shareOrgId}>
                      <Plus size={14} /> Share
                    </Button>
                  </div>
                  {!!rag.sharedWithOrgIds?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {rag.sharedWithOrgIds.map((id) => (
                        <Badge key={id} tone="indigo">
                          {organisations.find((o) => o.id === id)?.name ?? id}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5 mb-2">
                    <Globe2 size={14} /> Assign to an individual, in any organisation
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={crossOrgUserId} onChange={(e) => setCrossOrgUserId(e.target.value)} className="max-w-xs">
                      <option value="">Choose a person...</option>
                      {crossOrgEmployees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({organisations.find((o) => o.id === u.orgId)?.name ?? u.orgId})
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" onClick={assignCrossOrg} disabled={!crossOrgUserId}>
                      <Plus size={14} /> Assign
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {!isInternalRag && availableEmployees.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="max-w-xs">
                  <option value="">Assign someone to this RAG...</option>
                  {availableEmployees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Select value={assignOwnerId} onChange={(e) => setAssignOwnerId(e.target.value)} className="max-w-xs">
                  <option value="">Who recovers their alerts?</option>
                  {eligibleOwners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({TEAM_ROLE_LABEL[o.teamRole ?? "employee"]})
                    </option>
                  ))}
                </Select>
                <Button onClick={assign} disabled={!assignUserId || !assignOwnerId}>
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
                const owner = users.find((u) => u.id === a.alertOwnerId);
                return (
                  <div key={a.userId}>
                    <button onClick={() => setExpandedUser(expanded ? null : a.userId)} className="w-full flex items-center gap-3 py-3.5 hover:bg-slate-50 rounded-lg px-2 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{userName(a.userId)}</p>
                        <p className="text-xs text-slate-400 font-mono">{a.accessCode}</p>
                        {owner && <p className="text-[11px] text-slate-400">Alerts go to {owner.name}</p>}
                      </div>
                      <Badge tone="slate">{activity.length} in audit</Badge>
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

        {tab === "risk" && (
          <CardBody>
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <BellRing size={13} /> Any question containing one of these words turns into an alert for the assigned person&apos;s
              alert owner to review.
            </p>
            <details className="mb-4">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">What does each severity do?</summary>
              <div className="pt-2">
                <SeverityLegend />
              </div>
            </details>
            <div className="space-y-2 mb-5">
              {rag.alertKeywords.map((k) => (
                <div key={k.id} className="rounded-lg border border-slate-200 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-800 font-mono">{k.keyword}</span>
                    <div className="flex items-center gap-2">
                      {k.scope && <Badge tone={k.scope === "global" ? "indigo" : "slate"}>{k.scope === "global" ? "Global" : "This RAG only"}</Badge>}
                      <Badge tone={severityTone(k.severity ?? "medium")}>{k.severity ?? "medium"}</Badge>
                      <button
                        onClick={() => toggleAlertKeyword(rag.id, k.id)}
                        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${k.enabled ? "bg-brand" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${k.enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => removeAlertKeyword(rag.id, k.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <RuleHistory entries={k.changeLog} />
                </div>
              ))}
              {rag.alertKeywords.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No alert keywords set yet.</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="New keyword, e.g. 'self-harm'" className="flex-1" />
              <Select value={keywordSeverity} onChange={(e) => setKeywordSeverity(e.target.value as AlertSeverity)} className="!w-auto">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
              <Select value={keywordScope} onChange={(e) => setKeywordScope(e.target.value as KeywordScope)} className="!w-auto">
                <option value="rag">This RAG only</option>
                <option value="global">Organisation-wide (global)</option>
              </Select>
              <Button onClick={submitKeyword}>
                <Plus size={14} /> Add
              </Button>
            </div>

            <Label>What should happen when this flags?</Label>
            <Textarea
              value={escalationDraft}
              onChange={(e) => setEscalationDraft(e.target.value)}
              rows={2}
              placeholder="e.g. Notify the on-call manager immediately and log a concern form within 1 hour."
            />
            <Button size="sm" className="mt-2" onClick={saveEscalationNote}>
              {escalationSaved ? (
                <>
                  <Check size={13} /> Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </CardBody>
        )}

        {tab === "settings" && (
          <CardBody>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
              <FlaskConical size={13} /> Ask an example question before publishing, to see exactly what this RAG would say.
            </p>
            <div className="flex gap-2 mb-5">
              <Input
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runTest()}
                placeholder="e.g. What should a member of staff do if a child is reported missing?"
                className="flex-1"
              />
              <Button onClick={runTest} disabled={testing || !testQuestion.trim()}>
                {testing ? "Testing..." : "Run test"}
              </Button>
            </div>

            <div className="space-y-4">
              {testResults.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-800 mb-2">{t.question}</p>
                  {t.answer ? (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 mb-2">{t.answer}</p>
                  ) : (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 mb-2">
                      Not enough approved content to answer confidently - this would escalate to your organisation.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <Badge tone={CONFIDENCE_TONE[t.confidence]}>{t.confidence} confidence</Badge>
                    {t.conflictFound && <Badge tone="amber">Conflicting guidance found</Badge>}
                    {t.escalationTriggered && <Badge tone="red">Escalation triggered</Badge>}
                    {t.citedDocumentIds.map((docId) => (
                      <Badge key={docId} tone="slate">
                        <CopyIcon size={10} /> {docName(docId)}
                      </Badge>
                    ))}
                  </div>
                  {t.feedback ? (
                    <Badge tone="indigo">Marked: {FEEDBACK_LABEL[t.feedback]}</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(FEEDBACK_LABEL) as TestFeedback[]).map((f) => (
                        <Button key={f} size="sm" variant="outline" onClick={() => setTestFeedback(t.id, f)}>
                          {f === "correct" ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />} {FEEDBACK_LABEL[f]}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {testResults.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No test questions run yet.</p>}
            </div>
          </CardBody>
        )}

        {tab === "communications" && (
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="Search this RAG's conversations..." className="pl-8" />
              </div>
              <Select value={qMemberFilter} onChange={(e) => setQMemberFilter(e.target.value)} className="sm:w-52">
                <option value="">All team members</option>
                {assignments.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {userName(a.userId)}
                  </option>
                ))}
              </Select>
              <Select value={qRiskFilter} onChange={(e) => setQRiskFilter(e.target.value)} className="sm:w-40">
                <option value="">Any risk level</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
              <Input type="date" value={qDateFilter} onChange={(e) => setQDateFilter(e.target.value)} className="sm:w-44" />
            </div>

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
              {(qSubTab === "pending" ? pendingQs : answeredQs).map((q) => {
                const risk = riskForQuestion(q.id);
                return (
                  <div key={q.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-800">{q.text}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {userName(q.userId)} · {timeAgo(q.askedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {risk && <Badge tone={severityTone(risk)}>{risk} risk</Badge>}
                        <Badge tone={q.status === "answered" ? "green" : q.status === "escalated" ? "red" : "amber"}>{q.status}</Badge>
                      </div>
                    </div>
                    {q.answer && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">{q.answer}</p>}
                    {q.status !== "answered" && (
                      <div className="mt-2">
                        {replyFor === q.id ? (
                          <div className="space-y-2">
                            <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} />
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" checked={replyAddToKnowledge} onChange={(e) => setReplyAddToKnowledge(e.target.checked)} />
                              <BookOpen size={12} /> Also add this answer to the RAG&apos;s knowledge (goes through the usual review queue)
                            </label>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => submitReply(q.id)}>
                                Send answer{replyAddToKnowledge ? " + add to knowledge" : ""}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReplyFor(q.id)}>
                              Answer employee only
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyFor(q.id);
                                setReplyAddToKnowledge(true);
                              }}
                            >
                              <BookOpen size={12} /> Answer + add to knowledge
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(qSubTab === "pending" ? pendingQs : answeredQs).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nothing here yet.</p>
              )}
            </div>

            {ragCases.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Alerts on this RAG
                </p>
                {ragCases.map((c) => (
                  <AlertCaseThread key={c.id} caseItem={c} canClose={true} currentUserId={currentUser?.id ?? "u-admin"} />
                ))}
              </div>
            )}
          </CardBody>
        )}

        {tab === "activity" && (
          <CardBody>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
              <HistoryIcon size={13} /> Administrative and system events for this RAG - people added, documents uploaded, rules changed,
              republish events. Not conversation content - see Communications for that.
            </p>
            <div className="space-y-2">
              {systemEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 text-sm">
                  <HistoryIcon size={13} className="text-slate-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-slate-700">{e.text}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(e.at)}</p>
                  </div>
                </div>
              ))}
              {systemEvents.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>}
            </div>
          </CardBody>
        )}
      </Card>

      <Modal open={!!reviewingDoc} onClose={() => setReviewDocId(null)} title="Review content" widthClass="max-w-lg">
        {reviewingDoc && (
          <DocumentReviewForm
            doc={reviewingDoc}
            onSave={(updates) => {
              updateRagDocumentMetadata(rag.id, reviewingDoc.id, updates);
              setReviewDocId(null);
            }}
          />
        )}
      </Modal>

      <GlobalScopeConfirmModal
        open={confirmingGlobalKeyword}
        onClose={() => setConfirmingGlobalKeyword(false)}
        onConfirm={createKeyword}
        affectedLabel={`every RAG system in this organisation (${rags.filter((r) => r.orgId === rag.orgId).length})`}
      />
    </AppShell>
  );
}

function DocumentReviewForm({
  doc,
  onSave,
}: {
  doc: RagDocument;
  onSave: (updates: Partial<Pick<RagDocument, "name" | "contentType" | "description" | "appliesTo" | "accessLevel" | "effectiveDate" | "reviewDate" | "owner" | "approvalStatus">>) => void;
}) {
  const [contentType, setContentType] = useState<ContentType>(doc.aiSuggestion?.contentType ?? doc.contentType);
  const [description, setDescription] = useState(doc.description);
  const [appliesTo, setAppliesTo] = useState(doc.appliesTo === "Not confirmed" ? "" : doc.appliesTo);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(doc.accessLevel);
  const [effectiveDate, setEffectiveDate] = useState(doc.effectiveDate ?? "");
  const [reviewDate, setReviewDate] = useState(doc.reviewDate ?? "");
  const [owner, setOwner] = useState(doc.owner === "Not confirmed" ? "" : doc.owner);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(doc.approvalStatus === "draft" ? "awaiting_approval" : doc.approvalStatus);

  return (
    <div>
      {doc.aiSuggestion && (
        <div className="flex items-start gap-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs p-3 mb-4">
          <Sparkles size={14} className="shrink-0 mt-0.5" />
          <span>
            AI has suggested the following{doc.aiSuggestion.keywords?.length ? ` (keywords: ${doc.aiSuggestion.keywords.join(", ")})` : ""}. Please review
            and confirm before publishing.
            {doc.aiSuggestion.possibleDuplicate && <strong className="block mt-1">This looks like it may duplicate an existing document.</strong>}
          </span>
        </div>
      )}
      <p className="text-sm font-medium text-slate-800 mb-3">{doc.name}</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label>Content type</Label>
          <Select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Access</Label>
          <Select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}>
            <option value="everyone">Everyone</option>
            <option value="managers">Managers</option>
          </Select>
        </div>
      </div>
      <div className="mb-3">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="mb-3">
        <Label>Which service, team or location does this apply to?</Label>
        <Input value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} placeholder="e.g. All teams, all locations" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label>Effective date</Label>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
        <div>
          <Label>Review date</Label>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Document owner</Label>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name" />
        </div>
        <div>
          <Label>Approval status</Label>
          <Select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}>
            {(Object.keys(APPROVAL_LABEL) as ApprovalStatus[]).map((s) => (
              <option key={s} value={s}>
                {APPROVAL_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button
        className="w-full"
        onClick={() =>
          onSave({
            contentType,
            description,
            appliesTo: appliesTo.trim() || "Not confirmed",
            accessLevel,
            effectiveDate: effectiveDate || undefined,
            reviewDate: reviewDate || undefined,
            owner: owner.trim() || "Not confirmed",
            approvalStatus,
          })
        }
      >
        Save and confirm
      </Button>
    </div>
  );
}

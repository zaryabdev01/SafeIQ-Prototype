"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormRow, Textarea, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { INTERNAL_ORG_ID } from "@/lib/mockData";
import { timeAgo } from "@/lib/format";
import {
  Plus,
  FileText,
  Users,
  HelpCircle,
  Eye,
  EyeOff,
  BrainCircuit,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  Key,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  Globe2,
  Building2,
  BellRing,
  History as HistoryIcon,
  MessageSquare as MessageSquareIcon,
  BookOpen,
} from "lucide-react";
import type { AlertSeverity, ContentType, TeamRole } from "@/lib/types";

const PRESET_CATEGORIES = ["Training", "Policy", "Safeguarding", "Home visits"];
const CONTENT_TYPES: ContentType[] = ["Policy", "Procedure", "Guidance", "Template", "Regulation", "FAQ", "Website", "Other"];
const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

const WIZARD_STEPS = [
  { label: "RAG details" },
  { label: "Knowledge" },
  { label: "People & access" },
  { label: "Alert criteria" },
  { label: "Escalation" },
  { label: "Settings" },
  { label: "Review & create" },
];

export default function RagListPage() {
  const router = useRouter();
  const {
    currentUser,
    rags: allRags,
    users,
    ragAssignments,
    ragQuestions,
    createRag,
    addDocumentToRag,
    assignRagToUser,
    addAlertKeyword,
    removeAlertKeyword,
    setRagEscalationNote,
    updateRagSettings,
    publishRag,
  } = useApp();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [createdRagId, setCreatedRagId] = useState<string | null>(null);

  // Step 0 - RAG details
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"global" | "team">("team");

  // Step 1 - Knowledge
  const [uploadType, setUploadType] = useState<ContentType>("Policy");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 - People & access
  const [assignUserId, setAssignUserId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [justAssigned, setJustAssigned] = useState<{ userId: string; code: string } | null>(null);

  // Step 3 - Alert criteria
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordSeverity, setKeywordSeverity] = useState<AlertSeverity>("medium");

  // Step 4 - Escalation
  const [escalationDraft, setEscalationDraft] = useState("");

  const isInternal = currentUser?.role === "internal";
  const rags = allRags.filter((r) =>
    isInternal ? r.orgId === INTERNAL_ORG_ID : r.orgId === currentUser?.orgId || r.sharedWithOrgIds?.includes(currentUser?.orgId ?? "")
  );

  const effectiveCategory = category === "Other" ? customCategory.trim() : category;
  const createdRag = createdRagId ? allRags.find((r) => r.id === createdRagId) ?? null : null;
  const wizardAssignments = createdRagId ? ragAssignments.filter((a) => a.ragId === createdRagId) : [];
  const availableEmployees = users.filter(
    (u) => u.role === "employee" && u.orgId === currentUser?.orgId && !wizardAssignments.some((a) => a.userId === u.id)
  );
  const eligibleOwners = users.filter((u) => u.role === "employee" && u.orgId === currentUser?.orgId && u.teamRole && u.teamRole !== "employee");

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  function resetWizard() {
    setWizardOpen(false);
    setStep(0);
    setCreatedRagId(null);
    setName("");
    setPassword("");
    setDescription("");
    setCategory(PRESET_CATEGORIES[0]);
    setCustomCategory("");
    setScope("team");
    setUploadType("Policy");
    setAssignUserId("");
    setAssignOwnerId("");
    setJustAssigned(null);
    setNewKeyword("");
    setKeywordSeverity("medium");
    setEscalationDraft("");
  }

  function goNext() {
    if (step === 0) {
      if (!name.trim() || !password.trim() || !effectiveCategory) return;
      const rag = createRag(name.trim(), password.trim(), effectiveCategory, description.trim(), scope);
      setCreatedRagId(rag.id);
      setStep(1);
      return;
    }
    if (step === 4 && createdRagId) {
      setRagEscalationNote(createdRagId, escalationDraft.trim());
    }
    setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  }

  function goBack() {
    setStep((s) => s - 1);
  }

  function saveDraftAndExit() {
    resetWizard();
  }

  function finishAndPublish() {
    if (createdRagId) {
      publishRag(createdRagId);
      router.push(`/rag/${createdRagId}`);
    }
    resetWizard();
  }

  function ingestFiles(files: FileList | null) {
    if (!files || files.length === 0 || !createdRagId) return;
    Array.from(files).forEach((f) => {
      addDocumentToRag(createdRagId, {
        name: f.name,
        sizeKb: Math.max(4, Math.round(f.size / 1024)),
        addedBy: currentUser?.name ?? "Organisation",
        addedAt: new Date().toISOString(),
        note: "Initial upload",
        contentType: uploadType,
      });
    });
  }

  function assign() {
    if (!assignUserId || !assignOwnerId || !createdRagId) return;
    const code = assignRagToUser(createdRagId, assignUserId, assignOwnerId);
    setJustAssigned({ userId: assignUserId, code });
    setAssignUserId("");
    setAssignOwnerId("");
  }

  function submitKeyword() {
    if (!newKeyword.trim() || !createdRagId) return;
    addAlertKeyword(createdRagId, newKeyword.trim(), keywordSeverity, "rag");
    setNewKeyword("");
  }

  function isReviewDue(rag: (typeof rags)[number]) {
    const today = new Date().toISOString().slice(0, 10);
    return rag.documents.some((d) => d.reviewDate && d.reviewDate < today);
  }

  return (
    <AppShell title="RAG systems" subtitle="Create isolated RAG systems and manage what each one knows">
      <div className="flex justify-end mb-5">
        <Button onClick={() => setWizardOpen(true)}>
          <Plus size={15} /> Create RAG
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rags.map((r) => {
          const assigned = ragAssignments.filter((a) => a.ragId === r.id).length;
          const pending = ragQuestions.filter((q) => q.ragId === r.id && q.status !== "answered").length;
          const reviewDue = isReviewDue(r);
          return (
            <Link key={r.id} href={`/rag/${r.id}`}>
              <Card className="h-full hover:border-brand transition-colors">
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${r.colorTag}1a`, color: r.colorTag }}>
                      <BrainCircuit size={19} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={r.status === "published" ? "green" : "amber"}>{r.status}</Badge>
                      {pending > 0 && <Badge tone="amber">{pending} pending</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge tone="indigo">{r.category}</Badge>
                    {r.scope === "global" && (
                      <Badge tone="slate">
                        <Globe2 size={10} /> Org-wide
                      </Badge>
                    )}
                    {reviewDue && (
                      <Badge tone="red">
                        <AlertTriangle size={10} /> review due
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{r.name}</p>
                  {r.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{r.description}</p>}
                  <p className="text-xs text-slate-400 mb-4">Created {timeAgo(r.createdAt)}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileText size={12} /> {r.documents.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {assigned}
                    </span>
                    <span className="flex items-center gap-1">
                      <HelpCircle size={12} /> {ragQuestions.filter((q) => q.ragId === r.id).length}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
        {rags.length === 0 && <p className="text-sm text-slate-400 col-span-full text-center py-12">No RAG systems yet - create your first one.</p>}
      </div>

      <Modal open={wizardOpen} onClose={saveDraftAndExit} title="Create a new RAG system" widthClass="max-w-3xl">
        <div className="flex gap-6">
          <div className="w-40 shrink-0 space-y-1 hidden sm:block">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.label} className={`flex items-center gap-2 text-xs px-2 py-2 rounded-lg ${i === step ? "bg-brand/10 text-brand font-medium" : "text-slate-500"}`}>
                {i < step ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <Circle size={14} className={`shrink-0 ${i === step ? "text-brand" : "text-slate-300"}`} />}
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <p className="sm:hidden text-xs text-slate-500 mb-3">
              Step {step + 1} of {WIZARD_STEPS.length}: <span className="font-medium text-slate-700">{WIZARD_STEPS[step].label}</span>
            </p>

            {step === 0 && (
              <div>
                <FormRow label="RAG name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Safety Procedures" />
                </FormRow>
                <div className="mb-4">
                  <Label>Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...PRESET_CATEGORIES, "Other"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                          category === c ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:border-brand"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {category === "Other" && (
                    <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Name your own category" className="mt-2" />
                  )}
                </div>
                <FormRow label="Description" hint="What is this RAG for, and who is it for?">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g. Approved safeguarding policy and reporting procedure for all care staff." />
                </FormRow>
                <FormRow label="Access password" hint="Used to generate unique access codes for people you assign.">
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" className="pr-9" />
                    <button onClick={() => setShowPw((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FormRow>
                <div className="mb-1">
                  <Label>System scope</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setScope("team")}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        scope === "team" ? "border-brand bg-brand/5 text-brand" : "border-slate-200 text-slate-600 hover:border-brand"
                      }`}
                    >
                      <Building2 size={15} /> Team-specific
                    </button>
                    <button
                      onClick={() => setScope("global")}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        scope === "global" ? "border-brand bg-brand/5 text-brand" : "border-slate-200 text-slate-600 hover:border-brand"
                      }`}
                    >
                      <Globe2 size={15} /> Organisation-wide
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && createdRag && (
              <div>
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
                    <Sparkles size={12} /> AI will extract and suggest categories - you can review this once the RAG is created.
                  </p>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => ingestFiles(e.target.files)} />
                </div>
                {createdRag.documents.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {createdRag.documents.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <FileText size={13} className="text-slate-400 shrink-0" />
                        <span className="text-slate-700 truncate">{d.name}</span>
                        <Badge tone="slate">{d.contentType}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">This step is optional - you can add knowledge later from the RAG&apos;s own page.</p>
              </div>
            )}

            {step === 2 && createdRag && (
              <div>
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
                {justAssigned && (
                  <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs px-3 py-2.5 flex items-center gap-1.5">
                    <Key size={13} /> {userName(justAssigned.userId)}&apos;s access code: <span className="font-mono font-semibold">{justAssigned.code}</span>
                  </div>
                )}
                <div className="divide-y divide-slate-100">
                  {wizardAssignments.map((a) => (
                    <div key={a.userId} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{userName(a.userId)}</p>
                        <p className="text-xs text-slate-400 font-mono">{a.accessCode}</p>
                      </div>
                    </div>
                  ))}
                  {wizardAssignments.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No one assigned yet - this step is optional.</p>}
                </div>
              </div>
            )}

            {step === 3 && createdRag && (
              <div>
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                  <BellRing size={13} /> Any question containing one of these words turns into an alert for the assigned person&apos;s alert owner to review.
                </p>
                <div className="space-y-2 mb-4">
                  {createdRag.alertKeywords.map((k) => (
                    <div key={k.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5">
                      <span className="text-sm text-slate-800 font-mono">{k.keyword}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={k.severity === "critical" || k.severity === "high" ? "red" : k.severity === "medium" ? "amber" : "slate"}>{k.severity ?? "medium"}</Badge>
                        <button onClick={() => removeAlertKeyword(createdRag.id, k.id)} className="text-slate-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {createdRag.alertKeywords.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No alert keywords set yet - this step is optional.</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="New keyword, e.g. 'self-harm'" className="flex-1" />
                  <Select value={keywordSeverity} onChange={(e) => setKeywordSeverity(e.target.value as AlertSeverity)} className="!w-auto">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                  <Button onClick={submitKeyword}>
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <Label>What should happen when an alert flags on this RAG?</Label>
                <Textarea
                  value={escalationDraft}
                  onChange={(e) => setEscalationDraft(e.target.value)}
                  rows={4}
                  placeholder="e.g. Notify the on-call manager immediately and log a concern form within 1 hour."
                />
                <p className="text-xs text-slate-400 mt-2">Optional - you can also set this later from the RAG&apos;s Risk rules tab.</p>
              </div>
            )}

            {step === 5 && createdRag && (
              <div className="space-y-3">
                {(
                  [
                    { key: "enableConversationHistory" as const, label: "Enable conversation history", hint: "Keep a searchable record of every question asked in this RAG." },
                    { key: "allowFileUploads" as const, label: "Allow file uploads", hint: "Let team members attach files when asking a question." },
                    { key: "enableFeedbackCollection" as const, label: "Enable feedback collection", hint: "Ask a quick thumbs up/down after each answer." },
                  ]
                ).map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{setting.label}</p>
                      <p className="text-xs text-slate-500">{setting.hint}</p>
                    </div>
                    <button
                      onClick={() => updateRagSettings(createdRag.id, { [setting.key]: !createdRag[setting.key] })}
                      className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${createdRag[setting.key] ? "bg-brand" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${createdRag[setting.key] ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {step === 6 && createdRag && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge tone="indigo">{createdRag.category}</Badge>
                  <Badge tone={createdRag.scope === "global" ? "slate" : "indigo"}>{createdRag.scope === "global" ? "Organisation-wide" : "Team-specific"}</Badge>
                  <Badge tone="amber">Draft</Badge>
                </div>
                <p className="text-sm font-semibold text-slate-900">{createdRag.name}</p>
                {createdRag.description && <p className="text-sm text-slate-600">{createdRag.description}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                    <FileText size={14} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-slate-900">{createdRag.documents.length}</p>
                    <p className="text-[11px] text-slate-500">Documents</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                    <Users size={14} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-slate-900">{wizardAssignments.length}</p>
                    <p className="text-[11px] text-slate-500">People assigned</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                    <BellRing size={14} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-slate-900">{createdRag.alertKeywords.length}</p>
                    <p className="text-[11px] text-slate-500">Alert keywords</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                    <MessageSquareIcon size={14} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-slate-900">{[createdRag.enableConversationHistory, createdRag.allowFileUploads, createdRag.enableFeedbackCollection].filter(Boolean).length}</p>
                    <p className="text-[11px] text-slate-500">Settings on</p>
                  </div>
                </div>
                {createdRag.escalationNote && (
                  <div>
                    <Label>Escalation</Label>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
                      <BookOpen size={13} className="shrink-0 mt-0.5 text-slate-400" /> {createdRag.escalationNote}
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <HistoryIcon size={12} /> Publishing makes this RAG live for the people assigned to it. You can keep editing everything afterwards from its own page.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100">
              <div>{step >= 2 && <Button variant="ghost" onClick={goBack}>Back</Button>}</div>
              <div className="flex gap-2">
                {createdRagId && step < WIZARD_STEPS.length - 1 && (
                  <Button variant="outline" onClick={saveDraftAndExit}>
                    Save as draft
                  </Button>
                )}
                {step === 0 && (
                  <Button variant="ghost" onClick={saveDraftAndExit}>
                    Cancel
                  </Button>
                )}
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button onClick={goNext} disabled={step === 0 && (!name.trim() || !password.trim() || !effectiveCategory)}>
                    Next
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={saveDraftAndExit}>
                      Save as draft
                    </Button>
                    <Button onClick={finishAndPublish}>
                      <Check size={14} /> Publish RAG
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

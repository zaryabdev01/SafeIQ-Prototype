"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormRow, Textarea, Label } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { INTERNAL_ORG_ID } from "@/lib/mockData";
import { timeAgo } from "@/lib/format";
import { Plus, FileText, Users, HelpCircle, Eye, EyeOff, BrainCircuit, AlertTriangle } from "lucide-react";

const PRESET_CATEGORIES = ["Training", "Policy", "Safeguarding", "Home visits"];

export default function RagListPage() {
  const router = useRouter();
  const { currentUser, rags: allRags, ragAssignments, ragQuestions, createRag } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");

  const isInternal = currentUser?.role === "internal";
  const rags = allRags.filter((r) =>
    isInternal ? r.orgId === INTERNAL_ORG_ID : r.orgId === currentUser?.orgId || r.sharedWithOrgIds?.includes(currentUser?.orgId ?? "")
  );

  const effectiveCategory = category === "Other" ? customCategory.trim() : category;

  function submit() {
    if (!name.trim() || !password.trim() || !effectiveCategory) return;
    const rag = createRag(name.trim(), password.trim(), effectiveCategory, description.trim());
    setOpen(false);
    setName("");
    setPassword("");
    setDescription("");
    setCategory(PRESET_CATEGORIES[0]);
    setCustomCategory("");
    router.push(`/rag/${rag.id}`);
  }

  function isReviewDue(rag: (typeof rags)[number]) {
    const today = new Date().toISOString().slice(0, 10);
    return rag.documents.some((d) => d.reviewDate && d.reviewDate < today);
  }

  return (
    <AppShell title="RAG systems" subtitle="Create isolated RAG systems and manage what each one knows">
      <div className="flex justify-end mb-5">
        <Button onClick={() => setOpen(true)}>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Create a new RAG system">
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
        <Button className="w-full" onClick={submit} disabled={!name.trim() || !password.trim() || !effectiveCategory}>
          Create RAG
        </Button>
      </Modal>
    </AppShell>
  );
}

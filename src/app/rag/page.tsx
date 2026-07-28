"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormRow } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Plus, FileText, Users, HelpCircle, Eye, EyeOff, BrainCircuit } from "lucide-react";

export default function RagListPage() {
  const router = useRouter();
  const { rags, ragAssignments, ragQuestions, createRag } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  function submit() {
    if (!name.trim() || !password.trim()) return;
    const rag = createRag(name.trim(), password.trim());
    setOpen(false);
    setName("");
    setPassword("");
    router.push(`/rag/${rag.id}`);
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
          return (
            <Link key={r.id} href={`/rag/${r.id}`}>
              <Card className="h-full hover:border-brand transition-colors">
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${r.colorTag}1a`, color: r.colorTag }}>
                      <BrainCircuit size={19} />
                    </div>
                    {pending > 0 && <Badge tone="amber">{pending} pending</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{r.name}</p>
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
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a new RAG system">
        <FormRow label="RAG name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Safety Procedures" />
        </FormRow>
        <FormRow label="Access password" hint="Used to generate unique access codes for people you assign.">
          <div className="relative">
            <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" className="pr-9" />
            <button onClick={() => setShowPw((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </FormRow>
        <Button className="w-full" onClick={submit} disabled={!name.trim() || !password.trim()}>
          Create RAG
        </Button>
      </Modal>
    </AppShell>
  );
}

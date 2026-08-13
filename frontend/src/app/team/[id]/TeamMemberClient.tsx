"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ArrowLeft, StickyNote, BellRing, BrainCircuit, Trash2, ChevronDown, Globe2, Languages, ShieldAlert } from "lucide-react";
import type { AlertSeverity, TeamRole } from "@/lib/types";
import { AlertCaseThread } from "@/components/AlertCaseThread";

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

export function TeamMemberClient({ userId }: { userId: string }) {
  const {
    users,
    rags,
    ragAssignments,
    ragQuestions,
    notesByUser,
    personAlertsByUser,
    addNote,
    addPersonAlertRule,
    removePersonAlertRule,
    assignRagToUser,
    setTeamRole,
    loginHistory,
    alertCases,
    currentUser,
  } = useApp();

  const user = users.find((u) => u.id === userId);

  const [note, setNote] = useState("");
  const [ruleCategory, setRuleCategory] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState<AlertSeverity>("medium");
  const [expandedRag, setExpandedRag] = useState<string | null>(null);
  const [assignRagId, setAssignRagId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [justAssignedCode, setJustAssignedCode] = useState<string | null>(null);

  const assignments = useMemo(() => ragAssignments.filter((a) => a.userId === userId), [ragAssignments, userId]);
  const availableRags = rags.filter((r) => r.orgId === user?.orgId && !assignments.some((a) => a.ragId === r.id));
  const notes = notesByUser[userId] ?? [];
  const rules = personAlertsByUser[userId] ?? [];
  const flaggedCases = useMemo(
    () => alertCases.filter((c) => c.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [alertCases, userId]
  );
  const eligibleOwners = users.filter(
    (u) => u.role === "employee" && u.orgId === user?.orgId && u.id !== userId && u.teamRole && u.teamRole !== "employee"
  );
  const lastLogin = [...loginHistory].filter((l) => l.userId === userId).sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))[0];

  if (!user) return notFound();

  function submitNote() {
    if (!note.trim()) return;
    addNote(userId, note.trim());
    setNote("");
  }

  function submitRule() {
    if (!ruleCategory.trim()) return;
    addPersonAlertRule(userId, { category: ruleCategory.trim(), severity: ruleSeverity, notifyEmail: "morgan.ellis@brightcare.co.uk" });
    setRuleCategory("");
  }

  function assign() {
    if (!assignRagId || !assignOwnerId) return;
    const code = assignRagToUser(assignRagId, userId, assignOwnerId);
    setJustAssignedCode(code);
    setAssignRagId("");
    setAssignOwnerId("");
  }

  return (
    <AppShell title={user.name} subtitle={user.jobTitle}>
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to team
      </Link>

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} color={user.avatarColor} size={56} />
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge tone="indigo">{user.jobTitle}</Badge>
              <Badge tone="slate">
                <Globe2 size={11} /> {user.country}
              </Badge>
              <Badge tone="slate">
                <Languages size={11} /> {user.language}
              </Badge>
              <Badge tone={user.twoFactorEnabled ? "green" : "slate"}>2FA {user.twoFactorEnabled ? "on" : "off"}</Badge>
              <Badge tone={user.ipLockEnabled ? "green" : "slate"}>IP lock {user.ipLockEnabled ? "on" : "off"}</Badge>
            </div>
            {user.role === "employee" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Account type</span>
                <Select
                  value={user.teamRole ?? "employee"}
                  onChange={(e) => setTeamRole(user.id, e.target.value as TeamRole)}
                  className="!w-auto text-xs py-1.5"
                >
                  {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                    <option key={r} value={r}>
                      {TEAM_ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {lastLogin && (
            <div className="text-xs text-slate-500 text-right">
              <p>Last seen {timeAgo(lastLogin.loginAt)}</p>
              <p>{lastLogin.location}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <StickyNote size={15} /> Notes
            </h2>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2 mb-4">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about this person..." onKeyDown={(e) => e.key === "Enter" && submitNote()} />
              <Button onClick={submitNote}>Add</Button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="text-sm bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-slate-700">{n.text}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {n.authorName} · {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No notes yet.</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BellRing size={15} /> Custom alert rules
            </h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)} placeholder="e.g. Missed check-in" className="flex-1" />
              <Select value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value as AlertSeverity)} className="!w-auto">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
              <Button onClick={submitRule}>Add</Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm text-slate-800">{r.category}</p>
                    <p className="text-[11px] text-slate-400">Notifies {r.notifyEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={r.severity === "critical" || r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "slate"}>{r.severity}</Badge>
                    <button onClick={() => removePersonAlertRule(userId, r.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No custom alert rules set for this person.</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ShieldAlert size={15} /> Flagged alert words
          </h2>
          <Badge tone="slate">{flaggedCases.length}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          {flaggedCases.map((c) => (
            <AlertCaseThread key={c.id} caseItem={c} canClose={true} currentUserId={currentUser?.id ?? "u-admin"} />
          ))}
          {flaggedCases.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No keyword-flagged alerts for this person.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BrainCircuit size={15} /> Assigned RAG systems &amp; audit of activity
          </h2>
          {availableRags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={assignRagId} onChange={(e) => setAssignRagId(e.target.value)} className="!w-auto text-xs py-1.5">
                <option value="">Assign a RAG...</option>
                {availableRags.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Select value={assignOwnerId} onChange={(e) => setAssignOwnerId(e.target.value)} className="!w-auto text-xs py-1.5">
                <option value="">Who recovers their alerts?</option>
                {eligibleOwners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({TEAM_ROLE_LABEL[o.teamRole ?? "employee"]})
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={assign} disabled={!assignRagId || !assignOwnerId}>
                Assign
              </Button>
            </div>
          )}
        </CardHeader>
        {justAssignedCode && (
          <div className="mx-5 mt-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs px-3 py-2.5">
            Assigned. Unique access code: <span className="font-mono font-semibold">{justAssignedCode}</span>
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {assignments.map((a) => {
            const rag = rags.find((r) => r.id === a.ragId);
            if (!rag) return null;
            const activity = ragQuestions.filter((q) => q.ragId === a.ragId && q.userId === userId).sort((x, y) => (x.askedAt < y.askedAt ? 1 : -1));
            const expanded = expandedRag === a.ragId;
            return (
              <div key={a.ragId}>
                <button onClick={() => setExpandedRag(expanded ? null : a.ragId)} className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 text-left">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{rag.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{a.accessCode}</p>
                  </div>
                  <Badge tone="slate">{activity.length} questions</Badge>
                  <ChevronDown size={16} className={`text-slate-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="px-5 pb-4 space-y-2">
                    {activity.map((q) => (
                      <div key={q.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-slate-700">{q.text}</p>
                          <Badge tone={q.status === "answered" ? "green" : q.status === "escalated" ? "red" : "amber"}>{q.status}</Badge>
                        </div>
                        <p className="text-slate-400 mt-1">{formatDateTime(q.askedAt)}</p>
                      </div>
                    ))}
                    {activity.length === 0 && <p className="text-xs text-slate-400 py-2">No activity recorded yet.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {assignments.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">No RAG systems assigned to this person yet.</p>}
        </div>
      </Card>
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Send, Link2, RotateCcw, XCircle, Copy, ChevronRight } from "lucide-react";
import type { InviteStatus, TeamRole } from "@/lib/types";

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

const statusTone: Record<InviteStatus, "amber" | "green" | "slate"> = {
  pending: "amber",
  accepted: "green",
  cancelled: "slate",
};

export default function TeamPage() {
  const { currentUser, users, invites: allInvites, createInvite, resendInvite, cancelInvite, ragAssignments: allRagAssignments, setTeamRole } = useApp();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState("");

  const employees = users.filter((u) => u.role === "employee" && u.orgId === currentUser?.orgId);
  const invites = allInvites.filter((i) => i.orgId === currentUser?.orgId);
  const employeeIds = new Set(employees.map((e) => e.id));
  const ragAssignments = allRagAssignments.filter((a) => employeeIds.has(a.userId));

  function sendInvite() {
    if (!email.trim()) return;
    createInvite(email.trim());
    setEmail("");
  }

  function generateOpenLink() {
    createInvite("Open invite - anyone with this link");
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(link);
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <AppShell title="Team" subtitle="Invite people and manage everyone assigned to your organisation">
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Invite a new person</h2>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.co.uk" onKeyDown={(e) => e.key === "Enter" && sendInvite()} />
              <Button onClick={sendInvite}>
                <Send size={14} /> Send magic link
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-xs text-slate-400">or</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>
            <Button variant="outline" className="mt-3" onClick={generateOpenLink}>
              <Link2 size={14} /> Generate an open magic link
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Team members</span>
              <span className="font-medium text-slate-800">{employees.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending invites</span>
              <span className="font-medium text-slate-800">{invites.filter((i) => i.status === "pending").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">RAG assignments</span>
              <span className="font-medium text-slate-800">{ragAssignments.length}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Invite log</h2>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {invites.map((inv) => (
            <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 truncate">{inv.email}</p>
                <p className="text-xs text-slate-400">Sent {timeAgo(inv.sentAt)}</p>
              </div>
              <Badge tone={statusTone[inv.status]}>{inv.status}</Badge>
              <button onClick={() => copyLink(inv.magicLink)} className="text-slate-400 hover:text-brand p-1.5 rounded-md hover:bg-slate-100" title="Copy magic link">
                <Copy size={14} />
              </button>
              {copied === inv.magicLink && <span className="text-[11px] text-emerald-600">Copied</span>}
              {inv.status === "pending" && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => resendInvite(inv.id)}>
                    <RotateCcw size={13} /> Resend
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelInvite(inv.id)} className="text-red-600 hover:bg-red-50">
                    <XCircle size={13} /> Cancel
                  </Button>
                </>
              )}
            </div>
          ))}
          {invites.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">No invites sent yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Team members</h2>
          <Badge tone="slate">{employees.length}</Badge>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {employees.map((u) => {
            const codes = ragAssignments.filter((a) => a.userId === u.id);
            return (
              <div key={u.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <Link href={`/team/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={u.name} color={u.avatarColor} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.jobTitle} · {u.email}</p>
                  </div>
                </Link>
                <Select
                  value={u.teamRole ?? "employee"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setTeamRole(u.id, e.target.value as TeamRole)}
                  className="!w-auto text-xs py-1.5"
                >
                  {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                    <option key={r} value={r}>
                      {TEAM_ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
                <Badge tone="indigo">{codes.length} RAG{codes.length === 1 ? "" : "s"}</Badge>
                <Link href={`/team/${u.id}`}>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}

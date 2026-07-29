"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { BrainCircuit, GraduationCap, Bot, ArrowRight, Key, ShieldAlert } from "lucide-react";

export default function EmployeeHomePage() {
  const { currentUser, rags, ragAssignments, ragQuestions, alertCases } = useApp();
  if (!currentUser) return null;

  const myAssignments = ragAssignments.filter((a) => a.userId === currentUser.id);
  const myPending = ragQuestions.filter((q) => q.userId === currentUser.id && q.status !== "answered").length;
  const myAlerts = alertCases.filter(
    (c) => c.status === "open" && (c.userId === currentUser.id || c.ownerId === currentUser.id)
  ).length;

  const stats = [
    { label: "RAG allocated", value: myAssignments.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "/employee/my-rags" },
    { label: "Pending responses", value: myPending, icon: GraduationCap, tone: "text-amber-600 bg-amber-50", href: "/employee/my-rags" },
    { label: "Alerts", value: myAlerts, icon: ShieldAlert, tone: "text-red-600 bg-red-50", href: "/employee/alerts" },
  ];

  return (
    <AppShell title={`Welcome back, ${currentUser.name.split(" ")[0]}`} subtitle={currentUser.jobTitle}>
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 mb-6 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bot size={22} />
        </div>
        <div className="flex-1">
          <p className="font-medium">Your AI agent is ready</p>
          <p className="text-sm text-indigo-100">Open the floating widget in the bottom-right corner to switch on a RAG, message a colleague, or use safety tools.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-brand transition-colors">
              <CardBody className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>
                  <s.icon size={16} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900 leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Your assigned RAGs</h2>
          <Link href="/employee/my-rags" className="text-xs font-medium text-brand flex items-center gap-1 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {myAssignments.map((a) => {
            const rag = rags.find((r) => r.id === a.ragId);
            if (!rag) return null;
            return (
              <div key={rag.id} className="px-5 py-3.5 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{rag.name}</p>
                </div>
                <Badge tone="slate">
                  <Key size={11} /> {a.accessCode}
                </Badge>
              </div>
            );
          })}
          {myAssignments.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">No RAGs assigned yet - your organisation will assign these.</p>}
        </div>
      </Card>
    </AppShell>
  );
}

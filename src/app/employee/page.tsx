"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { BrainCircuit, CalendarDays, GraduationCap, Bot, ArrowRight, Key } from "lucide-react";

export default function EmployeeHomePage() {
  const { currentUser, rags, ragAssignments, bookings, ragQuestions } = useApp();
  if (!currentUser) return null;

  const myAssignments = ragAssignments.filter((a) => a.userId === currentUser.id);
  const myBookings = [...bookings]
    .filter((b) => b.withUserId === currentUser.id)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((b) => `${b.date}T${b.time}` >= new Date().toISOString().slice(0, 16));
  const myPending = ragQuestions.filter((q) => q.userId === currentUser.id && q.status !== "answered").length;

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-brand flex items-center justify-center">
              <BrainCircuit size={16} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 leading-none">{myAssignments.length}</p>
              <p className="text-xs text-slate-500 mt-1">RAGs assigned</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <GraduationCap size={16} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 leading-none">{myPending}</p>
              <p className="text-xs text-slate-500 mt-1">Questions awaiting reply</p>
            </div>
          </CardBody>
        </Card>
        <Card className="col-span-2 lg:col-span-2">
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CalendarDays size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 leading-none">
                {myBookings[0] ? `${myBookings[0].title} - ${myBookings[0].date}` : "No upcoming bookings"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Next booking</p>
            </div>
          </CardBody>
        </Card>
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

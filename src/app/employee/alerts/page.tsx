"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { useApp } from "@/lib/store";
import { ShieldAlert } from "lucide-react";

export default function EmployeeAlertsPage() {
  const { currentUser, alertCases } = useApp();

  const myCases = useMemo(
    () =>
      currentUser
        ? alertCases
            .filter((c) => c.userId === currentUser.id || c.ownerId === currentUser.id)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [alertCases, currentUser]
  );

  if (!currentUser) return null;

  return (
    <AppShell title="Alerts" subtitle="Things flagged by keyword, or an AI concern under review by your manager">
      <Card>
        <CardBody className="space-y-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            <ShieldAlert size={13} /> Anything here either concerns you directly, or is an alert you&apos;ve been designated to
            review and close.
          </p>
          {myCases.map((c) => (
            <AlertCaseThread key={c.id} caseItem={c} canClose={currentUser.id === c.ownerId} currentUserId={currentUser.id} />
          ))}
          {myCases.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No alerts right now.</p>}
        </CardBody>
      </Card>
    </AppShell>
  );
}

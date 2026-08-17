"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { GlobalScopeConfirmModal, RuleHistory, SeverityLegend } from "@/components/AlertRuleGovernance";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Plus, Search, ShieldAlert, ShieldCheck, Clock3, Inbox, Check, X, Pencil } from "lucide-react";
import type { AlertSeverity, GlobalAlertRule, TeamRole } from "@/lib/types";

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

type RuleFormValue = Pick<
  GlobalAlertRule,
  "phrase" | "category" | "severity" | "ragScope" | "recipientRoles" | "autoCreateAction" | "acknowledgementRequired"
>;

const EMPTY_FORM: RuleFormValue = {
  phrase: "",
  category: "",
  severity: "medium",
  ragScope: "all",
  recipientRoles: ["administrator"],
  autoCreateAction: true,
  acknowledgementRequired: false,
};

export default function AlertLibraryPage() {
  const { currentUser, rags: allRags, globalAlertRules, createGlobalAlertRule, proposeGlobalAlertRule, approveGlobalAlertRule, rejectGlobalAlertRule } =
    useApp();

  const rags = useMemo(() => allRags.filter((r) => r.orgId === currentUser?.orgId), [allRags, currentUser]);
  const rules = useMemo(() => globalAlertRules.filter((r) => r.orgId === currentUser?.orgId), [globalAlertRules, currentUser]);

  const activeRules = rules.filter((r) => r.status === "active");
  const suggestedRules = rules.filter((r) => r.status === "suggested");
  const criticalCount = activeRules.filter((r) => r.severity === "critical").length;
  const triggeredTotal = activeRules.reduce((sum, r) => sum + r.triggeredCount, 0);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit" | "suggest">("add");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<RuleFormValue>(EMPTY_FORM);
  const [confirming, setConfirming] = useState(false);
  const [triggeredRule, setTriggeredRule] = useState<GlobalAlertRule | null>(null);

  const filteredActive = activeRules.filter((r) => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.phrase.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  });

  function ragScopeLabel(scope: string) {
    if (scope === "all") return "All RAGs";
    return rags.find((r) => r.id === scope)?.name ?? "A specific RAG";
  }

  function openAddForm() {
    setFormMode("add");
    setEditingRuleId(null);
    setFormValue(EMPTY_FORM);
    setFormOpen(true);
  }

  function openSuggestForm() {
    setFormMode("suggest");
    setEditingRuleId(null);
    setFormValue(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(rule: GlobalAlertRule) {
    setFormMode("edit");
    setEditingRuleId(rule.id);
    setFormValue({
      phrase: rule.phrase,
      category: rule.category,
      severity: rule.severity,
      ragScope: rule.ragScope,
      recipientRoles: rule.recipientRoles,
      autoCreateAction: rule.autoCreateAction,
      acknowledgementRequired: rule.acknowledgementRequired,
    });
    setFormOpen(true);
  }

  function submitForm() {
    if (!formValue.phrase.trim() || !formValue.category.trim()) return;
    setFormOpen(false);
    if (formMode === "suggest") {
      proposeGlobalAlertRule(formValue);
      setFormValue(EMPTY_FORM);
      return;
    }
    setConfirming(true);
  }

  function confirmActivate() {
    if (formMode === "edit" && editingRuleId) {
      approveGlobalAlertRule(editingRuleId, formValue);
    } else {
      createGlobalAlertRule(formValue);
    }
    setConfirming(false);
    setFormValue(EMPTY_FORM);
    setEditingRuleId(null);
  }

  function toggleRecipient(role: TeamRole) {
    setFormValue((v) => ({
      ...v,
      recipientRoles: v.recipientRoles.includes(role) ? v.recipientRoles.filter((r) => r !== role) : [...v.recipientRoles, role],
    }));
  }

  return (
    <AppShell title="Global Alert Library" subtitle="Organisation-wide alert rules, with a review queue for suggested rules">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-brand" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{activeRules.length}</p>
              <p className="text-xs text-slate-500">Total active rules</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <ShieldAlert size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{criticalCount}</p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Clock3 size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{triggeredTotal}</p>
              <p className="text-xs text-slate-500">Triggered this month</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Inbox size={16} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{suggestedRules.length}</p>
              <p className="text-xs text-slate-500">Awaiting review</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {suggestedRules.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Suggestions awaiting review</h2>
            <Badge tone="amber">{suggestedRules.length}</Badge>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {suggestedRules.map((r) => (
              <div key={r.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 font-mono">{r.phrase}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.category} · proposed by {r.proposedBy} · {r.proposedAt && timeAgo(r.proposedAt)}
                    </p>
                  </div>
                  <Badge tone={severityTone(r.severity)}>{r.severity}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <Button size="sm" onClick={() => approveGlobalAlertRule(r.id)}>
                    <Check size={13} /> Approve as global
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditForm(r)}>
                    <Pencil size={13} /> Edit &amp; approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => rejectGlobalAlertRule(r.id)}>
                    <X size={13} /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Global alert rules</h2>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "all" | AlertSeverity)} className="!w-auto text-xs py-1.5">
              <option value="all">All severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Button size="sm" variant="outline" onClick={openSuggestForm}>
              Suggest a rule
            </Button>
            <Button size="sm" onClick={openAddForm}>
              <Plus size={14} /> Add global alert
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <details className="mb-4">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">What does each severity do?</summary>
            <div className="pt-2">
              <SeverityLegend />
            </div>
          </details>
        </CardBody>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Phrase</th>
                <th className="px-5 py-2.5 font-medium">Category</th>
                <th className="px-5 py-2.5 font-medium">Severity</th>
                <th className="px-5 py-2.5 font-medium">Scope</th>
                <th className="px-5 py-2.5 font-medium">Recipients</th>
                <th className="px-5 py-2.5 font-medium">Triggered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredActive.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-slate-800 font-mono">{r.phrase}</td>
                  <td className="px-5 py-3 text-slate-600">{r.category}</td>
                  <td className="px-5 py-3">
                    <Badge tone={severityTone(r.severity)}>{r.severity}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{ragScopeLabel(r.ragScope)}</td>
                  <td className="px-5 py-3 text-slate-500">{r.recipientRoles.map((role) => TEAM_ROLE_LABEL[role]).join(", ")}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setTriggeredRule(r)} className="text-brand font-medium hover:underline">
                      {r.triggeredCount}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredActive.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No global alert rules match.</p>}
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "edit" ? "Edit & approve suggestion" : formMode === "suggest" ? "Suggest a global alert rule" : "Add global alert"}
      >
        <FormRow label="Word or phrase">
          <Input value={formValue.phrase} onChange={(e) => setFormValue((v) => ({ ...v, phrase: e.target.value }))} placeholder="e.g. 'unsafe staffing levels'" />
        </FormRow>
        <FormRow label="Category">
          <Input value={formValue.category} onChange={(e) => setFormValue((v) => ({ ...v, category: e.target.value }))} placeholder="e.g. Operational risk" />
        </FormRow>
        <FormRow label="Severity">
          <Select value={formValue.severity} onChange={(e) => setFormValue((v) => ({ ...v, severity: e.target.value as AlertSeverity }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </FormRow>
        <FormRow label="RAG scope">
          <Select value={formValue.ragScope} onChange={(e) => setFormValue((v) => ({ ...v, ragScope: e.target.value }))}>
            <option value="all">All RAGs</option>
            {rags.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Recipient roles">
          <div className="flex flex-wrap gap-3 text-sm">
            {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" checked={formValue.recipientRoles.includes(role)} onChange={() => toggleRecipient(role)} />
                {TEAM_ROLE_LABEL[role]}
              </label>
            ))}
          </div>
        </FormRow>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 mb-3">
          <span className="text-sm text-slate-700">Auto-create an action when triggered</span>
          <button
            onClick={() => setFormValue((v) => ({ ...v, autoCreateAction: !v.autoCreateAction }))}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${formValue.autoCreateAction ? "bg-brand" : "bg-slate-200"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formValue.autoCreateAction ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 mb-4">
          <span className="text-sm text-slate-700">Require acknowledgement</span>
          <button
            onClick={() => setFormValue((v) => ({ ...v, acknowledgementRequired: !v.acknowledgementRequired }))}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${formValue.acknowledgementRequired ? "bg-brand" : "bg-slate-200"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formValue.acknowledgementRequired ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>
        <Button className="w-full" onClick={submitForm} disabled={!formValue.phrase.trim() || !formValue.category.trim()}>
          {formMode === "suggest" ? "Submit for review" : "Continue"}
        </Button>
      </Modal>

      <GlobalScopeConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmActivate}
        affectedLabel={`every employee with the ${formValue.recipientRoles.map((r) => TEAM_ROLE_LABEL[r]).join("/")} role, across ${ragScopeLabel(formValue.ragScope)}`}
      />

      <Modal open={!!triggeredRule} onClose={() => setTriggeredRule(null)} title="Rule occurrences">
        {triggeredRule && (
          <div>
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-mono">{triggeredRule.phrase}</span> has triggered {triggeredRule.triggeredCount} time
              {triggeredRule.triggeredCount === 1 ? "" : "s"}.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Per-occurrence drill-down (which employee, which RAG, when) will read from real alert-case data once this rule is wired into
              live conversations - not simulated in this prototype yet.
            </p>
            <RuleHistory entries={triggeredRule.changeLog} />
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

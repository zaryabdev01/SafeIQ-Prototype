"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { COUNTRIES, LANGUAGES, SECTORS } from "@/lib/constants";
import type { Country, Language } from "@/lib/types";
import { apiClient, ApiError, type ApiAuditEntry, type ApiLoginEvent } from "@/lib/apiClient";
import { ShieldCheck, Building2, History, Smartphone, Check, Globe2, FileLock2, Loader2, Search } from "lucide-react";

export default function SettingsPage() {
  const { currentUser, isRealSession, toggle2FA, toggleIPLock, loginHistory, users, organisations, updateOrganisation } = useApp();

  const isOrg = isOrgLevel(currentUser);
  const org = organisations.find((o) => o.id === currentUser?.orgId);
  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [orgSector, setOrgSector] = useState(org?.sector ?? SECTORS[0]);
  const [saved, setSaved] = useState(false);

  // --- Real-backend mode: PATCH /me/settings and read the audit ledger (Milestone 2 tasks 19-20) ---
  const [country, setCountry] = useState<Country>(currentUser?.country ?? "United Kingdom");
  const [language, setLanguage] = useState<Language>(currentUser?.language ?? "English");
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");

  const [auditEntries, setAuditEntries] = useState<ApiAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditVerification, setAuditVerification] = useState<{ valid: boolean; entries_checked: number } | null>(null);
  const [auditVerifying, setAuditVerifying] = useState(false);
  const [auditError, setAuditError] = useState("");

  const [loginEvents, setLoginEvents] = useState<ApiLoginEvent[]>([]);
  const [loginEventsLoading, setLoginEventsLoading] = useState(false);
  const [loginEventsError, setLoginEventsError] = useState("");
  const [loginQuery, setLoginQuery] = useState("");

  useEffect(() => {
    if (!isRealSession || !isOrg) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/session-change; loading flag must flip synchronously
    setAuditLoading(true);
    apiClient
      .listAudit()
      .then(setAuditEntries)
      .catch((err) => setAuditError(err instanceof ApiError ? err.message : "Could not load the audit trail."))
      .finally(() => setAuditLoading(false));
  }, [isRealSession, isOrg]);

  useEffect(() => {
    if (!isRealSession || !isOrg) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/search-change; loading flag must flip synchronously
    setLoginEventsLoading(true);
    const handle = window.setTimeout(() => {
      apiClient
        .listLoginHistory({ q: loginQuery.trim() || undefined, limit: 200 })
        .then(setLoginEvents)
        .catch((err) => setLoginEventsError(err instanceof ApiError ? err.message : "Could not load login history."))
        .finally(() => setLoginEventsLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [isRealSession, isOrg, loginQuery]);

  async function saveAccountSettings() {
    setAccountBusy(true);
    setAccountError("");
    try {
      await apiClient.updateSettings({ country, language });
      setAccountSaved(true);
      window.setTimeout(() => setAccountSaved(false), 1800);
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Could not save your settings.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function verifyAuditChain() {
    setAuditVerifying(true);
    setAuditError("");
    try {
      setAuditVerification(await apiClient.verifyAuditChain());
    } catch (err) {
      setAuditError(err instanceof ApiError ? err.message : "Could not verify the audit chain.");
    } finally {
      setAuditVerifying(false);
    }
  }

  const historyRows = useMemo(() => {
    const sameOrgUserIds = new Set(users.filter((u) => u.orgId === currentUser?.orgId).map((u) => u.id));
    return [...loginHistory]
      .filter((l) => (isOrg ? sameOrgUserIds.has(l.userId) : l.userId === currentUser?.id))
      .sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1));
  }, [loginHistory, isOrg, currentUser, users]);

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  function saveOrg() {
    if (!org) return;
    updateOrganisation(org.id, { name: orgName, sector: orgSector });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (!currentUser) return null;

  return (
    <AppShell title="Settings" subtitle="Security and account activity">
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={15} /> Security
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-sm font-medium text-slate-800">Two-step verification</p>
                <p className="text-xs text-slate-500">Require a one-time code at every sign-in</p>
              </div>
              <button
                onClick={() => toggle2FA(currentUser.id)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${currentUser.twoFactorEnabled ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${currentUser.twoFactorEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-sm font-medium text-slate-800">IP address lock</p>
                <p className="text-xs text-slate-500">Only allow sign-in from approved IP addresses</p>
              </div>
              <button
                onClick={() => toggleIPLock(currentUser.id)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${currentUser.ipLockEnabled ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${currentUser.ipLockEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Building2 size={15} /> Organisation
            </h2>
          </CardHeader>
          <CardBody>
            {isOrg ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Organisation name</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Sector</label>
                  <Select value={orgSector} onChange={(e) => setOrgSector(e.target.value)}>
                    {SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" onClick={saveOrg}>
                  {saved ? (
                    <>
                      <Check size={13} /> Saved
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Organisation</span>
                  <span className="font-medium text-slate-800">{org?.name ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sector</span>
                  <span className="font-medium text-slate-800">{org?.sector ?? "-"}</span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {isRealSession && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Globe2 size={15} /> Account (live on the SafeIQ API)
              </h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Country</label>
                <Select value={country} onChange={(e) => setCountry(e.target.value as Country)}>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Language</label>
                <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
              {accountError && <p className="text-xs text-red-600">{accountError}</p>}
              <Button size="sm" onClick={saveAccountSettings} disabled={accountBusy}>
                {accountBusy ? <Loader2 size={13} className="animate-spin" /> : accountSaved ? <Check size={13} /> : null}
                {accountBusy ? "Saving..." : accountSaved ? "Saved" : "Save changes"}
              </Button>
              <p className="text-[11px] text-slate-400">
                This calls <code>PATCH /me/settings</code> on the real backend - Milestone 2, task 19.
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {isRealSession && isOrg && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileLock2 size={15} /> Audit trail (live)
            </h2>
            <div className="flex items-center gap-2">
              {auditLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
              <Button size="sm" variant="outline" onClick={verifyAuditChain} disabled={auditVerifying}>
                {auditVerifying ? <Loader2 size={13} className="animate-spin" /> : null} Verify chain
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {auditError && <p className="text-xs text-red-600 mb-3">{auditError}</p>}
            {auditVerification && (
              <p className={`text-xs mb-3 ${auditVerification.valid ? "text-emerald-600" : "text-red-600"}`}>
                {auditVerification.valid
                  ? `Chain verified - all ${auditVerification.entries_checked} entries are intact (ADR-005).`
                  : `Chain verification FAILED across ${auditVerification.entries_checked} entries - tampering detected.`}
              </p>
            )}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="py-2.5 flex items-center gap-3 text-xs">
                  <Badge tone="indigo">{entry.event_type}</Badge>
                  <span className="text-slate-400 font-mono truncate flex-1">{entry.entry_hash.slice(0, 16)}...</span>
                  <span className="text-slate-400">{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
              {auditEntries.length === 0 && !auditLoading && <p className="py-6 text-center text-sm text-slate-400">No audit entries yet.</p>}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <History size={15} />
            {isRealSession && isOrg ? "Account login history - all users (live)" : isOrg ? "Account login history - all users" : "Your login history"}
          </h2>
          {isRealSession && isOrg && (
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={loginQuery}
                onChange={(e) => setLoginQuery(e.target.value)}
                placeholder="Search by name or email"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              {loginEventsLoading && <Loader2 size={13} className="animate-spin text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />}
            </div>
          )}
        </CardHeader>
        {isRealSession && isOrg ? (
          <div className="overflow-x-auto">
            {loginEventsError && <p className="text-xs text-red-600 px-5 pt-3">{loginEventsError}</p>}
            <div className="max-h-[26rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">User</th>
                    <th className="px-5 py-2.5 font-medium">IP address</th>
                    <th className="px-5 py-2.5 font-medium">Device / user agent</th>
                    <th className="px-5 py-2.5 font-medium">Logged in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loginEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-3 text-slate-700">{e.user_name}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-xs">{e.ip ?? "-"}</td>
                      <td className="px-5 py-3 text-slate-500 flex items-center gap-1.5 truncate max-w-xs">
                        <Smartphone size={12} className="shrink-0" /> <span className="truncate">{e.user_agent ?? "-"}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatDateTime(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loginEvents.length === 0 && !loginEventsLoading && <p className="py-8 text-center text-sm text-slate-400">No login history yet.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  {isOrg && <th className="px-5 py-2.5 font-medium">User</th>}
                  <th className="px-5 py-2.5 font-medium">IP address</th>
                  <th className="px-5 py-2.5 font-medium">Location</th>
                  <th className="px-5 py-2.5 font-medium">Device</th>
                  <th className="px-5 py-2.5 font-medium">Logged in</th>
                  <th className="px-5 py-2.5 font-medium">Logged out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historyRows.map((l) => (
                  <tr key={l.id}>
                    {isOrg && <td className="px-5 py-3 text-slate-700">{userName(l.userId)}</td>}
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{l.ip}</td>
                    <td className="px-5 py-3 text-slate-500">{l.location}</td>
                    <td className="px-5 py-3 text-slate-500 flex items-center gap-1.5">
                      <Smartphone size={12} /> {l.device}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDateTime(l.loginAt)}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {l.logoutAt ? formatDateTime(l.logoutAt) : <Badge tone="green">Active now</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historyRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No login history yet.</p>}
          </div>
        )}
      </Card>
    </AppShell>
  );
}

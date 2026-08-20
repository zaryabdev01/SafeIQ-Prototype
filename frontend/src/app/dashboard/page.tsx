"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import {
  BrainCircuit,
  Users,
  AlertTriangle,
  Bell,
  Download,
  CalendarClock,
  MessageSquare as MessageSquareIcon,
  BookOpen,
  Zap,
  Activity,
  Clock,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  ChevronRight,
  Plus,
  UserPlus,
  ShieldAlert,
} from "lucide-react";
import type { AlertSeverity } from "@/lib/types";

// Status palette for ordered severity (dataviz skill: fixed status colors, never
// hue-alone - every use below pairs the color with a visible label/count).
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  low: "#0ca30c",
  medium: "#fab219",
  high: "#ec835a",
  critical: "#d03b3b",
};
const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low"];
const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

const RANGE_OPTIONS = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null as number | null },
];

function csvCell(value: string | number) {
  const s = String(value);
  // Guard against CSV-formula injection (Excel/Sheets execute leading =+-@) before quoting.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function DashboardPage() {
  const {
    currentUser,
    rags: allRags,
    users: allUsers,
    ragQuestions: allRagQuestions,
    alertCases: allAlertCases,
    bookings: allBookings,
    touchPointRequests: allTouchPointRequests,
    actions: allActions,
    ragAssignments: allRagAssignments,
  } = useApp();

  const [rangeKey, setRangeKey] = useState("30");
  const selectedRange = RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? RANGE_OPTIONS[1];

  const rags = useMemo(
    () => allRags.filter((r) => r.orgId === currentUser?.orgId || r.sharedWithOrgIds?.includes(currentUser?.orgId ?? "")),
    [allRags, currentUser]
  );
  const users = useMemo(() => allUsers.filter((u) => u.orgId === currentUser?.orgId), [allUsers, currentUser]);
  const ragQuestions = useMemo(() => {
    const ragIds = new Set(rags.map((r) => r.id));
    return allRagQuestions.filter((q) => ragIds.has(q.ragId));
  }, [allRagQuestions, rags]);
  const orgCases = useMemo(() => allAlertCases.filter((c) => c.orgId === currentUser?.orgId), [allAlertCases, currentUser]);
  const bookings = useMemo(() => allBookings.filter((b) => b.orgId === currentUser?.orgId && !b.cancelled), [allBookings, currentUser]);
  const orgTouchPointRequests = useMemo(
    () => allTouchPointRequests.filter((r) => r.orgId === currentUser?.orgId),
    [allTouchPointRequests, currentUser]
  );
  const actions = useMemo(() => allActions.filter((a) => a.orgId === currentUser?.orgId), [allActions, currentUser]);
  const ragAssignments = useMemo(() => {
    const ragIds = new Set(rags.map((r) => r.id));
    return allRagAssignments.filter((a) => ragIds.has(a.ragId));
  }, [allRagAssignments, rags]);

  const today = new Date().toISOString().slice(0, 10);
  const nowMs = new Date().getTime();
  const rangeStartIso = selectedRange.days ? new Date(nowMs - selectedRange.days * 86400000).toISOString().slice(0, 10) : "0000-00-00";
  const casesInRange = useMemo(() => orgCases.filter((c) => c.createdAt.slice(0, 10) >= rangeStartIso), [orgCases, rangeStartIso]);

  function userName(userId: string) {
    return users.find((u) => u.id === userId)?.name ?? "Unknown";
  }
  function ragName(ragId?: string) {
    return ragId ? (rags.find((r) => r.id === ragId)?.name ?? "Unknown RAG") : "-";
  }

  const publishedRags = rags.filter((r) => r.status === "published");
  const teamMembersCount = users.filter((u) => u.role === "employee").length;
  const liveAlertsCount = orgCases.filter((c) => c.status === "open").length;

  const statTiles = [
    { label: "RAG systems", value: rags.length, caption: `${publishedRags.length} published`, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "/rag" },
    { label: "Team members", value: teamMembersCount, icon: Users, tone: "text-teal-600 bg-teal-50", href: "/team" },
    { label: "Live alerts", value: liveAlertsCount, icon: AlertTriangle, tone: "text-red-600 bg-red-50", href: "#alerts-by-severity" },
    { label: "Touch points", value: orgTouchPointRequests.length, icon: Bell, tone: "text-indigo-600 bg-indigo-50", href: "#upcoming-touch-points" },
  ];

  const severityCounts = useMemo(() => {
    const counts: Record<AlertSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    casesInRange.forEach((c) => {
      counts[c.severity] = (counts[c.severity] ?? 0) + 1;
    });
    return counts;
  }, [casesInRange]);
  const severityTotal = SEVERITY_ORDER.reduce((sum, s) => sum + severityCounts[s], 0);

  const trendDays = selectedRange.days ?? 90;
  const trendBuckets = useMemo(() => {
    return Array.from({ length: trendDays }, (_, i) => {
      const d = new Date(nowMs - (trendDays - 1 - i) * 86400000).toISOString().slice(0, 10);
      return { date: d, count: orgCases.filter((c) => c.createdAt.slice(0, 10) === d).length };
    });
  }, [orgCases, trendDays, nowMs]);
  const trendMax = Math.max(1, ...trendBuckets.map((b) => b.count));

  const topActiveRags = useMemo(
    () =>
      [...rags]
        .map((r) => ({ rag: r, conversations: ragQuestions.filter((q) => q.ragId === r.id).length }))
        .sort((a, b) => b.conversations - a.conversations)
        .slice(0, 5),
    [rags, ragQuestions]
  );
  const topActiveMax = Math.max(1, ...topActiveRags.map((r) => r.conversations));

  const alertsBySystem = useMemo(
    () =>
      [...rags]
        .map((r) => ({ rag: r, alerts: casesInRange.filter((c) => c.ragId === r.id).length }))
        .filter((r) => r.alerts > 0)
        .sort((a, b) => b.alerts - a.alerts)
        .slice(0, 5),
    [rags, casesInRange]
  );
  const alertsBySystemMax = Math.max(1, ...alertsBySystem.map((r) => r.alerts));

  const upcomingTouchPoints = useMemo(
    () =>
      bookings
        .filter((b) => b.sourceTouchPointRequestId && b.date >= today)
        .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
        .slice(0, 4),
    [bookings, today]
  );

  const recentCommunications = useMemo(
    () => [...ragQuestions].sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1)).slice(0, 4),
    [ragQuestions]
  );

  const totalDocs = rags.reduce((sum, r) => sum + r.documents.length, 0);
  const outOfDateDocs = rags.reduce((sum, r) => sum + r.documents.filter((d) => d.reviewDate && d.reviewDate < today).length, 0);

  const teamActivity = useMemo(() => {
    type ActivityRow = { id: string; person: string; text: string; at: string };
    const items: ActivityRow[] = [];
    ragQuestions
      .filter((q) => q.askedAt.slice(0, 10) >= rangeStartIso)
      .forEach((q) => items.push({ id: `q-${q.id}`, person: userName(q.userId), text: `Asked a question in ${ragName(q.ragId)}`, at: q.askedAt }));
    casesInRange.forEach((c) => {
      items.push({ id: `c-open-${c.id}`, person: userName(c.userId), text: `Alert case opened in ${ragName(c.ragId)}`, at: c.createdAt });
      if (c.closedAt) items.push({ id: `c-closed-${c.id}`, person: c.closedBy ? userName(c.closedBy) : "A manager", text: "Closed an alert case", at: c.closedAt });
    });
    actions
      .filter((a) => a.createdAt.slice(0, 10) >= rangeStartIso)
      .forEach((a) => items.push({ id: `a-${a.id}`, person: userName(a.assigneeId), text: `Action created: ${a.title}`, at: a.createdAt }));
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ragQuestions, casesInRange, actions, rangeStartIso]);

  function exportReport() {
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["RAG systems", rags.length],
      ["Team members", teamMembersCount],
      ["Live alerts", liveAlertsCount],
      ["Touch points", orgTouchPointRequests.length],
      [],
      ["RAG name", "Conversations", "Alerts", "Documents", "People assigned"],
      ...rags.map((r) => [
        r.name,
        ragQuestions.filter((q) => q.ragId === r.id).length,
        orgCases.filter((c) => c.ragId === r.id).length,
        r.documents.length,
        ragAssignments.filter((a) => a.ragId === r.id).length,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safeiq-dashboard-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Donut geometry - stacked stroke-dasharray arcs on a single circle.
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutSegments = SEVERITY_ORDER.filter((sev) => severityCounts[sev] > 0).map((sev, i, arr) => {
    const priorCount = arr.slice(0, i).reduce((sum, s) => sum + severityCounts[s], 0);
    const dash = (severityCounts[sev] / severityTotal) * donutCircumference;
    const offset = (priorCount / severityTotal) * donutCircumference;
    return { sev, dash, offset };
  });

  return (
    <AppShell title="Dashboard" subtitle="Organisation-wide overview across every RAG you manage">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} className="!w-auto">
          {RANGE_OPTIONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={exportReport}>
          <Download size={14} /> Export report
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statTiles.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-brand transition-colors h-full">
              <CardBody className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>
                  <s.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-slate-900 leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{s.label}</p>
                  {s.caption && <p className="text-[10px] text-slate-400">{s.caption}</p>}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card id="alerts-by-severity">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <PieChartIcon size={15} /> Alerts by severity
            </h2>
            <Badge tone="slate">{severityTotal} total</Badge>
          </CardHeader>
          <CardBody>
            {severityTotal > 0 ? (
              <div className="flex items-center gap-6">
                <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0 -rotate-90">
                  <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="#e1e0d9" strokeWidth="16" />
                  {donutSegments.map(({ sev, dash, offset }) => (
                    <circle
                      key={sev}
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="none"
                      stroke={SEVERITY_COLOR[sev]}
                      strokeWidth="16"
                      strokeDasharray={`${dash} ${donutCircumference - dash}`}
                      strokeDashoffset={-offset}
                    />
                  ))}
                  <text x="60" y="60" transform="rotate(90 60 60)" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-[22px] font-semibold">
                    {severityTotal}
                  </text>
                </svg>
                <div className="space-y-2 flex-1 min-w-0">
                  {SEVERITY_ORDER.map((sev) => (
                    <div key={sev} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLOR[sev] }} />
                        {SEVERITY_LABEL[sev]}
                      </span>
                      <span className="font-medium text-slate-800">{severityCounts[sev]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-10">No alerts in this period.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp size={15} /> Alerts trend
            </h2>
            <Badge tone="slate">{selectedRange.label}</Badge>
          </CardHeader>
          <CardBody>
            <AlertsTrendChart buckets={trendBuckets} max={trendMax} />
          </CardBody>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card id="upcoming-touch-points">
          <CardHeader>
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <CalendarClock size={14} /> Upcoming touch points
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {upcomingTouchPoints.map((b) => (
              <div key={b.id} className="text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                <p className="font-medium text-slate-700 truncate">{b.title}</p>
                <p className="text-slate-400">
                  {b.date} · {b.time}
                </p>
              </div>
            ))}
            {upcomingTouchPoints.length === 0 && <p className="text-xs text-slate-400 text-center py-4">None scheduled.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <MessageSquareIcon size={14} /> Recent communications
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {recentCommunications.map((q) => (
              <div key={q.id} className="text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                <p className="text-slate-700 truncate">{q.text}</p>
                <p className="text-slate-400">
                  {userName(q.userId)} · {timeAgo(q.askedAt)}
                </p>
              </div>
            ))}
            {recentCommunications.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No conversations yet.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <BookOpen size={14} /> Knowledge overview
            </h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Documents</span>
              <span className="font-medium text-slate-800">{totalDocs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Out of date</span>
              <span className={`font-medium ${outOfDateDocs > 0 ? "text-red-600" : "text-slate-800"}`}>{outOfDateDocs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Published RAGs</span>
              <span className="font-medium text-slate-800">{publishedRags.length}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Zap size={14} /> Quick actions
            </h2>
          </CardHeader>
          <CardBody className="space-y-1.5">
            {[
              { label: "Create a RAG", href: "/rag", icon: Plus },
              { label: "Invite a team member", href: "/team", icon: UserPlus },
              { label: "Manage alert rules", href: "/alert-library", icon: ShieldAlert },
              { label: "Open calendar", href: "/calendar", icon: CalendarClock },
            ].map((qa) => (
              <Link key={qa.label} href={qa.href} className="flex items-center gap-2 text-xs text-slate-600 hover:text-brand hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
                <qa.icon size={13} /> {qa.label}
                <ChevronRight size={12} className="ml-auto text-slate-300" />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 size={15} /> Top active RAG systems
            </h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {topActiveRags.map(({ rag, conversations }) => (
              <Link key={rag.id} href={`/rag/${rag.id}`} className="block group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 group-hover:text-brand truncate">{rag.name}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{conversations}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (conversations / topActiveMax) * 100)}%` }} />
                </div>
              </Link>
            ))}
            {topActiveRags.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No RAG activity yet.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle size={15} /> Alerts by system
            </h2>
            <Badge tone="slate">{selectedRange.label}</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {alertsBySystem.map(({ rag, alerts }) => (
              <Link key={rag.id} href={`/rag/${rag.id}`} className="block group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 group-hover:text-brand truncate">{rag.name}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{alerts}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (alerts / alertsBySystemMax) * 100)}%`, backgroundColor: "#b45309" }} />
                </div>
              </Link>
            ))}
            {alertsBySystem.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No alerts in this period.</p>}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity size={15} /> Team activity
          </h2>
          <Badge tone="slate">{selectedRange.label}</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Person</th>
                <th className="px-5 py-2.5 font-medium">Activity</th>
                <th className="px-5 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {teamActivity.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-slate-800">{item.person}</td>
                  <td className="px-5 py-3 text-slate-600">{item.text}</td>
                  <td className="px-5 py-3 text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(item.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {teamActivity.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No activity in this period.</p>}
        </div>
      </Card>

      <p className="text-xs text-slate-400 text-center">Data refreshed every 15 minutes.</p>
    </AppShell>
  );
}

function AlertsTrendChart({ buckets, max }: { buckets: { date: string; count: number }[]; max: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 560;
  const height = 160;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0;

  function xFor(i: number) {
    return padding + i * stepX;
  }
  function yFor(count: number) {
    return padding + innerHeight - (count / max) * innerHeight;
  }

  const linePath = buckets.map((b, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(b.count)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(buckets.length - 1)} ${padding + innerHeight} L ${xFor(0)} ${padding + innerHeight} Z`;
  const hovered = hoverIndex !== null ? buckets[hoverIndex] : null;
  const tickCount = Math.min(6, buckets.length);
  const tickIndices = [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round((i * (buckets.length - 1)) / Math.max(1, tickCount - 1))))];

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round((relX - padding) / (stepX || 1));
          setHoverIndex(Math.min(buckets.length - 1, Math.max(0, idx)));
        }}
      >
        <line x1={padding} y1={padding + innerHeight} x2={width - padding} y2={padding + innerHeight} stroke="#e1e0d9" strokeWidth="1" />
        <path d={areaPath} fill="#4f46e5" opacity="0.08" stroke="none" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xFor(buckets.length - 1)} cy={yFor(buckets[buckets.length - 1].count)} r="4" fill="#4f46e5" stroke="#fcfcfb" strokeWidth="2" />
        <text
          x={xFor(buckets.length - 1) - 6}
          y={yFor(buckets[buckets.length - 1].count) - 8}
          textAnchor="end"
          className="fill-slate-700 font-medium"
          style={{ fontSize: 10 }}
        >
          {buckets[buckets.length - 1].count}
        </text>
        {tickIndices.map((i) => (
          <text key={`lbl-${buckets[i].date}`} x={xFor(i)} y={height - 2} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
            {buckets[i].date.slice(5)}
          </text>
        ))}
        {hoverIndex !== null && (
          <>
            <line x1={xFor(hoverIndex)} y1={padding} x2={xFor(hoverIndex)} y2={padding + innerHeight} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={xFor(hoverIndex)} cy={yFor(buckets[hoverIndex].count)} r="5" fill="#4f46e5" stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-[11px] rounded-md px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{ left: `${(xFor(hoverIndex!) / width) * 100}%`, top: `${(yFor(hovered.count) / height) * 100}%` }}
        >
          {hovered.date}: {hovered.count} alert{hovered.count === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

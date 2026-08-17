"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { monthMatrix, toIsoDate, isSameDay } from "@/lib/calendar";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Key,
  BrainCircuit,
  RefreshCw,
  Check,
  Search,
  FileClock,
  X,
  Pencil,
  Ban,
  Video,
  CalendarDays,
} from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const REVIEW_PUSH_DAYS = 90;
const DAY_VIEW_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00-20:00
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" }));

type ViewMode = "day" | "month" | "year";

type CalendarEntry = {
  kind: "booking" | "review";
  id: string;
  date: string;
  time: string;
  title: string;
  subtitle: string;
  category: string;
  ragId?: string;
  docId?: string;
  withUserId?: string;
  accessCode?: string;
  notes?: string;
  meetingLink?: string;
};

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function CalendarPage() {
  const {
    currentUser,
    users: allUsers,
    rags: allRags,
    ragAssignments,
    bookings: allBookings,
    createBooking,
    updateBooking,
    cancelBooking,
    updateRagDocumentMetadata,
  } = useApp();
  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [open, setOpen] = useState(false);
  const [panelKey, setPanelKey] = useState<string | null>(null);
  const [editingPanel, setEditingPanel] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const users = useMemo(() => allUsers.filter((u) => u.orgId === currentUser?.orgId), [allUsers, currentUser]);
  const rags = useMemo(
    () => allRags.filter((r) => r.orgId === currentUser?.orgId || r.sharedWithOrgIds?.includes(currentUser?.orgId ?? "")),
    [allRags, currentUser]
  );
  const bookings = useMemo(
    () => allBookings.filter((b) => b.orgId === currentUser?.orgId && !b.cancelled),
    [allBookings, currentUser]
  );

  const [title, setTitle] = useState("");
  const [withUserId, setWithUserId] = useState(users.find((u) => u.role === "employee")?.id ?? "");
  const [time, setTime] = useState("10:00");
  const [ragId, setRagId] = useState("");
  const [notes, setNotes] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());

  function toggleGoogleSync() {
    if (googleConnected) {
      setGoogleConnected(false);
      return;
    }
    setConnecting(true);
    window.setTimeout(() => {
      setConnecting(false);
      setGoogleConnected(true);
    }, 900);
  }

  const isOrg = isOrgLevel(currentUser);
  const visibleBookings = useMemo(
    () => (isOrg ? bookings : bookings.filter((b) => b.withUserId === currentUser?.id)),
    [isOrg, bookings, currentUser]
  );

  function ragName(id?: string) {
    return id ? rags.find((r) => r.id === id)?.name : undefined;
  }

  function userName(id?: string) {
    return id ? users.find((u) => u.id === id)?.name : undefined;
  }

  const bookingEntries: CalendarEntry[] = useMemo(
    () =>
      visibleBookings.map((b) => {
        const linkedRag = b.ragId ? rags.find((r) => r.id === b.ragId) : undefined;
        return {
          kind: "booking" as const,
          id: b.id,
          date: b.date,
          time: b.time,
          title: b.title,
          subtitle: `with ${users.find((u) => u.id === b.withUserId)?.name ?? "Unknown"}`,
          category: linkedRag?.category ?? "General",
          ragId: b.ragId,
          withUserId: b.withUserId,
          accessCode: b.accessCode,
          notes: b.notes,
          meetingLink: b.meetingLink,
        };
      }),
    [visibleBookings, rags, users]
  );

  const reviewEntries: CalendarEntry[] = useMemo(() => {
    const entries: CalendarEntry[] = [];
    rags.forEach((r) => {
      r.documents.forEach((d) => {
        if (!d.reviewDate) return;
        entries.push({
          kind: "review",
          id: `${r.id}:${d.id}`,
          date: d.reviewDate,
          time: "00:00",
          title: `Review due - ${d.name}`,
          subtitle: r.name,
          category: r.category,
          ragId: r.id,
          docId: d.id,
        });
      });
    });
    return entries;
  }, [rags]);

  const allEntries = useMemo(() => [...bookingEntries, ...reviewEntries], [bookingEntries, reviewEntries]);

  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    allEntries.forEach((e) => {
      map[e.date] = [...(map[e.date] ?? []), e];
    });
    return map;
  }, [allEntries]);

  const categories = useMemo(() => Array.from(new Set(rags.map((r) => r.category))).sort(), [rags]);

  const weeks = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const selectedIso = toIsoDate(selectedDate);
  const dayEntries = (entriesByDate[selectedIso] ?? []).sort((a, b) => a.time.localeCompare(b.time));

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const upcoming = useMemo(
    () =>
      allEntries
        .filter((e) => e.date >= todayIso)
        .filter((e) => (categoryFilter === "all" ? true : e.category === categoryFilter))
        .filter((e) => (search.trim() ? (e.title + " " + e.subtitle).toLowerCase().includes(search.trim().toLowerCase()) : true))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [allEntries, categoryFilter, search, todayIso]
  );

  const accessCode = ragAssignments.find((a) => a.ragId === ragId && a.userId === withUserId)?.accessCode;

  function submit() {
    if (!title.trim() || !withUserId) return;
    createBooking({
      title: title.trim(),
      withUserId,
      date: selectedIso,
      time,
      ragId: ragId || undefined,
      accessCode: ragId ? accessCode : undefined,
      notes: notes.trim() || undefined,
    });
    setOpen(false);
    setTitle("");
    setNotes("");
    setRagId("");
  }

  function toggleReviewSelected(id: string) {
    setSelectedReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markSelectedReviewed() {
    selectedReviewIds.forEach((key) => {
      const [rId, dId] = key.split(":");
      const doc = rags.find((r) => r.id === rId)?.documents.find((d) => d.id === dId);
      if (!doc?.reviewDate) return;
      updateRagDocumentMetadata(rId, dId, { reviewDate: addDaysIso(doc.reviewDate, REVIEW_PUSH_DAYS) });
    });
    setSelectedReviewIds(new Set());
  }

  function goToday() {
    const t = new Date();
    setSelectedDate(t);
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  }

  function goPrev() {
    if (viewMode === "day") setSelectedDate((d) => addDays(d, -1));
    else if (viewMode === "year") setCursor((c) => new Date(c.getFullYear() - 1, c.getMonth(), 1));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }

  function goNext() {
    if (viewMode === "day") setSelectedDate((d) => addDays(d, 1));
    else if (viewMode === "year") setCursor((c) => new Date(c.getFullYear() + 1, c.getMonth(), 1));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  function openPanel(entry: CalendarEntry) {
    setPanelKey(`${entry.kind}-${entry.id}`);
    setEditingPanel(false);
  }

  function closePanel() {
    setPanelKey(null);
    setEditingPanel(false);
  }

  const panelEntry = panelKey ? (allEntries.find((e) => `${e.kind}-${e.id}` === panelKey) ?? null) : null;

  function startEditPanel() {
    if (!panelEntry) return;
    setEditTitle(panelEntry.title);
    setEditDate(panelEntry.date);
    setEditTime(panelEntry.time);
    setEditNotes(panelEntry.notes ?? "");
    setEditingPanel(true);
  }

  function saveEditPanel() {
    if (!panelEntry || panelEntry.kind !== "booking") return;
    updateBooking(panelEntry.id, { title: editTitle.trim() || panelEntry.title, date: editDate, time: editTime, notes: editNotes.trim() || undefined });
    setEditingPanel(false);
  }

  function cancelPanelBooking() {
    if (!panelEntry || panelEntry.kind !== "booking") return;
    cancelBooking(panelEntry.id);
    closePanel();
  }

  const headerLabel =
    viewMode === "day"
      ? selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : viewMode === "year"
        ? String(cursor.getFullYear())
        : cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function EntryChip({ e }: { e: CalendarEntry }) {
    return (
      <button
        onClick={() => openPanel(e)}
        className="w-full text-left rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-brand hover:bg-indigo-50/40 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-800 truncate flex items-center gap-1.5">
            {e.kind === "review" && <FileClock size={11} className="text-amber-500 shrink-0" />}
            {e.title}
          </p>
          {e.kind === "booking" && <span className="text-[11px] text-slate-400 shrink-0">{e.time}</span>}
        </div>
      </button>
    );
  }

  return (
    <AppShell title="Calendar" subtitle={isOrg ? "Book time with your team, linked to a RAG and access code" : "Your upcoming bookings"}>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <button onClick={goPrev} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-sm font-semibold text-slate-800 min-w-40 text-center">{headerLabel}</h2>
              <button onClick={goNext} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <ChevronRight size={16} />
              </button>
              <Button size="sm" variant="outline" onClick={goToday}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs">
                {(["day", "month", "year"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                      viewMode === mode ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <Button size="sm" variant={googleConnected ? "outline" : "secondary"} onClick={toggleGoogleSync} disabled={connecting}>
                {googleConnected ? (
                  <>
                    <Check size={13} className="text-emerald-600" /> Synced
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} className={connecting ? "animate-spin" : ""} /> {connecting ? "Connecting..." : "Connect Google Calendar"}
                  </>
                )}
              </Button>
              {isOrg && (
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus size={14} /> New booking
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4 mb-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" /> Booking
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> RAG review due
              </span>
            </div>

            {viewMode === "month" && (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-slate-400 py-1.5">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weeks.flat().map((d, i) => {
                    if (!d) return <div key={i} className="aspect-square" />;
                    const iso = toIsoDate(d);
                    const items = entriesByDate[iso] ?? [];
                    const selected = isSameDay(d, selectedDate);
                    const isToday = isSameDay(d, today);
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(d)}
                        onDoubleClick={() => {
                          setSelectedDate(d);
                          setViewMode("day");
                        }}
                        className={`aspect-square rounded-lg p-1.5 flex flex-col items-start gap-1 border transition-colors ${
                          selected ? "border-brand bg-indigo-50/60" : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <span className={`text-xs font-medium ${isToday ? "bg-brand text-white rounded-full w-5 h-5 flex items-center justify-center" : "text-slate-600"}`}>
                          {d.getDate()}
                        </span>
                        <div className="flex flex-wrap gap-0.5">
                          {items.slice(0, 3).map((e) => (
                            <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${e.kind === "review" ? "bg-amber-500" : "bg-brand"}`} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {viewMode === "day" && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                {DAY_VIEW_HOURS.map((hour) => {
                  const hourEntries = dayEntries.filter((e) => e.kind === "booking" && Number(e.time.split(":")[0]) === hour);
                  return (
                    <div key={hour} className="flex gap-3 px-3 py-2 min-h-[3rem]">
                      <span className="text-xs text-slate-400 w-14 shrink-0 pt-0.5">{String(hour).padStart(2, "0")}:00</span>
                      <div className="flex-1 space-y-1.5">
                        {hourEntries.map((e) => (
                          <EntryChip key={e.id} e={e} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {dayEntries.filter((e) => e.kind === "review").length > 0 && (
                  <div className="flex gap-3 px-3 py-2 bg-amber-50/40">
                    <span className="text-xs text-amber-600 w-14 shrink-0 pt-0.5">All day</span>
                    <div className="flex-1 space-y-1.5">
                      {dayEntries
                        .filter((e) => e.kind === "review")
                        .map((e) => (
                          <EntryChip key={e.id} e={e} />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === "year" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {MONTH_NAMES.map((name, monthIndex) => {
                  const miniWeeks = monthMatrix(cursor.getFullYear(), monthIndex);
                  return (
                    <div key={name} className="border border-slate-100 rounded-lg p-2">
                      <button
                        onClick={() => {
                          setCursor(new Date(cursor.getFullYear(), monthIndex, 1));
                          setViewMode("month");
                        }}
                        className="text-xs font-semibold text-slate-700 hover:text-brand mb-1.5"
                      >
                        {name}
                      </button>
                      <div className="grid grid-cols-7 gap-[2px]">
                        {miniWeeks.flat().map((d, i) => {
                          if (!d) return <div key={i} className="aspect-square" />;
                          const iso = toIsoDate(d);
                          const hasItems = !!entriesByDate[iso]?.length;
                          const isToday = isSameDay(d, today);
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedDate(d);
                                setViewMode("day");
                              }}
                              className={`aspect-square rounded text-[9px] flex items-center justify-center relative ${
                                isToday ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {d.getDate()}
                              {hasItems && !isToday && <span className="absolute bottom-0 w-1 h-1 rounded-full bg-brand" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          {viewMode !== "day" && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-800">
                  {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
              </CardHeader>
              <div className="divide-y divide-slate-100">
                {dayEntries.map((e) => (
                  <button key={`${e.kind}-${e.id}`} onClick={() => openPanel(e)} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{e.title}</p>
                      {e.kind === "booking" ? (
                        <Badge tone="indigo">
                          <Clock size={11} /> {e.time}
                        </Badge>
                      ) : (
                        <Badge tone="amber">
                          <FileClock size={11} /> Review due
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{e.subtitle}</p>
                    {e.ragId && e.kind === "booking" && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                        <BrainCircuit size={12} /> {ragName(e.ragId)}
                        {e.accessCode && (
                          <span className="font-mono flex items-center gap-1 text-slate-400">
                            <Key size={11} /> {e.accessCode}
                          </span>
                        )}
                      </div>
                    )}
                    {e.notes && <p className="text-xs text-slate-400 mt-1.5">{e.notes}</p>}
                  </button>
                ))}
                {dayEntries.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">Nothing this day.</p>}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Upcoming</h2>
            </CardHeader>
            <div className="px-4 py-2.5 border-b border-slate-100 flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search upcoming..." className="text-xs pl-7 py-1.5" />
              </div>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="!w-auto text-xs py-1.5">
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            {selectedReviewIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border-b border-indigo-100">
                <span className="text-xs text-indigo-700">{selectedReviewIds.size} review{selectedReviewIds.size === 1 ? "" : "s"} selected</span>
                <Button size="sm" onClick={markSelectedReviewed}>
                  <Check size={12} /> Mark reviewed
                </Button>
              </div>
            )}
            <div className="divide-y divide-slate-100 max-h-[22.5rem] overflow-y-auto">
              {upcoming.map((e) => (
                <div key={`${e.kind}-${e.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50">
                  {e.kind === "review" ? (
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.has(e.id)}
                      onChange={() => toggleReviewSelected(e.id)}
                      className="w-3.5 h-3.5 rounded border-slate-300 shrink-0"
                    />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <button onClick={() => openPanel(e)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-slate-800 flex items-center gap-1.5 truncate">
                      {e.kind === "review" && <FileClock size={12} className="text-amber-500 shrink-0" />}
                      {e.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {e.date} {e.kind === "booking" ? `· ${e.time}` : ""} · {e.subtitle}
                    </p>
                  </button>
                </div>
              ))}
              {upcoming.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nothing matches.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`New booking - ${selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}>
        <FormRow label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fortnightly supervision" />
        </FormRow>
        <FormRow label="With">
          <Select value={withUserId} onChange={(e) => setWithUserId(e.target.value)}>
            {users
              .filter((u) => u.role === "employee")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
        </FormRow>
        <FormRow label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </FormRow>
        <FormRow label="Link a RAG (optional)">
          <Select value={ragId} onChange={(e) => setRagId(e.target.value)}>
            <option value="">None</option>
            {rags.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormRow>
        {ragId && (
          <p className="text-xs mb-4 -mt-2">
            {accessCode ? (
              <span className="text-emerald-600 font-mono">Access code: {accessCode}</span>
            ) : (
              <span className="text-amber-600">This person isn&apos;t assigned to that RAG yet - no access code will show.</span>
            )}
          </p>
        )}
        <FormRow label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormRow>
        <Button className="w-full" onClick={submit} disabled={!title.trim() || !withUserId}>
          Create booking
        </Button>
      </Modal>

      {panelEntry && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={closePanel} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl border-l border-slate-200 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarDays size={15} className="text-slate-400" /> {panelEntry.kind === "booking" ? "Booking details" : "Review due"}
              </h3>
              <button onClick={closePanel} className="text-slate-400 hover:text-slate-600 rounded-md p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {!editingPanel ? (
                <>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{panelEntry.title}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {new Date(panelEntry.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {panelEntry.kind === "booking" && ` · ${panelEntry.time}`}
                    </p>
                  </div>

                  {panelEntry.kind === "booking" && panelEntry.withUserId && (
                    <div className="text-sm text-slate-600">
                      With{" "}
                      <Link href={`/team/${panelEntry.withUserId}`} className="text-brand font-medium hover:underline">
                        {userName(panelEntry.withUserId)}
                      </Link>
                    </div>
                  )}

                  {panelEntry.ragId && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <BrainCircuit size={14} className="text-slate-400" /> {ragName(panelEntry.ragId)}
                      {panelEntry.accessCode && (
                        <span className="font-mono flex items-center gap-1 text-slate-400 text-xs">
                          <Key size={11} /> {panelEntry.accessCode}
                        </span>
                      )}
                    </div>
                  )}

                  {panelEntry.notes && <p className="text-sm text-slate-500 whitespace-pre-wrap">{panelEntry.notes}</p>}

                  {panelEntry.kind === "booking" && (
                    <div className="pt-2 space-y-2">
                      {panelEntry.meetingLink ? (
                        <a href={panelEntry.meetingLink} target="_blank" rel="noreferrer" className="block">
                          <Button className="w-full">
                            <Video size={14} /> Join meeting
                          </Button>
                        </a>
                      ) : (
                        <Button className="w-full" disabled title="No meeting link set for this booking">
                          <Video size={14} /> Join meeting
                        </Button>
                      )}
                      {isOrg && (
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={startEditPanel}>
                            <Pencil size={13} /> Edit / Reschedule
                          </Button>
                          <Button variant="outline" className="flex-1 text-red-600 hover:bg-red-50" onClick={cancelPanelBooking}>
                            <Ban size={13} /> Cancel booking
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {panelEntry.kind === "review" && panelEntry.ragId && (
                    <Link href={`/rag/${panelEntry.ragId}`} className="text-sm text-brand font-medium hover:underline">
                      Open this RAG&apos;s Knowledge tab to manage the document →
                    </Link>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <FormRow label="Title">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </FormRow>
                  <FormRow label="Date">
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </FormRow>
                  <FormRow label="Time">
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </FormRow>
                  <FormRow label="Notes">
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                  </FormRow>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={saveEditPanel}>
                      Save changes
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditingPanel(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

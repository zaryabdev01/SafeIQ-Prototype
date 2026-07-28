"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { monthMatrix, toIsoDate, isSameDay } from "@/lib/calendar";
import { ChevronLeft, ChevronRight, Plus, Clock, Key, BrainCircuit } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const { currentUser, users, rags, ragAssignments, bookings, createBooking } = useApp();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [withUserId, setWithUserId] = useState(users.find((u) => u.role === "employee")?.id ?? "");
  const [time, setTime] = useState("10:00");
  const [ragId, setRagId] = useState("");
  const [notes, setNotes] = useState("");

  const isOrg = currentUser?.role === "organisation";
  const visibleBookings = isOrg ? bookings : bookings.filter((b) => b.withUserId === currentUser?.id);

  const weeks = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const bookingsByDate = useMemo(() => {
    const map: Record<string, typeof bookings> = {};
    visibleBookings.forEach((b) => {
      map[b.date] = [...(map[b.date] ?? []), b];
    });
    return map;
  }, [visibleBookings]);

  const selectedIso = toIsoDate(selectedDate);
  const dayBookings = (bookingsByDate[selectedIso] ?? []).sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = [...visibleBookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).filter((b) => b.date >= toIsoDate(today));

  const accessCode = ragAssignments.find((a) => a.ragId === ragId && a.userId === withUserId)?.accessCode;

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }
  function ragName(id?: string) {
    return id ? rags.find((r) => r.id === id)?.name : undefined;
  }

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

  return (
    <AppShell title="Calendar" subtitle={isOrg ? "Book time with your team, linked to a RAG and access code" : "Your upcoming bookings"}>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-sm font-semibold text-slate-800 w-40 text-center">
                {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </h2>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <ChevronRight size={16} />
              </button>
            </div>
            {isOrg && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus size={14} /> New booking
              </Button>
            )}
          </CardHeader>
          <CardBody>
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
                const items = bookingsByDate[iso] ?? [];
                const selected = isSameDay(d, selectedDate);
                const isToday = isSameDay(d, today);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(d)}
                    className={`aspect-square rounded-lg p-1.5 flex flex-col items-start gap-1 border transition-colors ${
                      selected ? "border-brand bg-indigo-50/60" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "bg-brand text-white rounded-full w-5 h-5 flex items-center justify-center" : "text-slate-600"}`}>
                      {d.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {items.slice(0, 3).map((b) => (
                        <span key={b.id} className="w-1.5 h-1.5 rounded-full bg-brand" />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">
                {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {dayBookings.map((b) => (
                <div key={b.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{b.title}</p>
                    <Badge tone="indigo">
                      <Clock size={11} /> {b.time}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">with {userName(b.withUserId)}</p>
                  {b.ragId && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <BrainCircuit size={12} /> {ragName(b.ragId)}
                      {b.accessCode && (
                        <span className="font-mono flex items-center gap-1 text-slate-400">
                          <Key size={11} /> {b.accessCode}
                        </span>
                      )}
                    </div>
                  )}
                  {b.notes && <p className="text-xs text-slate-400 mt-1.5">{b.notes}</p>}
                </div>
              ))}
              {dayBookings.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">No bookings this day.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Upcoming</h2>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {upcoming.slice(0, 6).map((b) => (
                <button key={b.id} onClick={() => setSelectedDate(new Date(b.date))} className="w-full text-left px-5 py-3 hover:bg-slate-50">
                  <p className="text-sm text-slate-800">{b.title}</p>
                  <p className="text-xs text-slate-400">
                    {b.date} · {b.time} · {userName(b.withUserId)}
                  </p>
                </button>
              ))}
              {upcoming.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">Nothing upcoming.</p>}
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
    </AppShell>
  );
}

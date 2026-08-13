"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, GripHorizontal, MessagesSquare, BrainCircuit, ShieldAlert } from "lucide-react";
import { useApp } from "@/lib/store";
import { WidgetChatPanel } from "./WidgetChatPanel";
import { WidgetRagPanel } from "./WidgetRagPanel";
import { WidgetSafetyPanel } from "./WidgetSafetyPanel";

const BUBBLE = 60;
const PANEL_W = 352;
const PANEL_H = 528;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

type Tab = "chat" | "rag" | "safety";

export function FloatingWidget() {
  const { currentUser, dashboardAlerts } = useApp();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("rag");
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function place() {
      setPos((prev) => {
        const size = open ? { w: PANEL_W, h: PANEL_H } : { w: BUBBLE, h: BUBBLE };
        if (!prev) return { x: window.innerWidth - size.w - 24, y: window.innerHeight - size.h - 24 };
        return { x: clamp(prev.x, 8, window.innerWidth - size.w - 8), y: clamp(prev.y, 8, window.innerHeight - size.h - 8) };
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  if (!currentUser || !pos) return null;

  const size = open ? { w: PANEL_W, h: PANEL_H } : { w: BUBBLE, h: BUBBLE };
  const unread = currentUser.role === "organisation" ? dashboardAlerts.filter((a) => !a.read).length : 0;

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    offsetRef.current = { x: e.clientX - pos!.x, y: e.clientY - pos!.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    movedRef.current = true;
    const nx = e.clientX - offsetRef.current.x;
    const ny = e.clientY - offsetRef.current.y;
    setPos({ x: clamp(nx, 8, window.innerWidth - size.w - 8), y: clamp(ny, 8, window.innerHeight - size.h - 8) });
  }
  function onPointerUp() {
    draggingRef.current = false;
  }

  if (!open) {
    return (
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => !movedRef.current && setOpen(true)}
        style={{ left: pos.x, top: pos.y, width: BUBBLE, height: BUBBLE }}
        className="fixed z-[200] rounded-full bg-brand text-white shadow-xl shadow-indigo-900/30 flex items-center justify-center hover:bg-brand-dark active:scale-95 transition-transform touch-none"
        aria-label="Open SafeIQ AI agent"
      >
        <Bot size={24} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{ left: pos.x, top: pos.y, width: PANEL_W, height: PANEL_H }}
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 flex flex-col overflow-hidden animate-fade-in"
      data-testid="floating-widget-panel"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        data-testid="floating-widget-drag-handle"
        className="bg-slate-900 text-white px-3.5 py-3 flex items-center gap-2 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bot size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-none">SafeIQ Agent</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Always on top - drag to move</p>
        </div>
        <GripHorizontal size={14} className="text-slate-500 shrink-0" />
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1 shrink-0">
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="flex border-b border-slate-100 shrink-0">
        {(
          [
            { key: "rag" as Tab, label: "RAG", icon: BrainCircuit },
            { key: "chat" as Tab, label: "Chat", icon: MessagesSquare },
            { key: "safety" as Tab, label: "Safety", icon: ShieldAlert },
          ]
        ).map((t) => (
          <button
            key={t.key}
            data-testid={`widget-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" && <WidgetChatPanel />}
        {tab === "rag" && <WidgetRagPanel />}
        {tab === "safety" && <WidgetSafetyPanel />}
      </div>
    </div>
  );
}

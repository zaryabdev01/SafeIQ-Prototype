"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, GripHorizontal, MessagesSquare, BrainCircuit, ShieldAlert, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { WidgetChatPanel } from "./WidgetChatPanel";
import { WidgetRagPanel } from "./WidgetRagPanel";
import { WidgetSafetyPanel } from "./WidgetSafetyPanel";

const BUBBLE = 56;
const PANEL_W_DESKTOP = 352;
const PANEL_H_DESKTOP = 528;
const EDGE = 12;
const DRAG_THRESHOLD = 6;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function getPanelSize(open: boolean) {
  if (!open) return { w: BUBBLE, h: BUBBLE };
  const maxW = Math.min(PANEL_W_DESKTOP, window.innerWidth - EDGE * 2);
  const maxH = Math.min(PANEL_H_DESKTOP, window.innerHeight - EDGE * 2 - 16);
  return { w: maxW, h: maxH };
}

/** Distance from viewport bottom-right; stays fixed when toggling open/closed. */
type Anchor = { right: number; bottom: number };

function anchorToPos(anchor: Anchor, size: { w: number; h: number }): { x: number; y: number } {
  const x = window.innerWidth - anchor.right - size.w;
  const y = window.innerHeight - anchor.bottom - size.h;
  return {
    x: clamp(x, EDGE, window.innerWidth - size.w - EDGE),
    y: clamp(y, EDGE, window.innerHeight - size.h - EDGE),
  };
}

function posToAnchor(pos: { x: number; y: number }, size: { w: number; h: number }): Anchor {
  return {
    right: window.innerWidth - pos.x - size.w,
    bottom: window.innerHeight - pos.y - size.h,
  };
}

type Tab = "chat" | "rag" | "safety";

export function FloatingWidget() {
  const { currentUser, dashboardAlerts } = useApp();
  const [anchor, setAnchor] = useState<Anchor>({ right: EDGE, bottom: EDGE });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("rag");
  const [panelSize, setPanelSize] = useState({ w: BUBBLE, h: BUBBLE });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function syncLayout() {
      const size = getPanelSize(open);
      setPanelSize(size);
      setPos(anchorToPos(anchor, size));
    }
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, [open, anchor]);

  if (!currentUser || !pos) return null;

  const unread = currentUser.role === "organisation" ? dashboardAlerts.filter((a) => !a.read).length : 0;

  function updatePosition(nextPos: { x: number; y: number }) {
    const clamped = {
      x: clamp(nextPos.x, EDGE, window.innerWidth - panelSize.w - EDGE),
      y: clamp(nextPos.y, EDGE, window.innerHeight - panelSize.h - EDGE),
    };
    setPos(clamped);
    setAnchor(posToAnchor(clamped, panelSize));
  }

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    offsetRef.current = { x: e.clientX - pos!.x, y: e.clientY - pos!.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    updatePosition({
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasDragging = movedRef.current;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!open && !wasDragging) {
      setOpen(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-[200] cursor-pointer rounded-full bg-brand text-white shadow-xl shadow-brand/40 flex items-center justify-center hover:bg-brand-dark hover:scale-105 active:scale-95 transition-[transform,background-color,box-shadow] duration-200 touch-none safe-bottom"
        style={{
          left: pos.x,
          top: pos.y,
          width: BUBBLE,
          height: BUBBLE,
          marginBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Open SafeIQ AI agent"
      >
        <Bot size={24} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white animate-pulse-ring">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        left: pos.x,
        top: pos.y,
        width: panelSize.w,
        height: panelSize.h,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "calc(100vh - 24px)",
      }}
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl shadow-slate-900/25 border border-[var(--border-default)] flex flex-col overflow-hidden animate-modal-panel safe-bottom"
      data-testid="floating-widget-panel"
    >
      <div className="bg-[var(--shell-bg)] text-white px-3.5 py-3 flex items-center gap-2 shrink-0">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          data-testid="floating-widget-drag-handle"
          className="flex min-w-0 flex-1 items-center gap-2 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Bot size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--text-sm)] font-semibold leading-none">SafeIQ Agent</p>
            <p className="text-[11px] text-white/50 mt-0.5 hidden sm:block">Drag to move · always on top</p>
          </div>
          <GripHorizontal size={14} className="text-white/40 shrink-0 hidden sm:block" />
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 cursor-pointer rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex border-b border-[var(--border-soft)] shrink-0">
        {(
          [
            { key: "rag" as Tab, label: "RAG", icon: BrainCircuit },
            { key: "chat" as Tab, label: "Chat", icon: MessagesSquare },
            { key: "safety" as Tab, label: "Safety", icon: ShieldAlert },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`widget-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex cursor-pointer items-center justify-center gap-1.5 py-3 text-[var(--text-xs)] sm:text-[var(--text-sm)] font-semibold border-b-2 transition-colors ${
              tab === t.key ? "border-brand text-brand bg-[var(--brand-tint-2)]/40" : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-body)]"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden" onPointerDown={(e) => e.stopPropagation()}>
        {tab === "chat" && <WidgetChatPanel />}
        {tab === "rag" && <WidgetRagPanel />}
        {tab === "safety" && <WidgetSafetyPanel />}
      </div>
    </div>
  );
}

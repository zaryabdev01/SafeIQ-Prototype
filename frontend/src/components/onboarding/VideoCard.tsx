"use client";

import { Play, Clock, Share2, Pencil, UserPlus } from "lucide-react";

export type VideoCardTag = { label: string; tone: "grey" | "violet" };

export interface VideoCardAction {
  label: string;
  kind: "share" | "edit" | "assign";
  onClick: () => void;
}

const ACTION_ICON = { share: Share2, edit: Pencil, assign: UserPlus } as const;

/**
 * Onboarding / Help Hub video card from the production Figma (M3): 16:9
 * thumbnail with a status badge, centred play button and duration pill; title +
 * tag chips below; a dark hover overlay exposing the description and actions.
 */
export function VideoCard({
  title,
  description,
  thumbnailGradient,
  durationLabel,
  statusLabel,
  statusTone = "neutral",
  tags = [],
  onOpen,
  actions = [],
}: {
  title: string;
  description: string;
  thumbnailGradient: string;
  durationLabel?: string;
  statusLabel?: string;
  statusTone?: "recommended" | "next" | "new" | "required" | "neutral";
  tags?: VideoCardTag[];
  onOpen: () => void;
  actions?: VideoCardAction[];
}) {
  const statusClass =
    statusTone === "recommended"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : statusTone === "required"
        ? "bg-red-50 text-red-600"
        : statusTone === "next"
          ? "bg-amber-50 text-amber-700"
          : statusTone === "new"
            ? "bg-[var(--brand-tint-2)] text-brand"
            : "bg-white/90 text-[var(--text-body)]";

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-soft)] bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(73,46,161,0.10)]"
      onClick={onOpen}
    >
      <div className={`relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br ${thumbnailGradient}`}>
        {statusLabel && (
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
        )}
        <span className="flex size-12 items-center justify-center rounded-full bg-white/25 backdrop-blur transition-transform group-hover:scale-110">
          <Play size={18} className="ml-0.5 fill-white text-white" />
        </span>
        {durationLabel && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Clock size={9} /> {durationLabel}
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="truncate text-[14px] font-bold text-[var(--text-strong)]">{title}</p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tags.map((t, i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  t.tone === "violet" ? "bg-[var(--brand-tint-2)] text-brand" : "bg-slate-100 text-slate-500"
                }`}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col justify-between bg-[#1a1038]/90 p-4 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <div>
          <p className="mb-1.5 text-sm font-semibold">{title}</p>
          <p className="line-clamp-4 text-xs text-white/75">{description}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {actions.map((a) => {
              const Icon = ACTION_ICON[a.kind];
              return (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={`flex items-center gap-1.5 rounded-[var(--r-control)] px-2.5 py-1.5 text-xs font-semibold ${
                    a.kind === "share" ? "bg-brand text-white hover:bg-brand-dark" : "bg-white/15 hover:bg-white/25"
                  }`}
                >
                  <Icon size={12} /> {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

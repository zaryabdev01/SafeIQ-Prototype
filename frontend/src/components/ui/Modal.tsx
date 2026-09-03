"use client";

import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const emptySubscribe = () => () => {};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
  description?: string;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = "max-w-lg",
  description,
  footer,
}: ModalProps) {
  // Client-only: portals need document.body (SSR-safe via getServerSnapshot)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[250] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-modal-backdrop"
          onClick={onClose}
          aria-hidden
        />
        <div
          className={`relative z-10 w-full ${widthClass} flex max-h-[min(calc(100vh-2rem),880px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-2xl shadow-slate-900/25 animate-modal-panel`}
        >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border-soft)] bg-gradient-to-b from-[var(--brand-tint-2)]/50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 id="modal-title" className="text-[var(--text-lg)] font-bold tracking-tight text-[var(--text-strong)]">
                {title}
              </h3>
              {description && (
                <p className="mt-1 text-[var(--text-sm)] text-[var(--text-soft)]">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] text-[var(--text-soft)] transition-colors hover:bg-[var(--brand-tint-2)] hover:text-[var(--text-body)]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-[var(--text-sm)] text-[var(--text-body)]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--surface-warm)]/80 px-6 py-4">
            {footer}
          </div>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

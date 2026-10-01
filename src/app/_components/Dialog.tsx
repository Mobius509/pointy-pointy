"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A real dialog (no browser pop-ups — those don't show in every app).
// Portalled to <body> so panels with backdrop-blur can't trap it; a bottom
// sheet on phones, a centered card on bigger screens. Escape or tapping the
// backdrop closes it.
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first button (the safe choice in a confirm).
    panel.current?.querySelector<HTMLElement>("[data-autofocus], button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panel} className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-pp-primary-strong">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 shrink-0 rounded-full grid place-items-center text-pp-muted hover:bg-pp-soft"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// "Are you sure?" with Cancel / confirm buttons.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      {message && <div className="mt-2 text-sm text-pp-muted">{message}</div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" data-autofocus onClick={onCancel} className="btn-secondary btn-lg">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`${danger ? "btn-danger" : "btn-primary"} btn-lg`}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/_components/Dialog";
import { deleteStreakAction } from "../_actions/streaks";

export function DeleteStreakButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-rose-600 hover:underline">
        Delete streak
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete "${name}"?`}
        message="Rewards already earned stay, but this streak stops counting."
        confirmLabel="Delete streak"
        danger
        pending={pending}
        onConfirm={() =>
          start(async () => {
            await deleteStreakAction(slug, id);
            setOpen(false);
          })
        }
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

"use client";

import { useRef, useTransition } from "react";
import { approveAllCompletionsAction } from "../_actions/approvals";

// "Approve all (N)" for one kid's To Approve list. Suggestions are approved
// with whatever points are typed in their boxes (inputs marked
// data-proposal-points in the same list).
export function ApproveAllButton({ slug, kidId, count }: { slug: string; kidId: string; count: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  const approveAll = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("slug", slug);
      fd.set("kidProfileId", kidId);
      const list = ref.current?.closest("[data-approvals]");
      list?.querySelectorAll<HTMLInputElement>("input[data-proposal-points]").forEach((input) => {
        fd.set(`proposal_points:${input.dataset.proposalPoints}`, input.value || "0");
      });
      await approveAllCompletionsAction(fd);
    });
  return (
    <button
      ref={ref}
      type="button"
      onClick={approveAll}
      disabled={pending}
      className="rounded-full bg-pp-primary text-white font-semibold px-4 py-1 text-[12px] transition hover:bg-pp-primary-strong active:scale-[0.99] disabled:opacity-50"
    >
      {pending ? "Approving…" : `Approve all (${count})`}
    </button>
  );
}

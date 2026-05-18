"use client";

import { useState, useTransition } from "react";
import {
  createInviteAction,
  deleteInviteAction,
} from "../_actions/invites";
import type { HouseholdMemberRow, PendingInvite } from "@/lib/v2/members";

export function CoParentManager({
  slug,
  members,
  invites,
}: {
  slug: string;
  members: HouseholdMemberRow[];
  invites: PendingInvite[];
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  const inviteUrl = (code: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/v2/sign-up?invite=${code}`
      : `/v2/sign-up?invite=${code}`;

  const onCreate = (fd: FormData) => {
    setError(null);
    setGenerated(null);
    startTransition(async () => {
      const res = await createInviteAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGenerated(res.code);
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked — user can long-press to copy
    }
  };

  const generatedUrl = generated ? inviteUrl(generated) : null;

  return (
    <section className="card-warm">
      <span className="inline-block rounded-full bg-[#F9EBE3] text-[#D45B00] px-4 py-1 text-[14px] font-semibold">
        Co-parents
      </span>
      <p className="text-[#C3A38A] mt-2">
        Anyone who joins via your invite link can manage the family with you.
      </p>

      {members.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="py-2 flex items-center justify-between gap-3"
            >
              <span>
                <span className="font-semibold text-slate-800">
                  {m.email ?? "(no email)"}
                </span>
                <span className="ml-2 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">
                  parent
                </span>
              </span>
              <span className="text-xs text-[#C3A38A]">
                Joined {new Date(m.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={onCreate} className="mt-4">
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          className="btn-warm-primary"
          disabled={pending}
        >
          {pending ? "Generating…" : "Invite a co-parent"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {generatedUrl && (
        <div className="mt-3 rounded-2xl bg-[#F9EBE3] ring-1 ring-[#F1D1BD] p-3">
          <p className="text-sm font-semibold text-[#D45B00]">
            New invite link
          </p>
          <p className="text-xs text-[#C3A38A] mt-1">
            Send this URL to your co-parent. It works for 14 days and can only
            be used once.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-xs bg-white rounded-lg ring-1 ring-[#F1D1BD] px-2 py-1 text-slate-700">
              {generatedUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(generatedUrl)}
              className="btn-warm-secondary text-xs px-3 py-1"
            >
              {copied === generatedUrl ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[12px] font-semibold text-[#C3A38A] uppercase tracking-wide">
            Pending invites
          </h3>
          <ul className="mt-2 space-y-2">
            {invites.map((inv) => {
              const url = inviteUrl(inv.code);
              return (
                <li
                  key={inv.id}
                  className="rounded-2xl bg-white ring-1 ring-[#F1D1BD] p-2 flex flex-wrap items-center gap-2"
                >
                  <code className="flex-1 min-w-0 truncate text-xs text-slate-700">
                    {url}
                  </code>
                  <span className="text-xs text-[#C3A38A]">
                    expires {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(url)}
                    className="text-xs font-semibold text-[#D45B00] hover:underline"
                  >
                    {copied === url ? "Copied!" : "Copy"}
                  </button>
                  <form action={deleteInviteAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={inv.id} />
                    <button
                      type="submit"
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

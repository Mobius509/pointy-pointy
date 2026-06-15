/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useTransition } from "react";
import { avatarSrc } from "@/lib/avatar";
import type { KidProfile } from "@/lib/v2/data";
import { kidSignInAction } from "../_actions/kid-session";

// Two-step kid sign-in. Step 1: pick avatar/name. Step 2: enter PIN.
// Keeping this client-side so we can show the picker without a server round-trip.
//
// When the household has exactly one kid, step 1 is skipped — we auto-pick
// them and go straight to the PIN. The "Not me" link in step 2 is also
// suppressed in that case since there's no one else to switch to.
export function KidPicker({
  slug,
  kids,
}: {
  slug: string;
  kids: KidProfile[];
}) {
  const soleKid = kids.length === 1 ? kids[0] : null;
  const [picked, setPicked] = useState<KidProfile | null>(soleKid);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!picked) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kids.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              setError(null);
              setPicked(k);
            }}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-brand-300 active:scale-[0.98] transition p-5"
          >
            <img
              src={avatarSrc(k.avatar_emoji)}
              alt=""
              aria-hidden
              className="w-20 h-20 object-contain"
            />
            <span className="font-bold text-slate-800">{k.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await kidSignInAction(fd);
          if (!res.ok) setError(res.error);
        })
      }
      className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 max-w-sm mx-auto"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kid_profile_id" value={picked.id} />

      <div className="flex items-center gap-3 mb-4">
        <img
          src={avatarSrc(picked.avatar_emoji)}
          alt=""
          aria-hidden
          className="w-14 h-14 object-contain"
        />
        <div>
          <div className="font-bold text-xl text-slate-800">{picked.name}</div>
          {kids.length > 1 && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-slate-500 hover:underline"
            >
              Not me — pick someone else
            </button>
          )}
        </div>
      </div>

      <label className="label" htmlFor="kid-pin">
        Enter your PIN
      </label>
      <input
        id="kid-pin"
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        minLength={4}
        maxLength={8}
        required
        autoFocus
        className="input text-center text-2xl tracking-[0.4em]"
        placeholder="••••"
      />

      {error && (
        <p className="text-sm text-rose-600 mt-2" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full mt-3" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}

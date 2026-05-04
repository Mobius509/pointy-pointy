"use client";

import { useState, useTransition } from "react";
import { changePinAction } from "../_actions/settings";

export function ChangePinForm() {
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await changePinAction(fd);
          if (res.ok) setMsg({ kind: "ok", text: "PIN updated." });
          else setMsg({ kind: "err", text: res.error });
        })
      }
      className="grid gap-3 sm:grid-cols-3"
    >
      <div>
        <label className="label">Current PIN</label>
        <input
          name="current"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={4}
          maxLength={8}
          required
          className="input"
        />
      </div>
      <div>
        <label className="label">New PIN</label>
        <input
          name="next"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={4}
          maxLength={8}
          required
          className="input"
        />
      </div>
      <div>
        <label className="label">Confirm</label>
        <input
          name="confirm"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={4}
          maxLength={8}
          required
          className="input"
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Change PIN"}
        </button>
        {msg && (
          <span
            className={`text-sm ${
              msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

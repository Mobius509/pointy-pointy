"use client";

import { useState, useTransition } from "react";
import { setupPinAction, unlockAction } from "../_actions/auth";

export function PinSetup() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card max-w-sm mx-auto mt-8">
      <h2 className="text-xl font-bold text-slate-800">Set up parent PIN</h2>
      <p className="text-sm text-slate-600 mt-1">
        Choose a 4–8 digit PIN. You&apos;ll need it to manage tasks, award
        bonuses, and undo entries.
      </p>
      <form
        action={(fd) =>
          start(async () => {
            const res = await setupPinAction(fd);
            if (!res.ok) setError(res.error);
          })
        }
        className="mt-4 space-y-3"
      >
        <div>
          <label className="label" htmlFor="pin">
            New PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            required
            autoFocus
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            Confirm PIN
          </label>
          <input
            id="confirm"
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
        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving…" : "Save PIN"}
        </button>
      </form>
    </div>
  );
}

export function PinUnlock() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card max-w-sm mx-auto mt-8">
      <h2 className="text-xl font-bold text-slate-800">Parent PIN</h2>
      <p className="text-sm text-slate-600 mt-1">
        Enter your PIN to manage tasks and points.
      </p>
      <form
        action={(fd) =>
          start(async () => {
            const res = await unlockAction(fd);
            if (!res.ok) setError(res.error);
          })
        }
        className="mt-4 space-y-3"
      >
        <input
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
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { signInAction } from "./_actions";

export function SignInForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await signInAction(fd);
          if (!res.ok) setError(res.error);
        })
      }
      className="mt-4 space-y-3"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="si-email">
          Email
        </label>
        <input
          id="si-email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="si-password">
          Password
        </label>
        <input
          id="si-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>
      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

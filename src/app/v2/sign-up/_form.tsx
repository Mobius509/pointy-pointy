"use client";

import { useState, useTransition } from "react";
import { signUpAction } from "./_actions";

export function SignUpForm({
  inviteCode = "",
  showHouseholdName = true,
}: {
  inviteCode?: string;
  showHouseholdName?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await signUpAction(fd);
          if (!res.ok) setError(res.error);
        })
      }
      className="mt-4 space-y-3"
    >
      <input type="hidden" name="invite" value={inviteCode} />
      {showHouseholdName && (
        <div>
          <label className="label" htmlFor="su-name">
            Family name
          </label>
          <input
            id="su-name"
            name="household_name"
            required
            autoFocus
            maxLength={80}
            placeholder="Steenburgs"
            className="input"
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="su-email">
          Email
        </label>
        <input
          id="su-email"
          name="email"
          type="email"
          required
          autoFocus={!showHouseholdName}
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="su-password">
          Password
        </label>
        <input
          id="su-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-cyan w-full" disabled={pending}>
        {pending
          ? "Creating…"
          : showHouseholdName
            ? "Create family"
            : "Join family"}
      </button>
    </form>
  );
}

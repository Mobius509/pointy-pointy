"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signInAction } from "@/app/sign-in/_actions";
import { signUpAction } from "@/app/sign-up/_actions";

type Mode = "signin" | "signup" | null;

// Wraps the welcome page's interactive auth surface: top-right header links,
// the bottom auth-card buttons, and the modal itself. State lives here so
// every entry point opens the same dialog.
export function AuthModalControls() {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mode]);

  return (
    <>
      <HeaderLinks open={(m) => setMode(m)} />
      <BottomCard open={(m) => setMode(m)} />

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMode(null);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl ring-1 ring-slate-200 p-6 max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-extrabold text-orange-700">
                {mode === "signin" ? "Welcome back" : "Create your family"}
              </h2>
              <button
                type="button"
                onClick={() => setMode(null)}
                aria-label="Close"
                className="size-8 rounded-full grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {mode === "signin" ? <SignInBody /> : <SignUpBody />}

            <p className="text-sm text-slate-600 mt-4 text-center">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-orange-700 hover:underline"
                  >
                    Create a family
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-semibold text-orange-700 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Header links (top-right of welcome page)
// ============================================================================
function HeaderLinks({ open }: { open: (m: Mode) => void }) {
  return (
    <nav
      className="fixed top-0 right-0 z-30 px-[36px] py-5 flex items-center gap-5 text-sm text-orange-800 font-semibold"
      // Pin to viewport corner so it sits over the welcome page's existing header.
    >
      <button
        type="button"
        onClick={() => open("signin")}
        className="underline underline-offset-4 hover:text-orange-900"
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => open("signup")}
        className="underline underline-offset-4 hover:text-orange-900"
      >
        Sign Up
      </button>
    </nav>
  );
}

// ============================================================================
// Bottom auth card (the frosted panel at the bottom of the welcome page)
// ============================================================================
function BottomCard({ open }: { open: (m: Mode) => void }) {
  return (
    <div
      id="signin"
      className="fixed bottom-0 inset-x-0 z-30 flex justify-center"
    >
      <div
        className="w-full max-w-2xl bg-white/60 backdrop-blur-md pt-20 pb-[60px] px-6 sm:px-[100px]"
        style={{ borderTopLeftRadius: 58, borderTopRightRadius: 58 }}
      >
        <button
          type="button"
          onClick={() => open("signin")}
          className="block mx-auto w-[280px] rounded-full bg-cyan-200 hover:bg-cyan-300 active:scale-[0.99] transition text-cyan-950 font-bold py-3 text-base text-center"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => open("signup")}
          className="mt-3 block mx-auto w-[280px] rounded-full bg-cyan-200 hover:bg-cyan-300 active:scale-[0.99] transition text-cyan-950 font-bold py-3 text-base text-center"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Form bodies (inline so they share the modal layout consistently)
// ============================================================================
function SignInBody() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await signInAction(fd);
          if (!res.ok) setError(res.error);
        })
      }
      className="space-y-3"
    >
      <p className="text-sm text-slate-700">
        Sign in to manage your family&apos;s tasks and points.
      </p>
      <div>
        <label className="label" htmlFor="modal-si-email">
          Email
        </label>
        <input
          id="modal-si-email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="modal-si-password">
          Password
        </label>
        <input
          id="modal-si-password"
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
      <button type="submit" className="btn-cyan w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function SignUpBody() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await signUpAction(fd);
          if (!res.ok) setError(res.error);
        })
      }
      className="space-y-3"
    >
      <p className="text-sm text-slate-700">
        You&apos;ll be the parent admin. You can add kids and set up tasks
        next.
      </p>
      <div>
        <label className="label" htmlFor="modal-su-name">
          Family name
        </label>
        <input
          id="modal-su-name"
          name="household_name"
          required
          autoFocus
          maxLength={80}
          placeholder="Steenburgs"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="modal-su-email">
          Email
        </label>
        <input
          id="modal-su-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="modal-su-password">
          Password
        </label>
        <input
          id="modal-su-password"
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
        {pending ? "Creating…" : "Create family"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        By signing up you agree to be the parent admin of your family.
      </p>
      {/* Fallback for users who'd rather have a full-page form. */}
      <p className="text-xs text-slate-500 text-center">
        <Link
          href="/sign-up"
          className="hover:underline"
        >
          Open full sign-up page
        </Link>
      </p>
    </form>
  );
}

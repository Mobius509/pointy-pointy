"use client";

import { useEffect, useState, useTransition } from "react";
import {
  registerWebPushAction,
  unregisterWebPushAction,
} from "@/app/_actions/push";

type State = "loading" | "unsupported" | "blocked" | "off" | "on";

// Decode the VAPID public key (URL-safe base64) into the Uint8Array that
// PushManager.subscribe expects.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Tiny widget: shows whether push notifications are on for this device,
// and toggles them on/off. Caller picks the role (parent or kid) so the
// server knows which kind of event to push to this device.
export function PushToggle({
  slug,
  role,
  label = "Notify me",
}: {
  slug: string;
  role: "parent" | "kid";
  label?: string;
}) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch (e) {
        console.error("[push] sw register failed", e);
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    setError(null);
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setError("Push not configured (missing VAPID key).");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast to BufferSource — TS narrows Uint8Array<ArrayBufferLike> too
          // strictly for the PushManager type.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        const res = await registerWebPushAction(
          slug,
          role,
          JSON.stringify(sub),
          navigator.userAgent,
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setState("on");
      } catch (e) {
        console.error(e);
        setError("Couldn't enable notifications.");
      }
    });
  };

  const disable = () => {
    setError(null);
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await unregisterWebPushAction(slug, role, endpoint);
        }
        setState("off");
      } catch (e) {
        console.error(e);
        setError("Couldn't turn off notifications.");
      }
    });
  };

  if (state === "loading") return null;
  if (state === "unsupported") {
    return (
      <p className="text-xs text-pp-muted">
        This browser can&apos;t get notifications. On iPhone, add Pointy Points
        to your home screen and open it from there.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="text-xs text-pp-muted">
        Notifications are blocked. Enable them in your browser settings.
      </p>
    );
  }

  return (
    <div className="text-sm flex items-center gap-3">
      <button
        type="button"
        onClick={state === "on" ? disable : enable}
        disabled={pending}
        className={state === "on" ? "btn-secondary" : "btn-primary"}
      >
        {state === "on" ? "🔔 Notifications on — turn off" : `🔔 ${label}`}
      </button>
      {error && <span className="text-rose-600 text-xs">{error}</span>}
    </div>
  );
}

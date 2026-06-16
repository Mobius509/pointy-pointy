"use client";

import { useEffect, useState, useTransition } from "react";
import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
} from "@/app/_actions/push";
import { AvatarPicker } from "../../_components/AvatarPicker";
import { updateKidAvatarAction } from "../../_actions/kid-settings";

type NotifState = "loading" | "unsupported" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function KidSettingsPanel({
  slug,
  initialAvatar,
}: {
  slug: string;
  initialAvatar: string;
}) {
  // ---- Avatar selection ----------------------------------------------------
  const [avatarMsg, setAvatarMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [avatarPending, startAvatar] = useTransition();

  const onAvatarChange = (next: string) => {
    setAvatarMsg(null);
    startAvatar(async () => {
      const res = await updateKidAvatarAction(slug, next);
      if (res.ok) setAvatarMsg({ kind: "ok", text: "Saved!" });
      else setAvatarMsg({ kind: "err", text: res.error });
    });
  };

  // ---- Notifications -------------------------------------------------------
  const [notifState, setNotifState] = useState<NotifState>("loading");
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifPending, startNotif] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setNotifState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setNotifState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setNotifState(sub ? "on" : "off");
      } catch (e) {
        console.error("[push] sw register failed", e);
        if (!cancelled) setNotifState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enableNotifs = () => {
    setNotifError(null);
    startNotif(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotifState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setNotifError("Push not configured (missing VAPID key).");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        const res = await registerPushSubscriptionAction(
          "kid",
          JSON.stringify(sub),
          navigator.userAgent,
        );
        if (!res.ok) {
          setNotifError(res.error);
          return;
        }
        setNotifState("on");
      } catch (e) {
        console.error(e);
        setNotifError("Couldn't enable notifications.");
      }
    });
  };

  const disableNotifs = () => {
    setNotifError(null);
    startNotif(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await unregisterPushSubscriptionAction(endpoint);
        }
        setNotifState("off");
      } catch (e) {
        console.error(e);
        setNotifError("Couldn't turn off notifications.");
      }
    });
  };

  return (
    <section className="bg-white rounded-[32px] p-6 sm:p-8 shadow-lg">
      {/* Avatar */}
      <h2
        className="text-[#F2662A] leading-tight"
        style={{ fontSize: 21, fontWeight: 500 }}
      >
        Select avatar
      </h2>

      <div className="mt-4">
        <AvatarPicker
          defaultValue={initialAvatar}
          onChange={onAvatarChange}
          bleed
        />
        <div className="mt-2 min-h-[18px] text-xs">
          {avatarPending && <span className="text-[#C3A38A]">Saving…</span>}
          {!avatarPending && avatarMsg?.kind === "ok" && (
            <span className="text-emerald-700">{avatarMsg.text}</span>
          )}
          {!avatarPending && avatarMsg?.kind === "err" && (
            <span className="text-rose-600">{avatarMsg.text}</span>
          )}
        </div>
      </div>

      <div className="h-px bg-[#F1D1BD]/70 my-6" />

      {/* Notifications */}
      <h2
        className="text-[#F2662A] leading-tight"
        style={{ fontSize: 21, fontWeight: 500 }}
      >
        Turn On Notifications
      </h2>
      <p className="mt-2 text-[#F2662A] text-[12px] font-medium leading-snug">
        To turn on notifications you need to add Pointy Points to your home
        screen as an app.
      </p>

      <div className="mt-4">
        {notifState === "loading" && (
          <p className="text-xs text-[#C3A38A]">Checking…</p>
        )}
        {notifState === "unsupported" && (
          <p className="text-xs text-[#C3A38A]">
            Notifications aren&apos;t supported on this device yet.
          </p>
        )}
        {notifState === "blocked" && (
          <p className="text-xs text-[#C3A38A]">
            Notifications are blocked. Enable them in your browser settings.
          </p>
        )}
        {(notifState === "on" || notifState === "off") && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F9EBE3] p-1">
            <button
              type="button"
              onClick={enableNotifs}
              disabled={notifPending || notifState === "on"}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold transition ${
                notifState === "on"
                  ? "bg-[#D1FAE5] text-[#065F46]"
                  : "text-[#F2662A] hover:bg-white"
              }`}
            >
              {notifState === "on" && (
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center size-4 rounded-full bg-[#10B981] text-white"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="size-2.5">
                    <path
                      d="M5 10l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              On
            </button>
            <button
              type="button"
              onClick={disableNotifs}
              disabled={notifPending || notifState === "off"}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold transition ${
                notifState === "off"
                  ? "bg-white text-[#F2662A] ring-1 ring-[#F1D1BD]"
                  : "text-[#F2662A] hover:bg-white"
              }`}
            >
              Off
            </button>
          </div>
        )}
        {notifError && (
          <p className="mt-2 text-xs text-rose-600">{notifError}</p>
        )}
      </div>
    </section>
  );
}

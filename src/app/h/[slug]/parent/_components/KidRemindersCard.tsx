"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { avatarSrc } from "@/lib/avatar";
import { REMINDER_TIMES } from "@/lib/reminder-times";
import {
  sendTestReminderAction,
  setKidReminderByParentAction,
} from "../_actions/reminders";
import { SectionPill } from "./ui";

type Kid = {
  id: string;
  name: string;
  avatar_emoji: string;
  reminderTime: string | null;
};

// Parent Settings → Reminders: pick each kid's daily "log your points"
// time and fire a test on demand.
export function KidRemindersCard({ slug, kids }: { slug: string; kids: Kid[] }) {
  if (kids.length === 0) return null;

  return (
    <section className="card">
      <SectionPill>Reminders</SectionPill>
      <p className="text-pp-muted mt-2">
        Send a daily nudge to log points — only if there are still tasks left
        that day. Your kid needs notifications turned on in their Settings.
      </p>
      <ul className="mt-4 divide-y divide-pp-soft">
        {kids.map((kid) => (
          <KidReminderRow key={kid.id} slug={slug} kid={kid} />
        ))}
      </ul>
    </section>
  );
}

function KidReminderRow({ slug, kid }: { slug: string; kid: Kid }) {
  const [time, setTime] = useState(kid.reminderTime);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (next: string | null) => {
    const previous = time;
    setTime(next);
    setMsg(null);
    start(async () => {
      const res = await setKidReminderByParentAction(slug, kid.id, next);
      if (res.ok) setMsg({ kind: "ok", text: next ? "Saved." : "Reminder off." });
      else {
        setTime(previous);
        setMsg({ kind: "err", text: res.error });
      }
    });
  };

  const sendTest = () => {
    setMsg(null);
    start(async () => {
      const res = await sendTestReminderAction(slug, kid.id);
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      if (res.devices === 0) {
        return setMsg({
          kind: "err",
          text: `${kid.name} hasn't turned on notifications on any device yet.`,
        });
      }
      setMsg(
        res.delivered > 0
          ? { kind: "ok", text: `Sent to ${res.delivered} of ${res.devices} device${res.devices === 1 ? "" : "s"}.` }
          : { kind: "err", text: "Couldn't deliver to any device. Try turning notifications off and on again." },
      );
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <img src={avatarSrc(kid.avatar_emoji)} alt="" aria-hidden className="size-9 object-contain" />
      <span className="font-semibold text-pp-primary-strong min-w-[5rem]">{kid.name}</span>

      <select
        aria-label={`Reminder time for ${kid.name}`}
        value={time ?? ""}
        disabled={pending}
        onChange={(e) => save(e.target.value || null)}
        className="input w-auto"
      >
        <option value="">Off</option>
        {REMINDER_TIMES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <button type="button" onClick={sendTest} disabled={pending} className="btn-secondary">
        Send test reminder
      </button>

      <span className="basis-full text-xs min-h-[16px]">
        {pending && <span className="text-pp-muted">Working…</span>}
        {!pending && msg?.kind === "ok" && <span className="text-emerald-700">{msg.text}</span>}
        {!pending && msg?.kind === "err" && <span className="text-rose-600">{msg.text}</span>}
      </span>
    </li>
  );
}

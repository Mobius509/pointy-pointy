"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { kidPalette, kidThemeVars } from "@/lib/kid-palette";
import { updateKidHueAction } from "../../../_actions/kid-settings";

// "My color": slide through the rainbow. The whole kid app (and the avatar)
// recolors as you slide; it's saved when you let go — on the kid's profile,
// so their iPhone matches.
const STOPS = Array.from({ length: 13 }, (_, i) => i * 30);

export function ColorSlider({ slug, initialHue }: { slug: string; initialHue: number }) {
  const router = useRouter();
  const [hue, setHue] = useState(initialHue);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const saved = useRef(initialHue);

  const preview = (h: number) => {
    setHue(h);
    const vars = kidThemeVars(h);
    const targets = [document.documentElement, document.querySelector<HTMLElement>("[data-kid-chrome]")];
    for (const el of targets) if (el) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  };
  const save = () => {
    if (hue === saved.current) return;
    setMsg(null);
    start(async () => {
      const res = await updateKidHueAction(slug, hue);
      if (res.ok) {
        saved.current = hue;
        setMsg({ kind: "ok", text: "Saved!" });
        router.refresh();
      } else {
        preview(saved.current); // didn't save: back to their color
        setMsg({ kind: "err", text: "Couldn't save your color — try again in a bit." });
      }
    });
  };

  const track = `linear-gradient(90deg, ${STOPS.map((h) => kidPalette(h).strong).join(", ")})`;
  return (
    <section className="rounded-[32px] bg-white p-6">
      <h2 className="text-[20px] font-medium text-kid-text">My color</h2>
      <p className="mt-1 text-[14px] text-kid-text">Slide to pick your color. Everything changes to match!</p>
      <input
        type="range"
        min={0}
        max={359}
        step={1}
        value={hue}
        aria-label="My color"
        onChange={(e) => preview(Number(e.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        onBlur={save}
        className="kid-hue-slider mt-5 w-full"
        style={{ background: track }}
      />
      <p className={`mt-3 min-h-5 text-[13px] ${msg?.kind === "err" ? "text-rose-600" : "text-kid-text"}`} aria-live="polite">
        {pending ? "Saving…" : msg?.text}
      </p>
    </section>
  );
}

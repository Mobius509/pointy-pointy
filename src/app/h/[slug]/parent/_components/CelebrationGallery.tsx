"use client";

import { useState } from "react";
import { CELEBRATIONS, playCelebration } from "@/app/_components/celebrations";
import { CelebrationScreen } from "@/app/_components/CelebrationScreen";
import { avatarSrc } from "@/lib/avatar";
import { SectionPill } from "./ui";

type Kid = { id: string; name: string; avatar_emoji: string };

const SAMPLE_ITEMS = [
  { id: "s1", name: "Make lunch", points: 5, isBonus: false },
  { id: "s2", name: "Practice piano", points: 5, isBonus: false },
  { id: "s3", name: "Helped with groceries", points: 15, isBonus: true },
];

// Parent Settings → Celebrations: preview every effect the kid view can
// play when points are approved, plus the full "points approved" screen.
export function CelebrationGallery({ kids }: { kids: Kid[] }) {
  const [kidId, setKidId] = useState(kids[0]?.id);
  // Which effect the preview screen should force ("" = random).
  const [preview, setPreview] = useState<string | null>(null);

  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const src = avatarSrc(kid?.avatar_emoji);

  return (
    <section className="card">
      <SectionPill>Celebrations</SectionPill>
      <p className="text-pp-muted mt-2">
        When points get approved, your kid sees one of these at random the next
        time they open Pointy Points.
      </p>

      {kids.length > 1 && (
        <label className="mt-4 block max-w-xs">
          <span className="label">Preview with</span>
          <select className="input" value={kidId} onChange={(e) => setKidId(e.target.value)}>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CELEBRATIONS.map((c) => (
          <li key={c.id} className="rounded-2xl bg-pp-soft p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-pp-primary-strong">{c.name}</p>
              <p className="text-xs text-pp-muted mt-0.5">{c.description}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void playCelebration({ avatarSrc: src }, c.id)}
              >
                Play
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPreview(c.id)}>
                Full screen
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <button type="button" className="btn-soft" onClick={() => setPreview("")}>
          🎲 Surprise me (what {kid?.name ?? "your kid"} sees)
        </button>
      </div>

      {preview !== null && (
        <CelebrationScreen
          avatarSrc={src}
          total={SAMPLE_ITEMS.reduce((s, i) => s + i.points, 0)}
          items={SAMPLE_ITEMS}
          milestonesUnlocked={[{ name: "Ice Cream Trip" }]}
          effectId={preview || undefined}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

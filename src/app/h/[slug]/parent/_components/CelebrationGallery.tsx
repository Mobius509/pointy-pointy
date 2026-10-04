"use client";

import { useEffect, useState, useTransition } from "react";
import { CELEBRATIONS, playCelebration, unlockAudio } from "@/app/_components/celebrations";
import { CelebrationScreen, type HighScore } from "@/app/_components/CelebrationScreen";
import { avatarSrc } from "@/lib/avatar";
import { ConfirmDialog } from "@/app/_components/Dialog";
import type { NextUp } from "@/lib/next-up";
import { SectionPill } from "./ui";
import {
  clearHighScoresAction,
  setParentsPlayAction,
  setScoreNameAction,
  submitParentHighScoreAction,
} from "../_actions/high-scores";

// `nextUp` / `lastMilestone` are the kid's real ones, so the preview's
// "Next up" pill matches what they'd actually see.
type Kid = {
  id: string;
  name: string;
  avatar_emoji: string;
  nextUp: NextUp | null;
  lastMilestone: string | null;
};

const SAMPLE_ITEMS = [
  { id: "s1", name: "Make lunch", points: 5, isBonus: false },
  { id: "s2", name: "Practice piano", points: 5, isBonus: false },
  { id: "s3", name: "Helped with groceries", points: 15, isBonus: true },
];

const SAMPLE_TOTAL = SAMPLE_ITEMS.reduce((sum, i) => sum + i.points, 0);

// Parent Settings → Celebrations: preview every effect the kid view can
// play when points are approved, plus the full "points approved" screen.
export function CelebrationGallery({
  slug,
  kids,
  highScores,
  parentsPlay,
  scoreName,
}: {
  slug: string;
  kids: Kid[];
  highScores: Record<string, HighScore>;
  // "Parents can set high scores": when on, this parent's gallery games
  // count, under `scoreName` ("DAD").
  parentsPlay: boolean;
  scoreName: string;
}) {
  const [play, setPlay] = useState(parentsPlay);
  const [name, setName] = useState(scoreName);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const togglePlay = () => {
    const next = !play;
    setPlay(next);
    start(async () => {
      const res = await setParentsPlayAction(slug, next);
      if (!res.ok) setPlay(!next);
    });
  };
  const saveName = () =>
    start(async () => {
      const res = await setScoreNameAction(slug, name);
      setSaved(res.ok ? "Saved." : res.error ?? "Couldn't save.");
    });
  // Clearing a game's high score asks first, in a dialog.
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [clearing, startClear] = useTransition();
  const clearScore = (game: string) =>
    startClear(async () => {
      await clearHighScoresAction(slug, game);
      setConfirmClear(null);
    });
  const clearName = CELEBRATIONS.find((c) => c.id === confirmClear)?.name ?? "";
  const clearBest = confirmClear ? highScores[confirmClear] : undefined;
  const [kidId, setKidId] = useState(kids[0]?.id);
  // Which effect the preview screen should force ("" = random).
  const [preview, setPreview] = useState<string | null>(null);
  // A link straight to one: …/parent/settings?play=pong opens it full screen.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("play");
    if (id && CELEBRATIONS.some((c) => c.id === id)) setPreview(id);
  }, []);

  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const src = avatarSrc(kid?.avatar_emoji);

  return (
    <section className="card">
      <ConfirmDialog
        open={confirmClear !== null}
        title={`Clear the ${clearName} high score?`}
        message={
          clearBest
            ? `🏆 ${clearBest.score} · ${clearBest.initials} will be wiped and the next game sets a new record. This can't be undone.`
            : undefined
        }
        confirmLabel="Clear high score"
        danger
        pending={clearing}
        onConfirm={() => confirmClear && clearScore(confirmClear)}
        onCancel={() => setConfirmClear(null)}
      />
      <SectionPill>Celebrations</SectionPill>
      <p className="text-pp-muted mt-2">
        When points get approved, your kid sees one of these at random the next
        time they open Pointy Points.
      </p>

      {/* Parents in the high score race. */}
      <div className="mt-4 rounded-2xl bg-pp-soft p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold text-pp-primary-strong">Parents can set high scores</span>
            <span className="block text-xs text-pp-muted">
              Play from here to set a record — the kids get a “can you beat it?” notification.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={play}
            disabled={pending}
            onChange={togglePlay}
            className="size-6 shrink-0 accent-pp-primary"
          />
        </label>
        {play && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="label">Your initials</span>
              <input
                value={name}
                maxLength={3}
                onChange={(e) => {
                  setName(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase());
                  setSaved(null);
                }}
                placeholder="DAD"
                className="input w-24 text-center font-bold tracking-widest"
              />
            </label>
            <button type="button" onClick={saveName} disabled={pending || !name} className="btn-secondary">
              Save
            </button>
            {saved && <span className="text-xs text-pp-muted">{saved}</span>}
          </div>
        )}
      </div>

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
              {highScores[c.id] && highScores[c.id].score > 0 && (
                <p className="mt-1 text-xs font-bold text-pp-primary tabular-nums">
                  🏆 High score: {highScores[c.id].score} · {highScores[c.id].initials}
                  <button
                    type="button"
                    onClick={() => setConfirmClear(c.id)}
                    className="ml-2 font-semibold text-pp-muted underline underline-offset-2"
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  unlockAudio();
                  void playCelebration({ avatarSrc: src, points: SAMPLE_TOTAL }, c.id);
                }}
              >
                Play
              </button>
              <button type="button" className="btn-secondary" onClick={() => {
                  unlockAudio();
                  setPreview(c.id);
                }}>
                Full screen
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <button type="button" className="btn-soft" onClick={() => {
            unlockAudio();
            setPreview("");
          }}>
          🎲 Surprise me (what {kid?.name ?? "your kid"} sees)
        </button>
      </div>

      {preview !== null && (
        <CelebrationScreen
          // Fresh screen (and effect pick) for every preview.
          key={preview}
          avatarSrc={src}
          total={SAMPLE_TOTAL}
          items={SAMPLE_ITEMS}
          milestonesUnlocked={kid?.lastMilestone ? [{ name: kid.lastMilestone }] : []}
          nextUp={kid?.nextUp ?? null}
          effectId={preview || undefined}
          highScores={highScores}
          onSubmitHighScore={
            play
              ? async (game, score) => {
                  const res = await submitParentHighScoreAction(slug, game, score);
                  return res.ok ? { best: res.best, isNew: res.isNew } : null;
                }
              : undefined
          }
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

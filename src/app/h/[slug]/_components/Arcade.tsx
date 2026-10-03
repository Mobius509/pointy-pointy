"use client";

import { useState, useTransition } from "react";
import { CelebrationScreen, type HighScore } from "@/app/_components/CelebrationScreen";
import { Dialog } from "@/app/_components/Dialog";
import { unlockAudio } from "@/app/_components/celebrations";
import { ARCADE_GAMES, arcadeGameName } from "@/lib/games";
import type { Arcade as ArcadeState } from "@/lib/v2/streaks";
import { finishArcadeTicketAction, redeemArcadeTicketAction, submitHighScoreAction } from "../_actions/kid-completions";

// The kid's arcade. Streak rewards give arcade tickets, which pile up; each
// one is a single play. With a streak going a ticket plays a surprise game,
// and once the streak has run two weeks the kid picks the game. Closing the
// game spends the ticket (until then it can be picked back up).
export function Arcade({
  slug,
  avatarSrc,
  arcade,
  highScores,
  preview = false,
  kidName = "",
}: {
  slug: string;
  avatarSrc: string;
  arcade: ArcadeState;
  highScores: Record<string, HighScore>;
  // Parent "Kid view": tickets are the kid's to use, so it's look-only.
  preview?: boolean;
  kidName?: string;
}) {
  const [playing, setPlaying] = useState<{ ticketId: string; game: string; endsAt: string } | null>(null);
  const [spin, setSpin] = useState(false); // the surprise-game dialog
  const [confirm, setConfirm] = useState<string | null>(null); // picked game, to confirm
  const { tickets, mode, streakDays, pickAt } = arcade;
  const canUse = !preview && tickets > 0 && mode !== "locked" && !arcade.playing;
  const who = preview ? kidName || "Your kid" : "You";

  const status =
    tickets === 0
      ? "Keep a streak going to earn arcade tickets — each one is a game to play!"
      : mode === "locked"
        ? `Start a streak to use ${preview ? "them" : "your tickets"}!`
        : mode === "random"
          ? `Each ticket plays a surprise game. Keep your streak to ${pickAt} days to pick the game! (🔥 ${streakDays}/${pickAt})`
          : `🔥 ${streakDays}-day streak — ${preview ? "they pick" : "you pick"} the game!`;

  return (
    <section className="bg-white rounded-[32px] p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-pp-primary-strong font-semibold text-[16px]">🕹️ Arcade</h2>
        <span className="rounded-full bg-pp-soft px-3 py-1 text-[13px] font-bold text-pp-primary tabular-nums">
          🎟️ {tickets}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-pp-muted">{status}</p>

      {arcade.playing && !preview && (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setPlaying(arcade.playing);
          }}
          className="btn-primary btn-lg mt-4 w-full animate-celebrate-wiggle"
        >
          {ARCADE_GAMES.find((g) => g.id === arcade.playing!.game)?.icon} Back to {arcadeGameName(arcade.playing.game)}
        </button>
      )}

      {mode === "random" && tickets > 0 && !arcade.playing && (
        <button
          type="button"
          disabled={!canUse}
          onClick={() => {
            unlockAudio();
            setSpin(true);
          }}
          className={`btn-primary btn-lg mt-4 w-full ${canUse ? "animate-celebrate-wiggle" : ""}`}
        >
          {preview ? `🎟️ ${who} can play ${tickets} surprise game${tickets === 1 ? "" : "s"}` : "🎟️ Use a ticket!"}
        </button>
      )}

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {ARCADE_GAMES.map((g) => {
          const best = highScores[g.id];
          const pickable = canUse && mode === "pick";
          return (
            <li key={g.id}>
              <button
                type="button"
                disabled={!pickable}
                onClick={() => {
                  unlockAudio();
                  setConfirm(g.id);
                }}
                className={`w-full rounded-2xl p-3 text-center transition ${
                  pickable ? "bg-pp-tint ring-2 ring-pp-primary active:scale-[0.97]" : "bg-pp-soft"
                }`}
              >
                <span className={`block text-3xl ${pickable ? "" : "opacity-60"}`} aria-hidden>
                  {g.icon}
                </span>
                <span className="mt-1 block text-[12px] font-semibold text-pp-primary-strong leading-tight">
                  {g.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-pp-muted tabular-nums">
                  {best?.score ? `🏆 ${best.score}` : pickable ? "Play!" : " "}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {spin && (
        <SurpriseDialog
          slug={slug}
          onClose={() => setSpin(false)}
          onPlay={(p) => {
            setSpin(false);
            setPlaying(p);
          }}
        />
      )}

      {confirm && (
        <PickDialog
          slug={slug}
          game={confirm}
          tickets={tickets}
          onClose={() => setConfirm(null)}
          onPlay={(p) => {
            setConfirm(null);
            setPlaying(p);
          }}
        />
      )}

      {playing && (
        <CelebrationScreen
          key={playing.ticketId}
          mode="game"
          effectId={playing.game}
          playUntil={Date.parse(playing.endsAt)}
          avatarSrc={avatarSrc}
          total={0}
          items={[]}
          milestonesUnlocked={[]}
          highScores={highScores}
          onSubmitHighScore={async (game, score) => {
            const res = await submitHighScoreAction(slug, game, score);
            return res.ok ? { best: res.best, isNew: res.isNew } : null;
          }}
          onClose={() => {
            const done = playing;
            setPlaying(null);
            void finishArcadeTicketAction(slug, done.ticketId);
          }}
        />
      )}
    </section>
  );
}

// A surprise game: flick through the games and land on the one the ticket
// plays.
function SurpriseDialog({
  slug,
  onClose,
  onPlay,
}: {
  slug: string;
  onClose: () => void;
  onPlay: (p: { ticketId: string; game: string; endsAt: string }) => void;
}) {
  const [won, setWon] = useState<{ ticketId: string; game: string; endsAt: string } | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      setError(null);
      const res = await redeemArcadeTicketAction(slug, null);
      if (!res.ok) return setError(res.error);
      for (let i = 0; i < 14; i++) {
        setSpinning(ARCADE_GAMES[i % ARCADE_GAMES.length].id);
        await new Promise((r) => setTimeout(r, 70 + i * 12));
      }
      setSpinning(null);
      setWon({ ticketId: res.ticketId, game: res.game, endsAt: res.endsAt });
    });

  const shown = spinning ?? won?.game;
  return (
    <Dialog open onClose={onClose} title="🎟️ Surprise game!">
      <div className="mt-4 text-center">
        <p className="my-6 text-6xl" aria-live="polite">
          {shown ? ARCADE_GAMES.find((g) => g.id === shown)?.icon : "🎁"}
        </p>
        {won ? (
          <button type="button" onClick={() => onPlay(won)} className="btn-primary btn-lg w-full">
            Play {arcadeGameName(won.game)}!
          </button>
        ) : (
          <button type="button" onClick={open} disabled={pending} className="btn-primary btn-lg w-full">
            {pending ? "Spinning…" : "Spin it! (uses 1 ticket)"}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Dialog>
  );
}

// Picking a game (two-week streak): one tap to confirm spending a ticket.
function PickDialog({
  slug,
  game,
  tickets,
  onClose,
  onPlay,
}: {
  slug: string;
  game: string;
  tickets: number;
  onClose: () => void;
  onPlay: (p: { ticketId: string; game: string; endsAt: string }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const icon = ARCADE_GAMES.find((g) => g.id === game)?.icon;
  return (
    <Dialog open onClose={onClose} title={`${icon} ${arcadeGameName(game)}`}>
      <p className="mt-2 text-pp-muted">
        Use 1 of your {tickets} ticket{tickets === 1 ? "" : "s"} to play?
      </p>
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} className="btn-secondary btn-lg flex-1">
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await redeemArcadeTicketAction(slug, game);
              if (!res.ok) return setError(res.error);
              onPlay({ ticketId: res.ticketId, game: res.game, endsAt: res.endsAt });
            })
          }
          className="btn-primary btn-lg flex-1"
        >
          {pending ? "…" : "Play!"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Dialog>
  );
}

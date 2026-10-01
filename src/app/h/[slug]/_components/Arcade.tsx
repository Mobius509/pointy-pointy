"use client";

import { useEffect, useState, useTransition } from "react";
import { CelebrationScreen, type HighScore } from "@/app/_components/CelebrationScreen";
import { Dialog } from "@/app/_components/Dialog";
import { unlockAudio } from "@/app/_components/celebrations";
import { ARCADE_GAMES, arcadeGameName } from "@/lib/games";
import type { Arcade as ArcadeState, ArcadeTicket } from "@/lib/v2/streaks";
import { claimArcadeTicketAction, submitHighScoreAction } from "../_actions/kid-completions";

// The kid's arcade: the mini games, locked until a streak earns a ticket.
// Opening a ticket unlocks a random game (first reward) or games they pick
// (later rewards) for 24 hours. Tap an unlocked game to play.
export function Arcade({
  slug,
  avatarSrc,
  arcade,
  highScores,
}: {
  slug: string;
  avatarSrc: string;
  arcade: ArcadeState;
  highScores: Record<string, HighScore>;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [ticket, setTicket] = useState<ArcadeTicket | null>(null);
  const now = useNow();
  const unlocked = new Map(
    arcade.unlocked.filter((u) => new Date(u.expiresAt).getTime() > now).map((u) => [u.game as string, u.expiresAt]),
  );

  return (
    <section className="bg-white rounded-[32px] p-4 sm:p-6 shadow-sm">
      <h2 className="text-pp-primary-strong font-semibold text-[16px]">🕹️ Arcade</h2>
      <p className="mt-1 text-[13px] text-pp-muted">
        {unlocked.size
          ? "Your unlocked games — play before time runs out!"
          : "Keep a streak going to earn an arcade ticket and unlock games."}
      </p>

      {arcade.tickets.length > 0 && (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setTicket(arcade.tickets[0]);
          }}
          className="btn-primary btn-lg mt-4 w-full animate-celebrate-wiggle"
        >
          🎟️ Open your arcade ticket{arcade.tickets.length > 1 ? `s (${arcade.tickets.length})` : ""}!
        </button>
      )}

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {ARCADE_GAMES.map((g) => {
          const until = unlocked.get(g.id);
          const best = highScores[g.id];
          return (
            <li key={g.id}>
              <button
                type="button"
                disabled={!until}
                onClick={() => {
                  unlockAudio();
                  setPlaying(g.id);
                }}
                className={`w-full rounded-2xl p-3 text-center transition ${
                  until ? "bg-pp-tint ring-2 ring-pp-primary active:scale-[0.97]" : "bg-pp-soft opacity-60"
                }`}
              >
                <span className="block text-3xl" aria-hidden>
                  {until ? g.icon : "🔒"}
                </span>
                <span className="mt-1 block text-[12px] font-semibold text-pp-primary-strong leading-tight">
                  {g.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-pp-muted tabular-nums">
                  {until ? timeLeft(until, now) : best?.score ? `🏆 ${best.score}` : "Locked"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {ticket && (
        <TicketDialog
          slug={slug}
          ticket={ticket}
          unlocked={unlocked}
          onClose={() => setTicket(null)}
          onPlay={(game) => {
            setTicket(null);
            setPlaying(game);
          }}
        />
      )}

      {playing && (
        <CelebrationScreen
          key={playing}
          mode="game"
          effectId={playing}
          avatarSrc={avatarSrc}
          total={0}
          items={[]}
          milestonesUnlocked={[]}
          highScores={highScores}
          onSubmitHighScore={async (game, score) => {
            const res = await submitHighScoreAction(slug, game, score);
            return res.ok ? { best: res.best, isNew: res.isNew } : null;
          }}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  );
}

// Opening a ticket: a spin that lands on a surprise game (tier 1), or
// picking games (later tiers).
function TicketDialog({
  slug,
  ticket,
  unlocked,
  onClose,
  onPlay,
}: {
  slug: string;
  ticket: ArcadeTicket;
  unlocked: Map<string, string>;
  onClose: () => void;
  onPlay: (game: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [won, setWon] = useState<string[] | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      setError(null);
      const res = await claimArcadeTicketAction(slug, ticket.id, picked);
      if (!res.ok) return setError(res.error);
      if (ticket.random) {
        // Flick through the games, then land on the one it unlocked.
        for (let i = 0; i < 14; i++) {
          setSpinning(ARCADE_GAMES[i % ARCADE_GAMES.length].id);
          await new Promise((r) => setTimeout(r, 70 + i * 12));
        }
        setSpinning(null);
      }
      setWon(res.games);
    });

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < ticket.picks ? [...p, id] : p));

  return (
    <Dialog open onClose={onClose} title="🎟️ Arcade ticket!">
      {won ? (
        <div className="mt-4 text-center">
          <p className="text-pp-muted">Unlocked for 24 hours:</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-3">
            {won.map((g) => (
              <li key={g}>
                <button type="button" onClick={() => onPlay(g)} className="btn-primary btn-lg">
                  {ARCADE_GAMES.find((a) => a.id === g)?.icon} Play {arcadeGameName(g)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : ticket.random ? (
        <div className="mt-4 text-center">
          <p className="text-pp-muted">Open it to unlock a surprise game for 24 hours!</p>
          <p className="my-6 text-6xl" aria-live="polite">
            {spinning ? ARCADE_GAMES.find((g) => g.id === spinning)?.icon : "🎁"}
          </p>
          <button type="button" onClick={open} disabled={pending} className="btn-primary btn-lg w-full">
            {pending ? "Opening…" : "Open it!"}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-pp-muted">
            Pick {ticket.picks === ARCADE_GAMES.length ? "all" : ticket.picks} game{ticket.picks === 1 ? "" : "s"} to
            unlock for 24 hours.
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {ARCADE_GAMES.map((g) => {
              const on = picked.includes(g.id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(g.id)}
                    className={`w-full rounded-2xl p-3 text-center transition ${
                      on ? "bg-pp-tint ring-2 ring-pp-primary" : "bg-pp-soft"
                    }`}
                  >
                    <span className="block text-3xl" aria-hidden>
                      {g.icon}
                    </span>
                    <span className="mt-1 block text-[12px] font-semibold text-pp-primary-strong leading-tight">
                      {g.name}
                    </span>
                    {unlocked.has(g.id) && <span className="block text-[10px] text-pp-muted">already on</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={open}
            disabled={pending || picked.length !== ticket.picks}
            className="btn-primary btn-lg mt-5 w-full"
          >
            {pending ? "Unlocking…" : `Unlock ${picked.length}/${ticket.picks}`}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Dialog>
  );
}

// Re-renders every minute so "2h 10m left" stays current (and expired
// games lock themselves).
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function timeLeft(until: string, now: number) {
  const mins = Math.max(0, Math.round((new Date(until).getTime() - now) / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m left` : `${mins}m left`;
}

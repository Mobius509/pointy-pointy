"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A goal's or milestone's emoji, for a parent form: a button showing the
// pick, which opens a full-screen scrolling picker — suggestions from the
// reward's name first, then every emoji by group, with search. Submits as
// `name` (blank = no emoji). The kid's goal ring shows it.

type Group = { name: string; emojis: [emoji: string, name: string][] };

// Rewards kids tend to work toward — shown under the suggestions.
const POPULAR = "🍦🍨🍕🍩🧁🍪🍫🍭🍿🎮🎁🧸🐶🐱🦄🎢🎡🏊⚽🎨📚🎬🎟️🛍️💰🏖️⛺🚲🛹🎤🎧📱🌈⭐🏆🎉";

export function EmojiField({
  name = "emoji",
  defaultValue = "",
  label = "Emoji",
  id,
}: {
  name?: string;
  defaultValue?: string | null;
  label?: string;
  id?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [rewardName, setRewardName] = useState("");
  const button = useRef<HTMLButtonElement>(null);

  const show = () => {
    // The reward's name in the same form, for suggestions.
    const field = button.current?.form?.elements.namedItem("name");
    setRewardName(field instanceof HTMLInputElement ? field.value : "");
    setOpen(true);
  };

  return (
    <div className="min-w-0">
      <span className="label" id={id ? `${id}-label` : undefined}>
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        ref={button}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-label={value ? `Emoji: ${value}. Change it` : "Pick an emoji"}
        className="input flex w-full items-center justify-center text-center"
      >
        {value ? <span className="text-2xl leading-none">{value}</span> : <span className="text-pp-muted">＋</span>}
      </button>
      {open && (
        <EmojiPicker
          current={value}
          rewardName={rewardName}
          onPick={(e) => {
            setValue(e);
            setOpen(false);
            button.current?.focus();
          }}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function EmojiPicker({
  current,
  rewardName,
  onPick,
  onClose,
}: {
  current: string;
  rewardName: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void import("@/lib/emoji-data.json").then((m) => live && setGroups(m.default as Group[]));
    return () => {
      live = false;
    };
  }, []);

  // Lock the page behind, close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const names = useMemo(() => new Map(groups?.flatMap((g) => g.emojis) ?? []), [groups]);

  // Emoji whose names share a word with the reward's name ("Get a dog" →
  // 🐶 🐕 …), then the popular rewards.
  const suggested = useMemo(() => {
    if (!groups) return [];
    const words = rewardName
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
      .map((w) => w.replace(/s$/, ""));
    // Scored by how many of the name's words they match: with "ice cream",
    // 🍦 (both) beats 🏒 (just "ice"), and the one-word matches drop out.
    const scored: [string, number][] = [];
    if (words.length)
      for (const [e, n] of names) {
        const parts = n.split(/[^a-z]+/);
        const score = words.filter((w) => parts.some((part) => part === w || part === `${w}s`)).length;
        if (score) scored.push([e, score]);
      }
    const best = Math.max(0, ...scored.map(([, n]) => n));
    const hits = scored
      .filter(([, n]) => best < 2 || n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([e]) => e);
    const popular = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(POPULAR)].map((s) => s.segment);
    return [...new Set([...hits.slice(0, 24), ...popular])];
  }, [groups, names, rewardName]);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !groups) return null;
    return [...names].filter(([, n]) => terms.every((t) => n.includes(t))).map(([e]) => e);
  }, [query, groups, names]);

  const jump = (i: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-group="${i}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Pick an emoji" className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="border-b border-pp-line/70 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <h2 className="flex-1 text-[18px] font-semibold text-pp-primary-strong">Pick an emoji</h2>
          {current && (
            <button type="button" onClick={() => onPick("")} className="text-[14px] font-semibold text-rose-600 hover:underline">
              No emoji
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-full text-xl text-pp-primary hover:bg-pp-hover"
          >
            ✕
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — ice cream, dog, game…"
            aria-label="Search emoji"
            className="input w-full"
          />
          {!results && groups && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {["Suggested", ...groups.map((g) => g.name)].map((n, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => jump(i)}
                  className="shrink-0 rounded-full bg-pp-tint px-3 py-1.5 text-[13px] font-semibold text-pp-primary hover:bg-pp-tint-hover"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={scroller} className="relative flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          {!groups ? (
            <p className="py-10 text-center text-pp-muted">Loading…</p>
          ) : results ? (
            results.length ? (
              <Grid emojis={results} current={current} names={names} onPick={onPick} />
            ) : (
              <p className="py-10 text-center text-pp-muted">No emoji match “{query}”.</p>
            )
          ) : (
            <>
              <Section index={0} title={rewardName ? `Suggested for “${rewardName}”` : "Suggested"}>
                <Grid emojis={suggested} current={current} names={names} onPick={onPick} />
              </Section>
              {groups.map((g, i) => (
                <Section key={g.name} index={i + 1} title={g.name}>
                  <Grid emojis={g.emojis.map(([e]) => e)} current={current} names={names} onPick={onPick} />
                </Section>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section data-group={index} className="pt-4">
      <h3 className="sticky top-0 z-10 bg-white/95 py-2 text-[13px] font-semibold uppercase tracking-wide text-pp-muted backdrop-blur">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({
  emojis,
  current,
  names,
  onPick,
}: {
  emojis: string[];
  current: string;
  names: Map<string, string>;
  onPick: (emoji: string) => void;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1">
      {emojis.map((e) => (
        <li key={e}>
          <button
            type="button"
            onClick={() => onPick(e)}
            title={names.get(e)}
            aria-label={names.get(e) ?? e}
            aria-pressed={e === current}
            className={`grid aspect-square w-full place-items-center rounded-2xl text-[32px] leading-none transition hover:bg-pp-hover active:scale-90 ${
              e === current ? "bg-pp-tint ring-2 ring-pp-primary" : ""
            }`}
          >
            {e}
          </button>
        </li>
      ))}
    </ul>
  );
}

const STOP_WORDS = new Set(["the", "and", "for", "get", "trip", "with", "new", "big", "our", "your", "some", "time", "day", "out"]);

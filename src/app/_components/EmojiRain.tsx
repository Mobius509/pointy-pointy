"use client";

import { useEffect, useRef } from "react";
import { EMOJI_SOURCES, rainCountAndSize, startEmojiPhysics } from "./emojiPhysics";

// Falling emojis you can grab and throw (physics in ./emojiPhysics).
//
// Renders two overlapping layers so particles can sit in front of OR
// behind whatever the page composes (e.g. a translucent white card).
// Place page content as `children` — it lands in the DOM between the
// two layers and just needs its own z-index between back (z-0) and
// front (z-20) for the depth illusion to read.
//
// `fixed` pins both layers to the viewport instead of the parent box — use it
// on pages that scroll, since the physics runs in viewport coordinates.
// `backRatio` is the share of particles placed behind the content (0 = all
// in front, e.g. when there's no card to sandwich). `extraSources` are
// images that always make it into the rain (e.g. the kid's own avatar).
export function EmojiRain({
  children,
  fixed = false,
  backRatio = 0.4,
  extraSources = [],
}: {
  children?: React.ReactNode;
  fixed?: boolean;
  backRatio?: number;
  extraSources?: string[];
}) {
  // Stable dependency for the effect — callers usually pass a fresh array.
  const extraKey = extraSources.join("|");
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const back = backRef.current;
    const front = frontRef.current;
    if (!back || !front) return;

    const { count, sizeMin, sizeMax } = rainCountAndSize(window.innerWidth);
    // Extras go first so they're always used, and add to the usual count.
    const extras = extraKey ? extraKey.split("|") : [];
    const engine = startEmojiPhysics({
      back,
      front,
      sources: [...extras, ...EMOJI_SOURCES],
      count: count + extras.length,
      sizeMin,
      sizeMax,
      backRatio,
      mode: { kind: "rain" },
    });
    return () => engine.stop();
  }, [backRatio, extraKey]);

  const position = fixed ? "fixed" : "absolute";
  return (
    <>
      <div
        aria-hidden
        ref={backRef}
        className={`pointer-events-none ${position} inset-0 overflow-hidden z-0`}
      />
      {children}
      <div
        aria-hidden
        ref={frontRef}
        className={`pointer-events-none ${position} inset-0 overflow-hidden z-20`}
      />
    </>
  );
}

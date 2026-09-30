"use client";

import { useState } from "react";
import { EmojiRain } from "@/app/_components/EmojiRain";

// Just-for-fun button at the bottom of the kid view: turns on the home
// page's falling emojis, which can be grabbed and thrown around. The kid's
// own avatar joins the rain (twice, so there's always one to grab).
export function RainToggle({ avatarSrc }: { avatarSrc: string }) {
  const [on, setOn] = useState(false);

  return (
    <>
      {on && (
        <EmojiRain fixed backRatio={0} extraSources={[avatarSrc, avatarSrc]} />
      )}
      <div className="relative z-30 flex justify-center">
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          aria-pressed={on}
          className={on ? "btn-secondary btn-lg" : "btn-primary btn-lg"}
        >
          {on ? "Stop the rain" : "Make it rain! 🎉"}
        </button>
      </div>
    </>
  );
}

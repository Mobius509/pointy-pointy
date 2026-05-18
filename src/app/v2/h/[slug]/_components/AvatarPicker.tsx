/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AVATAR_IDS, avatarId, type AvatarId } from "@/lib/avatar";

// Horizontal scrollable grid of selectable avatars. Mirrors the modal in
// the design — selected tile has an orange checkmark badge, others have an
// empty pill placeholder.
//
// Controlled component: caller owns the value. We expose the current value
// as a hidden `<input name>` so the picker drops into a plain server-action
// form without extra wiring.
export function AvatarPicker({
  name = "avatar_emoji",
  defaultValue,
  onChange,
  bleed = false,
}: {
  name?: string;
  defaultValue?: string | null;
  onChange?: (avatar: AvatarId) => void;
  // When true, the scroll container extends past the parent's p-6/p-8
  // padding so partial tiles bleed off the parent card's edge. Used in
  // the kid settings modal. Default off so the picker stays self-contained
  // in normal form layouts.
  bleed?: boolean;
}) {
  const [selected, setSelected] = useState<AvatarId>(avatarId(defaultValue));
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Render the currently-selected avatar first, then the rest in their
  // original order. Memoized so picking the same avatar doesn't churn.
  const orderedIds = useMemo(() => {
    return [selected, ...AVATAR_IDS.filter((id) => id !== selected)];
  }, [selected]);

  // After the order changes (i.e. a new avatar was picked), snap the
  // scroll container back to the start so the now-first tile is visible.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [selected]);

  const pick = (id: AvatarId) => {
    setSelected(id);
    onChange?.(id);
  };

  // `min-w-0` is critical: without it CSS grid/flex parents would let the
  // picker's intrinsic content width (~5500px of tiles) drive their own
  // size, blowing out the page layout horizontally.
  return (
    <div className="min-w-0">
      <input type="hidden" name={name} value={selected} />
      {/* In bleed mode the scroll container extends past the parent's
          p-6/p-8 padding so partial tiles bleed off the card edge.
          Otherwise the container is fully contained. py-{2,4} gives the
          selected tile's ring vertical room and the scrollbar bottom
          space (overflow-x:auto implicitly clips the y-axis too once x
          overflows). */}
      <div
        ref={scrollRef}
        className={`overflow-x-auto ${bleed ? "-mx-6 sm:-mx-8" : ""}`}
      >
        <div
          className={`flex gap-3 sm:gap-4 pt-2 pb-4 ${
            bleed ? "px-6 sm:px-8" : ""
          }`}
        >
          {orderedIds.map((id) => {
            const isSelected = id === selected;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={isSelected}
                aria-label={`Choose ${id} avatar`}
                className={`relative flex-shrink-0 rounded-[24px] bg-[#FEEFE3] transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#D45B00] ${
                  isSelected
                    ? "ring-2 ring-[#D45B00]"
                    : "ring-1 ring-[#F1D1BD] hover:ring-[#E6BA9D]"
                }`}
                style={{ width: 160, height: 160 }}
              >
                <img
                  src={`/avatars/${id}.png`}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-contain p-3"
                />
                <span
                  aria-hidden
                  className={`absolute top-2.5 right-2.5 inline-flex items-center justify-center size-7 rounded-full ${
                    isSelected
                      ? "bg-[#D45B00] text-white"
                      : "bg-white ring-1 ring-[#F1D1BD]"
                  }`}
                >
                  {isSelected && (
                    <svg viewBox="0 0 20 20" fill="none" className="size-4">
                      <path
                        d="M5 10l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
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
}: {
  name?: string;
  defaultValue?: string | null;
  onChange?: (avatar: AvatarId) => void;
}) {
  const [selected, setSelected] = useState<AvatarId>(avatarId(defaultValue));

  const pick = (id: AvatarId) => {
    setSelected(id);
    onChange?.(id);
  };

  return (
    <>
      <input type="hidden" name={name} value={selected} />
      {/* Negative right margin lets the row of avatars scroll past the
          card's right padding — partial tiles bleed off the edge instead
          of getting visually clipped. Left edge still aligns with the
          section title. */}
      <div className="overflow-x-auto -mr-6 sm:-mr-8">
        <div className="flex gap-3 sm:gap-4 pb-1 pr-6 sm:pr-8">
          {AVATAR_IDS.map((id) => {
            const isSelected = id === selected;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={isSelected}
                aria-label={`Choose ${id} avatar`}
                className={`relative flex-shrink-0 rounded-2xl bg-[#FEEFE3] transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#D45B00] ${
                  isSelected
                    ? "ring-2 ring-[#D45B00]"
                    : "ring-1 ring-[#F1D1BD] hover:ring-[#E6BA9D]"
                }`}
                style={{ width: 116, height: 116 }}
              >
                <img
                  src={`/avatars/${id}.png`}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-contain p-2"
                />
                <span
                  aria-hidden
                  className={`absolute top-2 right-2 inline-flex items-center justify-center size-6 rounded-full ${
                    isSelected
                      ? "bg-[#D45B00] text-white"
                      : "bg-white ring-1 ring-[#F1D1BD]"
                  }`}
                >
                  {isSelected && (
                    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
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
    </>
  );
}

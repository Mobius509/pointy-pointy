"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { unlockAudio } from "@/app/_components/celebrations";
import { ChevronIcon } from "./KidIcons";

// "Your points have been approved! Let's celebrate!" — shown while there are
// approvals the kid hasn't celebrated. Plays the same celebration the
// approval notification opens (/celebrate). The tap also unlocks sound.
export function CelebrateCard({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const inner = (
    <>
      <span className="grid size-[75px] shrink-0 place-items-center rounded-[22px] bg-kid-strong-deep" aria-hidden>
        {/* The animated fire (a still one if the device asks for less motion). */}
        <picture>
          <source srcSet="/icons/3dIcon_Fire.png" media="(prefers-reduced-motion: reduce)" />
          <img src="/anims/fire.webp" alt="" className="size-[58px] object-contain" />
        </picture>
      </span>
      <span className="flex-1 text-[17px] font-medium leading-snug text-white">
        Your points have been approved! Nice work. Let&apos;s celebrate!
      </span>
      <ChevronIcon className="size-6 shrink-0 text-white" />
    </>
  );
  const cls = "flex items-center gap-4 rounded-[32px] bg-kid-strong p-3.5 pr-5";
  return disabled ? (
    <div className={cls}>{inner}</div>
  ) : (
    <Link href={`/h/${slug}/celebrate`} onClick={() => unlockAudio()} className={`${cls} transition active:scale-[0.99]`}>
      {inner}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CelebrationScreen, type HighScore } from "@/app/_components/CelebrationScreen";
import { nextUpFor } from "@/lib/next-up";
import { markCelebratedAction, submitHighScoreAction } from "../_actions/kid-completions";

type Approval = { id: string; name: string; points: number; isBonus: boolean };
type IosBridge = { webkit?: { messageHandlers?: { pointy?: { postMessage: (m: unknown) => void } } } };

// Plays the celebration for the approvals the kid hasn't celebrated, marks
// them celebrated (on every device), then heads home — or, in the iOS app's
// web view, tells the app to close it.
export function CelebratePlayer({
  slug,
  avatarSrc,
  approvals,
  progress,
  milestones,
  goal,
  highScores,
}: {
  slug: string;
  avatarSrc: string;
  approvals: Approval[];
  progress: number;
  milestones: { name: string; points: number }[];
  goal: { name: string; targetPoints: number } | null;
  highScores: Record<string, HighScore>;
}) {
  const router = useRouter();
  // The celebration only runs in the browser (it plays on the page itself).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const leave = useCallback(() => {
    const ios = (window as unknown as IosBridge).webkit?.messageHandlers?.pointy;
    if (ios) ios.postMessage({ type: "close" });
    else router.replace(`/h/${slug}`);
  }, [router, slug]);
  const close = useCallback(() => {
    void markCelebratedAction(
      slug,
      approvals.map((a) => a.id),
    ).finally(leave);
  }, [approvals, leave, slug]);

  if (!approvals.length) {
    return (
      <section className="mt-10 rounded-[32px] bg-kid-card p-8 text-center">
        <p className="text-[22px] font-medium text-kid-strong">All caught up! 🎉</p>
        <p className="mt-2 text-kid-text">Nothing new to celebrate right now.</p>
        <Link href={`/h/${slug}`} onClick={(e) => ((window as unknown as IosBridge).webkit ? (e.preventDefault(), leave()) : null)} className="btn-primary btn-lg mt-6">
          Back home
        </Link>
      </section>
    );
  }

  if (!mounted) return null;
  const total = approvals.reduce((sum, a) => sum + a.points, 0);
  const from = progress - total;
  return (
    <CelebrationScreen
      avatarSrc={avatarSrc}
      total={total}
      items={approvals}
      milestonesUnlocked={milestones.filter((m) => m.points > from && m.points <= progress)}
      nextUp={nextUpFor(progress, milestones, goal)}
      highScores={highScores}
      onSubmitHighScore={async (game, score) => {
        const res = await submitHighScoreAction(slug, game, score);
        return res.ok ? { best: res.best, isNew: res.isNew } : null;
      }}
      onClose={close}
    />
  );
}

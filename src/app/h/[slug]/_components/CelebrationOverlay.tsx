"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CelebrationScreen,
  type CelebrationItem,
} from "@/app/_components/CelebrationScreen";

// Celebrates approvals this device hasn't celebrated yet. "Seen" approval
// ids live in browser storage per kid, so there's no server state: the
// first visit on a device just records what's there (no flood of old
// approvals), and each new approval plays once per device.

const KEY = (kidId: string) => `pp:celebrated:${kidId}`;
const MAX_REMEMBERED = 200;

export function CelebrationOverlay({
  kidId,
  avatarSrc,
  approvals,
  progress,
  milestones,
}: {
  kidId: string;
  avatarSrc: string;
  approvals: CelebrationItem[];
  progress: number;
  milestones: { name: string; points: number }[];
}) {
  const [fresh, setFresh] = useState<CelebrationItem[] | null>(null);
  const idsKey = approvals.map((a) => a.id).join(",");

  useEffect(() => {
    let seen: string[] | null;
    try {
      const raw = localStorage.getItem(KEY(kidId));
      seen = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return; // storage unavailable — skip rather than repeat celebrations
    }

    const current = approvals.map((a) => a.id);
    const newOnes = seen ? approvals.filter((a) => !seen!.includes(a.id)) : [];

    try {
      const merged = [...new Set([...current, ...(seen ?? [])])].slice(0, MAX_REMEMBERED);
      localStorage.setItem(KEY(kidId), JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    if (newOnes.length > 0) setFresh(newOnes);
    // idsKey stands in for `approvals` so a refresh with the same data is a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, idsKey]);

  const close = useCallback(() => setFresh(null), []);
  if (!fresh) return null;

  const total = fresh.reduce((sum, i) => sum + i.points, 0);
  const from = progress - total;
  const unlocked = milestones.filter((m) => m.points > from && m.points <= progress);

  return (
    <CelebrationScreen
      avatarSrc={avatarSrc}
      total={total}
      items={fresh}
      milestonesUnlocked={unlocked}
      onClose={close}
    />
  );
}

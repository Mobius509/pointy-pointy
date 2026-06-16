"use client";

import { useEffect, useState } from "react";
import { SectionPill } from "./ui";

// Shows the kid sign-in URL (the household's /h/{slug} page) with quick
// share affordances. Origin is derived client-side so it matches whatever
// host the parent is currently on (localhost, vercel.app, custom domain).
export function KidUrlCard({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const url = origin ? `${origin}/h/${slug}` : `/h/${slug}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can long-press the field instead */
    }
  };

  const onShare = async () => {
    try {
      await navigator.share({
        title: "Pointy Points",
        text: "Your Pointy Points sign-in link",
        url,
      });
    } catch {
      /* user cancelled the share sheet — no-op */
    }
  };

  return (
    <section className="card-warm">
      <SectionPill>Kid sign-in URL</SectionPill>
      <p className="text-[#C3A38A] mt-2">
        Share this with your kid — bookmark it on their phone or add it to
        their home screen.
      </p>

      <div className="mt-4 flex flex-wrap items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input-warm flex-1 min-w-[200px] font-mono text-[12px] text-[#733405]"
          aria-label="Kid sign-in URL"
        />
        <button
          type="button"
          onClick={onCopy}
          className="btn-warm-secondary"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={onShare}
            className="btn-warm-primary"
          >
            Share
          </button>
        )}
      </div>

      <p className="mt-3 text-[12px] text-[#C3A38A]">
        Your kid still needs their PIN to unlock the checklist after
        opening the link.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

// The kid's avatar recolored to their palette (the same turn the
// .kid-avatar class gives it on the page), as an image URL the celebrations
// and games can draw — they paint the avatar onto canvas, where the CSS
// filter doesn't reach. `shift` is in degrees (avatarShift in
// kid-palette.ts); 0 or not ready yet: the original.
export function useShiftedAvatar(src: string, shift: number): string {
  const [out, setOut] = useState(src);
  useEffect(() => {
    if (!shift) return setOut(src);
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      if (!g || !live) return;
      g.filter = `hue-rotate(${shift}deg)`;
      g.drawImage(img, 0, 0);
      try {
        setOut(c.toDataURL("image/png"));
      } catch {
        setOut(src);
      }
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src, shift]);
  return out;
}

import type { ReactNode } from "react";
import { KidChrome } from "../_components/KidChrome";
import { RefreshOnFocus } from "../_components/RefreshOnFocus";
import { isEmbedded, loadKidPage } from "../_lib/kid-page";

// The signed-in kid app (Stats, Tasks, Arcade, Settings, Celebrate): their
// color, font and bars. Signed out, the page shows the kid picker in the
// plain shell instead.
export default async function KidLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { home } = await loadKidPage(slug);
  if (!home) return children;
  return (
    <KidChrome
      slug={slug}
      hue={home.hue}
      householdName={home.householdName}
      initials={home.initials}
      embedded={await isEmbedded()}
    >
      {children}
      <RefreshOnFocus />
    </KidChrome>
  );
}

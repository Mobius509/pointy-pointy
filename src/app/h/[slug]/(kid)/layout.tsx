import type { ReactNode } from "react";
import { KidChrome } from "../_components/KidChrome";
import { RefreshOnFocus } from "../_components/RefreshOnFocus";
import { isEmbedded, loadKidPage } from "../_lib/kid-page";
import { getKidVersion, kidVersionSwitchAllowed, wantsDefaultKidColor } from "../_lib/kid-version";
import { KidDevBar } from "../_components/KidDevBar";

// The signed-in kid app (Stats, Tasks, Arcade, Settings, Celebrate): their
// color, font and bars. Signed out, the page shows the kid picker in the
// plain shell instead.
export default async function KidLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { home } = await loadKidPage(slug);
  // Signed out, or the old 1.0 page (dev switch): no 2.0 frame.
  if (!home || (await getKidVersion()) === 1) return children;
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
      {kidVersionSwitchAllowed() && <KidDevBar slug={slug} version={2} defaultColor={await wantsDefaultKidColor()} />}
    </KidChrome>
  );
}

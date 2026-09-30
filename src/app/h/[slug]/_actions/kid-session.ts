"use server";

import { revalidatePath } from "next/cache";
import { clearKidSession, setKidSession } from "@/lib/v2/auth";
import { signInKid } from "@/lib/v2/kid-ops";

// Verify a kid's PIN against their stored bcrypt hash and, on success,
// set the kid_session cookie. No parent auth required — anyone with the
// household URL plus the kid's PIN can sign in as that kid (by design).
export async function kidSignInAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const slug = String(formData.get("slug") ?? "");
  const kidProfileId = String(formData.get("kid_profile_id") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const res = await signInKid(slug, kidProfileId, pin);
  if (!res.ok) return res;

  await setKidSession({
    householdId: res.householdId,
    kidProfileId: res.kidProfileId,
  });
  revalidatePath(`/h/${slug}`);
  return { ok: true };
}

export async function kidSignOutAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  await clearKidSession();
  revalidatePath(`/h/${slug}`);
}

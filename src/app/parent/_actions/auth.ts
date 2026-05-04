"use server";

import { revalidatePath } from "next/cache";
import {
  isPinSet,
  lockParent,
  setPin,
  verifyPinAndSetCookie,
} from "@/lib/auth/pin";

export async function setupPinAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (await isPinSet()) {
    return { ok: false, error: "PIN already set. Use the Settings tab." };
  }
  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pin !== confirm) return { ok: false, error: "PINs don't match." };
  try {
    await setPin(pin);
    await verifyPinAndSetCookie(pin);
    revalidatePath("/parent");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function unlockAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const pin = String(formData.get("pin") ?? "");
  const ok = await verifyPinAndSetCookie(pin);
  if (!ok) return { ok: false, error: "Wrong PIN." };
  revalidatePath("/parent");
  return { ok: true };
}

export async function lockAction(): Promise<void> {
  await lockParent();
  revalidatePath("/parent");
}

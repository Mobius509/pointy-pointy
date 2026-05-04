import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";

const COOKIE = "pointy_parent";
const COOKIE_TTL_SECONDS = 60 * 60 * 8; // 8 hours

async function getStoredPinHash(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("parent_pin_hash")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data?.parent_pin_hash ?? null;
}

export async function isPinSet(): Promise<boolean> {
  const hash = await getStoredPinHash();
  return Boolean(hash);
}

export async function setPin(newPin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error("PIN must be 4–8 digits.");
  }
  const hash = await bcrypt.hash(newPin, 10);
  const { error } = await supabaseAdmin
    .from("settings")
    .update({ parent_pin_hash: hash })
    .eq("id", 1);
  if (error) throw error;
}

export async function verifyPinAndSetCookie(pin: string): Promise<boolean> {
  const hash = await getStoredPinHash();
  if (!hash) return false;
  const ok = await bcrypt.compare(pin, hash);
  if (!ok) return false;

  const jar = await cookies();
  jar.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
  return true;
}

export async function isParentUnlocked(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === "1";
}

export async function lockParent(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requireParent(): Promise<void> {
  if (!(await isParentUnlocked())) {
    throw new Error("Parent PIN required.");
  }
}

import { NextResponse } from "next/server";
import { runDueReminders } from "@/lib/v2/push/reminders";

// Scheduler entry point for daily kid reminders. Call every 15 minutes with
// `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header
// automatically when CRON_SECRET is set; see README for Supabase pg_cron).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDueReminders());
}

export const POST = GET;

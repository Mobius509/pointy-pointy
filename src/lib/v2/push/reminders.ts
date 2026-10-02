import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { localTimeInTimezone, todayInTimezone } from "@/lib/time";
import { getKidTodayView } from "@/lib/v2/kid-ops";
import { getKidStreaks } from "@/lib/v2/streaks";
import { notifyKid } from "./index";

// Sends each kid's daily "log your points" reminder once their reminder
// time has passed in the household's timezone. Meant to be hit every ~15
// minutes by a scheduler; `last_reminded_on` makes repeat runs harmless.
export async function runDueReminders(now: Date = new Date()): Promise<{
  checked: number;
  sent: number;
}> {
  const { data, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, household_id, reminder_time, last_reminded_on, households(timezone)")
    .not("reminder_time", "is", null);
  if (error) throw error;

  let sent = 0;
  for (const row of data ?? []) {
    const rel = (row as unknown as {
      households: { timezone: string } | { timezone: string }[] | null;
    }).households;
    const timezone = (Array.isArray(rel) ? rel[0]?.timezone : rel?.timezone) ?? "UTC";

    const today = todayInTimezone(timezone, now);
    const due = (row.reminder_time as string).slice(0, 5) <= localTimeInTimezone(timezone, now);
    if (!due || row.last_reminded_on === today) continue;

    // Claim today's reminder first so overlapping runs can't double-send.
    const { data: claimed } = await supabaseV2Admin
      .from("kid_profiles")
      .update({ last_reminded_on: today })
      .eq("id", row.id)
      .or(`last_reminded_on.is.null,last_reminded_on.neq.${today}`)
      .select("id");
    if (!claimed?.length) continue;

    const res = await sendReminder(
      { householdId: row.household_id as string, kidProfileId: row.id as string, timezone },
      { skipIfCaughtUp: true },
    );
    if (res.delivered > 0) sent++;
  }

  return { checked: data?.length ?? 0, sent };
}

// Sends one kid's reminder right now. The scheduled job skips kids with no
// open tasks; the parent "send test" button sends regardless so there's
// always something to see.
export async function sendReminder(
  ctx: { householdId: string; kidProfileId: string; timezone: string },
  opts: { skipIfCaughtUp: boolean; test?: boolean },
): Promise<{ open: number; delivered: number }> {
  const view = await getKidTodayView(ctx);
  const open = view?.items.filter((i) => i.state === "open").length ?? 0;
  if (open === 0 && opts.skipIfCaughtUp) return { open, delivered: 0 };

  let body =
    open === 0
      ? "You're all caught up today — nice work!"
      : `You have ${open} ${open === 1 ? "task" : "tasks"} left today.`;

  // A streak going that today's open tasks would break? Say so. (A task
  // done and waiting for approval counts — and an "any 3 of 4" streak only
  // needs three.)
  const openIds = new Set(view?.items.filter((i) => i.state === "open").map((i) => i.id));
  const shortToday = ({ streak }: { streak: { taskIds: string[]; tasks_needed: number | null } }) => {
    const need = Math.min(streak.tasks_needed ?? streak.taskIds.length, streak.taskIds.length);
    return need - streak.taskIds.filter((id) => !openIds.has(id)).length > 0;
  };
  const atRisk = (await getKidStreaks(ctx).catch(() => []))
    .filter((ks) => ks.run.length > 0 && !ks.run.todayDone && !ks.run.restDay && shortToday(ks))
    .sort((a, b) => b.run.length - a.run.length)[0];
  if (atRisk) body += ` Don't break your 🔥 ${atRisk.run.length}-day ${atRisk.streak.name} streak!`;

  const delivered = await notifyKid(ctx.householdId, ctx.kidProfileId, {
    title: opts.test ? "Test reminder ⭐" : "Time to log your points! ⭐",
    body,
    tag: "reminder",
  });
  return { open, delivered };
}

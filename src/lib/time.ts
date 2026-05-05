// Returns "today" as a YYYY-MM-DD string in the given IANA timezone.
// Used so the daily checklist resets at local midnight regardless of server TZ.
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type Frequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly";

// Returns a stable bucket key for the period that contains "now" given the
// frequency. Two completions share a key iff they happened in the same
// period. Used to enforce one completion per period and to mark tasks as
// "done for this week/month/year/etc." in the kid view.
export function computePeriodKey(
  frequency: Frequency,
  timezone: string,
  now: Date = new Date(),
): string {
  const today = todayInTimezone(timezone, now); // 'YYYY-MM-DD'
  const [yyyy, mm, dd] = today.split("-").map(Number);

  if (frequency === "daily") return `D-${today}`;
  if (frequency === "monthly") {
    return `M-${yyyy}-${String(mm).padStart(2, "0")}`;
  }
  if (frequency === "yearly") return `Y-${yyyy}`;

  // Weekly + biweekly use ISO week. Compute from the date components in the
  // household's timezone so the week boundary respects local Mondays.
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  const dayNum = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const isoYear = date.getUTCFullYear();

  if (frequency === "weekly") {
    return `W-${isoYear}-${String(weekNum).padStart(2, "0")}`;
  }
  if (frequency === "biweekly") {
    const bucket = Math.floor((weekNum - 1) / 2);
    return `BW-${isoYear}-${String(bucket).padStart(2, "0")}`;
  }

  return `D-${today}`;
}

// Human-readable label for a frequency, used in the kid view + parent admin.
export function frequencyLabel(f: Frequency): string {
  switch (f) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
  }
}

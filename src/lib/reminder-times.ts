// Reminder time choices: 15-minute steps from 7:00 AM to 9:45 PM (the
// reminder job runs every 15 minutes). Values are "HH:MM" 24h in the
// household's timezone — the format v2.kid_profiles.reminder_time stores.
export const REMINDER_TIMES = Array.from({ length: 60 }, (_, i) => {
  const minutes = 7 * 60 + i * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: formatReminderTime(h, m),
  };
});

function formatReminderTime(h: number, m: number): string {
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

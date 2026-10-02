// The kid home's greeting ("Hello Freya! Let's get some stuff done today"):
// picked to fit what's going on, and different from day to day. Upbeat and
// fun by default; a bit pithy when a streak's just broken or nothing's
// happened for a while.
//
// Plain logic, no imports: the server works it out and sends the text to
// both apps (web and iOS show the same message).

export type GreetingContext = {
  name: string;
  hour: number; // 0–23, family's timezone
  tasksTotal: number; // today's tasks
  tasksLeft: number; // not done yet
  tasksWaiting: number; // done, waiting for a parent to approve
  newApprovals: number; // approved, not celebrated yet
  streak: { length: number; todayDone: boolean; daysToGo: number; broken: boolean } | null;
  daysInactive: number | null; // days since they last did a task (null: never)
  toMilestone: number | null; // 0–1 of the way to the next milestone
  toGoal: number | null; // 0–1 of the way to the goal
  seed: string; // kid + date: same message all day, a new one tomorrow
};

type Situation =
  | "inactive"
  | "streakLost"
  | "approved"
  | "allDone"
  | "allDoneWaiting"
  | "streakRisk"
  | "streakClose"
  | "goalClose"
  | "milestoneClose"
  | "streakGoing"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

const MESSAGES: Record<Situation, string[]> = {
  inactive: [
    "Oh hey, {name}. Long time no see. The tasks missed you.",
    "{name}! We were about to send a search party.",
    "Well, well, well. Look who remembered us, {name}.",
    "The points won't earn themselves, {name}. Believe us, we asked.",
    "{name}, your tasks have been waiting very patiently. Mostly.",
    "Back from your vacation, {name}? Let's ease in with one task.",
    "Dust off that checklist, {name}. Time to get rolling again.",
    "Nothing for a few days, {name}? Today's a great day to fix that.",
  ],
  streakLost: [
    "The streak's gone, {name}. It had a good run. Start a new one?",
    "RIP streak. Gone but not forgotten. New one today, {name}?",
    "Streaks happen, then they un-happen. Start fresh today, {name}.",
    "Your streak took a nap, {name}. Let's wake up a new one.",
    "Oof, the streak broke. Good news: day one is today, {name}.",
    "Every great streak started at zero, {name}. Let's go again.",
    "That streak's history, {name}. Time to make a better one.",
  ],
  approved: [
    "Points approved, {name}! Somebody's been busy.",
    "Ka-ching! Fresh points for {name}!",
    "Your hard work paid off, {name}. Go celebrate!",
    "Approved! {name}, you're on a roll.",
    "New points just landed, {name}. Nice going!",
    "{name}, the points are in. Time for a victory dance.",
    "Look at you, {name}! Points approved and ready to party.",
  ],
  allDone: [
    "All done today, {name}! You absolute legend.",
    "Every task, done. Take a bow, {name}!",
    "Checklist: crushed. Nice work, {name}!",
    "{name}, you did everything today. Go have some fun!",
    "That's a clean sweep, {name}. Feet up time!",
    "Done and dusted, {name}. Tomorrow's you says thanks.",
  ],
  allDoneWaiting: [
    "All done, {name}! Now we wait for the grown-ups to approve.",
    "Every task done, {name}. The points are on their way!",
    "Great work, {name}! Your points are waiting for a thumbs up.",
    "Done with everything, {name}. Points coming soon!",
  ],
  streakRisk: [
    "Your {streak}-day streak needs you tonight, {name}!",
    "Don't let the streak slip, {name}. Still time today!",
    "{name}, that {streak}-day streak isn't going to save itself.",
    "Tick tock, {name}. Keep the {streak}-day streak alive!",
    "Quick, {name}! Finish today's tasks and the streak lives on.",
  ],
  streakClose: [
    "One more day and the streak pays out, {name}!",
    "{name}, you're one day from a streak reward. Don't stop now!",
    "So close! Finish today and the streak bonus is yours, {name}.",
    "Tomorrow's reward is calling, {name}. Finish today strong!",
  ],
  goalClose: [
    "{name}, your goal is SO close. Keep going!",
    "Almost there, {name}! The big goal is right around the corner.",
    "Just a few more points to your goal, {name}!",
    "{name}, you can practically see your goal from here.",
  ],
  milestoneClose: [
    "Your next milestone is nearly here, {name}!",
    "{name}, a couple more tasks and you'll hit your next milestone.",
    "So close to the next milestone, {name}. Let's do this!",
    "Next milestone in sight, {name}. Keep it up!",
  ],
  streakGoing: [
    "{streak} days in a row, {name}! Let's make it {next}.",
    "The {streak}-day streak is looking good, {name}!",
    "{name}, you're on fire! {streak} days and counting.",
    "Keep that {streak}-day streak rolling, {name}!",
    "Streak status: {streak} days. Nice work, {name}!",
  ],
  morning: [
    "Good morning, {name}! Let's get some stuff done today.",
    "Rise and shine, {name}! Today's tasks are waiting.",
    "Morning, {name}! Fresh day, fresh points.",
    "Hello {name}! Let's get some stuff done today.",
    "Up and at 'em, {name}! What are we tackling first?",
    "Good morning, {name}! Points don't sleep in, and neither do you.",
  ],
  afternoon: [
    "Hey {name}! Let's knock out a few tasks.",
    "Good afternoon, {name}! Time to rack up some points.",
    "Hello {name}! Let's get some stuff done today.",
    "Afternoon, {name}! The points are calling.",
    "Hi {name}! How about a task or two?",
    "{name}! Let's turn this afternoon into points.",
  ],
  evening: [
    "Evening, {name}! Still time to grab some points.",
    "Hey {name}! Let's wrap up today's tasks.",
    "Good evening, {name}! Finish strong today.",
    "Hi {name}! A few more tasks before bedtime?",
    "{name}, the day's not over yet. Let's get some done!",
  ],
  night: [
    "Up late, {name}? Tomorrow's a fresh start.",
    "Night owl, {name}! Rest up for tomorrow's points.",
    "Hey {name}! Get some sleep, the tasks will be here tomorrow.",
    "{name}! Bedtime soon. Big points tomorrow.",
  ],
};

function situation(c: GreetingContext): Situation {
  if (c.daysInactive !== null && c.daysInactive >= 3) return "inactive";
  if (c.streak?.broken) return "streakLost";
  if (c.newApprovals > 0) return "approved";
  if (c.tasksTotal > 0 && c.tasksLeft === 0) return c.tasksWaiting > 0 ? "allDoneWaiting" : "allDone";
  if (c.streak && c.streak.length > 0 && !c.streak.todayDone) {
    if (c.hour >= 17) return "streakRisk";
    if (c.streak.daysToGo === 1) return "streakClose";
  }
  if (c.toGoal !== null && c.toGoal >= 0.9) return "goalClose";
  if (c.toMilestone !== null && c.toMilestone >= 0.85) return "milestoneClose";
  if (c.streak && c.streak.length >= 2) {
    // Mix the streak in now and then, so it isn't every day.
    if (hash(`${c.seed}:streak`) % 3 === 0) return "streakGoing";
  }
  if (c.hour < 5 || c.hour >= 21) return "night";
  if (c.hour < 12) return "morning";
  if (c.hour < 17) return "afternoon";
  return "evening";
}

export function greeting(c: GreetingContext): string {
  const s = situation(c);
  const list = MESSAGES[s];
  const text = list[hash(`${c.seed}:${s}`) % list.length];
  const streak = c.streak?.length ?? 0;
  return text
    .replaceAll("{name}", c.name)
    .replaceAll("{streak}", String(streak))
    .replaceAll("{next}", String(streak + 1));
}

// Small, stable string hash (FNV-1a).
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// For tests and the parent preview.
export const GREETING_SITUATIONS = Object.keys(MESSAGES) as Situation[];

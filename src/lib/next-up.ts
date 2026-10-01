// "Next up" on the celebration screen: the nearest milestone the kid hasn't
// reached yet, else the goal itself. Null once the goal is reached too.
export type NextUp = { name: string; pointsToGo: number };

export function nextUpFor(
  progress: number,
  milestones: { name: string; points: number }[],
  goal: { name: string; targetPoints: number } | null,
): NextUp | null {
  const next = milestones.filter((m) => m.points > progress).sort((a, b) => a.points - b.points)[0];
  if (next) return { name: next.name, pointsToGo: next.points - progress };
  if (goal && goal.targetPoints > progress) return { name: goal.name, pointsToGo: goal.targetPoints - progress };
  return null;
}

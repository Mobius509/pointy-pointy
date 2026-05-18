import type { KidProfile } from "@/lib/v2/data";

type Props = {
  householdName: string;
  kids: KidProfile[];
  taskCount: number;
  goalCount: number;
};

// Header strip on the overview: family name, kids list, # tasks, # goals.
export function FamilyStatsCard({
  householdName,
  kids,
  taskCount,
  goalCount,
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 text-[18px]">
        <Row label="Family" value={householdName} />
        <Row
          label="Tasks"
          value={`${taskCount} ${taskCount === 1 ? "Task" : "Tasks"} Set`}
        />
        <Row
          label="Kids"
          value={
            kids.length === 0 ? (
              <span className="text-slate-500 italic">None yet</span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {kids.map((k) => (
                  <span key={k.id} className="inline-flex items-center gap-1">
                    <span aria-hidden>{k.avatar_emoji}</span>
                    {k.name}
                  </span>
                ))}
              </span>
            )
          }
        />
        <Row
          label="Goal"
          value={`${goalCount} ${goalCount === 1 ? "Goal" : "Goals"} Set`}
        />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-6">
      <dt className="w-16 shrink-0 text-[#C3A38A]">{label}</dt>
      <dd className="font-semibold text-[#D45B00]">{value}</dd>
    </div>
  );
}

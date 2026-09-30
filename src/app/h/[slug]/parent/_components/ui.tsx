// Shared visual primitives for the parent admin tabs. Keeps the warm/peach
// palette consistent across Overview, Tasks, Activity, Goal, Settings.

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[32px] font-medium text-pp-primary leading-none">
      {children}
    </h1>
  );
}

export function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-pp-soft text-pp-primary-strong px-4 py-1 text-[14px] font-semibold">
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-medium text-pp-primary-strong">{children}</h2>
  );
}

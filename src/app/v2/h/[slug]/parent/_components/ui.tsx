// Shared visual primitives for the parent admin tabs. Keeps the warm/peach
// palette consistent across Overview, Tasks, Activity, Goal, Settings.

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[32px] font-medium text-[#D45B00] leading-none">
      {children}
    </h1>
  );
}

export function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#F9EBE3] text-[#D45B00] px-4 py-1 text-[14px] font-semibold">
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-medium text-[#D45B00]">{children}</h2>
  );
}

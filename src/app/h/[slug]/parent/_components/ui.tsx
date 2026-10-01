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

// A card that opens and closes (native <details>), with a pill title, an
// optional one-line summary and a chevron.
export function AccordionCard({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group card" open={defaultOpen}>
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SectionPill>{title}</SectionPill>
          {summary && <span className="text-[13px] text-pp-muted">{summary}</span>}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          className="size-4 text-pp-primary transition-transform group-open:rotate-180 flex-shrink-0"
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

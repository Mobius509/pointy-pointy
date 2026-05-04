-- Adds parent-approval workflow.
-- Kid taps a task → row inserted with status='pending'. Parent approves → status='approved'.
-- Goal progress only counts 'approved' rows.

alter table public.completions
  add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved'));

create index if not exists completions_pending_idx
  on public.completions (completed_at desc)
  where status = 'pending';

create table if not exists public.admin_ops_markers (
  marker_key text primary key check (
    marker_key in ('encrypted_backup', 'restore_drill')
  ),
  status text not null check (status in ('ok', 'failed')),
  occurred_at timestamptz not null,
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object'
    and pg_column_size(details) <= 4096
  ),
  updated_at timestamptz not null default now()
);

alter table public.admin_ops_markers enable row level security;
alter table public.admin_ops_markers force row level security;

drop policy if exists "Staff read operational markers"
  on public.admin_ops_markers;
create policy "Staff read operational markers"
on public.admin_ops_markers for select
to authenticated
using (public.is_staff());

revoke all on table public.admin_ops_markers
  from public, anon, authenticated;
grant select on table public.admin_ops_markers to authenticated;

create index if not exists admin_ops_markers_occurred_at_idx
  on public.admin_ops_markers(occurred_at desc);

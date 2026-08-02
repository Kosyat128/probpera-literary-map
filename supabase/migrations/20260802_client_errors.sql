-- First-party production diagnostics. Messages are intentionally bounded and
-- written only through a rate-limited function; no secret or form payload is stored.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  fingerprint text not null check (char_length(fingerprint) between 4 and 120),
  message text not null check (char_length(message) between 1 and 1000),
  stack text not null default '' check (char_length(stack) <= 6000),
  path text not null default '/' check (char_length(path) <= 500),
  source text not null default 'runtime' check (source in ('runtime', 'promise', 'react', 'resource', 'manual')),
  context jsonb not null default '{}'::jsonb,
  session_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists client_errors_open_idx
  on public.client_errors(status, created_at desc);
create index if not exists client_errors_fingerprint_idx
  on public.client_errors(fingerprint, created_at desc);

create or replace function public.submit_client_error(
  p_session_id uuid,
  p_message text,
  p_stack text default '',
  p_path text default '/',
  p_source text default 'runtime',
  p_fingerprint text default 'unknown',
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  recent_errors integer;
begin
  if char_length(trim(p_message)) not between 1 and 1000
    or char_length(coalesce(p_stack, '')) > 6000
    or char_length(coalesce(p_path, '/')) > 500
    or p_source not in ('runtime', 'promise', 'react', 'resource', 'manual')
    or char_length(coalesce(p_fingerprint, 'unknown')) not between 4 and 120
    or octet_length(coalesce(p_context, '{}'::jsonb)::text) > 8000 then
    raise exception 'Invalid diagnostic event';
  end if;

  select count(*) into recent_errors
  from public.client_errors
  where session_id = p_session_id
    and created_at > now() - interval '10 minutes';

  if recent_errors >= 12 then
    return;
  end if;

  insert into public.client_errors (
    fingerprint, message, stack, path, source, context, session_id, user_id
  ) values (
    left(p_fingerprint, 120),
    left(trim(p_message), 1000),
    left(coalesce(p_stack, ''), 6000),
    left(coalesce(p_path, '/'), 500),
    p_source,
    p_context,
    p_session_id,
    (select auth.uid())
  );
end;
$$;

grant execute on function public.submit_client_error(uuid, text, text, text, text, text, jsonb)
  to anon, authenticated;

alter table public.client_errors enable row level security;

drop policy if exists "Staff read client diagnostics" on public.client_errors;
create policy "Staff read client diagnostics"
on public.client_errors for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff update client diagnostics" on public.client_errors;
create policy "Staff update client diagnostics"
on public.client_errors for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke insert, delete on public.client_errors from anon, authenticated;

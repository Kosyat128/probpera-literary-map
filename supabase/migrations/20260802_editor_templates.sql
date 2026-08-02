-- Reusable editorial structures shared safely between staff devices.
create table if not exists public.editor_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 2 and 80),
  content_html text not null check (char_length(content_html) between 1 and 500000),
  content_json jsonb not null default '{}'::jsonb,
  visibility text not null default 'personal' check (visibility in ('personal', 'shared')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, label)
);

create index if not exists editor_templates_visibility_idx
  on public.editor_templates(visibility, updated_at desc);

drop trigger if exists editor_templates_set_updated_at on public.editor_templates;
create trigger editor_templates_set_updated_at
before update on public.editor_templates
for each row execute function public.set_updated_at();

alter table public.editor_templates enable row level security;

create policy "Staff read available editor templates"
on public.editor_templates for select
to authenticated
using (public.is_staff() and (visibility = 'shared' or owner_id = (select auth.uid())));

create policy "Staff create editor templates"
on public.editor_templates for insert
to authenticated
with check (public.is_staff() and owner_id = (select auth.uid()));

create policy "Owners edit templates and admins manage shared templates"
on public.editor_templates for update
to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
)
with check (public.is_staff());

create policy "Owners delete templates and admins manage shared templates"
on public.editor_templates for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
);

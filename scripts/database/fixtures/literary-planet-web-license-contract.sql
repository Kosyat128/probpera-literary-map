-- Isolated PostgreSQL/PGlite fixture only. No remote database or credentials.
-- The auth.uid boundary represents Supabase's authenticated request subject.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key);
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to authenticated;

-- Preserve the relevant CURRENT canonical profile/comment deletion constraints.
-- Acknowledging a request must not bypass these constraints or delete the user.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);
create table public.article_comments (
  id uuid primary key,
  author_id uuid references public.profiles(id) on delete set null,
  guest_name text check (char_length(guest_name) between 2 and 80),
  check (author_id is not null or guest_name is not null)
);
create table public.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null
);
create table public.editorial_reference_fixture (
  id uuid primary key,
  created_by uuid not null references auth.users(id) on delete restrict
);

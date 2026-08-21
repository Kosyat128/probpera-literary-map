-- Emergency RLS repair for the editorial article workflow.
-- Supabase INSERT ... RETURNING and the draft editor both need an explicit
-- SELECT policy for staff. Public readers keep the published-only policy.

drop policy if exists "Staff read articles" on public.articles;
create policy "Staff read articles"
on public.articles for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read article translations"
  on public.article_translations;
create policy "Staff read article translations"
on public.article_translations for select
to authenticated
using (public.is_staff());

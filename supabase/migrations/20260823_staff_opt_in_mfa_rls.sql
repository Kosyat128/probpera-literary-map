-- Enforce AAL2 at the database boundary for staff who opted into MFA.
-- Staff without a verified MFA factor keep their current access. Non-staff
-- authenticated readers are unaffected. This mirrors Supabase's opt-in MFA
-- guidance while keeping the existing permissive editorial policies intact.

create or replace function public.staff_mfa_session_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_staff() then true
    when exists (
      select 1
      from auth.mfa_factors as factor
      where factor.user_id = (select auth.uid())
        and factor.status = 'verified'
    )
      then coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    else true
  end;
$$;

revoke all on function public.staff_mfa_session_allowed() from public;
grant execute on function public.staff_mfa_session_allowed() to authenticated;

drop policy if exists "Staff opted-in MFA articles" on public.articles;
create policy "Staff opted-in MFA articles"
on public.articles
as restrictive
for all
to authenticated
using (public.staff_mfa_session_allowed())
with check (public.staff_mfa_session_allowed());

drop policy if exists "Staff opted-in MFA article translations"
  on public.article_translations;
create policy "Staff opted-in MFA article translations"
on public.article_translations
as restrictive
for all
to authenticated
using (public.staff_mfa_session_allowed())
with check (public.staff_mfa_session_allowed());

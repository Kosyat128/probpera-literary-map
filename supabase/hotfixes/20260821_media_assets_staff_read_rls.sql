-- Ensure editorial staff can inspect all media metadata, including rows hidden
-- from the public catalog by soft deletion or future visibility rules.

drop policy if exists "Staff read media metadata" on public.media_assets;
create policy "Staff read media metadata"
on public.media_assets for select
to authenticated
using (public.is_staff());

-- Transport fixture only: the archive implementation has separate integration tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
create table public.native_commit_fixture (
  release_id uuid primary key,
  manifest_sha256 text not null,
  observed_context jsonb not null
);
grant select, insert on public.native_commit_fixture to service_role;
create function public.commit_literary_archive_release(
  p_release_id uuid, p_manifest_sha256 text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing_manifest text; observed jsonb;
begin
  if current_user <> 'service_role' or auth.role() <> 'service_role'
    or auth.uid() is not null
    or current_setting('request.jwt.claims')::jsonb <> '{"role":"service_role"}'::jsonb
    or (select setting from pg_catalog.pg_settings where name = 'statement_timeout') <> '300000'
    or (select setting from pg_catalog.pg_settings where name = 'lock_timeout') <> '15000' then
    raise exception 'Native transport context was not installed before the RPC';
  end if;
  if p_manifest_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Fixture manifest validation failed';
  end if;
  select manifest_sha256 into existing_manifest from public.native_commit_fixture where release_id = p_release_id;
  if found then
    if existing_manifest <> p_manifest_sha256 then raise exception 'Fixture manifest mismatch'; end if;
    return jsonb_build_object('releaseId',p_release_id,'manifestSha256',p_manifest_sha256,'alreadyCommitted',true);
  end if;
  observed := jsonb_build_object('role',current_user,'uid',auth.uid(),
    'claims',current_setting('request.jwt.claims')::jsonb,
    'statementTimeoutMs',(select setting::integer from pg_catalog.pg_settings where name='statement_timeout'),
    'lockTimeoutMs',(select setting::integer from pg_catalog.pg_settings where name='lock_timeout'));
  insert into public.native_commit_fixture values(p_release_id,p_manifest_sha256,observed);
  if p_manifest_sha256 = repeat('f',64) then raise exception 'Fixture later phase failed after insertion'; end if;
  return jsonb_build_object('releaseId',p_release_id,'manifestSha256',p_manifest_sha256,'alreadyCommitted',false);
end;
$$;
revoke all on function public.commit_literary_archive_release(uuid,text) from public, anon, authenticated;
grant execute on function public.commit_literary_archive_release(uuid,text) to service_role;

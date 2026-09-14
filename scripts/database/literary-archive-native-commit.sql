-- Fixed administrative transport for the existing, service-only atomic RPC.
-- psql supplies quoted values; this file does not accept SQL or user identities.
set local statement_timeout = '5min';
set local lock_timeout = '15s';
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
set local request.jwt.claim.role = 'service_role';

do $$
begin
  if current_user <> 'service_role'
    or coalesce(auth.role(), '') <> 'service_role'
    or auth.uid() is not null then
    raise exception 'Native archive commit requires a service-only context'
      using errcode = '42501';
  end if;
end;
$$;

with started as materialized (
  select clock_timestamp() as started_at
), committed as materialized (
  select
    public.commit_literary_archive_release(
      :'release_id'::uuid,
      :'manifest_sha256'::text
    ) as receipt,
    started_at
  from started
)
select jsonb_build_object(
  'transport', 'native-postgres',
  'elapsedMs', round(extract(epoch from clock_timestamp() - started_at) * 1000),
  'receipt', receipt
)
from committed;

-- Fixed read operations only. The executor supplies one validated JSON literal.
set transaction isolation level repeatable read read only;
set local statement_timeout = '5min';
set local lock_timeout = '15s';
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
set local request.jwt.claim.role = 'service_role';

do $$
begin
  if current_user <> 'service_role'
    or coalesce(auth.role(), '') <> 'service_role'
    or auth.uid() is not null
    or current_setting('transaction_read_only') <> 'on'
    or current_setting('transaction_isolation') <> 'repeatable read' then
    raise exception 'Native archive verification requires a read-only service context'
      using errcode = '42501';
  end if;
end;
$$;

with started as materialized (
  select clock_timestamp() as started_at
), request as materialized (
  select __NATIVE_ARCHIVE_READ_REQUEST__::jsonb as value
), verified as materialized (
  select started_at, value,
    case value ->> 'operation'
      when 'precondition' then public.get_literary_archive_release_precondition()
      when 'postflight' then (
        select public.assert_literary_archive_live_target(
          committed.id, value #>> '{args,committedManifestSha256}'
        )
        from public.literary_archive_releases as committed
        where committed.id = (value #>> '{args,releaseId}')::uuid
          and committed.status = 'committed'
          and committed.metadata ->> 'logicalTargetManifestSha256'
            = value #>> '{args,logicalTargetManifestSha256}'
      )
    end as result,
    case when value ->> 'operation' = 'postflight' then
      public.assert_literary_work_evidence_v2_health(
        value #>> '{identity,contractVersion}',
        value #>> '{identity,validatorVersion}',
        value #>> '{identity,validatorSha256}',
        value #>> '{identity,canonRegistryVersion}',
        value #>> '{identity,canonRegistrySha256}'
      )
    end as health
  from started cross join request
)
select jsonb_build_object(
  'transport', 'native-postgres-read-only',
  'operation', value ->> 'operation',
  'context', jsonb_build_object(
    'readOnly', current_setting('transaction_read_only') = 'on',
    'isolation', current_setting('transaction_isolation'),
    'role', current_user,
    'authRole', auth.role(),
    'uid', auth.uid(),
    'statementTimeoutMs', extract(epoch from current_setting('statement_timeout')::interval) * 1000,
    'lockTimeoutMs', extract(epoch from current_setting('lock_timeout')::interval) * 1000
  ),
  'elapsedMs', round(extract(epoch from clock_timestamp() - started_at) * 1000),
  'result', result,
  'health', health
)
from verified;

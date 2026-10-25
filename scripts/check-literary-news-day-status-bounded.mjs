import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const literal = value => "'" + String(value).replaceAll("'", "''") + "'";

/** Entire fixture is synthetic and runs only in a disposable test database. */
export async function buildDayStatusBoundedFixture() {
  const original = await readFile(new URL('./database/literary-news-runtime-latest-query.sql', import.meta.url), 'utf8');
  const optimized = await readFile(new URL('./database/literary-news-day-status-bounded.sql', import.meta.url), 'utf8');
  const marker = 'create or replace function public.literary_news_delivery_day_status(';
  assert.equal(original.split(marker).length, 2);
  const reference = original.slice(original.indexOf(marker)).replaceAll(
    'literary_news_delivery_day_status', 'literary_news_delivery_day_status_reference');
  const destination = { platform: 'telegram', id: '-100123' };
  const state = change => ({ destination, status: 'sent_current', remoteId: '100',
    firstAcknowledgedAt: '2026-10-25T05:00:00Z', remoteMediaKind: 'text',
    prepared: { temporal: { kind: 'news', publishedAt: '2026-10-25' } }, ...change });
  const temporal = change => ({ temporal: { kind: 'news', publishedAt: '2026-10-25', ...change } });
  const entries = [
    ['text', state({})], ['photo', state({ remoteMediaKind: 'photo' })],
    ['old-first', state({ firstAcknowledgedAt: '2026-10-24T12:00:00Z', acknowledgedAt: '2026-10-25T10:00:00Z' })],
    ['before-midnight', state({ firstAcknowledgedAt: '2026-10-24T20:59:59.999Z' })],
    ['at-midnight', state({ firstAcknowledgedAt: '2026-10-24T21:00:00.000Z' })],
    ['no-first', state({ firstAcknowledgedAt: null })],
    ['bad-first', state({ firstAcknowledgedAt: '2026-02-30T00:00:00Z' })],
    ['empty-first', state({ firstAcknowledgedAt: '' })],
    ['infinite-first', state({ firstAcknowledgedAt: 'infinity' })],
    ['no-remote', state({ remoteId: null })], ['empty-remote', state({ remoteId: '' })],
    ['whitespace-remote', state({ remoteId: ' ' })],
    ['nullable-kind-and-media', state({ prepared: null, remoteMediaKind: null })],
    ['no-kind', state({ prepared: temporal({ kind: null }) })],
    ['not-story', state({ prepared: temporal({ kind: 'calendar' }) })],
    ['announcement', state({ prepared: temporal({ kind: 'announcement' }) })],
    ['unknown-published', state({ prepared: temporal({ publishedAt: null }) })],
    ['invalid-published', state({ prepared: temporal({ publishedAt: '2026-02-30' }) })],
    ['future-published', state({ prepared: temporal({ publishedAt: '2026-10-25T05:00:00.001Z' }) })],
    ['seven-days', state({ prepared: temporal({ publishedAt: '2026-10-18T05:00:00Z' }) })],
    ['older-seven-days', state({ prepared: temporal({ publishedAt: '2026-10-18T04:59:59.999Z' }) })],
    ['at-first', state({ prepared: temporal({ publishedAt: '2026-10-25T05:00:00Z' }) })],
    ['correction', state({ status: 'correction_pending' })],
    ['blocked', state({ status: 'blocked' })],
    ['hidden', state({})],
    ['encoded%20key', state({})],
    ['wrong-platform', state({ destination: { ...destination, platform: 'vk' } })],
    ['wrong-destination', state({ destination: { ...destination, id: '-100456' } })],
    ['latest-unsent', state({})], ['latest-unsent', state({ remoteId: null, firstAcknowledgedAt: null, status: 'pending' })],
    ['latest-mismatch', state({})], ['latest-mismatch', state({ destination: { ...destination, id: '-100456' } })],
    ['latest-unknown', state({})], ['latest-unknown', state({ firstAcknowledgedAt: null })],
    ['null-metadata', null], ['array-metadata', []], ['scalar-metadata', 'unrelated'],
  ];
  const rows = entries.map(([key, metadata]) => "('literary_news_runtime'," + literal(
    'post:news:' + key + ':telegram:' + destination.id) + ',' + literal(JSON.stringify(metadata)) + '::jsonb)');
  rows.push("('different_entity_type','post:news:text:telegram:-100123'," + literal(JSON.stringify(state({ remoteId: '999' }))) + '::jsonb)');
  const select = optimized.slice(optimized.indexOf('  with latest_ids as ('), optimized.indexOf('  return pg_catalog'))
    .replace('into creates, photos, fresh, fresh_photos, unknown_first from receipt;', 'from receipt;')
    .replaceAll('p_destination_id', "'-100123'").replaceAll('p_day', "date '2026-10-25'");
  assert.ok(select.trimEnd().endsWith('from receipt;'));
  return `
create role anon; create role authenticated; create role service_role;
create table public.admin_audit_log(id bigint generated always as identity primary key, entity_type text, entity_id text, metadata jsonb);
create index admin_audit_literary_news_runtime_latest_key_c on public.admin_audit_log(entity_id collate "C",id desc)
  where entity_type='literary_news_runtime';
grant select on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy runtime_service_read on public.admin_audit_log for select to service_role using(entity_type='literary_news_runtime');
create policy runtime_hidden_read on public.admin_audit_log as restrictive for select to service_role using(entity_id not like '%:hidden:%');
${reference}
${optimized}
-- Historical payloads are deliberately large; latest states below replace them.
insert into public.admin_audit_log(entity_type,entity_id,metadata)
select 'literary_news_runtime','post:news:history-' || (n % 24) || ':telegram:-100123',
  jsonb_build_object('destination',jsonb_build_object('platform','telegram','id','-100123'),
    'remoteId',n::text,'firstAcknowledgedAt','2026-10-25T05:00:00Z','payload',repeat(md5(n::text),64))
from generate_series(1,1440) n;
insert into public.admin_audit_log(entity_type,entity_id,metadata)
select 'literary_news_runtime','post:news:history-' || n || ':telegram:-100123',
  jsonb_build_object('destination',jsonb_build_object('platform','telegram','id','-100123'),'status','pending')
from generate_series(0,23) n;
insert into public.admin_audit_log(entity_type,entity_id,metadata) values ${rows.join(',\n')};
analyze public.admin_audit_log;
set role service_role;
do $fixture$
declare observed jsonb; expected jsonb; at timestamptz; dest text; attempt integer; old_count bigint;
  plan jsonb; node jsonb;
begin
  foreach dest in array array['-100123','-100456','-100999'] loop
    foreach at in array array['2026-10-08T20:59:59Z','2026-10-08T21:00:00Z',
      '2026-10-24T20:59:59.999Z','2026-10-24T21:00:00Z','2026-10-25T05:00:00Z',
      '2026-10-25T20:59:59.999Z','2026-10-25T21:00:00Z','2026-10-31T12:00:00Z']::timestamptz[] loop
      expected := public.literary_news_delivery_day_status_reference(dest,at);
      observed := public.literary_news_delivery_day_status(dest,at);
      if observed is distinct from expected then raise exception 'Daily metrics differ from historical reference for % at %',dest,at; end if;
    end loop;
  end loop;
  -- Exercise repeated cached execution as well as the default planner mode.
  perform set_config('plan_cache_mode','force_generic_plan',true);
  for attempt in 1..12 loop
    if public.literary_news_delivery_day_status('-100123','2026-10-25T12:00:00Z')
      is distinct from public.literary_news_delivery_day_status_reference('-100123','2026-10-25T12:00:00Z')
      then raise exception 'Generic cached plan changed metrics'; end if;
  end loop;
  execute ${literal('explain (format json) ' + select)} into plan;
  if not exists (
    with recursive nodes(n) as (
      select plan->0->'Plan' union all select child.value from nodes
      cross join lateral jsonb_array_elements(coalesce(n->'Plans','[]'::jsonb)) child
    ) select 1 from nodes where n->>'Subplan Name'='CTE latest_rows'
  ) then raise exception 'Latest-state materialization fence missing from actual plan'; end if;
  if exists (
    with recursive nodes(n) as (
      select plan->0->'Plan' union all select child.value from nodes
      cross join lateral jsonb_array_elements(coalesce(n->'Plans','[]'::jsonb)) child
    ) select 1 from nodes where n->>'Relation Name'='admin_audit_log' and coalesce(n->>'Filter','') like '%metadata%'
  ) then raise exception 'JSON predicate escaped to the immutable journal scan'; end if;
  if has_function_privilege('anon','public.literary_news_delivery_day_status(text,timestamptz)','execute')
    or has_function_privilege('authenticated','public.literary_news_delivery_day_status(text,timestamptz)','execute')
    or not has_function_privilege('service_role','public.literary_news_delivery_day_status(text,timestamptz)','execute')
    then raise exception 'Service-only ACL changed'; end if;
  if exists(select 1 from pg_proc where oid='public.literary_news_delivery_day_status(text,timestamptz)'::regprocedure
    and (prosecdef or not proconfig @> array['search_path=""'])) then raise exception 'Invoker/search_path boundary changed'; end if;
end;
$fixture$;
reset role;
do $fixture$ declare observed jsonb; begin
  observed := public.literary_news_delivery_day_status('-100123','2026-10-25T12:00:00Z');
  set local role service_role;
  if (observed->>'acknowledgedCreates')::integer <> (public.literary_news_delivery_day_status('-100123','2026-10-25T12:00:00Z')->>'acknowledgedCreates')::integer + 1
    then raise exception 'Invoker RPC does not preserve caller RLS'; end if;
end; $fixture$;
reset role;
create temporary table fixture_before as select count(*) as count from public.admin_audit_log;
${optimized}
do $fixture$ begin
  if (select count(*) from public.admin_audit_log)<>(select count from fixture_before)
    then raise exception 'Reapplying metrics SQL changed journal history'; end if;
end; $fixture$;
select 'day_status_bounded_differential_passed' as result;
`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const modulePath = process.argv.find(argument => argument.startsWith('--pglite='))?.slice(9);
  if (!modulePath || process.argv.length !== 3) throw Error('Provide --pglite=module; only a disposable in-memory database is used.');
  const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
  const database = new PGlite();
  try {
    await database.exec(await buildDayStatusBoundedFixture());
    console.log(JSON.stringify({ passed: true, engine: 'isolated PGlite PostgreSQL', differentialCases: 36,
      genericPlanRepeated: true, materializedPlanVerified: true, serviceOnlyAcl: true, invokerRls: true,
      idempotent: true, remoteDatabaseWrites: 0 }));
  } finally { await database.close(); }
}

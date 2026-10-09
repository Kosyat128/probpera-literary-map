import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9);
if (!modulePath) throw Error('Provide --pglite=path; this checker never connects to a remote database.');
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite(), checks = [];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.admin_audit_log(id bigint generated always as identity primary key,entity_type text,entity_id text,metadata jsonb);
    create index admin_audit_literary_news_runtime_key_version on public.admin_audit_log(entity_id,id desc)
      where entity_type='literary_news_runtime';
    grant select on public.admin_audit_log to service_role;
    alter table public.admin_audit_log enable row level security;
    create policy runtime_service_read on public.admin_audit_log for select to service_role using(entity_type='literary_news_runtime');`);
  const source = await readFile(new URL('./database/literary-news-operations-supply.sql', import.meta.url), 'utf8');
  await db.exec(source);
  const now = '2026-10-09T10:00:00Z', destination = { platform: 'telegram', id: '-100123' }, revision = 'a'.repeat(64);
  const temporal = { kind: 'news', eventDate: '2026-10-09', publishedAt: '2026-10-09T09:00:00Z', verifiedAt: now };
  const key = id => 'post:news:' + id + ':telegram:' + destination.id;
  const candidate = id => ({ key: key(id), textRevision: revision, temporal });
  const candidates = ['a%20b', 'photo', 'later', 'after-close', 'expired-inflight', 'live-inflight', 'ambiguous',
    'expired-dispatch', 'stale-revision', 'stale-temporal', 'mismatched-prepared', 'already-sent', 'missing', 'malformed-due',
    'withdrawn', 'unknown-remote', 'bad-prepared'].map(candidate);
  const state = id => ({ key: key(id), newsId: id, destination, status: 'pending', originalAdmission: now,
    desiredRevision: revision, nextDueAt: now, prepared: { revision, textRevision: revision, temporal } });
  const insert = async (id, change = {}) => db.query("insert into public.admin_audit_log(entity_type,entity_id,metadata) values('literary_news_runtime',$1,$2)",
    [key(id), { ...state(id), ...change }]);
  await insert('a%20b'); await insert('aX20b');
  await insert('photo', { withdrawal: null, prepared: { ...state('photo').prepared, media: { assetId: 'fixture' } } });
  await insert('later', { nextDueAt: '2026-10-09T19:59:00Z' });
  await insert('after-close', { nextDueAt: '2026-10-09T20:00:00Z' });
  await insert('expired-inflight', { status: 'inflight', leaseUntil: '2026-10-09T09:59:00Z' });
  await insert('live-inflight', { status: 'inflight', leaseUntil: '2026-10-09T10:01:00Z' });
  await insert('ambiguous', { status: 'ambiguous', attemptId: 'private-attempt-marker' });
  await insert('expired-dispatch', { status: 'inflight', dispatchStartedAt: '2026-10-09T09:58:00Z', leaseUntil: '2026-10-09T09:59:00Z' });
  await insert('stale-revision', { prepared: { ...state('stale-revision').prepared, textRevision: 'b'.repeat(64) } });
  await insert('stale-temporal', { prepared: { ...state('stale-temporal').prepared, temporal: { ...temporal, verifiedAt: '2026-10-09T09:00:00Z' } } });
  await insert('mismatched-prepared', { desiredRevision: 'b'.repeat(64) });
  await insert('already-sent'); await insert('already-sent', { status: 'sent_current', remoteId: '42', firstAcknowledgedAt: now });
  await insert('malformed-due', { nextDueAt: '2026-02-30' });
  await insert('withdrawn', { withdrawal: { revision: 'c'.repeat(64) } });
  await insert('unknown-remote', { firstAcknowledgedAt: now });
  await insert('bad-prepared', { prepared: null });
  await db.exec('set role service_role');
  const supply = async (rows = candidates, at = now, dest = destination.id) => (await db.query(
    'select public.literary_news_operations_supply($1,$2,$3) as value', [dest, rows, at])).rows[0].value;
  const counts = await supply();
  assert.equal(counts.candidateCount, 17); assert.equal(counts.readyNow, 3); assert.equal(counts.readyByClose, 4);
  assert.equal(counts.ambiguous, 2); assert.equal(counts.acknowledged, 1); assert.equal(counts.inflight, 1);
  assert.equal(counts.missing, 1); assert.equal(counts.stale, 4);
  assert.match(counts.ambiguousFingerprint, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(counts).includes('private-attempt-marker'), false);
  checks.push('exact current public revisions, text/photo reserve, retry dates, leases, unknown dispatches, missing states and latest receipts');
  assert.deepEqual(await supply([candidate('a%20b')]), { schemaVersion: 1, checkedAt: counts.checkedAt, candidateCount: 1,
    readyNow: 1, readyByClose: 1, ambiguous: 0, ambiguousFingerprint: null, acknowledged: 0, inflight: 0, missing: 0, stale: 0 });
  checks.push('encoded percent keys cannot become LIKE wildcards');
  assert.equal((await supply([candidate('later')])).readyByClose, 1);
  assert.equal((await supply([candidate('after-close')])).readyByClose, 0);
  assert.equal((await supply([candidate('malformed-due')])).readyNow, 0);
  checks.push('exclusive Moscow closing boundary and corrupt retry timestamps never create ready reserve');
  const repeated = await supply(); assert.equal(repeated.ambiguousFingerprint, counts.ambiguousFingerprint);
  assert.equal((await supply([], now)).candidateCount, 0);
  checks.push('stable ambiguity identity and empty verified candidate set');
  for (const rows of [[candidate('a%20b'), candidate('a%20b')], Array.from({ length: 25 }, (_, index) => candidate('many-' + index)),
    [{ ...candidate('a%20b'), key: 'post:news:a%20b:telegram:-100456' }], [{ ...candidate('a%20b'), textRevision: 'bad' }],
    [{ ...candidate('a%20b'), temporal: { ...temporal, rawArticle: 'unbounded' } }], [{ ...candidate('a%20b'), temporal: null }], null, {}])
    await assert.rejects(supply(rows));
  await assert.rejects(supply(candidates, null)); await assert.rejects(supply(candidates, now, 'bad'));
  checks.push('bounded input, exact destination keys, duplicate candidates and invalid semantic hashes rejected');
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role); await assert.rejects(supply());
  }
  checks.push('public and authenticated clients cannot execute the service-only query');
  await db.exec('reset role');
  const definition = (await db.query("select prosecdef,proconfig from pg_proc where proname='literary_news_operations_supply'")).rows[0];
  assert.equal(definition.prosecdef, false); assert.equal(definition.proconfig.includes('search_path=""'), true);
  const before = (await db.query('select count(*)::int as count from public.admin_audit_log')).rows[0].count;
  await db.exec(source);
  assert.equal((await db.query('select count(*)::int as count from public.admin_audit_log')).rows[0].count, before);
  checks.push('invoker RLS, empty search path and reapplication preserve every immutable journal row');
  console.log(JSON.stringify({ status: 'passed', checks, remoteDatabaseWrites: 0 }, null, 2));
} finally { await db.close(); }

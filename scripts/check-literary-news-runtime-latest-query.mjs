import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const modulePath = process.argv.find(arg => arg.startsWith("--pglite="))?.slice(9);
if (!modulePath) throw Error("Provide --pglite=path; this checker never connects to a remote DB.");
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite(), checks = [];
try {
  await db.exec("create role anon; create role authenticated; create role service_role; create table public.admin_audit_log(id bigint generated always as identity primary key, entity_type text, entity_id text, metadata jsonb); grant select on public.admin_audit_log to service_role; alter table public.admin_audit_log enable row level security; create policy runtime_service_read on public.admin_audit_log for select to service_role using(entity_type='literary_news_runtime');");
  await db.exec(await readFile(new URL("./database/literary-news-runtime-latest-query.sql", import.meta.url), "utf8"));
  for (const [key, state] of [["post:news:a", { status: "inflight" }], ["post:news:b", { status: "pending" }],
    ["post:news:a", { status: "sent_current", remoteId: "17" }], ["post:news:a%20b", { status: "blocked" }],
    ["post:news:aX20b", { status: "pending" }]])
    await db.query("insert into public.admin_audit_log(entity_type,entity_id,metadata) values('literary_news_runtime',$1,$2)", [key, state]);
  await db.exec("set role service_role");
  const query = (prefix, after = null, limit = 500) => db.query("select * from public.read_latest_literary_news_runtime($1,$2,$3)", [prefix, after, limit]);
  const page1 = (await query("post:", null, 2)).rows;
  assert.equal(page1.length, 2); assert.equal(page1[0].metadata.remoteId, "17");
  const page2 = (await query("post:", page1.at(-1).entity_id, 2)).rows;
  assert.equal(page2.length, 2); assert.equal(new Set([...page1, ...page2].map(row => row.entity_id)).size, 4);
  checks.push("latest complete receipts and keyset pages");
  assert.equal((await query("post:news:a%20")).rows.length, 1);
  checks.push("encoded keys cannot become LIKE wildcards");
  for (const args of [["articles:", null, 2], ["post:", "history:other", 2], ["post:", null, 501]])
    await assert.rejects(query(...args));
  checks.push("bounded namespace, cursor and page size");
  const body = (await db.query("select prosecdef from pg_proc where proname='read_latest_literary_news_runtime'")).rows[0];
  assert.equal(body.prosecdef, false); checks.push("security invoker preserves caller RLS");
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role; set role " + role);
    await assert.rejects(query("post:"));
  }
  checks.push("anon and authenticated cannot execute the service-only query");
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int as n from public.admin_audit_log")).rows[0].n, 5);
  checks.push("all historical rows retained");
  const now = '2026-09-29T12:00:00Z', destination = { platform: 'telegram', id: '-100123' };
  const base = { destination, status: 'pending', nextDueAt: now, prepared: { media: { assetId: 'fixture' },
    temporal: { kind: 'news', publishedAt: '2026-09-29' } } };
  const insert = async (id, change = {}) => db.query("insert into public.admin_audit_log(entity_type,entity_id,metadata) values('literary_news_runtime',$1,$2)",
    ['post:news:' + id + ':telegram:' + destination.id, { ...base, ...change }]);
  await insert('fresh'); await insert('already-sent', { status: 'pending' });
  await insert('already-sent', { status: 'sent_current', remoteId: '1', remoteMediaKind: 'photo', firstAcknowledgedAt: now });
  await insert('old', { prepared: { ...base.prepared, temporal: { kind: 'news', publishedAt: '2025-01-01' } } });
  await insert('undated', { prepared: { ...base.prepared, temporal: { kind: 'news', publishedAt: null } } });
  await insert('text-only', { prepared: { ...base.prepared, media: null } });
  await insert('malformed-time', { nextDueAt: '2026-02-30' });
  await insert('future', { nextDueAt: '2027-01-01T00:00:00Z' });
  await insert('expired-inflight', { status: 'inflight', leaseUntil: '2026-09-29T11:00:00Z' });
  await insert('live-inflight', { status: 'inflight', leaseUntil: '2026-09-29T13:00:00Z' });
  await insert('ambiguous', { status: 'ambiguous', remoteId: '2' });
  await insert('correction', { status: 'correction_pending', remoteId: '3',
    prepared: { ...base.prepared, temporal: { kind: 'news', publishedAt: '2025-01-01' } } });
  await insert('legacy', { status: 'sent_current', remoteId: '4', remoteMediaKind: 'photo', acknowledgedAt: now });
  await insert('old-first', { status: 'sent_current', remoteId: '5', remoteMediaKind: 'photo',
    firstAcknowledgedAt: '2026-09-28T00:00:00Z', acknowledgedAt: now });
  await insert('same-moscow-day', { status: 'sent_current', remoteId: '6', remoteMediaKind: 'photo',
    firstAcknowledgedAt: '2026-09-28T22:00:00Z' });
  await db.exec('set role service_role');
  const due = () => db.query('select * from public.read_due_literary_news_runtime_posts($1,$2,$3)', [destination.id, now, 20]);
  const eligible = (await due()).rows;
  assert.deepEqual(eligible.map(row => row.entity_id.split(':')[2]).sort(), ['correction', 'expired-inflight', 'fresh']);
  assert.equal(eligible[0].metadata.remoteId, '3'); checks.push('due-only bounded photos, existing corrections, leases and corrupt timestamps');
  const status = () => db.query('select public.literary_news_delivery_day_status($1,$2) as value', [destination.id, now]);
  const day = (await status()).rows[0].value;
  assert.equal(day.editorialDay, '2026-09-29'); assert.equal(day.freshPhotoCreates, 2);
  assert.equal(day.deficitToMinimum, 8); assert.equal(day.legacyReceiptsWithUnknownFirstDate, 3);
  checks.push('Moscow-day first receipts, old edits excluded, legacy dates unknown');
  await assert.rejects(db.query('select * from public.read_due_literary_news_runtime_posts($1,$2,21)', [destination.id, now]));
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role); await assert.rejects(due()); await assert.rejects(status());
  }
  checks.push('due and day stats denied to public authenticated clients');
  await db.exec('reset role');
  const definitions = (await db.query("select prosecdef from pg_proc where proname in ('read_due_literary_news_runtime_posts','literary_news_delivery_day_status')")).rows;
  assert.equal(definitions.length, 2); assert.equal(definitions.every(row => row.prosecdef === false), true);
  checks.push('all new RPCs preserve invoker RLS and immutable journal');
  console.log(JSON.stringify({ status: "passed", checks, remoteDatabaseWrites: 0 }, null, 2));
} finally { await db.close(); }

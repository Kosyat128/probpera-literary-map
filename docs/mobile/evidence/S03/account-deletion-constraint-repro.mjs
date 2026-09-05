import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const schema = await readFile('supabase/schema.sql', 'utf8');
const cms = await readFile('supabase/migrations/20260728_cms_foundation.sql', 'utf8');
const table = (source, name) => { const result = source.match(new RegExp('create table(?: if not exists)? public\\.' + name + ' \\([\\s\\S]*?\\n\\);', 'u')); if (!result) throw new Error('Missing exact table source: ' + name); return result[0]; };
const db = new PGlite();
// The auth table is an explicitly minimal in-memory fixture; public table DDL
// and constraints below are read verbatim from canonical source, not rewritten.
await db.exec(`create schema auth; create table auth.users(id uuid primary key); create type public.community_role as enum ('reader','moderator','editor','admin'); create type public.publication_status as enum ('published','hidden','pending'); create type public.staff_role as enum ('owner','admin','editor');`);
for (const name of ['profiles', 'forum_topics', 'forum_replies', 'article_comments', 'ratings']) await db.exec(table(schema, name));
await db.exec(table(cms, 'staff_memberships'));
await db.exec(schema.match(/create unique index ratings_user_unique_idx[\s\S]*?where user_id is not null;/u)[0]);
await db.exec(schema.match(/create unique index ratings_guest_unique_idx[\s\S]*?where user_id is null;/u)[0]);
const subject = '123e4567-e89b-42d3-a456-426614174000';
const other = '223e4567-e89b-42d3-a456-426614174000';
const session = '323e4567-e89b-42d3-a456-426614174000';
const topic = '423e4567-e89b-42d3-a456-426614174000';
const findings = [];
async function scenario(name, prepare, after) {
  await db.exec('begin');
  try {
    await db.exec(`insert into auth.users values ('${subject}'),('${other}'); insert into public.profiles(id,display_name) values ('${subject}','Reader'),('${other}','Other reader');`);
    await db.exec(prepare);
    await db.exec(`delete from auth.users where id='${subject}'`);
    findings.push({ scenario: name, deleted: true, ...(after ? { result: (await db.query(after)).rows } : {}) });
  } catch (error) { findings.push({ scenario: name, deleted: false, sqlState: error.code, constraint: error.constraint }); }
  finally { await db.exec('rollback'); }
}
await scenario('bare-reader-profile-cascades', 'select 1', `select count(*)::int as profiles_remaining from public.profiles where id='${subject}'`);
await scenario('registered-comment-blocks-delete', `insert into public.article_comments(article_slug,author_id,guest_name,session_id,body) values ('article-slug','${subject}',null,'${session}','Registered reader comment');`);
await scenario('guest-and-user-rating-same-session-blocks-delete', `insert into public.ratings(subject_type,subject_id,user_id,session_id,score) values ('book','canonical-book',null,'${session}',4),('book','canonical-book','${subject}','${session}',5);`);
await scenario('auth-cascade-bypasses-owner-RPC', `insert into public.staff_memberships(user_id,role) values ('${subject}','owner');`, `select count(*)::int as owner_count from public.staff_memberships where role='owner'`);
await scenario('forum-topic-cascade-removes-other-reader-reply', `insert into public.forum_topics(id,author_id,title,body,category) values ('${topic}','${subject}','Topic title','Long enough topic content','Books'); insert into public.forum_replies(topic_id,author_id,body) values ('${topic}','${other}','Other reader reply');`, `select count(*)::int as other_reader_replies from public.forum_replies where author_id='${other}'`);
await db.close();
const report = { limitation: 'Local PGlite with minimal auth.users fixture and verbatim selected public DDL. Does not claim deployed migration parity or execute an Auth Admin API.', sourceHashes: { 'supabase/schema.sql':createHash('sha256').update(schema).digest('hex'), 'supabase/migrations/20260728_cms_foundation.sql':createHash('sha256').update(cms).digest('hex') }, findings };
await mkdir('.tmp/worker-review', { recursive: true });
await writeFile('.tmp/worker-review/account-deletion-constraint-repro.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Exact canonical setup inputs; bind these bytes as well as the helper source.
// schema.sql is an additional dependency outside the standard thirteen roots.
export const SETUP_INPUT_PATHS = Object.freeze([
  "supabase/schema.sql",
  "supabase/migrations/20260802_reader_journey.sql",
  "supabase/migrations/20260905_book_dossiers_v2.sql",
  "supabase/migrations/20260728_cms_foundation.sql",
  "supabase/migrations/20260905_literary_planet_web_license.sql",
  "supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql",
  "supabase/migrations/20261001190736_planet_verified_payment_retry.sql",
]);

const read = path => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");
function table(source, name) {
  const match = source.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`, "u"));
  if (!match) throw Error("Missing canonical table " + name);
  return match[0];
}

// This is the rich setup from the existing canonical reader-deletion fixture:
// local role/Auth/Storage scaffolding plus actual schema/journey/CMS tables.
// It executes the real foundation, deletion processor and generated migration.
// One connection proves SQL constraints/ACL/rollback behavior, not contention
// or live Supabase Auth, Storage, payment-provider or production acceptance.
export async function createPaymentRetryTestDatabase() {
  const [canonical, journey, dossiers, cms, foundation, processorSql, retrySql] = SETUP_INPUT_PATHS.map(read);
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create schema storage; grant usage on schema public,auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      create table storage.objects(id uuid primary key,bucket_id text not null,name text not null,owner_id text,owner uuid,unique(bucket_id,name));
      create type public.community_role as enum ('reader','moderator','editor','admin');
      create type public.publication_status as enum ('published','hidden','pending');`);
    for (const name of ["profiles", "forum_topics", "forum_replies", "article_comments", "ratings", "content_views", "reader_favorites", "reader_book_collections", "reader_book_collection_items", "reader_book_favorites", "comment_reports"]) await db.exec(table(canonical, name));
    for (const name of ["reader_progress", "reader_subscriptions", "reader_notifications"]) await db.exec(table(journey, name));
    await db.exec(table(dossiers, "book_dossiers"));
    const enumMatch = cms.match(/create type public\.staff_role as enum \([\s\S]*?\);/u);
    if (!enumMatch) throw Error("Missing canonical staff enum");
    await db.exec(enumMatch[0]); await db.exec(table(cms, "staff_memberships"));
    await db.exec(foundation); await db.exec(processorSql); await db.exec(retrySql);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

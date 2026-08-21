import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// These checksums are an approval boundary, not generated bookkeeping. A
// historical file change must be reviewed and deliberately reflected here
// before the production workflow can build a plan.
const reviewedMigrations = [
  ["20260808_article_translations.sql", "37915d5aa77a4d647ea8bc9b84923b8c07fe148e7c6f301cabf5bb685909d372"],
  ["20260808_book_translations_and_import_staging.sql", "2f7896316307c678c9139f8849ca4cb9930baea5bfc86c3441f281b17203b744"],
  ["20260812_homepage_block_revisions.sql", "f261d7249c4aaf2a6db20ad8a5b2a587d00e417b8cadcd1f1b4ae7d496ba1a22"],
  ["20260812_writer_and_work_revisions.sql", "76d9b65a2fc37aa03ffda3b293b09011dfaf316baa1c2153afaecd334c5c135f"],
  ["20260813_editorial_database_admin.sql", "fb28408f56efe29c6173395af3d78c58f46cc8a766249e08f3d8b7ed91588819"],
  ["20260813_homepage_atomic_move.sql", "34cd8a00b8ae55c0a3126226a597c06c6d0f1d653b8095806d4372496905a185"],
  ["20260813_tags_updated_at.sql", "e7e7475d11af036a3cabf55a7f35831d7da5a8a18745979be26313e33f8386e7"],
  ["20260813_unified_revision_history.sql", "e851c9e2a8d4a4af2760be2798de40a59dcc2ce4ada35e8ca49209f87b81c42e"],
  ["20260814_publication_outbox_and_schema_health.sql", "795274d300104dcf41edb43fb5fd8e7079badb14bf5747f9d0190021a914456e"],
  ["20260820_homepage_book_month_editorial_choice.sql", "436bb25b4513ed451320489278fda8670a1e4ada9f66b065fd6b734ba84c729f"],
  ["20260820_literary_work_cover_artworks.sql", "e39ba6da664bcb2c3b4c5c78fa1e6ff6f46d420453d5575e113b92635e1f5c58"],
  ["20260822_staff_editorial_read_rls.sql", "c50cda9a947cda1769c6aa36db81181dda988738e5dcf0ff7f2711d43faf03c9"],
];

const reviewedHotfixes = [
  [
    "20260821_articles_staff_read_rls.sql",
    "e148b1f35cc49e1ed1eeb3bd116b625bfcd1784e7c32f6ee3baacc3f345cc82b",
  ],
  [
    "20260821_media_assets_staff_read_rls.sql",
    "1b03d20025d5bc8bc8ec6ab1bf38f1d92fb8892650c6f466d39aa528d3b2abf8",
  ],
];

function fail(message) {
  throw new Error(`Production migration plan rejected: ${message}`);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      fail("arguments must be --name value pairs");
    }
    values.set(name.slice(2), value);
  }

  const result = {
    output: values.get("output"),
    manifest: values.get("manifest"),
    verification: values.get("verification"),
    repositorySha: values.get("repository-sha"),
  };
  for (const [name, value] of Object.entries(result)) {
    if (!value) fail(`missing --${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(result.repositorySha)) {
    fail("repository SHA must be exactly 40 lowercase hexadecimal characters");
  }
  return result;
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function policyNames(source) {
  return [...source.matchAll(/create\s+policy\s+"([^"]+)"/giu)].map(
    (match) => match[1]
  );
}

function assertStaticSafety(filename, source) {
  if (/^\s*\\/mu.test(source)) {
    fail(`${filename} contains a psql meta-command`);
  }
  if (/^\s*(?:begin|commit|rollback)\s*;/gimu.test(source)) {
    fail(`${filename} controls its own transaction`);
  }
  if (/\bdrop\s+(?:table|schema|column)\b/iu.test(source)) {
    fail(`${filename} contains destructive DROP DDL`);
  }
  if (/\btruncate\b/iu.test(source)) {
    fail(`${filename} contains TRUNCATE`);
  }

  for (const match of source.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([^\s(]+)/giu)) {
    fail(`${filename} creates non-idempotent table ${match[1]}`);
  }
  for (const name of policyNames(source)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const dropPattern = new RegExp(
      `drop\\s+policy\\s+if\\s+exists\\s+"${escaped}"`,
      "iu"
    );
    if (!dropPattern.test(source)) {
      fail(`${filename} creates policy ${name} without DROP POLICY IF EXISTS`);
    }
  }

  for (const match of source.matchAll(/create\s+trigger\s+([a-z0-9_]+)/giu)) {
    const triggerName = match[1];
    const escaped = triggerName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (!new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${escaped}`, "iu").test(source)) {
      fail(`${filename} creates trigger ${triggerName} without an idempotent guard`);
    }
  }

  for (const match of source.matchAll(
    /create\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)([a-z0-9_]+)/giu
  )) {
    const indexName = match[1];
    const escaped = indexName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (!new RegExp(`drop\\s+index\\s+if\\s+exists(?:\\s+public\\.)?${escaped}`, "iu").test(source)) {
      fail(`${filename} creates index ${indexName} without an idempotent guard`);
    }
  }
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function ledgerValues(migrations) {
  return migrations
    .map(
      ({ version, digest }) =>
        `      (${sqlLiteral(version)}, ${sqlLiteral(digest)})`
    )
    .join(",\n");
}

function buildPreflight(migrations) {
  const values = ledgerValues(migrations);
  return `
do $probpera_ledger_preflight$
declare
  checksum_mismatch text;
  unexpected_migrations text;
begin
  if to_regclass('public.probpera_schema_migrations') is not null then
    execute $probpera_checksum_query$
      select string_agg(expected.version, ', ' order by expected.version)
      from public.probpera_schema_migrations actual
      join (values
${values}
      ) as expected(version, migration_sha256)
        on expected.version = actual.version
      where actual.migration_sha256 <> expected.migration_sha256
    $probpera_checksum_query$
    into checksum_mismatch;

    if checksum_mismatch is not null then
      raise exception 'Historical migration checksum mismatch: %', checksum_mismatch;
    end if;

    execute $probpera_unexpected_query$
      select string_agg(actual.version, ', ' order by actual.version)
      from public.probpera_schema_migrations actual
      where not exists (
        select 1
        from (values
${values}
        ) as expected(version, migration_sha256)
        where expected.version = actual.version
      )
    $probpera_unexpected_query$
    into unexpected_migrations;

    if unexpected_migrations is not null then
      raise exception 'Database ledger contains migrations outside this plan: %', unexpected_migrations;
    end if;
  end if;
end;
$probpera_ledger_preflight$;
`;
}

function buildLedgerWrite(migrations, repositorySha) {
  const values = migrations
    .map(
      ({ version, digest }) =>
        `  (${sqlLiteral(version)}, ${sqlLiteral(digest)}, ${sqlLiteral(repositorySha)})`
    )
    .join(",\n");
  return `
insert into public.probpera_schema_migrations (
  version,
  migration_sha256,
  repository_sha
)
values
${values}
on conflict (version) do nothing;
`;
}

function buildInvariants(migrations) {
  const values = ledgerValues(migrations);
  return `
do $probpera_reconciliation_invariants$
declare
  health jsonb;
  staff_user uuid;
  recorded_migrations integer;
  invalid_indexes integer;
  outbox_triggers integer;
begin
  if to_regclass('public.article_translations') is null
    or to_regclass('public.literary_work_translations') is null
    or to_regclass('public.writer_profile_overrides') is null
    or to_regclass('public.country_profile_overrides') is null
    or to_regclass('public.public_build_outbox') is null
    or to_regclass('public.probpera_schema_migrations') is null
    or to_regclass('public.admin_revision_history') is null
    or to_regclass('public.literary_work_cover_artworks') is null then
    raise exception 'Required editorial relation is missing after reconciliation';
  end if;

  if to_regprocedure('public.get_editorial_schema_health()') is null
    or to_regprocedure('public.enqueue_public_build_request(text,text,text,jsonb)') is null
    or to_regprocedure('public.move_homepage_block(uuid,text)') is null then
    raise exception 'Required editorial RPC is missing after reconciliation';
  end if;

  select count(*) into recorded_migrations
  from public.probpera_schema_migrations actual
  join (values
${values}
  ) as expected(version, migration_sha256)
    on expected.version = actual.version
   and expected.migration_sha256 = actual.migration_sha256;
  if recorded_migrations <> ${migrations.length} then
    raise exception 'Migration ledger verification failed: % of ${migrations.length}', recorded_migrations;
  end if;
  if (select count(*) from public.probpera_schema_migrations) <> ${migrations.length} then
    raise exception 'Migration ledger contains entries outside the approved plan';
  end if;

  select count(*) into invalid_indexes
  from pg_catalog.pg_index
  where not indisvalid;
  if invalid_indexes <> 0 then
    raise exception 'Database contains % invalid indexes', invalid_indexes;
  end if;

  if (select count(*) from public.articles) = 0
    or (select count(*) from public.article_translations)
       < (select count(*) from public.articles) then
    raise exception 'Article translation coverage invariant failed';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
      and position('is_staff' in coalesce(qual, '')) > 0
      and (
        (tablename = 'articles' and policyname = 'Staff read articles')
        or (
          tablename = 'article_translations'
          and policyname = 'Staff read article translations'
        )
        or (
          tablename = 'media_assets'
          and policyname = 'Staff read media metadata'
        )
      )
  ) <> 3 then
    raise exception 'Staff editorial read policies are missing after reconciliation';
  end if;

  select count(*) into outbox_triggers
  from pg_catalog.pg_trigger outbox_trigger
  join pg_catalog.pg_class relation on relation.oid = outbox_trigger.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and not outbox_trigger.tgisinternal
    and outbox_trigger.tgfoid = 'public.capture_public_build_outbox()'::regprocedure
    and outbox_trigger.tgname = (relation.relname::text || '_public_build_outbox')::name;
  if outbox_triggers <> 21 then
    raise exception 'Expected 21 publication triggers, found %', outbox_triggers;
  end if;

  select user_id into staff_user
  from public.staff_memberships
  order by case role when 'owner' then 1 when 'admin' then 2 else 3 end, user_id
  limit 1;
  if staff_user is null then
    raise exception 'Schema health RPC cannot be verified without a staff membership';
  end if;
  perform set_config('request.jwt.claim.sub', staff_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', staff_user, 'role', 'authenticated')::text,
    true
  );
  health := public.get_editorial_schema_health();
  if health is null
    or health ->> 'version' <> '20260822_staff_editorial_read_rls'
    or not coalesce((health ->> 'outbox')::boolean, false)
    or not coalesce((health ->> 'outboxRpc')::boolean, false)
    or not coalesce((health ->> 'migrationLedger')::boolean, false)
    or not coalesce((health ->> 'publicationTriggers')::boolean, false)
    or not coalesce((health ->> 'staffEditorialReadPolicies')::boolean, false)
    or not coalesce((health ->> 'revisionHistory')::boolean, false)
    or not coalesce((health ->> 'workTranslations')::boolean, false)
    or not coalesce((health ->> 'workCoverArtworks')::boolean, false)
    or not coalesce((health ->> 'countryOverrides')::boolean, false)
    or not coalesce((health ->> 'writerOverrides')::boolean, false)
    or not coalesce((health ->> 'homepageMove')::boolean, false)
    or not coalesce((health ->> 'tagsUpdatedAt')::boolean, false) then
    raise exception 'Editorial schema health RPC did not report a current schema';
  end if;
end;
$probpera_reconciliation_invariants$;
`;
}

function buildVerificationSql(migrationCount) {
  return `\\set ON_ERROR_STOP on
\\set QUIET 1
do $probpera_health_identity$
declare
  staff_user uuid;
begin
  select user_id into staff_user
  from public.staff_memberships
  order by case role when 'owner' then 1 when 'admin' then 2 else 3 end, user_id
  limit 1;
  if staff_user is null then
    raise exception 'No staff membership is available for the health RPC';
  end if;
  perform set_config('request.jwt.claim.sub', staff_user::text, false);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', staff_user, 'role', 'authenticated')::text,
    false
  );
end;
$probpera_health_identity$;
\\pset tuples_only on
\\pset format unaligned
select concat(
  'schema_health=', health ->> 'version',
  ';outbox=', health ->> 'outbox',
  ';outbox_rpc=', health ->> 'outboxRpc',
  ';publication_triggers=', health ->> 'publicationTriggers',
  ';staff_editorial_read_policies=', health ->> 'staffEditorialReadPolicies',
  ';revision_history=', health ->> 'revisionHistory',
  ';work_translations=', health ->> 'workTranslations',
  ';work_cover_artworks=', health ->> 'workCoverArtworks',
  ';country_overrides=', health ->> 'countryOverrides',
  ';writer_overrides=', health ->> 'writerOverrides',
  ';homepage_move=', health ->> 'homepageMove',
  ';tags_updated_at=', health ->> 'tagsUpdatedAt',
  ';migration_ledger=', health ->> 'migrationLedger',
  ';ledger_entries=', (
    select count(*) from public.probpera_schema_migrations
  ),
  ';invalid_indexes=', (
    select count(*) from pg_catalog.pg_index where not indisvalid
  )
)
from (select public.get_editorial_schema_health() as health) probe
where health is not null
  and (select count(*) from public.probpera_schema_migrations) >= ${migrationCount};
`;
}

function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const migrations = reviewedMigrations.map(([filename, expectedDigest]) => {
    const migrationPath = path.join(
      repositoryRoot,
      "supabase",
      "migrations",
      filename
    );
    const source = readFileSync(migrationPath, "utf8").replaceAll("\r\n", "\n");
    const digest = sha256(source);
    if (digest !== expectedDigest) {
      fail(`${filename} does not match its reviewed SHA-256`);
    }
    assertStaticSafety(filename, source);
    return {
      filename,
      version: filename.replace(/\.sql$/u, ""),
      digest,
      source,
    };
  });
  const hotfixes = reviewedHotfixes.map(([filename, expectedDigest]) => {
    const hotfixPath = path.join(
      repositoryRoot,
      "supabase",
      "hotfixes",
      filename
    );
    const source = readFileSync(hotfixPath, "utf8").replaceAll("\r\n", "\n");
    const digest = sha256(source);
    if (digest !== expectedDigest) {
      fail(`${filename} does not match its reviewed SHA-256`);
    }
    assertStaticSafety(filename, source);
    return { filename, digest, source };
  });

  const plan = [
    "-- Generated from the reviewed production migration allowlist.",
    "set local lock_timeout = '15s';",
    "set local statement_timeout = '15min';",
    "set local idle_in_transaction_session_timeout = '5min';",
    "select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('probpera-production-database-reconciliation', 0));",
    buildPreflight(migrations),
    ...migrations.flatMap(({ filename, source }) => [
      `\n-- BEGIN REVIEWED MIGRATION: ${filename}`,
      source.trimEnd(),
      `-- END REVIEWED MIGRATION: ${filename}\n`,
    ]),
    ...hotfixes.flatMap(({ filename, source }) => [
      `\n-- BEGIN REVIEWED HOTFIX: ${filename}`,
      source.trimEnd(),
      `-- END REVIEWED HOTFIX: ${filename}\n`,
    ]),
    buildLedgerWrite(migrations, arguments_.repositorySha),
    buildInvariants(migrations),
    "",
  ].join("\n");

  writeFileSync(path.resolve(arguments_.output), plan, "utf8");
  writeFileSync(
    path.resolve(arguments_.manifest),
    `${JSON.stringify(
      {
        repositorySha: arguments_.repositorySha,
        databaseImage: "public.ecr.aws/supabase/postgres:17.6.1.136",
        migrations: migrations.map(({ filename, version, digest }) => ({
          filename,
          version,
          sha256: digest,
        })),
        hotfixes: hotfixes.map(({ filename, digest }) => ({
          filename,
          sha256: digest,
        })),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(
    path.resolve(arguments_.verification),
    buildVerificationSql(migrations.length),
    "utf8"
  );
}

main();

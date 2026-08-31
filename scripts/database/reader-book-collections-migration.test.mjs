import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const normalizeLineEndings = (value) => value.replace(/\r\n?/gu, "\n");

const migration = normalizeLineEndings(readFileSync(
  path.join(
    root,
    "supabase/migrations/20260827_reader_book_collections.sql",
  ),
  "utf8",
));
const iconMigration = normalizeLineEndings(readFileSync(
  path.join(
    root,
    "supabase/migrations/20260828_reader_book_collection_icons.sql",
  ),
  "utf8",
));
const schema = normalizeLineEndings(
  readFileSync(path.join(root, "supabase/schema.sql"), "utf8"),
);

const tables = [
  "reader_book_collections",
  "reader_book_collection_items",
  "reader_book_favorites",
];

const policyBlock = (name) => {
  const start = migration.indexOf(`create policy "${name}"`);
  expect(start, `missing policy ${name}`).toBeGreaterThanOrEqual(0);
  const next = migration.indexOf("\ncreate policy ", start + 1);
  return migration.slice(start, next < 0 ? migration.length : next);
};

describe("Stage 5D-2 reader book collection migration", () => {
  it("defines the private versioned collection contract in migration and schema", () => {
    for (const table of tables) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(schema).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
    }

    expect(migration).toMatch(
      /collection_type in \('system', 'manual', 'smart', 'editorial'\)/u,
    );
    expect(migration).toContain(
      "id text not null check (id ~ '^[A-Za-z0-9:_-]{1,192}$')",
    );
    expect(migration).toContain("visibility text not null default 'private'");
    expect(migration).toContain("check (visibility = 'private')");
    expect(migration).toContain(
      "system_type in ('library', 'want-to-read', 'reading', 'finished')",
    );
    expect(migration).toContain("dynamic_book_themes boolean not null default true");
    expect(migration).toContain("theme_intensity smallint not null default 70");
    expect(migration).toContain(
      "sort_mode text not null default 'editorial-relevance'",
    );
    expect(migration).toContain(
      "(collection_type = 'system' and system_type is not null)",
    );
    expect(migration).toContain("filter_state jsonb not null default '{}'::jsonb");
    expect(migration).toContain("jsonb_typeof(filter_state) = 'object'");
    expect(migration.match(/schema_version smallint not null default 1/gu)).toHaveLength(3);
    expect(migration.match(/created_at timestamptz not null default now\(\)/gu)).toHaveLength(3);
    expect(migration.match(/updated_at timestamptz not null default now\(\)/gu)).toHaveLength(3);
    expect(migration).toContain(
      "create index if not exists reader_book_collection_items_order_idx",
    );
    expect(migration).toContain(
      "on public.reader_book_collection_items(user_id, collection_id, position)",
    );
    expect(migration).toContain(
      "drop index if exists public.reader_book_collections_owner_name_unique_idx",
    );
    expect(migration).toContain(
      "drop index if exists public.reader_book_collection_items_order_unique_idx",
    );
    expect(migration).toContain(
      "foreign key (user_id, collection_id)\n    references public.reader_book_collections(user_id, id)",
    );
    expect(migration).toContain("primary key (user_id, id)");
    expect(migration).toContain(
      "primary key (user_id, collection_id, book_key)",
    );
  });

  it("keeps every personal row owner-only and exposes nothing to anonymous users", () => {
    const policyNames = [
      ["Readers view their own book collections", "select"],
      ["Readers create their own book collections", "insert"],
      ["Readers update their own book collections", "update"],
      ["Readers delete their own book collections", "delete"],
      ["Readers view their own book collection items", "select"],
      ["Readers create their own book collection items", "insert"],
      ["Readers update their own book collection items", "update"],
      ["Readers delete their own book collection items", "delete"],
      ["Readers view their own book favorites", "select"],
      ["Readers create their own book favorites", "insert"],
      ["Readers update their own book favorites", "update"],
      ["Readers delete their own book favorites", "delete"],
    ];

    for (const [name, command] of policyNames) {
      const block = policyBlock(name);
      expect(block).toContain(`for ${command}`);
      expect(block).toContain("to authenticated");
      expect(block).toContain("user_id = (select auth.uid())");
      expect(block).not.toMatch(/\bto anon\b/iu);
    }

    for (const table of tables) {
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon`,
      );
    }
    expect(migration).not.toMatch(/create policy[^;]+\bto anon\b/isu);
  });

  it("updates timestamps server-side without changing legacy reader state", () => {
    expect(migration).toContain(
      "create or replace function public.set_reader_book_state_updated_at()",
    );
    expect(migration.match(/execute function public\.set_reader_book_state_updated_at\(\)/gu)).toHaveLength(3);
    expect(migration).not.toMatch(/alter table public\.reader_favorites/iu);
    expect(migration).not.toMatch(/drop (?:table|column)[^;]*reader_(?:favorites|progress)/iu);
    expect(migration).toContain(
      "-- The existing reader_favorites and reader_progress contracts remain intact.",
    );
  });

  it("adds the reviewed safe icon whitelist without rewriting the historical migration", () => {
    expect(migration).not.toMatch(/^\s*icon text/gmu);
    expect(iconMigration).toContain(
      "add column if not exists icon text",
    );
    expect(iconMigration).toContain(
      "icon in ('book', 'star', 'quill', 'archive', 'heart')",
    );
    expect(schema).toContain(
      "icon text check (icon in ('book', 'star', 'quill', 'archive', 'heart'))",
    );
  });
});

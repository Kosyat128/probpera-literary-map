import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const migration = read(
  "supabase/migrations/20260901_zz_site_studio_engine.sql"
);
const contract = read("src/data/cms/siteStudioContract.ts");
const cmsFoundation = read("supabase/migrations/20260728_cms_foundation.sql");

function contractValues(name) {
  const body = contract.match(
    new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, "u")
  )?.[1];
  if (!body) throw new Error(`Missing canonical contract array: ${name}`);
  return [...body.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function section(start, end) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  expect(startIndex, start).toBeGreaterThanOrEqual(0);
  expect(endIndex, end).toBeGreaterThan(startIndex);
  return migration.slice(startIndex, endIndex);
}

function sqlCheckValues(source, column) {
  const body = source.match(
    new RegExp(
      `\\b${column} text[\\s\\S]*?\\b${column} in \\(([\\s\\S]*?)\\)\\n  \\)`,
      "u"
    )
  )?.[1];
  if (!body) throw new Error(`Missing SQL vocabulary check: ${column}`);
  return [...body.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
}

function contractComponents() {
  const registry = contract.match(
    /export const siteStudioComponentRegistry = \{([\s\S]*?)\n\} as const satisfies/u
  )?.[1];
  if (!registry) throw new Error("Missing canonical component registry");
  return [...registry.matchAll(
    /(?:"([^"]+)"|([a-z][a-z0-9-]*)): \{\s*capabilities: \[([^\]]*)\],\s*slots: \[([^\]]*)\],\s*states: \[([^\]]*)\],\s*ownerLocked: (true|false),\s*\}/gu
  )].map((match) => ({
    key: match[1] || match[2],
    capabilities: [...match[3].matchAll(/"([^"]+)"/gu)].map((value) => value[1]),
    slots: [...match[4].matchAll(/"([^"]+)"/gu)].map((value) => value[1]),
    states: [...match[5].matchAll(/"([^"]+)"/gu)].map((value) => value[1]),
    ownerLocked: match[6] === "true",
  }));
}

function seededComponents() {
  const seed = section(
    "insert into public.site_component_registry as registry (",
    "create table if not exists public.site_design_tokens"
  );
  return [...seed.matchAll(
    /\(\s*'([^']+)',\s*'[^']+',\s*array\[([^\]]*)\]::text\[\],\s*array\[([^\]]*)\]::text\[\],\s*array\[([^\]]*)\]::text\[\],\s*(true|false),\s*true\s*\)/gu
  )].map((match) => ({
    key: match[1],
    capabilities: [...match[2].matchAll(/'([^']+)'/gu)].map((value) => value[1]),
    slots: [...match[3].matchAll(/'([^']+)'/gu)].map((value) => value[1]),
    states: [...match[4].matchAll(/'([^']+)'/gu)].map((value) => value[1]),
    ownerLocked: match[5] === "true",
  }));
}

describe("Phase 5 Site Studio migration", () => {
  it("shares one strict vocabulary with the canonical TypeScript contract", () => {
    const tokenTable = section(
      "create table if not exists public.site_design_tokens",
      "create table if not exists public.site_design_change_sets"
    );
    for (const [contractName, column] of [
      ["siteStudioTokenCategories", "category"],
      ["siteStudioTokenValueTypes", "value_type"],
      ["siteStudioLayers", "layer"],
      ["siteStudioBreakpoints", "breakpoint"],
      ["siteStudioStates", "state"],
    ]) {
      expect(sqlCheckValues(tokenTable, column), contractName).toEqual(
        contractValues(contractName)
      );
    }
    for (const drift of [
      "'dimension'",
      "'integer'",
      "'boolean'",
      "'enum'",
      "'opacity'",
      "'sizing'",
      "'border'",
    ]) {
      expect(tokenTable).not.toContain(drift);
    }
    expect(migration).toContain(
      "create or replace function public.is_valid_site_design_category_type"
    );
    expect(migration).toContain(
      "create or replace function public.is_valid_site_design_token_value"
    );
    expect(migration).toContain("p_value - array[");
    expect(migration).toContain("url(javascript:alert(1))");
    expect(migration).not.toContain("raw_css");
    expect(migration).not.toContain("raw_javascript");
  });

  it("defines private draft/published tokens with immutable identity and CAS", () => {
    expect(migration).toContain(
      "create table if not exists public.site_design_tokens"
    );
    for (const field of [
      "layer",
      "target_key",
      "token_key",
      "category",
      "value_type",
      "breakpoint",
      "state",
      "draft_value",
      "published_value",
      "cas_version",
    ]) {
      expect(migration).toMatch(new RegExp(`\\b${field}\\b`, "u"));
    }
    const saveToken = section(
      "create or replace function public.save_site_design_token(",
      "create or replace function public.save_site_design_change_set("
    );
    expect(saveToken).toContain(
      "current_token.cas_version <> p_expected_cas_version"
    );
    expect(saveToken).toContain("char_length(p_token_key) > 160");
    expect(saveToken).toContain("site design token identity is immutable");
    expect(saveToken).toMatch(
      /set description = p_description,\s+draft_value = p_draft_value,/u
    );
    expect(saveToken).not.toMatch(/set published_value = p_draft_value/u);
    expect(migration).toContain(
      "create table if not exists public.site_design_token_revisions"
    );
  });

  it("keeps the code-owned component registry typed and owner locked", () => {
    const registry = section(
      "create table if not exists public.site_component_registry",
      "create table if not exists public.site_design_tokens"
    );
    for (const field of [
      "component_key",
      "capabilities",
      "slots",
      "states",
      "owner_lock",
      "registry_version",
    ]) {
      expect(registry).toMatch(new RegExp(`\\b${field}\\b`, "u"));
    }
    for (const capability of contractValues("siteStudioComponentCapabilities")) {
      expect(registry).toContain(`'${capability}'`);
    }
    expect(migration).toMatch(
      /register_site_component_registry_record[\s\S]*auth\.role\(\)[\s\S]*service_role/u
    );
    expect(migration).toMatch(
      /grant execute on function public\.register_site_component_registry_record\([\s\S]*?\) to service_role;/u
    );
    expect(migration).toContain("component is owner locked");
    expect(migration).toContain("'owner'::public.staff_role");
    expect(seededComponents()).toEqual(contractComponents());
    expect(seededComponents()).toHaveLength(8);
    expect(
      seededComponents()
        .filter((component) => component.ownerLocked)
        .map((component) => component.key)
    ).toEqual(["literary-globe", "bookshelf"]);
    expect(migration).toContain("on conflict (component_key) do update");
    expect(migration).toContain("is distinct from (");
  });

  it("records service-role registry reconciliation without forging a user", () => {
    const register = section(
      "create or replace function public.register_site_component_registry_record(",
      "create or replace function public.save_site_design_token("
    );
    const auditTable = cmsFoundation.slice(
      cmsFoundation.indexOf("create table if not exists public.admin_audit_log"),
      cmsFoundation.indexOf("create table if not exists public.publication_jobs")
    );
    expect(register).toContain("coalesce((select auth.role()), '') <> 'service_role'");
    expect(register).toContain("(select auth.uid()),");
    expect(auditTable).toContain("actor_id uuid references auth.users(id)");
    expect(auditTable).not.toMatch(/actor_id uuid not null/u);
  });

  it("enforces the CAS change-set workflow and scheduled approval", () => {
    expect(migration).toContain(
      "create table if not exists public.site_design_change_sets"
    );
    expect(migration).toContain(
      "create table if not exists public.site_design_change_set_items"
    );
    expect(migration).toContain(
      "status in ('draft', 'review', 'approved', 'published', 'cancelled')"
    );
    expect(migration).toContain("scheduled_at timestamptz");
    expect(migration).toContain("expected_token_cas_version");
    expect(migration).toContain("proposed_value jsonb not null");
    for (const rpc of [
      "save_site_design_change_set",
      "set_site_design_change_set_item",
      "remove_site_design_change_set_item",
      "transition_site_design_change_set",
    ]) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
    }
    const transition = section(
      "create or replace function public.transition_site_design_change_set(",
      "create or replace function public.publish_site_design_change_set("
    );
    expect(transition).toContain(
      "current_change_set.status = 'draft' and p_target_status = 'review'"
    );
    expect(transition).toContain(
      "current_change_set.status = 'review'\n    and p_target_status = 'approved'"
    );
    expect(transition).toContain(
      "current_change_set.status in ('draft', 'review', 'approved')"
    );
    expect(transition).not.toContain("p_target_status = 'published'");
  });

  it("publishes one release atomically with one audit and one outbox event", () => {
    const publish = section(
      "create or replace function public.publish_site_design_change_set(",
      "create or replace function public.rollback_site_design_release("
    );
    expect(publish).toMatch(/security definer\s+set search_path = ''/u);
    expect(publish).toContain("pg_advisory_xact_lock(52050103::bigint)");
    expect(publish).toContain("for update of token;");
    expect(publish).toContain(
      "token.cas_version <> item.expected_token_cas_version"
    );
    expect(publish).toContain("current_change_set.scheduled_at > now()");
    expect(publish).toContain("insert into public.site_design_releases");
    expect(publish).toContain("insert into public.site_design_token_revisions");
    expect(publish).toContain("set status = 'published'");
    expect(publish.match(/insert into public\.admin_audit_log/gu)).toHaveLength(1);
    expect(publish.match(/public\.append_public_build_outbox\(/gu)).toHaveLength(
      1
    );
    expect(publish).toContain("'site_design.change_set_published'");
    expect(publish).toContain("'site-design-change-set-published'");
  });

  it("rolls back only the latest complete revision group", () => {
    const rollback = section(
      "create or replace function public.rollback_site_design_release(",
      "create or replace function public.get_published_site_design()"
    );
    expect(rollback).toContain(
      "only the latest site design release can be rolled back"
    );
    expect(rollback).toContain(
      "source_revision_count <> source_release.token_count"
    );
    expect(rollback).toContain(
      "token.published_value is distinct from revision.published_value"
    );
    expect(rollback).toContain("source_revision_id, created_by");
    expect(rollback).toContain("'rollback'");
    expect(rollback.match(/insert into public\.admin_audit_log/gu)).toHaveLength(
      1
    );
    expect(rollback.match(/public\.append_public_build_outbox\(/gu)).toHaveLength(
      1
    );
  });

  it("exposes a bounded published-only payload and fail-closed ACLs", () => {
    const publicReader = section(
      "create or replace function public.get_published_site_design()",
      "revoke all on function public.is_valid_site_design_identifier_list"
    );
    expect(publicReader).toContain("where token.published_value is not null");
    expect(publicReader).toContain("limit 1024");
    expect(publicReader).toContain("limit 256");
    for (const key of [
      "'release'",
      "'tokens'",
      "'components'",
      "'layer'",
      "'targetKey'",
      "'state'",
      "'value'",
      "'ownerLock'",
    ]) {
      expect(publicReader).toContain(key);
    }
    for (const privateField of [
      "draft_value",
      "description",
      "created_by",
      "updated_by",
      "approved_by",
      "scheduled_at",
    ]) {
      expect(publicReader).not.toContain(privateField);
    }
    expect(migration).toMatch(
      /grant execute on function public\.get_published_site_design\(\)\s+to anon, authenticated, service_role;/u
    );
    expect(migration).not.toMatch(
      /grant select on table public\.site_design_tokens\s+to anon/u
    );
    expect(migration.match(/force row level security;/gu)).toHaveLength(6);
    expect(migration.match(/create policy "Staff read site design/gu)).toHaveLength(
      5
    );
    expect(migration).toContain('create policy "Staff read site component registry"');
  });

  it("extends the complete staff-only schema health contract", () => {
    expect(migration).toContain(
      "rename to get_editorial_schema_health_pre_site_studio"
    );
    expect(migration).toContain(
      "'version', '20260901_zz_site_studio_engine'"
    );
    expect(migration).toContain("'siteStudioEngine'");
    expect(migration).toContain("relation.relforcerowsecurity");
    expect(migration).toContain("count(*) = 8");
    expect(migration).toContain("component.owner_lock = (");
    expect(migration).toContain(
      "'anon', 'public.site_design_tokens', 'SELECT'"
    );
    expect(migration).toMatch(
      /revoke all on function public\.get_editorial_schema_health\(\)[\s\S]*grant execute on function public\.get_editorial_schema_health\(\)\s+to authenticated;/u
    );
  });
});

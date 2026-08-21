import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const sqlDirectories = [
  path.join(root, "supabase", "migrations"),
  path.join(root, "supabase", "hotfixes"),
];
const editorialTables = [
  "articles",
  "article_tags",
  "article_translations",
  "pages",
  "homepage_blocks",
  "banners",
  "navigation_menus",
  "navigation_items",
  "redirects",
  "categories",
  "tags",
  "media_assets",
  "media_usages",
  "literary_works",
  "literary_work_translations",
  "literary_work_sources",
  "literary_work_external_ids",
  "book_editions",
  "writer_profile_overrides",
  "country_profile_overrides",
  "literary_work_cover_artworks",
];
const adminOperationalTables = [
  "admin_audit_log",
  "article_revisions",
  "book_edition_revisions",
  "client_errors",
  "country_profile_override_revisions",
  "homepage_block_revisions",
  "literary_work_revisions",
  "page_revisions",
  "public_build_outbox",
  "publication_jobs",
  "site_chrome_revisions",
  "staff_memberships",
  "writer_profile_override_revisions",
];

function orderedSqlSources() {
  return sqlDirectories.flatMap((directory) =>
    readdirSync(directory)
      .filter((filename) => filename.endsWith(".sql"))
      .sort((first, second) => first.localeCompare(second, "en"))
      .map((filename) => ({
        filename,
        source: readFileSync(path.join(directory, filename), "utf8"),
      }))
  );
}

function finalRlsState(sources) {
  const state = new Map();
  const pattern =
    /alter\s+table\s+public\.([a-z0-9_]+)\s+(enable|disable)\s+row\s+level\s+security\s*;/giu;

  for (const { source } of sources) {
    for (const match of source.matchAll(pattern)) {
      state.set(match[1].toLowerCase(), match[2].toLowerCase() === "enable");
    }
  }
  return state;
}

function finalPolicyState(sources) {
  const policies = new Map();
  const statementPattern =
    /drop\s+policy\s+if\s+exists\s+"[^"]+"\s+on\s+public\.[a-z0-9_]+\s*;|create\s+policy\s+"[^"]+"\s+on\s+public\.[a-z0-9_]+\s+for\s+(?:all|select|insert|update|delete)[\s\S]*?;/giu;

  for (const { filename, source } of sources) {
    for (const match of source.matchAll(statementPattern)) {
      const statement = match[0];
      const drop = statement.match(
        /drop\s+policy\s+if\s+exists\s+"([^"]+)"\s+on\s+public\.([a-z0-9_]+)/iu
      );
      if (drop) {
        policies.delete(`${drop[2].toLowerCase()}:${drop[1]}`);
        continue;
      }

      const create = statement.match(
        /create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-z0-9_]+)\s+for\s+(all|select|insert|update|delete)/iu
      );
      if (!create) continue;
      const [, name, table, command] = create;
      policies.set(`${table.toLowerCase()}:${name}`, {
        name,
        table: table.toLowerCase(),
        command: command.toLowerCase(),
        filename,
        statement,
      });
    }
  }
  return [...policies.values()];
}

function policyRoles(statement) {
  return (
    statement.match(
      /\bto\s+([\s\S]*?)(?=\busing\b|\bwith\s+check\b|;)/iu
    )?.[1] ?? ""
  ).trim();
}

function targetsRole(statement, role) {
  return new RegExp(`(?:^|[\\s,])${role}(?:$|[\\s,])`, "iu").test(
    policyRoles(statement)
  );
}

function targetsAnonymous(statement) {
  const roles = policyRoles(statement);
  return (
    roles.length === 0 ||
    targetsRole(statement, "public") ||
    targetsRole(statement, "anon")
  );
}

const sources = orderedSqlSources();
const rlsState = finalRlsState(sources);
const policies = finalPolicyState(sources);

describe("editorial RLS contract", () => {
  it("keeps RLS enabled on every publication-bearing editorial table", () => {
    expect(editorialTables).toHaveLength(21);
    for (const table of editorialTables) {
      expect(rlsState.get(table), `${table} must finish with RLS enabled`).toBe(
        true
      );
    }
  });

  it("gives authenticated staff an explicit read path to every editorial table", () => {
    for (const table of editorialTables) {
      const staffReadPolicies = policies.filter(
        (policy) =>
          policy.table === table &&
          ["all", "select"].includes(policy.command) &&
          targetsRole(policy.statement, "authenticated") &&
          /public\.is_staff\s*\(/iu.test(policy.statement)
      );
      expect(
        staffReadPolicies,
        `${table} needs a final authenticated staff SELECT or ALL policy`
      ).not.toHaveLength(0);
    }
  });

  it("does not leave anonymous write policies on editorial tables", () => {
    const anonymousWrites = policies.filter(
      (policy) =>
        editorialTables.includes(policy.table) &&
        ["all", "insert", "update", "delete"].includes(policy.command) &&
        targetsAnonymous(policy.statement)
    );
    expect(
      anonymousWrites.map(
        (policy) => `${policy.table}:${policy.name} (${policy.filename})`
      )
    ).toEqual([]);
  });
});

describe("admin operational RLS contract", () => {
  it("keeps RLS enabled on private operational tables", () => {
    expect(adminOperationalTables).toHaveLength(13);
    for (const table of adminOperationalTables) {
      expect(rlsState.get(table), `${table} must finish with RLS enabled`).toBe(
        true
      );
    }
  });

  it("keeps an authenticated read path for the administrative application", () => {
    for (const table of adminOperationalTables) {
      const authenticatedReads = policies.filter(
        (policy) =>
          policy.table === table &&
          ["all", "select"].includes(policy.command) &&
          targetsRole(policy.statement, "authenticated")
      );
      expect(
        authenticatedReads,
        `${table} needs an authenticated SELECT or ALL policy`
      ).not.toHaveLength(0);
    }
  });

  it("does not expose operational tables through anonymous policies", () => {
    const anonymousPolicies = policies.filter(
      (policy) =>
        adminOperationalTables.includes(policy.table) &&
        targetsAnonymous(policy.statement)
    );

    expect(
      anonymousPolicies.map(
        (policy) =>
          `${policy.table}:${policy.command}:${policy.name} (${policy.filename})`
      )
    ).toEqual([]);
  });
});

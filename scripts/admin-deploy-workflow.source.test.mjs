import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const workflow = readFileSync(
  path.join(root, ".github", "workflows", "deploy-admin.yml"),
  "utf8"
);
const adminPackage = JSON.parse(
  readFileSync(path.join(root, "apps", "admin", "package.json"), "utf8")
);
const adminWrangler = JSON.parse(
  readFileSync(path.join(root, "apps", "admin", "wrangler.jsonc"), "utf8")
);
const catalogSync = readFileSync(
  path.join(root, "apps", "admin", "scripts", "sync-private-catalogs.mjs"),
  "utf8"
);

function stepSource(name) {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  expect(start, `missing workflow step: ${name}`).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next < 0 ? workflow.length : next);
}

describe("editorial admin deployment workflow", () => {
  it("runs a secret-free Worker build and size gate for pull requests", () => {
    const pullRequest = workflow.slice(
      workflow.indexOf("  pull_request:"),
      workflow.indexOf("\npermissions:")
    );

    for (const requiredPath of [
      '"apps/admin/**"',
      '"src/i18n/InterfaceLanguage.tsx"',
      '"src/utils/countryFlag.ts"',
      '"src/data/geo/countries.geojson"',
      '"scripts/lib/modern-globe-site-copy.mjs"',
      '"scripts/export-editorial-catalog.mjs"',
      '"scripts/export-interface-copy-catalog.mjs"',
      '"scripts/check-admin-worker-size.mjs"',
      '"package-lock.json"',
      '"scripts/admin-deploy-workflow.source.test.mjs"',
    ]) {
      expect(pullRequest).toContain(requiredPath);
    }

    const catalogs = stepSource("Generate private admin catalogs");
    expect(catalogs).toContain("npm run editorial:catalog");
    expect(catalogs).toContain("npm run interface:copy:catalog");

    const build = stepSource("Build and verify Cloudflare Worker");
    expect(build).toContain("npm run cf:build --workspace @probpera/admin");
    expect(build).toContain("npm run cf:size --workspace @probpera/admin");
    expect(adminPackage.scripts["cf:size"]).toBe(
      "node ../../scripts/check-admin-worker-size.mjs"
    );
    expect(build).not.toContain("if:");
    expect(build).not.toContain("secrets.");

    const pullRequestEnvironment = stepSource(
      "Configure pull request build environment"
    );
    expect(pullRequestEnvironment).toContain(
      "if: github.event_name == 'pull_request'"
    );
    expect(pullRequestEnvironment).toContain(
      "NEXT_PUBLIC_SUPABASE_URL=https://ci-placeholder.supabase.co"
    );
    expect(pullRequestEnvironment).not.toContain("secrets.");

    for (const name of [
      "Validate application configuration",
      "Sync private admin catalogs",
      "Inspect premium translation secret",
      "Deploy to Cloudflare Workers",
    ]) {
      expect(stepSource(name)).toContain("if: github.event_name != 'pull_request'");
    }
    const validation = stepSource("Validate application configuration");
    expect(validation).toContain("secrets.VITE_SUPABASE_URL");
    expect(validation).toContain("secrets.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(workflow.slice(0, workflow.indexOf("    steps:"))).not.toContain(
      "secrets."
    );
    expect(stepSource("Report premium translation readiness")).toContain(
      "if: ${{ always() && github.event_name != 'pull_request' }}"
    );
  });

  it("syncs private catalogs through the reusable command before deploying the measured artifact", () => {
    const build = workflow.indexOf("- name: Build and verify Cloudflare Worker");
    const sync = workflow.indexOf("- name: Sync private admin catalogs");
    const deploy = workflow.indexOf("- name: Deploy to Cloudflare Workers");
    expect(build).toBeGreaterThanOrEqual(0);
    expect(sync).toBeGreaterThan(build);
    expect(deploy).toBeGreaterThan(sync);

    const kv = stepSource("Sync private admin catalogs");
    expect(kv).toContain(
      "npm run cf:catalogs:sync --workspace @probpera/admin"
    );
    expect(adminPackage.scripts["cf:catalogs:sync"]).toBe(
      "node scripts/sync-private-catalogs.mjs"
    );
    expect(adminPackage.scripts["cf:deploy"]).toBe(
      "npm run cf:build && npm run cf:size && npm run cf:catalogs:sync && npm run cf:deploy:built"
    );
    expect(adminPackage.scripts["cf:upload"]).toBe(
      "npm run cf:build && npm run cf:size && npm run cf:catalogs:sync && npm run cf:upload:built"
    );
    expect(adminPackage.scripts["cf:preview"]).toBe(
      "npm run cf:build && npm run cf:catalogs:sync:local && opennextjs-cloudflare preview"
    );
    expect(adminPackage.scripts["cf:deploy:built"]).toBe(
      "opennextjs-cloudflare deploy"
    );
    expect(catalogSync).toMatch(/"kv",\s*"key",\s*"put"/u);
    expect(catalogSync).toMatch(/"kv",\s*"key",\s*"get"/u);
    expect(catalogSync).toContain('"--remote"');
    expect(catalogSync).not.toContain('"r2"');
    expect(adminWrangler.r2_buckets).toBeUndefined();
    expect(adminWrangler.kv_namespaces).toEqual([
      {
        binding: "ADMIN_CATALOGS",
        id: "f3ae59fd55ee4c0cac8ff1613db81680",
      },
    ]);
    expect(kv).not.toContain("wrangler r2");

    const deployment = stepSource("Deploy to Cloudflare Workers");
    expect(deployment).toContain(
      "npm run cf:deploy:built --workspace @probpera/admin"
    );
    expect(workflow).not.toContain(
      "npm run cf:deploy --workspace @probpera/admin"
    );
  });
});

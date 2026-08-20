import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

describe("release workflow hardening", () => {
  it("serializes complete Pages releases without cancelling a code or CMS snapshot", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    expect(source).toContain("group: pages-production");
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("queue: max");
    expect(source).not.toContain("cancel-in-progress: ${{ github.event_name != 'schedule' }}");
    expect(source).toContain("id: deployed_code");
    expect(source).toContain("node scripts/check-deployed-release-head.mjs");
    expect(source).toContain("steps.deployed_code.outputs.code_pending");
    expect(source).toContain("RELEASE_COMMIT_SHA: ${{ github.sha }}");
  });

  it("recovers a code-only main advance from a durable live release marker", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    const buildScript = read("scripts/build-domain-release.mjs");
    expect(workflow).toContain("Check whether production is behind the scheduled code head");
    expect(workflow).toContain("steps.deployed_code.outputs.code_pending");
    expect(buildScript).toContain('scripts/check-deployed-release-head.mjs", "--write"');
    expect(existsSync(path.join(root, "scripts/check-deployed-release-head.mjs"))).toBe(true);
    expect(existsSync(path.join(root, "scripts/check-deployed-release-head.test.mjs"))).toBe(true);
  });

  it("re-exports a stable CMS head and refuses a stale artifact before deployment", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    expect(source.match(/run: npm run content:export:cms/gu)).toHaveLength(2);
    expect(source).toContain("CMS_EXPORT_REQUIRE_STABLE: \"true\"");
    expect(source).toContain("CMS_PUBLICATION_BASELINE_URL: https://probpera.ru/cms/published-content.json");
    expect(source).toContain("id: publication_snapshot");
    expect(source).toContain("CMS_SNAPSHOT_PREEXPORTED: \"true\"");
    expect(source).toContain("run: npm run content:publication:head-check");
    expect(source).toContain(
      "--finalize=${{ needs.build.outputs.publication_queue_marker }}"
    );
    expect(source).toContain(
      "CANDIDATE_PUBLICATION_HEAD_SOURCE: ${{ needs.build.outputs.publication_head_source }}"
    );
    expect(source).toContain(
      "CANDIDATE_LEGACY_AUDIT_HIGH_WATER: ${{ needs.build.outputs.publication_legacy_audit_high_water }}"
    );
    expect(source).not.toContain(
      "--finalize=outbox:${{ needs.build.outputs.publication_outbox_high_water }}"
    );
    expect(read("scripts/check-public-build-requests.mjs")).toContain(
      "BigInt(deployedId) >= BigInt(maxId)"
    );
    expect(source.indexOf("Refuse stale code or CMS publication heads")).toBeLessThan(
      source.indexOf("uses: actions/deploy-pages@v5")
    );
    expect(source.indexOf("Coalesce an immediate CMS follow-up after Pages promotion")).toBeGreaterThan(
      source.indexOf("uses: actions/deploy-pages@v5")
    );
    expect(source).toContain("run: npm run content:publication:coalesce");
    expect(source).toContain(
      "if: needs.publication_followup.outputs.safe_to_finalize == 'true'"
    );
  });

  it("grants Actions write only to the single-purpose post-deploy coalescer", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    const deployStart = source.indexOf("\n  deploy:");
    const followUpStart = source.indexOf("\n  publication_followup:");
    const finalizeStart = source.indexOf("\n  finalize_publication:");
    const distributeStart = source.indexOf("\n  distribute:");
    const globalAndBuild = source.slice(0, deployStart);
    const deploy = source.slice(deployStart, followUpStart);
    const followUp = source.slice(followUpStart, finalizeStart);
    const finalize = source.slice(finalizeStart, distributeStart);

    expect(source.match(/^\s+actions: write$/gmu)).toHaveLength(1);
    expect(globalAndBuild).not.toContain("actions: write");
    expect(deploy).not.toContain("actions: write");
    expect(finalize).not.toContain("actions: write");
    expect(followUp).toContain("permissions:\n      contents: read\n      actions: write");
    expect(followUp).not.toContain("pages: write");
    expect(followUp).not.toContain("id-token: write");
    expect(followUp).toContain(
      "safe_to_finalize: ${{ steps.postdeploy_followup.outputs.safe_to_finalize }}"
    );
    expect(followUp).toContain("continue-on-error: true");
    expect(followUp).toContain("if: steps.postdeploy_followup.outcome != 'success'");
    expect(followUp).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(finalize).toContain("permissions:\n      contents: read");
    expect(finalize).toContain("- publication_followup");
    expect(JSON.parse(read("package.json")).scripts["content:publication:coalesce"]).toBe(
      "node scripts/coalesce-publication-followup.mjs"
    );
  });

  it("publishes a due schedule once and relies on its transactional outbox for retries", () => {
    const source = read("scripts/publish-scheduled-content.mjs");
    const publicationMutation = source.slice(source.indexOf("status: \"published\""));
    expect(publicationMutation).toContain("scheduled_at: null");
    const workflow = read(".github/workflows/deploy-pages.yml");
    expect(workflow).toContain(
      "Finalize the deployed composite CMS snapshot"
    );
    expect(workflow).not.toContain("Finalize scheduled publications");
  });

  it("uses the supported v7 checkout and setup-node actions in deploy workflows", () => {
    for (const workflow of ["deploy-pages.yml", "deploy-admin.yml"]) {
      const source = read(`.github/workflows/${workflow}`);
      const checkoutVersions = [...source.matchAll(/actions\/checkout@(v\d+)/gu)].map(
        (match) => match[1]
      );
      const setupNodeVersions = [...source.matchAll(/actions\/setup-node@(v\d+)/gu)].map(
        (match) => match[1]
      );
      expect(checkoutVersions.length).toBeGreaterThan(0);
      expect(setupNodeVersions.length).toBeGreaterThan(0);
      expect(new Set(checkoutVersions)).toEqual(new Set(["v7"]));
      expect(new Set(setupNodeVersions)).toEqual(new Set(["v7"]));
    }
  });

  it("keeps the live audit independent from code deployment", () => {
    const source = read(".github/workflows/audit-live-security.yml");
    expect(source).toContain("workflow_run:");
    expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(source).toContain("github.event.workflow_run.head_sha || 'main'");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("npm run release:smoke:live");
    expect(read(".github/workflows/deploy-pages.yml")).not.toContain("release:smoke:live");
    expect(read(".github/workflows/deploy-admin.yml")).not.toContain("release:smoke:live");
  });

  it("ships security.txt for both the public site and admin", () => {
    expect(existsSync(path.join(root, "public/.well-known/security.txt"))).toBe(true);
    expect(existsSync(path.join(root, "apps/admin/app/.well-known/security.txt/route.ts"))).toBe(true);
    const deployPages = read(".github/workflows/deploy-pages.yml");
    expect(deployPages).toContain("run: test -s dist/.well-known/security.txt");
    expect(deployPages).toContain("include-hidden-files: true");
    const articleBuilder = read("scripts/build-article-pages.mjs");
    expect(articleBuilder).toContain("/.well-known/security.txt");
    expect(articleBuilder).toContain("Content-Type: text/plain; charset=utf-8");
  });
});

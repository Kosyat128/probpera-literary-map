import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cachePublicEditorialOriginals } from "./cache-public-editorial-originals.mjs";

const root = path.resolve(process.cwd());
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

describe("release workflow hardening", () => {
  it("saves only changed editorial cache contents before the performance gate, even after a failed build", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    const restore = source.indexOf("uses: actions/cache/restore@v5");
    const seed = source.indexOf("node scripts/cache-public-editorial-originals.mjs restore");
    const build = source.indexOf("id: build_site");
    const stage = source.indexOf("node scripts/cache-public-editorial-originals.mjs stage");
    const save = source.indexOf("uses: actions/cache/save@v5");
    expect(restore).toBeGreaterThan(source.indexOf("Verify the frozen CMS publication snapshot"));
    expect(seed).toBeGreaterThan(restore);
    expect(build).toBeGreaterThan(seed);
    expect(stage).toBeGreaterThan(build);
    expect(save).toBeGreaterThan(stage);
    expect(save).toBeLessThan(source.indexOf("Enforce production performance budget"));
    expect(source.slice(build, save)).toContain("steps.build_site.outcome == 'failure'");
    expect(source.slice(build, save)).toContain("steps.staged_editorial_originals.outputs.changed == 'true'");
    expect(source.slice(restore, save)).toContain("github.repository == 'Kosyat128/probpera-literary-map' && github.ref == 'refs/heads/main'");
  });

  it("keeps only verified current immutable public originals and repairs an incomplete cache", async () => {
    const fixture = await mkdtemp(path.join(os.tmpdir(), "public-editorial-cache-test-"));
    try {
      const digest = value => createHash("sha256").update(value).digest("hex");
      const origin = "https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media";
      const first = `${origin}/2026/11/11111111-1111-4111-8111-111111111111.webp`;
      const second = `${origin}/2026/11/22222222-2222-4222-8222-222222222222.png`;
      const noLongerPublic = `${origin}/2026/11/33333333-3333-4333-8333-333333333333.avif`;
      const mutable = `${first}?download=1`;
      const originals = path.join(fixture, ".tmp/public-images/originals");
      const checkpoints = path.join(fixture, ".tmp/public-images/checkpoints");
      const shared = path.join(fixture, ".tmp/editorial-source-cache");
      const original = url => path.join(originals, `${digest(url)}.bin`);
      const record = (url, bytes) => ({ sourceUrl: url, status: "ready", pipelineVersion: 1, source: { bytes: bytes.length, sha256: digest(bytes) } });
      const firstBytes = Buffer.from("immutable prepared WebP bytes");
      const secondBytes = Buffer.from("immutable prepared PNG bytes");
      await Promise.all([mkdir(originals, { recursive: true }), mkdir(checkpoints, { recursive: true }), mkdir(path.join(fixture, "reports"))]);
      await writeFile(path.join(fixture, "reports/public-image-delivery.json"), JSON.stringify({ images: [record(first, firstBytes)] }));
      for (const url of [first, second, noLongerPublic, mutable]) {
        const bytes = url === first ? firstBytes : secondBytes;
        await writeFile(original(url), bytes);
        await writeFile(path.join(checkpoints, `${digest(url)}.json`), JSON.stringify(record(url, bytes)));
      }
      await writeFile(original(second), "corrupt");

      const inventory = [first, second, mutable].map(sourceUrl => ({ sourceUrl }));
      const args = { root: fixture, inventory };
      const staged = await cachePublicEditorialOriginals({ ...args, mode: "stage" });
      expect(staged).toMatchObject({ count: 1, changed: true });
      expect(JSON.parse(await readFile(path.join(shared, "manifest.json")))).toEqual([
        { sourceUrl: first, bytes: firstBytes.length, sha256: digest(firstBytes) },
      ]);
      const matchedKey = `probpera-public-editorial-originals-v1-1-1-${staged.digest}`;
      await rm(original(first));
      expect(await cachePublicEditorialOriginals({ ...args, mode: "restore", matchedKey: "unrelated-key" })).toMatchObject({ count: 0 });
      const restored = await cachePublicEditorialOriginals({ ...args, mode: "restore", matchedKey });
      expect(restored).toMatchObject({ count: 1, digest: staged.digest });
      expect(await readFile(original(first))).toEqual(firstBytes);
      expect(await cachePublicEditorialOriginals({ ...args, mode: "stage", matchedKey, restoredDigest: restored.digest })).toMatchObject({ count: 1, changed: false });

      await writeFile(original(second), secondBytes);
      const expanded = await cachePublicEditorialOriginals({ ...args, mode: "stage", matchedKey, restoredDigest: restored.digest });
      expect(expanded).toMatchObject({ count: 2, changed: true });
      await writeFile(path.join(shared, `${digest(second)}.bin`), Buffer.alloc(secondBytes.length));
      await rm(original(second));
      expect(await cachePublicEditorialOriginals({ ...args, mode: "restore", matchedKey: `probpera-public-editorial-originals-v1-2-1-${expanded.digest}` })).toMatchObject({ count: 1, digest: "" });
      expect(existsSync(original(second))).toBe(false);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

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
    const firstExport = source.indexOf(
      "- name: Export current CMS snapshot for release verification"
    );
    const releaseGate = source.indexOf("- name: Decide whether a release is needed");
    const immutableLocks = source.indexOf(
      "- name: Verify immutable repository content locks"
    );
    const derivedLinks = source.indexOf(
      "- name: Regenerate CMS-derived article and book links"
    );
    const biographyVerification = source.indexOf(
      "- name: Verify complete writer biography release artifacts"
    );
    const finalExport = source.indexOf(
      "- name: Re-export and freeze the complete CMS publication head"
    );
    const frozenVerification = source.indexOf(
      "- name: Verify the frozen CMS publication snapshot"
    );
    const fullVerification = source.indexOf(
      "- name: Verify public site and editorial archive"
    );
    expect(releaseGate).toBeGreaterThanOrEqual(0);
    expect(immutableLocks).toBeGreaterThan(releaseGate);
    expect(firstExport).toBeGreaterThan(immutableLocks);
    expect(derivedLinks).toBeGreaterThan(firstExport);
    expect(fullVerification).toBeGreaterThan(derivedLinks);
    expect(finalExport).toBeGreaterThan(fullVerification);
    expect(biographyVerification).toBeGreaterThan(finalExport);
    expect(frozenVerification).toBeGreaterThan(biographyVerification);
    expect(source).toContain(
      "run: npx vitest run scripts/lib/stage5-content-data-lock.test.mjs"
    );
    expect(source).toContain(
      "npm test -- --exclude scripts/lib/stage5-content-data-lock.test.mjs"
    );
    expect(source).toContain("run: npm run content:link-books");
    expect(source).toContain("npm run writers:biographies:reviews:check");
    expect(source).toContain(
      "npm run writers:biographies:russian:editorial:check"
    );
    expect(source).toContain(
      "npm run writers:biographies:english:paused:check"
    );
    expect(source).not.toContain(
      "npm run writers:biographies:english:check"
    );
    const packageScripts = JSON.parse(read("package.json")).scripts;
    expect(packageScripts["writers:biographies:english:paused:check"]).toContain(
      "node scripts/check-writer-biography-english-pause.mjs"
    );
    expect(packageScripts["release:check"]).toContain(
      "npm run writers:biographies:english:paused:check"
    );
    expect(packageScripts["release:check"]).not.toContain(
      "npm run writers:biographies:english:check"
    );
    expect(packageScripts["writers:biographies:english:check"]).toContain(
      "node scripts/generate-writer-biography-english-translations.mjs --check"
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

  it("refreshes CMS synopsis provenance after historical fixtures and before strict book checks", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    const verificationStart = workflow.indexOf("- name: Verify public site and editorial archive");
    const verification = workflow.slice(verificationStart, workflow.indexOf("- name: Verify fast CMS publication"));
    const refresh = "node scripts/extract-article-book-synopsis-manifest.mjs";
    expect(verificationStart).toBeGreaterThan(workflow.indexOf("- name: Export current CMS snapshot for release verification"));
    expect(verification).toContain(`${refresh} && npm run books:audit`);
    const historicalTests = verification.indexOf("npm test -- --exclude scripts/lib/stage5-content-data-lock.test.mjs");
    expect(historicalTests).toBeGreaterThanOrEqual(0);
    expect(verification.indexOf(refresh)).toBeGreaterThan(historicalTests);
    const booksAudit = JSON.parse(read("package.json")).scripts["books:audit"];
    expect(booksAudit).toContain(`${refresh} --check`);
    expect(booksAudit).toContain("audit-book-evidence-v2.mjs --strict");
  });

  it("grants Actions write only to single-purpose post-deploy jobs", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    const deployStart = source.indexOf("\n  deploy:");
    const securityAuditStart = source.indexOf("\n  post_deploy_security_audit:");
    const followUpStart = source.indexOf("\n  publication_followup:");
    const finalizeStart = source.indexOf("\n  finalize_publication:");
    const distributeStart = source.indexOf("\n  distribute:");
    const globalAndBuild = source.slice(0, deployStart);
    const deploy = source.slice(deployStart, securityAuditStart);
    const securityAudit = source.slice(securityAuditStart, followUpStart);
    const followUp = source.slice(followUpStart, finalizeStart);
    const finalize = source.slice(finalizeStart, distributeStart);

    expect(source.match(/^\s+actions: write$/gmu)).toHaveLength(2);
    expect(globalAndBuild).not.toContain("actions: write");
    expect(deploy).not.toContain("actions: write");
    expect(finalize).not.toContain("actions: write");
    expect(securityAudit).toContain("permissions:\n      actions: write\n      contents: read");
    expect(securityAudit).toContain(
      'gh workflow run audit-live-security.yml --repo "$GITHUB_REPOSITORY" --ref main'
    );
    expect(securityAudit).not.toContain("pages: write");
    expect(securityAudit).not.toContain("id-token: write");
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

  it("publishes approved due Site Studio change sets through the atomic RPC", () => {
    const source = read("scripts/publish-scheduled-content.mjs");
    expect(source).toContain('status: "eq.approved"');
    expect(source).toContain('scheduled_at: `lte.${now}`');
    expect(source).toContain("/rest/v1/rpc/publish_site_design_change_set");
    expect(source).toContain("p_expected_cas_version: changeSet.cas_version");
    expect(source).toContain(
      "publishedArticles.length + publishedDesignChangeSets.length"
    );
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
    expect(source).not.toContain("workflow_run:");
    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain('cron: "17 2 * * *"');
    expect(source).toContain("ref: refs/heads/main");
    expect(source).not.toContain("github.event.workflow_run");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("npm run release:smoke:live");
    for (const workflow of ["deploy-pages.yml", "deploy-admin.yml"]) {
      const deploySource = read(`.github/workflows/${workflow}`);
      expect(deploySource).not.toContain("release:smoke:live");
      expect(deploySource).toContain("post_deploy_security_audit:");
      expect(deploySource).toContain("actions: write");
      expect(deploySource).toContain(
        'gh workflow run audit-live-security.yml --repo "$GITHUB_REPOSITORY" --ref main'
      );
    }
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

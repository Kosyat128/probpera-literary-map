import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const auditScript = path.resolve("scripts/audit-performance-budget.mjs");
const workspaces = [];

async function fixture({
  aggregatePayloadBytes = 0,
  bookCoverMaximumBytes = 300,
  cmsArticleBaselineCount = 162,
  cmsArticleCount = 162,
  cmsArticleSnapshot,
  cmsArticleSnapshotPath = "cms/published-content.json",
  cmsArticleGrowthBytesPerArticle = 256 * 1024,
  distExcludingBookCoversBytes = 2_000_000,
  distTotalBytes = 2_000_000,
  domainCname,
  domainSiteBasePath = "/",
  entryBytes = Buffer.from("export const ready = true;"),
  indexHtml,
  initialAssetGzipBytes = 300 * 1024,
  siteBasePath = "/probpera-literary-map/",
} = {}) {
  const workspace = await mkdtemp(path.join(tmpdir(), "performance-budget-"));
  workspaces.push(workspace);
  await mkdir(path.join(workspace, "dist", "brand", "book-covers", "thumbs"), {
    recursive: true,
  });
  await mkdir(path.join(workspace, "dist", "assets"), { recursive: true });
  if (aggregatePayloadBytes > 0) {
    await writeFile(
      path.join(workspace, "dist", "assets", "aggregate-payload.bin"),
      Buffer.alloc(aggregatePayloadBytes)
    );
  }
  await writeFile(path.join(workspace, "dist", "assets", "index-entry.js"), entryBytes);
  await writeFile(
    path.join(workspace, "dist", "assets", "runtime.js"),
    "export const runtime = true;"
  );
  await writeFile(path.join(workspace, "dist", "assets", "index.css"), ".app{display:block}");
  await writeFile(
    path.join(workspace, "dist", "index.html"),
    indexHtml ||
      [
        '<link rel="modulepreload" href="/probpera-literary-map/assets/runtime.js">',
        '<link href="/probpera-literary-map/assets/index.css" rel="stylesheet">',
        '<script crossorigin type="module" src="/probpera-literary-map/assets/index-entry.js"></script>',
      ].join("\n")
  );
  await writeFile(
    path.join(workspace, "dist", "brand", "book-covers", "cover.webp"),
    Buffer.alloc(300)
  );
  await writeFile(
    path.join(workspace, "dist", "brand", "book-covers", "thumbs", "cover.webp"),
    Buffer.alloc(100)
  );
  await writeFile(path.join(workspace, "dist", "assets", "site.png"), Buffer.alloc(200));
  if (cmsArticleSnapshot !== null) {
    const snapshotTarget = path.join(
      workspace,
      "dist",
      ...cmsArticleSnapshotPath.split("/")
    );
    await mkdir(path.dirname(snapshotTarget), { recursive: true });
    const snapshot =
      cmsArticleSnapshot === undefined
        ? {
            articles: Array.from({ length: cmsArticleCount }, (_, index) => ({
              id: `cms-00000000-0000-4000-8000-${index
                .toString(16)
                .padStart(12, "0")}`,
            })),
          }
        : cmsArticleSnapshot;
    await writeFile(
      snapshotTarget,
      typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot)
    );
  }
  await writeFile(
    path.join(workspace, "performance-budget.json"),
    JSON.stringify({
      siteBasePath,
      domainSiteBasePath,
      domainCname,
      cmsArticleGrowthAllowance: {
        snapshotPath: cmsArticleSnapshotPath,
        baselineCount: cmsArticleBaselineCount,
        bytesPerAdditionalArticle: cmsArticleGrowthBytesPerArticle,
      },
      distTotalBytes,
      distExcludingBookCoversBytes,
      largestJavaScriptBytes: 1_000_000,
      largestJavaScriptGzipBytes: 1_000_000,
      mainJavaScriptBytes: 1_000_000,
      mainJavaScriptGzipBytes: 1_000_000,
      initialAssetGzipBytes,
      globeTextureBytes: 1_000_000,
      writerPortraitTotalBytes: 1_000_000,
      writerPortraitAverageBytes: 1_000_000,
      writerPortraitMaximumBytes: 1_000_000,
      bookCoverCount: 2,
      bookCoverTotalBytes: 400,
      bookCoverAverageBytes: 200,
      bookCoverMaximumBytes,
      individualImageBytes: 1_000_000,
    })
  );
  if (domainCname) {
    await writeFile(path.join(workspace, "dist", "CNAME"), `${domainCname}\n`);
  }
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true }))
  );
});

describe("performance budget audit", () => {
  it("allows bounded aggregate growth for articles above the pinned CMS baseline", async () => {
    const cwd = await fixture({
      aggregatePayloadBytes: 200 * 1024,
      cmsArticleCount: 163,
      distExcludingBookCoversBytes: 16 * 1024,
      distTotalBytes: 16 * 1024,
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain(
      "PASS CMS article growth allowance: 163 / 162 baseline articles; 262144 bytes"
    );
    expect(stdout).toContain("PASS dist total:");
    expect(stdout).toContain("PASS dist excluding book covers:");
  });

  it("still rejects aggregate growth above the per-article allowance", async () => {
    const cwd = await fixture({
      aggregatePayloadBytes: 280 * 1024,
      cmsArticleCount: 163,
      distExcludingBookCoversBytes: 16 * 1024,
      distTotalBytes: 16 * 1024,
    });

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stdout: expect.stringContaining("FAIL dist total:"),
      stderr: expect.stringContaining(
        "Performance budget exceeded: dist total, dist excluding book covers"
      ),
    });
  });

  it.each([
    ["missing", null, "configured snapshot cms/published-content.json is missing"],
    ["malformed", "{", "configured snapshot cms/published-content.json is not valid JSON"],
  ])("fails closed when the configured CMS snapshot is %s", async (_label, snapshot, detail) => {
    const cwd = await fixture({ cmsArticleSnapshot: snapshot });

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(`FAIL CMS article growth allowance: ${detail}`),
    });
  });

  it("measures book covers separately from the rest of dist", async () => {
    const cwd = await fixture({ bookCoverMaximumBytes: 300 });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain("PASS dist total:");
    expect(stdout).toContain("PASS dist excluding book covers:");
    expect(stdout).toContain("PASS book cover count: 2 / 2 files");
    expect(stdout).toContain("PASS book covers total: 400 / 400 bytes");
    expect(stdout).toContain("PASS book cover average: 200 / 200 bytes");
    expect(stdout).toContain("PASS book cover maximum: 300 / 300 bytes");
  });

  it("fails when one book cover exceeds its dedicated maximum", async () => {
    const cwd = await fixture({ bookCoverMaximumBytes: 299 });

    await expect(
      execFileAsync(process.execPath, [auditScript], {
        cwd,
        env: { ...process.env, GITHUB_ACTIONS: "true" },
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "::error title=Performance budget exceeded::book cover maximum: 300 / 299 bytes"
      ),
    });
  });

  it("passes a deduplicated local module/modulepreload/CSS initial graph", async () => {
    const cwd = await fixture({
      indexHtml: [
        '<link rel="modulepreload" href="/probpera-literary-map/assets/runtime.js?v=1">',
        '<link rel="modulepreload" href="/probpera-literary-map/assets/runtime.js?v=2">',
        '<link rel="stylesheet" href="./assets/index.css">',
        '<script type="module" src="/probpera-literary-map/assets/index-entry.js#entry"></script>',
      ].join("\n"),
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain("PASS initial asset references: 3 / 3 files");
    expect(stdout).toContain("PASS initial module script/modulepreload/CSS gzip:");
  });

  it("resolves the configured production Vite deployment base", async () => {
    const cwd = await fixture({
      indexHtml: [
        '<link rel="modulepreload" href="/probpera-literary-map/assets/runtime.js">',
        '<link rel="stylesheet" href="/probpera-literary-map/assets/index.css">',
        '<script type="module" src="/probpera-literary-map/assets/index-entry.js"></script>',
      ].join("\n"),
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain("PASS initial asset references: 3 / 3 files");
    expect(stdout).toContain("PASS initial module script/modulepreload/CSS gzip:");
  });

  it("resolves a root deployment only through its pinned domain marker", async () => {
    const cwd = await fixture({
      domainCname: "probpera.ru",
      indexHtml: [
        '<link rel="modulepreload" href="/assets/runtime.js">',
        '<link rel="stylesheet" href="/assets/index.css">',
        '<script type="module" src="/assets/index-entry.js"></script>',
      ].join("\n"),
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain("PASS initial asset references: 3 / 3 files");
  });

  it("fails closed for a wrong deployment base even when the asset suffix is unique", async () => {
    const cwd = await fixture({
      indexHtml:
        '<script type="module" src="/wrong-base/assets/index-entry.js"></script>',
    });

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "URL is outside configured site base /probpera-literary-map/"
      ),
    });
  });

  it("fails closed when a deployment-base suffix is ambiguous", async () => {
    const cwd = await fixture({
      indexHtml:
        '<script type="module" src="/probpera-literary-map/assets/index-entry.js"></script>',
    });
    await writeFile(
      path.join(cwd, "dist", "index-entry.js"),
      "export const duplicate = true;"
    );

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "FAIL ambiguous initial asset assets/index-entry.js: " +
          "ambiguous suffix matches assets/index-entry.js, index-entry.js; referenced as module script"
      ),
    });
  });

  it("fails closed when dist/index.html is missing", async () => {
    const cwd = await fixture();
    await unlink(path.join(cwd, "dist", "index.html"));

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "FAIL dist/index.html: missing; initial graph cannot be measured"
      ),
    });
  });

  it("fails closed when an initial reference does not exist in dist", async () => {
    const cwd = await fixture({
      indexHtml:
        '<script type="module" src="/probpera-literary-map/assets/missing-entry.js"></script>',
    });

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "FAIL missing initial asset assets/missing-entry.js: " +
          "not found in dist; referenced as module script"
      ),
    });
  });

  it.each([
    ["Three", "assets/three-runtime.js", "modulepreload"],
    ["BookArchive", "assets/BookArchiveSection.js", "module"],
    ["book-catalog", "assets/book-catalog.json", "preload"],
    ["full search catalog", "assets/search-catalog.js", "preload"],
  ])("rejects forbidden initial %s payloads", async (label, relative, referenceKind) => {
    const forbiddenReference = referenceKind === "module"
      ? `<script type="module" src="/probpera-literary-map/${relative}"></script>`
      : `<link rel="${referenceKind}" href="/probpera-literary-map/${relative}">`;
    const cwd = await fixture({
      indexHtml: [
        forbiddenReference,
        '<script type="module" src="/probpera-literary-map/assets/index-entry.js"></script>',
      ].join("\n"),
    });
    await writeFile(path.join(cwd, "dist", ...relative.split("/")), "export default {};");

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(`FAIL forbidden initial asset ${label}: ${relative}`),
    });
  });

  it("fails above the 300 KiB gzip initial ceiling", async () => {
    const cwd = await fixture({ entryBytes: randomBytes(310 * 1024) });

    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Performance budget exceeded: initial module script/modulepreload/CSS gzip"
      ),
    });
  });
});

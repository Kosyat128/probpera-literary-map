import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const auditScript = path.resolve("scripts/audit-performance-budget.mjs");
const workspaces = [];

function imageProvenance(outputs, index = 0, properties = {}) {
  const largest = outputs.at(-1);
  const prefix = /^media\/optimized\/([a-f0-9]{24})-/u.exec(largest.src)?.[1] ?? "";
  return {
    sourceUrl: `https://images.example.org/${index}.jpg`,
    status: "ready",
    source: { sha256: prefix.padEnd(64, "0"), bytes: largest.bytes },
    largest,
    outputs,
    ...properties,
  };
}

function imageProvenanceReport(images, delivery) {
  const originals = new Map(images.map(({ source }) => [source.sha256, source.bytes]));
  const outputs = new Map(images.flatMap((row) => row.outputs.map((output) => [output.src, output.bytes])));
  return {
    version: 1,
    completed: true,
    ...(delivery && { delivery }),
    images,
    summary: {
      inventoriedSources: images.length,
      processedSources: images.length,
      ready: images.length,
      failed: 0,
      uniqueSourceImages: originals.size,
      sourceBytes: [...originals.values()].reduce((sum, bytes) => sum + bytes, 0),
      allRenditionBytes: [...outputs.values()].reduce((sum, bytes) => sum + bytes, 0),
    },
  };
}

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
  publishedImageFiles = [],
  publishedImageBudget = { totalBytes: 1_000_000, fileCount: 10, sourceAliasCount: 2 },
  publishedImageReport,
  publishedSiteTotalBytes = 2_000_000,
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
  const publishedOutputs = [];
  for (const file of publishedImageFiles) {
    const target = path.join(workspace, "dist", file.src);
    const content = Buffer.alloc(file.bytes);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    publishedOutputs.push({ ...file, sha256: createHash("sha256").update(content).digest("hex") });
  }
  await mkdir(path.join(workspace, "reports"), { recursive: true });
  if (publishedImageReport !== null) await writeFile(
    path.join(workspace, "reports", "public-image-delivery.json"),
    JSON.stringify(publishedImageReport ?? imageProvenanceReport(
      publishedOutputs.map((output, index) => imageProvenance([output], index))
    ))
  );
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
      publishedImageCorpus: publishedImageBudget,
      publishedSiteTotalBytes,
      largestJavaScriptBytes: 1_000_000,
      largestJavaScriptGzipBytes: 1_000_000,
      mainJavaScriptBytes: 1_000_000,
      mainJavaScriptGzipBytes: 1_000_000,
      initialAssetGzipBytes,
      globeTextureBytes: 1_000_000,
      globeTextureCount: 0,
      globeTextureTotalBytes: 1_000_000,
      globeDesktopTextureBytes: 1_000_000,
      globeMobileTextureBytes: 1_000_000,
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
  const publishedImage = "media/optimized/0123456789abcdef01234567-640w.webp";

  it("accounts for validated published images without increasing the application allowance", async () => {
    const cwd = await fixture({
      publishedImageFiles: [{ src: publishedImage, bytes: 200 * 1024 }],
      distTotalBytes: 16 * 1024,
      distExcludingBookCoversBytes: 16 * 1024,
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });
    expect(stdout).toContain("PASS published image corpus total: 204800 / 1000000 bytes");
    expect(stdout).toContain("PASS published image corpus count: 1 / 10 files");
    expect(stdout).toContain("PASS published image source count: 1 / 12 sources");
    expect(stdout).toContain("PASS published image source aliases: 0 / 2 URLs");
    expect(stdout).toContain("PASS dist total:");
    expect(stdout).toContain("PASS dist excluding book covers:");
  });

  it("does not let published images hide unrelated application growth", async () => {
    const cwd = await fixture({
      publishedImageFiles: [{ src: publishedImage, bytes: 200 * 1024 }],
      aggregatePayloadBytes: 20 * 1024,
      distTotalBytes: 16 * 1024,
      distExcludingBookCoversBytes: 16 * 1024,
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining("Performance budget exceeded: dist total, dist excluding book covers"),
    });
  });

  it.each([
    ["total", { totalBytes: 199, fileCount: 10, sourceAliasCount: 2 }],
    ["count", { totalBytes: 1000, fileCount: 1, sourceAliasCount: 2 }],
  ])("rejects an oversized published image corpus by %s", async (kind, publishedImageBudget) => {
    const cwd = await fixture({
      publishedImageFiles: [
        { src: publishedImage, bytes: 200 },
        { src: "media/optimized/1123456789abcdef01234567-original.png", bytes: 200 },
      ],
      publishedImageBudget,
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stdout: expect.stringContaining(`FAIL published image corpus ${kind}:`),
    });
  });

  it("lets byte-identical URLs share a rendition within the alias reserve", async () => {
    const output = { src: publishedImage, bytes: 200, sha256: createHash("sha256").update(Buffer.alloc(200)).digest("hex") };
    const images = [imageProvenance([output]), imageProvenance([output], 1)];
    const options = {
      publishedImageBudget: { totalBytes: 1_000, fileCount: 3, sourceAliasCount: 1 },
      publishedImageFiles: [output],
    };
    const cwd = await fixture({ ...options, publishedImageReport: imageProvenanceReport(images) });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });
    expect(stdout).toContain("PASS published image source count: 2 / 4 sources");
    expect(stdout).toContain("PASS published image source aliases: 1 / 1 URLs");

    const over = await fixture({
      ...options,
      publishedImageReport: imageProvenanceReport([...images, imageProvenance([output], 2)]),
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd: over })).rejects.toMatchObject({
      stdout: expect.stringMatching(/PASS published image source count: 3 \/ 4 sources[\s\S]*FAIL published image source aliases: 2 \/ 1 URLs/u),
    });
  });

  it.each([
    ["duplicate exact URL", (row) => [row, row], "incomplete or duplicate source"],
    ["original checksum", (row) => [{ ...row, source: { ...row.source, sha256: "invalid" } }], "invalid original checksum or size"],
    ["original bytes", (row) => [{ ...row, source: { ...row.source, bytes: 0 } }], "invalid original checksum or size"],
    ["conflicting aliases", (row) => [row, { ...row, sourceUrl: `${row.sourceUrl}?alias=1`, source: { ...row.source, bytes: 201 } }], "conflicting original identities"],
    ["shared rendition ownership", (row) => [{ ...row, source: { ...row.source, sha256: "a".repeat(64) } }], "published image output does not belong to its original"],
    ["largest rendition ownership", (row) => [{ ...row, largest: { ...row.largest, bytes: 201 } }], "lacks a matching largest rendition"],
  ])("rejects invalid %s in the source provenance", async (_label, corrupt, diagnostic) => {
    const output = { src: publishedImage, bytes: 200, sha256: createHash("sha256").update(Buffer.alloc(200)).digest("hex") };
    const cwd = await fixture({
      publishedImageFiles: [output],
      publishedImageReport: imageProvenanceReport(corrupt(imageProvenance([output]))),
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(diagnostic),
    });
  });

  it("fits both limits by shipping two useful widths while preserving full provenance", async () => {
    const base = "media/optimized/1123456789abcdef01234567-";
    const output = (suffix, width, height, bytes) => ({
      src: `${base}${suffix}.webp`, width, height, bytes,
      sha256: createHash("sha256").update(Buffer.alloc(bytes)).digest("hex"),
    });
    const mobile = output("640w", 640, 427, 100);
    const desktop = output("1280w", 1280, 853, 400);
    const largest = output("original", 1536, 1024, 475);
    const publishedImageReport = imageProvenanceReport([imageProvenance([mobile, desktop, largest], 0, {
      contexts: ["public/cms/articles/example.json"],
    })]);
    const options = { publishedImageBudget: { totalBytes: 600, fileCount: 2, sourceAliasCount: 0 } };
    const before = await fixture({
      ...options, publishedImageReport, publishedImageFiles: [mobile, desktop, largest],
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd: before })).rejects.toMatchObject({
      stdout: expect.stringMatching(/FAIL published image corpus total:[\s\S]*FAIL published image corpus count:/u),
    });
    const after = await fixture({
      ...options, publishedImageFiles: [mobile, largest],
      publishedImageReport: { ...publishedImageReport, delivery: { version: 1, authoredRenditions: [] } },
    });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd: after });
    expect(stdout).toContain("PASS published image corpus total: 575 / 600 bytes");
    expect(stdout).toContain("PASS published image corpus count: 2 / 2 files");
    await unlink(path.join(after, "dist", largest.src));
    await expect(execFileAsync(process.execPath, [auditScript], { cwd: after })).rejects.toMatchObject({
      stderr: expect.stringContaining(`missing published image file: ${largest.src}`),
    });
  });

  it("audits the same pressure-selected delivery files under the configured corpus budget", async () => {
    const base = "media/optimized/1123456789abcdef01234567-";
    const image = (suffix, width, height, bytes) => ({
      src: `${base}${suffix}.webp`, width, height, bytes,
      sha256: createHash("sha256").update(Buffer.alloc(bytes)).digest("hex"),
    });
    const mobile = image("640w", 640, 427, 100);
    const desktop = image("1280w", 1280, 853, 400);
    const largest = image("original", 1536, 1024, 520);
    const publishedImageReport = imageProvenanceReport([imageProvenance([mobile, desktop, largest], 0, {
      contexts: ["public/cms/articles/example.json"],
    })], { version: 1, authoredRenditions: [] });
    const options = { publishedImageBudget: { totalBytes: 650, fileCount: 2, sourceAliasCount: 0 }, publishedImageReport };
    const fit = await fixture({ ...options, publishedImageFiles: [mobile, largest] });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd: fit });
    expect(stdout).toContain("PASS published image corpus total: 620 / 650 bytes");
    expect(stdout).toContain("PASS published image corpus count: 2 / 2 files");

    const accidental = await fixture({ ...options, publishedImageFiles: [mobile, desktop, largest] });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd: accidental })).rejects.toMatchObject({
      stderr: expect.stringContaining(`unlisted published image file: ${desktop.src}`),
    });
  });

  it("rejects files omitted from the published image provenance", async () => {
    const cwd = await fixture({ publishedImageFiles: [{ src: publishedImage, bytes: 200 }] });
    await writeFile(path.join(cwd, "dist", "media", "optimized", "unlisted.js"), "export default {};");
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining("unlisted published image file: media/optimized/unlisted.js"),
    });
  });

  it("rejects unrelated paths even when listed in the image provenance", async () => {
    const cwd = await fixture({ publishedImageFiles: [{ src: "assets/arbitrary.bin", bytes: 200 }] });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining("invalid published image output: assets/arbitrary.bin"),
    });
  });

  it.each(["missing", "changed"])("rejects %s delivered image files", async (kind) => {
    const cwd = await fixture({ publishedImageFiles: [{ src: publishedImage, bytes: 200 }] });
    const target = path.join(cwd, "dist", publishedImage);
    if (kind === "missing") await unlink(target);
    else await writeFile(target, Buffer.alloc(201));
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining(kind === "missing" ? "missing published image file" : "published image size differs from provenance"),
    });
  });

  it("fails closed when published image provenance is missing", async () => {
    const cwd = await fixture({ publishedImageReport: null });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stderr: expect.stringContaining("FAIL published image corpus: provenance is missing or unreadable"),
    });
  });

  it("keeps an independent ceiling on the complete published site", async () => {
    const cwd = await fixture({
      publishedImageFiles: [{ src: publishedImage, bytes: 200 * 1024 }],
      publishedSiteTotalBytes: 200 * 1024,
    });
    await expect(execFileAsync(process.execPath, [auditScript], { cwd })).rejects.toMatchObject({
      stdout: expect.stringContaining("FAIL published site total:"),
    });
  });

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

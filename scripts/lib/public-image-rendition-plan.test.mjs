import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { authoredPublicRenditions, planPublicImageRenditions, retiredPublicImageRenditions } from "./public-image-rendition-plan.mjs";

const prefix = "media/optimized/0123456789abcdef01234567-";
const mobile = { src: `${prefix}640w.webp`, width: 640, height: 428, bytes: 100 };
const desktop = { src: `${prefix}1280w.webp`, width: 1280, height: 853, bytes: 200 };
const largest = { src: `${prefix}original.webp`, width: 1536, height: 1024, bytes: 240 };
const article = {
  sourceUrl: "https://cdn.example.org/image.png",
  status: "ready",
  contexts: ["public/cms/articles/example.json"],
  largest,
  outputs: [mobile, desktop, largest],
};
const report = (images, authoredRenditions = []) => ({
  images,
  delivery: { version: 1, authoredRenditions },
});

function pressureArticle(id, desktopBytes, fullWidth = 1536) {
  const rebase = (output) => ({ ...output, src: output.src.replace(prefix, `media/optimized/${id.repeat(24)}-`) });
  const narrow = rebase(mobile);
  const wide = rebase({ ...desktop, bytes: desktopBytes });
  const full = rebase({ ...largest, width: fullWidth, bytes: Math.ceil(desktopBytes * 1.3) });
  return {
    ...article,
    sourceUrl: `https://cdn.example.org/${id}.png`,
    largest: full,
    outputs: [narrow, wide, full],
  };
}

describe("published article image renditions", () => {
  it("keeps mobile and full-resolution renditions without modifying the reusable archive", () => {
    const input = report([article]);
    const plan = planPublicImageRenditions(input);
    expect(plan.omitted).toEqual([desktop.src]);
    expect(plan.records[0]).toEqual({ ...article, outputs: [mobile, largest] });
    expect(input.images[0].outputs).toEqual([mobile, desktop, largest]);
    expect(planPublicImageRenditions(input)).toEqual(plan);
  });

  it.each([
    { width: 1601 },
    { height: desktop.height - 1 },
    { bytes: 251 },
  ])("preserves a distinct desktop rendition for replacement change %o", (changes) => {
    const full = { ...largest, ...changes };
    const record = { ...article, largest: full, outputs: [mobile, desktop, full] };
    expect(planPublicImageRenditions(report([record])).omitted).toEqual([]);
  });

  it("protects shared outputs needed for cover, card, and unclassified uses", () => {
    for (const contexts of [
      ["public/cms/published-content.json:imageUrl"],
      ["src/styles/premium.css"],
      [],
    ]) {
      const alias = { ...article, sourceUrl: "https://cdn.example.org/alias.png", contexts };
      expect(planPublicImageRenditions(report([article, alias])).omitted).toEqual([]);
    }
  });

  it("preserves editor-authored links to generated paths including absolute and srcset URLs", () => {
    const html = `<a href="https://probpera.ru/${desktop.src}?v=1">image</a>
      <img srcset="/${mobile.src} 640w, ${largest.src} 1536w">`;
    const referenced = authoredPublicRenditions(html);
    expect(referenced).toEqual([desktop.src, mobile.src, largest.src]);
    expect(planPublicImageRenditions(report([article], referenced)).omitted).toEqual([]);
  });

  it("identifies percent- and entity-encoded authored rendition paths", () => {
    const href = desktop.src.replaceAll("/", "%2F");
    const srcset = mobile.src.replaceAll("/", "&#47;");
    expect(authoredPublicRenditions(`<a href="${href}"><img srcset="${srcset} 640w">`))
      .toEqual([desktop.src, mobile.src]);
  });

  it("retains the largest output even if malformed ordering presents a greater width", () => {
    const record = { ...article, largest: desktop };
    expect(planPublicImageRenditions(report([record])).omitted).toEqual([]);
  });

  it.each([
    { totalBytes: 3000, fileCount: 6, omitted: [] },
    { totalBytes: 2250, fileCount: 6, omitted: ["b"] },
    { totalBytes: 3000, fileCount: 5, omitted: ["b"] },
    { totalBytes: 2500, fileCount: 4, omitted: ["a", "b"] },
  ])("fits measured bytes and file count independently and together (%o)", ({ totalBytes, fileCount, omitted }) => {
    const light = pressureArticle("a", 400);
    const heavy = pressureArticle("b", 700);
    const input = report([light, heavy]);
    const plan = planPublicImageRenditions(input, { totalBytes, fileCount });
    const byId = { a: light, b: heavy };
    expect(plan.omitted).toEqual(omitted.map((id) => byId[id].outputs[1].src));
    expect(plan.records.map(({ outputs, largest: full }) => [outputs[0], outputs.at(-1), full]))
      .toEqual([[light.outputs[0], light.largest, light.largest], [heavy.outputs[0], heavy.largest, heavy.largest]]);
    expect(input.images.map(({ outputs }) => outputs.length)).toEqual([3, 3]);
  });

  it("prefers the closer width tier and breaks equal savings by pathname regardless of inventory order", () => {
    const first = pressureArticle("a", 400);
    const equal = pressureArticle("b", 400);
    const wider = pressureArticle("c", 900, 1850);
    const budget = { totalBytes: 10_000, fileCount: 8 };
    for (const rows of [[equal, wider, first], [wider, first, equal]]) {
      expect(planPublicImageRenditions(report(rows), budget).omitted).toEqual([first.outputs[1].src]);
      expect(planPublicImageRenditions(report(rows), { ...budget, fileCount: 6 }).omitted)
        .toEqual([first, equal, wider].map(({ outputs }) => outputs[1].src));
    }
  });

  it("keeps an intermediate rendition if its replacement would add more than 50% to reader download bytes", () => {
    const current = pressureArticle("a", 400);
    current.largest.bytes = 601;
    expect(planPublicImageRenditions(report([current]), { totalBytes: 900, fileCount: 2 }).omitted)
      .toEqual([]);
  });

  it("keeps an authored path or a shared path required by any owner", () => {
    const ready = pressureArticle("a", 400);
    const intermediate = ready.outputs[1];
    const budget = { totalBytes: 900, fileCount: 2 };
    expect(planPublicImageRenditions(report([ready], [intermediate.src]), budget).omitted).toEqual([]);
    for (const changes of [
      { contexts: ["public/cms/published-content.json:imageUrl"] },
      { outputs: [intermediate, ready.largest] },
      { largest: intermediate },
      { outputs: [ready.outputs[0], intermediate, { ...ready.largest, width: 1930 }] },
    ]) {
      const alias = { ...ready, sourceUrl: "https://cdn.example.org/shared.png", ...changes };
      expect(planPublicImageRenditions(report([ready, alias]), budget).omitted).toEqual([]);
    }
    const alias = { ...ready, sourceUrl: "https://cdn.example.org/shared.png" };
    expect(planPublicImageRenditions(report([ready, alias]), { totalBytes: 1300, fileCount: 3 }).omitted)
      .toEqual([]);
    const shared = planPublicImageRenditions(report([ready, alias]), budget);
    expect(shared.omitted).toEqual([intermediate.src]);
    expect(shared.records.map(({ outputs }) => outputs.map(({ src }) => src)))
      .toEqual([[ready.outputs[0].src, ready.largest.src], [ready.outputs[0].src, ready.largest.src]]);
  });

  it("counts a still-authored retired rendition against the delivery limits", () => {
    const current = pressureArticle("a", 400);
    const historical = { src: largest.src, bytes: 150, sha256: "b".repeat(64) };
    const budget = { totalBytes: 1100, fileCount: 4 };
    const inventory = report([current]);
    inventory.delivery.retiredRenditions = [historical];
    expect(planPublicImageRenditions(inventory, budget).omitted).toEqual([]);
    inventory.delivery.authoredRenditions = [historical.src];
    const plan = planPublicImageRenditions(inventory, budget);
    expect(plan.preservedRetired).toEqual([historical]);
    expect(plan.omitted).toEqual([current.outputs[1].src]);
  });

  it.each([
    { fullWidth: 2400, retainedWidth: 1280 },
    { fullWidth: 2650, retainedWidth: 1920 },
  ])("keeps the remaining replacement when adjacent omissions would exceed the width limit (%o)", ({ fullWidth, retainedWidth }) => {
    const current = pressureArticle("a", 700, fullWidth);
    const wide = {
      ...current.outputs[1], src: current.outputs[1].src.replace("1280w", "1920w"),
      width: 1920, height: 900, bytes: 680,
    };
    current.outputs.splice(2, 0, wide);
    const plan = planPublicImageRenditions(report([current]), { totalBytes: 1500, fileCount: 2 });
    expect(plan.records[0].outputs.map(({ width }) => width)).toEqual([640, retainedWidth, fullWidth]);
    expect(plan.omitted).toHaveLength(1);
  });

  it("retires replaced outputs across builds while protecting active files and authored links", () => {
    const previous = {
      version: 1, completed: true,
      images: [{ ...article, outputs: [mobile, desktop, largest].map(output => ({ ...output, sha256: "a".repeat(64) })) }],
    };
    const replacement = { ...article, outputs: [mobile] };
    const retiredRenditions = retiredPublicImageRenditions(previous, [replacement]);
    expect(retiredRenditions.map(({ src }) => src)).toEqual([desktop.src, largest.src]);
    const current = {
      ...previous, images: [replacement],
      delivery: { version: 1, authoredRenditions: [largest.src], retiredRenditions },
    };
    expect(retiredPublicImageRenditions(current, [replacement])).toEqual(retiredRenditions);
    const plan = planPublicImageRenditions(current);
    expect(plan.retired.map(({ src }) => src)).toEqual([desktop.src]);
    expect(plan.preservedRetired.map(({ src }) => src)).toEqual([largest.src]);
  });

  it("prunes only previously verified orphaned files from the build output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "public-image-renditions-"));
    try {
      const content = Buffer.from("previously verified image");
      const inventory = {
        version: 1, completed: true, images: [],
        delivery: {
          version: 1, authoredRenditions: [largest.src],
          retiredRenditions: [desktop, largest].map(({ src }) => ({
            src, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex"),
          })),
        },
      };
      for (const dir of ["scripts/lib", "reports", "dist/media/optimized", "public/media/optimized"]) {
        await mkdir(path.join(root, dir), { recursive: true });
      }
      const scriptPath = path.join(root, "scripts/prune-public-image-renditions.mjs");
      const handleGuard = path.join(root, "require-rendition-file-handle.mjs");
      await Promise.all([
        copyFile(new URL("../prune-public-image-renditions.mjs", import.meta.url), scriptPath),
        copyFile(new URL("./public-image-rendition-plan.mjs", import.meta.url), path.join(root, "scripts/lib/public-image-rendition-plan.mjs")),
        copyFile(new URL("./compact-image-delivery.mjs", import.meta.url), path.join(root, "scripts/lib/compact-image-delivery.mjs")),
        copyFile(new URL("../../performance-budget.json", import.meta.url), path.join(root, "performance-budget.json")),
        writeFile(path.join(root, "reports/public-image-delivery.json"), JSON.stringify(inventory)),
        writeFile(path.join(root, "dist/index.html"), "<html></html>"),
        writeFile(path.join(root, "public", desktop.src), content),
        writeFile(path.join(root, "dist", desktop.src), Buffer.alloc(content.length)),
        writeFile(path.join(root, "dist", largest.src), content),
        writeFile(path.join(root, "dist", mobile.src), content),
        writeFile(handleGuard, `
          import fs from "node:fs/promises";
          import { syncBuiltinESMExports } from "node:module";
          const readFile = fs.readFile;
          fs.readFile = (file, ...options) => {
            const filename = file instanceof URL ? file.pathname : file;
            if (typeof filename === "string" && filename.endsWith(".webp")) {
              throw new Error("Rendition checks must read the opened file handle");
            }
            return readFile(file, ...options);
          };
          syncBuiltinESMExports();
        `),
      ]);

      const prune = () => promisify(execFile)(process.execPath, ["--import", pathToFileURL(handleGuard).href, scriptPath]);
      await expect(prune()).rejects.toMatchObject({ stderr: expect.stringContaining("Retired image rendition differs") });
      const distDesktop = path.join(root, "dist", desktop.src);
      expect(await readFile(distDesktop)).toEqual(Buffer.alloc(content.length));
      await unlink(distDesktop);
      if (process.platform === "win32") await mkdir(distDesktop);
      else await symlink(path.join(root, "public", desktop.src), distDesktop);
      await expect(prune()).rejects.toMatchObject({ stderr: expect.stringContaining("Image rendition is not a regular build file") });
      expect(await readFile(path.join(root, "public", desktop.src))).toEqual(content);
      if (process.platform === "win32") await rmdir(distDesktop);
      else await unlink(distDesktop);
      await writeFile(distDesktop, content);
      await prune();
      await expect(readFile(distDesktop)).rejects.toMatchObject({ code: "ENOENT" });
      for (const [dir, src] of [["public", desktop.src], ["dist", largest.src], ["dist", mobile.src]]) {
        expect(await readFile(path.join(root, dir, src))).toEqual(content);
      }
      await prune();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
      await Promise.all([
        copyFile(new URL("../prune-public-image-renditions.mjs", import.meta.url), scriptPath),
        copyFile(new URL("./public-image-rendition-plan.mjs", import.meta.url), path.join(root, "scripts/lib/public-image-rendition-plan.mjs")),
        copyFile(new URL("./compact-image-delivery.mjs", import.meta.url), path.join(root, "scripts/lib/compact-image-delivery.mjs")),
        writeFile(path.join(root, "reports/public-image-delivery.json"), JSON.stringify(inventory)),
        writeFile(path.join(root, "dist/index.html"), "<html></html>"),
        writeFile(path.join(root, "public", desktop.src), content),
        writeFile(path.join(root, "dist", desktop.src), Buffer.alloc(content.length)),
        writeFile(path.join(root, "dist", largest.src), content),
        writeFile(path.join(root, "dist", mobile.src), content),
      ]);

      const prune = () => promisify(execFile)(process.execPath, [scriptPath]);
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

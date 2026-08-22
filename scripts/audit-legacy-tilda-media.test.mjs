import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  auditLegacyTildaMedia,
  buildLegacyMediaInventory,
  extractLegacyMediaReferences,
} from "./audit-legacy-tilda-media.mjs";

const legacyHost = ["static", "tildacdn", "com"].join(".");
const legacyUrl = (pathname, query = "") =>
  `https://${legacyHost}${pathname}${query}`;

describe("legacy Tilda media inventory", () => {
  it("extracts locations, normalizes queries and classifies passive media", () => {
    const first = legacyUrl("/img/library/cover.webp", "?width=1200&format=webp");
    const second = legacyUrl("/docs/source.pdf");
    const source = `const cover = "${first}";\nconst sourceFile = "${second}";`;

    const references = extractLegacyMediaReferences(source, "src/example.ts");

    expect(references).toHaveLength(2);
    expect(references[0]).toMatchObject({
      file: "src/example.ts",
      line: 1,
      mediaKind: "image",
      extension: ".webp",
      protocol: "https:",
      malformed: false,
    });
    expect(references[0].normalizedUrl).toContain("format=webp&width=1200");
    expect(references[1]).toMatchObject({
      line: 2,
      mediaKind: "document",
      extension: ".pdf",
    });
  });

  it("redacts credentials and marks insecure or executable references", () => {
    const source = [
      `http://${legacyHost}/assets/runtime.js`,
      legacyUrl("/private/image.jpg", "?token=super-secret&width=800"),
    ].join("\n");
    const references = extractLegacyMediaReferences(source, "legacy.txt");
    const inventory = buildLegacyMediaInventory(references, 1);

    expect(inventory.unsafe).toEqual({
      httpReferences: 1,
      executableReferences: 1,
      credentialedReferences: 1,
      malformedReferences: 0,
    });
    expect(JSON.stringify(inventory)).not.toContain("super-secret");
    expect(JSON.stringify(inventory)).toContain("%5Bredacted%5D");
  });

  it("groups repeated URLs and preserves every source location", () => {
    const url = legacyUrl("/img/reused.jpg");
    const references = [
      ...extractLegacyMediaReferences(`"${url}"`, "src/first.ts"),
      ...extractLegacyMediaReferences(`"${url}"`, "src/second.ts"),
      ...extractLegacyMediaReferences(`"${url}"`, "src/second.ts"),
    ];
    const inventory = buildLegacyMediaInventory(references, 2);

    expect(inventory.totalReferences).toBe(3);
    expect(inventory.uniqueAssets).toBe(1);
    expect(inventory.duplicatedAssets).toBe(1);
    expect(inventory.assets[0].referenceCount).toBe(3);
    expect(inventory.assets[0].files).toEqual([
      "src/first.ts",
      "src/second.ts",
    ]);
    expect(inventory.urlSetSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("writes JSON, Markdown and CSV without scanning its own output", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "probpera-tilda-audit-"));
    const outputDirectory = path.join(root, ".tmp", "inventory");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "catalog.json"),
      JSON.stringify({ image: legacyUrl("/img/catalog.png") }),
      "utf8"
    );

    const inventory = await auditLegacyTildaMedia({ root, outputDirectory });
    expect(inventory.totalReferences).toBe(1);
    expect(inventory.uniqueAssets).toBe(1);

    const json = JSON.parse(
      await fs.readFile(path.join(outputDirectory, "inventory.json"), "utf8")
    );
    const markdown = await fs.readFile(
      path.join(outputDirectory, "inventory.md"),
      "utf8"
    );
    const csv = await fs.readFile(
      path.join(outputDirectory, "inventory.csv"),
      "utf8"
    );

    expect(json.totalReferences).toBe(1);
    expect(markdown).toContain("# Инвентаризация старых Tilda-медиа");
    expect(csv).toContain("reference_count");

    const secondRun = await auditLegacyTildaMedia({ root, outputDirectory });
    expect(secondRun.totalReferences).toBe(1);
  });
});

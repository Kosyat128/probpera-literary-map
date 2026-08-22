import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  auditTildaDependencies,
  classifyTildaPath,
  extractTildaUrls,
} from "./audit-tilda-dependencies.mjs";

const temporaryRoots = [];
const firstUrl =
  "https://static.tildacdn.com/tild0000-0000-0000-a000-000000000000/first.png";
const secondUrl =
  "https://static.tildacdn.com/tild1111-1111-1111-a111-111111111111/second.jpg";

async function fixtureRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "probpera-tilda-audit-"));
  temporaryRoots.push(rootDir);
  await fs.mkdir(path.join(rootDir, "src"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "public", "articles"), {
    recursive: true,
  });
  return rootDir;
}

function fixtureManifest() {
  return {
    version: 1,
    host: "static.tildacdn.com",
    runtimeRoots: ["src", "public"],
    handwrittenFiles: {
      "src/App.tsx": {
        expectedOccurrences: 2,
        allowedUrls: [firstUrl],
      },
    },
    generatedPrefixes: ["public/articles/"],
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((rootDir) =>
      fs.rm(rootDir, { recursive: true, force: true })
    )
  );
});

describe("Tilda dependency audit", () => {
  it("extracts complete URLs without trailing prose punctuation", () => {
    expect(
      extractTildaUrls(`image: "${firstUrl}", source: ${secondUrl}.`)
    ).toEqual([firstUrl, secondUrl]);
  });

  it("distinguishes reviewed handwritten, generated, and unexpected paths", () => {
    const manifest = fixtureManifest();
    expect(classifyTildaPath("src/App.tsx", manifest)).toBe("handwritten");
    expect(classifyTildaPath("public/articles/article.json", manifest)).toBe(
      "generated"
    );
    expect(classifyTildaPath("src/components/Card.tsx", manifest)).toBe(
      "unexpected"
    );
  });

  it("accepts the exact handwritten baseline and reports generated snapshots", async () => {
    const rootDir = await fixtureRoot();
    await fs.writeFile(
      path.join(rootDir, "src", "App.tsx"),
      `const cards = ["${firstUrl}", "${firstUrl}"];\n`
    );
    await fs.writeFile(
      path.join(rootDir, "public", "articles", "article.json"),
      JSON.stringify({ imageUrl: secondUrl })
    );

    const result = await auditTildaDependencies({
      rootDir,
      manifest: fixtureManifest(),
    });

    expect(result.status).toBe("ready");
    expect(result.errors).toEqual([]);
    expect(result.handwritten).toEqual([
      {
        path: "src/App.tsx",
        occurrences: 2,
        uniqueUrls: 1,
        addedUrls: [],
        missingUrls: [],
      },
    ]);
    expect(result.generated).toMatchObject({
      files: 1,
      occurrences: 1,
      uniqueUrls: 1,
      budget: null,
    });
  });

  it("fails closed for a new handwritten URL or a dependency in an unreviewed file", async () => {
    const rootDir = await fixtureRoot();
    await fs.mkdir(path.join(rootDir, "src", "components"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(rootDir, "src", "App.tsx"),
      `const cards = ["${firstUrl}", "${secondUrl}"];\n`
    );
    await fs.writeFile(
      path.join(rootDir, "src", "components", "Card.tsx"),
      `export const image = "${secondUrl}";\n`
    );

    const result = await auditTildaDependencies({
      rootDir,
      manifest: fixtureManifest(),
    });

    expect(result.status).toBe("failed");
    expect(result.errors.join("\n")).toContain("unreviewed Tilda URL");
    expect(result.errors.join("\n")).toContain(
      "src/components/Card.tsx: Tilda dependency is outside reviewed"
    );
  });

  it("stops aggregate growth inside generated runtime snapshots", async () => {
    const rootDir = await fixtureRoot();
    await fs.writeFile(
      path.join(rootDir, "src", "App.tsx"),
      `const cards = ["${firstUrl}", "${firstUrl}"];\n`
    );
    await fs.writeFile(
      path.join(rootDir, "public", "articles", "article.json"),
      JSON.stringify({ first: secondUrl, second: secondUrl })
    );
    const manifest = {
      ...fixtureManifest(),
      generatedBudget: {
        maxOccurrences: 1,
        maxUniqueUrls: 0,
      },
    };

    const result = await auditTildaDependencies({ rootDir, manifest });

    expect(result.status).toBe("failed");
    expect(result.errors.join("\n")).toContain(
      "above the reviewed ceiling 1"
    );
    expect(result.errors.join("\n")).toContain(
      "above the reviewed ceiling 0"
    );
    expect(result.generated.budget).toMatchObject({
      occurrenceHeadroom: -1,
      uniqueUrlHeadroom: -1,
    });
  });

  it("keeps the current repository inside the reviewed dependency boundary", async () => {
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "config", "tilda-dependency-baseline.json"),
        "utf8"
      )
    );
    const baseline = manifest.handwrittenFiles["src/App.tsx"];
    const result = await auditTildaDependencies();

    expect(result.errors, JSON.stringify(result, null, 2)).toEqual([]);
    expect(result.unexpected).toEqual([]);
    expect(result.handwritten).toEqual([
      {
        path: "src/App.tsx",
        occurrences: baseline.expectedOccurrences,
        uniqueUrls: new Set(baseline.allowedUrls).size,
        addedUrls: [],
        missingUrls: [],
      },
    ]);
    expect(result.generated.budget).toEqual({
      ...manifest.generatedBudget,
      occurrenceHeadroom: 0,
      uniqueUrlHeadroom: 0,
    });
  });
});

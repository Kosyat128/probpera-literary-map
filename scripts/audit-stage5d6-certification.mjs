import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

export const STAGE5D6_DATASET_SIZES = Object.freeze([
  1,
  7,
  12,
  100,
  1_000,
  10_000,
]);
export const STAGE5D6_DATASET_LABELS = Object.freeze([
  "1",
  "7",
  "12",
  "100",
  "1000",
  "current",
  "10000",
]);

const SOURCE_CONTRACTS = Object.freeze([
  {
    id: "quality-profiles",
    required: [
      ["src/books/bookShelfQualityController.ts", "ECONOMY profile", /["']ECONOMY["']/u],
      ["src/books/bookShelfQualityController.ts", "BALANCED profile", /["']BALANCED["']/u],
      ["src/books/bookShelfQualityController.ts", "HIGH profile", /["']HIGH["']/u],
      [
        "src/books/bookShelfQualityController.ts",
        "quality settings resolver",
        /export function resolveBookShelfQualitySettings\s*\(/u,
      ],
      [
        "src/books/completeShelfRenderer.tsx",
        "renderer consumes profile settings",
        /qualitySettings\.liveBookLimit/u,
      ],
    ],
  },
  {
    id: "texture-budgets",
    required: [
      [
        "src/books/bookShelfQualityController.ts",
        "desktop 32 and mobile/economy 16 shelf textures",
        /shelf:\s*mobile\s*\|\|\s*profile\s*===\s*["']ECONOMY["']\s*\?\s*16\s*:\s*32/u,
      ],
      [
        "src/books/bookShelfQualityController.ts",
        "one selected high-resolution texture",
        /selectedHighResolution:\s*1/u,
      ],
      [
        "src/books/bookShelfQualityController.ts",
        "bounded LRU trim",
        /function trimTextureEntries\s*\(/u,
      ],
      [
        "src/books/bookShelfQualityController.ts",
        "LRU touch helper",
        /export function touchBookShelfTextureLru\s*\(/u,
      ],
    ],
  },
  {
    id: "demand-frameloop",
    required: [
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "demand Canvas",
        /frameloop=["']demand["']/u,
      ],
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "hidden rendering pause",
        /setFrameloop\(["']never["']\)/u,
      ],
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "visibility lifecycle",
        /visibilitychange/u,
      ],
    ],
    forbidden: [
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "always-on Canvas",
        /frameloop=["']always["']/u,
      ],
    ],
  },
  {
    id: "webgl-context-recovery",
    required: [
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "context lost listener",
        /addEventListener\(["']webglcontextlost["']/u,
      ],
      [
        "src/components/BookShelfSceneCanvas.tsx",
        "context restored listener",
        /addEventListener\(\s*["']webglcontextrestored["']/u,
      ],
      [
        "src/components/BookShelfScene.tsx",
        "context loss fallback",
        /onFailure\(["']context-lost["']\)/u,
      ],
      [
        "src/components/BookShelfScene.tsx",
        "context restored callback",
        /onContextRestored/u,
      ],
    ],
  },
  {
    id: "mobile-detail-states",
    required: [
      ["src/books/bookShelfMobileDetail.ts", "collapsed state", /["']collapsed["']/u],
      ["src/books/bookShelfMobileDetail.ts", "half state", /["']half["']/u],
      ["src/books/bookShelfMobileDetail.ts", "expanded state", /["']expanded["']/u],
      [
        "src/books/bookShelfMobileDetail.ts",
        "axis lock resolver",
        /resolveBookShelfMobileDetailAxis/u,
      ],
      [
        "src/books/bookShelfMobileDetail.ts",
        "reduced-motion transition policy",
        /durationMs:\s*0/u,
      ],
      [
        "src/components/BookArchiveSection.tsx",
        "mobile state reducer integration",
        /useReducer\(\s*bookShelfMobileDetailReducer/u,
      ],
      [
        "src/components/BookArchiveSection.tsx",
        "mobile state semantic output",
        /data-mobile-position=/u,
      ],
    ],
  },
  {
    id: "combobox-live-region",
    required: [
      [
        "src/components/BookShelfControls.tsx",
        "integrated search combobox",
        /role=["']combobox["']/u,
      ],
      [
        "src/components/BookShelfControls.tsx",
        "listbox ownership",
        /aria-controls=\{listboxId\}/u,
      ],
      [
        "src/components/BookShelfControls.tsx",
        "active suggestion semantics",
        /aria-activedescendant=/u,
      ],
      [
        "src/components/BookShelfFrame.tsx",
        "rateable Shelf live region",
        /data-book-shelf-live-region/u,
      ],
      [
        "src/components/BookShelfFrame.tsx",
        "polite/assertive live priority",
        /aria-live=\{priority\}/u,
      ],
    ],
  },
  {
    id: "lazy-scene-mount",
    required: [
      [
        "src/components/BookArchiveSection.tsx",
        "near-viewport observer",
        /new IntersectionObserver\s*\(/u,
      ],
      [
        "src/components/BookArchiveSection.tsx",
        "bounded prefetch margin",
        /rootMargin:\s*["']720px 0px["']/u,
      ],
      [
        "src/components/BookArchiveSection.tsx",
        "direct-book activation override",
        /sceneNearViewport\s*\|\|\s*Boolean\(selectedBook\s*\|\|\s*requestedBook\)/u,
      ],
      [
        "src/components/BookShelfScene.tsx",
        "lazy Canvas module",
        /lazy\(\(\)\s*=>\s*loadSceneCanvas/u,
      ],
      [
        "src/components/BookShelfScene.tsx",
        "semantic loading boundary",
        /Suspense fallback=\{<BookShelfBrandLoader/u,
      ],
    ],
  },
  {
    id: "no-audio",
    required: [
      ["src/components/BookShelfScene.tsx", "Shelf scene source exists", /export default function BookShelfScene/u],
      ["src/books/completeShelfRenderer.tsx", "Shelf renderer source exists", /export default function CompleteShelfRenderer/u],
    ],
    forbidden: [
      ["src/components/BookArchiveSection.tsx", "audio API or asset", /new\s+Audio\s*\(|AudioContext|<audio\b|\.(?:mp3|wav|ogg|m4a)(?:[?"'\s]|$)/iu],
      ["src/components/BookShelfScene.tsx", "audio API or asset", /new\s+Audio\s*\(|AudioContext|<audio\b|\.(?:mp3|wav|ogg|m4a)(?:[?"'\s]|$)/iu],
      ["src/components/BookShelfSceneCanvas.tsx", "audio API or asset", /new\s+Audio\s*\(|AudioContext|<audio\b|\.(?:mp3|wav|ogg|m4a)(?:[?"'\s]|$)/iu],
      ["src/books/completeShelfRenderer.tsx", "audio API or asset", /new\s+Audio\s*\(|AudioContext|<audio\b|\.(?:mp3|wav|ogg|m4a)(?:[?"'\s]|$)/iu],
      ["src/books/completeShelfModel.ts", "audio API or asset", /new\s+Audio\s*\(|AudioContext|<audio\b|\.(?:mp3|wav|ogg|m4a)(?:[?"'\s]|$)/iu],
    ],
  },
]);

function normalizedPath(value) {
  return value.replaceAll("\\", "/");
}

export function auditStage5d6SourceContracts({ root = process.cwd() } = {}) {
  const sourceCache = new Map();
  const readSource = (relativePath) => {
    if (sourceCache.has(relativePath)) return sourceCache.get(relativePath);
    const absolutePath = path.join(root, relativePath);
    const source = existsSync(absolutePath)
      ? readFileSync(absolutePath, "utf8")
      : null;
    sourceCache.set(relativePath, source);
    return source;
  };

  const contracts = SOURCE_CONTRACTS.map((contract) => {
    const checks = [];
    for (const [file, label, pattern] of contract.required || []) {
      const source = readSource(file);
      checks.push({
        label,
        file: normalizedPath(file),
        expectation: "required",
        status: source !== null && pattern.test(source) ? "PASS" : "FAIL",
      });
    }
    for (const [file, label, pattern] of contract.forbidden || []) {
      const source = readSource(file);
      checks.push({
        label,
        file: normalizedPath(file),
        expectation: "forbidden",
        status: source !== null && !pattern.test(source) ? "PASS" : "FAIL",
      });
    }
    return {
      id: contract.id,
      status: checks.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
      checks,
    };
  });

  const fingerprint = createHash("sha256");
  for (const [file, source] of [...sourceCache.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  )) {
    fingerprint.update(`${normalizedPath(file)}\0${source ?? "MISSING"}\0`);
  }

  return {
    status: contracts.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    sourceFingerprintSha256: fingerprint.digest("hex"),
    contracts,
  };
}

async function runDeterministicHelperMetrics(root) {
  const entrySource = `
    import {
      createBookShelfTextureLru,
      resolveBookShelfQualitySettings,
      touchBookShelfTextureLru,
    } from "./src/books/bookShelfQualityController.ts";
    import { selectCompleteShelfWorkingSet } from "./src/books/completeShelfModel.ts";
    import {
      bookArchiveKey,
      buildBookArchive,
    } from "./src/data/bookArchive.ts";
    import { bookArchiveCountries } from "./src/data/countries.ts";

    const datasetSizes = ${JSON.stringify(STAGE5D6_DATASET_SIZES)};
    const makeSyntheticItems = (logicalBooks) => Array.from(
      { length: logicalBooks },
      (_, index) => ({ key: "book:" + String(index).padStart(5, "0") }),
    );
    const currentArchive = buildBookArchive(bookArchiveCountries);
    const currentByKey = new Map();
    for (const book of currentArchive) {
      const key = bookArchiveKey(book.countryId, book.writerId, book.id);
      if (!currentByKey.has(key)) currentByKey.set(key, { key });
    }
    const currentItems = [...currentByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key, "en"),
    );
    const datasetDefinitions = [
      ...datasetSizes
        .filter((logicalBooks) => logicalBooks < 10_000)
        .map((logicalBooks) => ({
          label: String(logicalBooks),
          source: "synthetic",
          items: makeSyntheticItems(logicalBooks),
        })),
      {
        label: "current",
        source: "canonical-book-archive",
        items: currentItems,
        rawArchiveBooks: currentArchive.length,
      },
      {
        label: "10000",
        source: "synthetic",
        items: makeSyntheticItems(10_000),
      },
    ];
    const scenarios = [
      {
        name: "HIGH",
        expectedProfile: "HIGH",
        signals: {
          viewportWidth: 1920,
          viewportHeight: 1080,
          devicePixelRatio: 2,
          deviceMemoryGb: 16,
          hardwareConcurrency: 12,
          preference: "HIGH",
        },
      },
      {
        name: "BALANCED",
        expectedProfile: "BALANCED",
        signals: {
          viewportWidth: 1024,
          viewportHeight: 768,
          devicePixelRatio: 1.5,
          deviceMemoryGb: 4,
          hardwareConcurrency: 4,
          preference: "BALANCED",
        },
      },
      {
        name: "ECONOMY",
        expectedProfile: "ECONOMY",
        signals: {
          viewportWidth: 390,
          viewportHeight: 844,
          devicePixelRatio: 3,
          deviceMemoryGb: 2,
          hardwareConcurrency: 2,
          saveData: true,
          preference: "auto",
        },
      },
    ];

    export default function runStage5d6HelperMetrics() {
    const datasets = datasetDefinitions.map((definition) => {
      const { items } = definition;
      const logicalBooks = items.length;
      if (logicalBooks < 1) {
        return {
          label: definition.label,
          source: definition.source,
          logicalBooks,
          profiles: [],
          status: "FAIL",
          failure: "empty-dataset",
        };
      }
      const anchorIndices = [...new Set([0, Math.floor((logicalBooks - 1) / 2), logicalBooks - 1])];
      const profiles = scenarios.map((scenario) => {
        const settings = resolveBookShelfQualitySettings(scenario.signals);
        const windows = anchorIndices.map((anchorSourceIndex) => {
          const anchorKey = items[anchorSourceIndex].key;
          const workingSet = selectCompleteShelfWorkingSet(
            items,
            anchorKey,
            settings.liveBookLimit,
          );
          const sourceIndexes = workingSet.entries.map(({ sourceIndex }) => sourceIndex);
          return {
            anchorSourceIndex,
            anchorResolvedIndex: workingSet.anchorSourceIndex,
            entries: workingSet.entries.length,
            firstSourceIndex: sourceIndexes[0],
            lastSourceIndex: sourceIndexes[sourceIndexes.length - 1],
            includesAnchor: sourceIndexes.includes(anchorSourceIndex),
          };
        });

        let cache = createBookShelfTextureLru(settings);
        let evictedShelfTextures = 0;
        let evictedSelectedTextures = 0;
        for (const item of items) {
          const result = touchBookShelfTextureLru(cache, {
            key: item.key,
            kind: "shelf",
          });
          cache = result.cache;
          evictedShelfTextures += result.evicted.length;
        }
        for (const item of items) {
          const result = touchBookShelfTextureLru(cache, {
            key: item.key,
            kind: "selected-high-resolution",
          });
          cache = result.cache;
          evictedSelectedTextures += result.evicted.length;
        }
        const retainedShelfTextures = cache.entries.filter(
          ({ kind }) => kind === "shelf",
        ).length;
        const retainedSelectedTextures = cache.entries.filter(
          ({ kind }) => kind === "selected-high-resolution",
        ).length;
        const maximumWorkingSet = Math.max(...windows.map(({ entries }) => entries));
        const assertions = {
          expectedProfile: settings.profile === scenario.expectedProfile,
          workingSetBounded:
            maximumWorkingSet <= settings.liveBookLimit && maximumWorkingSet <= 21,
          everyAnchorReachable: windows.every(({ includesAnchor }) => includesAnchor),
          shelfTextureBudget:
            retainedShelfTextures <= settings.textureBudgets.shelf,
          selectedTextureBudget:
            retainedSelectedTextures <= settings.textureBudgets.selectedHighResolution,
        };
        return {
          profile: scenario.name,
          resolvedProfile: settings.profile,
          mobile: settings.mobile,
          liveBookLimit: settings.liveBookLimit,
          textureBudgets: settings.textureBudgets,
          textureResolution: settings.textureResolution,
          maximumWorkingSet,
          windows,
          retainedShelfTextures,
          retainedSelectedTextures,
          evictedShelfTextures,
          evictedSelectedTextures,
          assertions,
          status: Object.values(assertions).every(Boolean) ? "PASS" : "FAIL",
        };
      });
      return {
        label: definition.label,
        source: definition.source,
        logicalBooks,
        ...(typeof definition.rawArchiveBooks === "number"
          ? { rawArchiveBooks: definition.rawArchiveBooks }
          : {}),
        profiles,
        status: profiles.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
      };
    });

    return {
      datasetSizes,
      datasetLabels: datasets.map(({ label }) => label),
      datasets,
      currentCorpus: {
        rawArchiveBooks: currentArchive.length,
        logicalBooks: currentItems.length,
        countries: bookArchiveCountries.length,
      },
      maxima: {
        logicalBooks: Math.max(...datasets.map(({ logicalBooks }) => logicalBooks)),
        liveWorkingSet: Math.max(...datasets.flatMap(({ profiles }) => profiles.map(({ maximumWorkingSet }) => maximumWorkingSet))),
        shelfTextures: Math.max(...datasets.flatMap(({ profiles }) => profiles.map(({ retainedShelfTextures }) => retainedShelfTextures))),
        selectedHighResolutionTextures: Math.max(...datasets.flatMap(({ profiles }) => profiles.map(({ retainedSelectedTextures }) => retainedSelectedTextures))),
      },
      status: datasets.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    };
    }
  `;
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: entrySource,
      resolveDir: root,
      sourcefile: "stage5d6-helper-certification.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    write: false,
    logLevel: "silent",
  });
  const output = result.outputFiles?.[0]?.text;
  if (!output) throw new Error("D6 helper certification bundle is empty");
  const sourceHash = createHash("sha256").update(output).digest("hex");
  const dataUrl = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}#${sourceHash}`;
  const module = await import(dataUrl);
  if (typeof module.default !== "function") {
    throw new Error("D6 helper certification entry is not executable");
  }
  return module.default();
}

export async function buildStage5d6Certification({ root = process.cwd() } = {}) {
  const source = auditStage5d6SourceContracts({ root });
  let helperMetrics = null;
  let helperError = null;
  if (source.status === "PASS") {
    try {
      helperMetrics = await runDeterministicHelperMetrics(root);
    } catch (error) {
      helperError = error instanceof Error ? error.message : String(error);
    }
  }
  const failures = [
    ...source.contracts
      .filter(({ status }) => status !== "PASS")
      .map(({ id }) => `source:${id}`),
    ...(helperError ? [`helpers:${helperError}`] : []),
    ...(helperMetrics && helperMetrics.status !== "PASS"
      ? ["helpers:bounded-datasets"]
      : []),
  ];
  return {
    schemaVersion: 1,
    certification: "STAGE_5D6_STATIC_AND_DETERMINISTIC",
    status: failures.length === 0 ? "PASS" : "FAIL",
    evidence: {
      sourceFingerprintSha256: source.sourceFingerprintSha256,
      runtime: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      limitations: [
        "Browser, GPU, CLS, frame-time and live service-worker measurements are not claimed by this static gate.",
      ],
    },
    sourceContracts: source.contracts,
    helperMetrics,
    failures,
  };
}

async function runCli() {
  const root = process.cwd();
  const report = await buildStage5d6Certification({ root });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write")) {
    const outputPath = path.join(
      root,
      "reports",
      "stage5d6-certification",
      "metrics.json",
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, "utf8");
  }
  process.stdout.write(json);
  if (report.status !== "PASS") process.exitCode = 1;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) await runCli();

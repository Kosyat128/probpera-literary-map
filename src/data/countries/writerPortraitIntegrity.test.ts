import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { countries } from "./index";
import type { WriterProfile } from "./types";
import curatedWriterQids from "./generated/curatedWriterQids.generated.json";
import identityRemediations from "./generated/writerIdentityRemediations.generated.json";

type PortraitFields = Pick<
  WriterProfile,
  "portrait" | "portraitAlt" | "portraitSourceUrl" | "portraitRights"
>;

type PortraitRecord = PortraitFields & {
  key: string;
  origin: "public" | "manifest" | "generated";
};

type RegistryEntry = {
  wikidataId: string;
};

type PortraitManifest = {
  writers: Record<string, PortraitFields>;
};

type GeneratedWriter = PortraitFields & {
  id: string;
};

type GeneratedWriterGroups = Record<string, GeneratedWriter[]>;

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "../../..");
const portraitDirectory = path.join(
  projectRoot,
  "public",
  "assets",
  "writer-portraits"
);
const manifestPath = path.join(
  testDirectory,
  "generated",
  "writerPortraits.generated.json"
);
const generatedWritersPath = path.join(
  testDirectory,
  "generated",
  "writers.generated.json"
);

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(filename, "utf8")) as T;
}

const manifest = readJson<PortraitManifest>(manifestPath);
const generatedWriterGroups = readJson<GeneratedWriterGroups>(
  generatedWritersPath
);
const registry = curatedWriterQids.writers as Record<string, RegistryEntry>;

const publicRecords: PortraitRecord[] = countries.flatMap((country) =>
  country.writers.map((writer) => ({
    key: `${country.id}:${writer.id}`,
    origin: "public" as const,
    portrait: writer.portrait,
    portraitAlt: writer.portraitAlt,
    portraitSourceUrl: writer.portraitSourceUrl,
    portraitRights: writer.portraitRights,
  }))
);

const manifestRecords: PortraitRecord[] = Object.entries(manifest.writers).map(
  ([key, portrait]) => ({ key, origin: "manifest", ...portrait })
);

const generatedRecords: PortraitRecord[] = Object.entries(
  generatedWriterGroups
).flatMap(([countryId, writers]) =>
  writers.map((writer) => ({
    key: `${countryId}:${writer.id}`,
    origin: "generated" as const,
    portrait: writer.portrait,
    portraitAlt: writer.portraitAlt,
    portraitSourceUrl: writer.portraitSourceUrl,
    portraitRights: writer.portraitRights,
  }))
);

// `countries` is the runtime result of the static country cards plus the
// portrait manifest. The two explicit JSON sources keep draft/generated asset
// references inside the same exact-reachability contract.
const allRecords = [
  ...publicRecords,
  ...manifestRecords,
  ...generatedRecords,
];

function normalizePortraitPath(value: string): string {
  return value.replace(/\\/gu, "/").replace(/^\/+/, "");
}

function portraitQid(value: string | undefined): string {
  const match = normalizePortraitPath(value || "").match(
    /(?:^|\/)q(\d+)\.webp$/iu
  );
  return match ? `Q${match[1]}` : "";
}

function rightsSignature(record: PortraitRecord): string {
  const rights = record.portraitRights;
  return JSON.stringify({
    portraitSourceUrl: record.portraitSourceUrl || "",
    status: rights?.status || "",
    licenseName: rights?.licenseName || "",
    licenseUrl: rights?.licenseUrl || "",
    creator: rights?.creator || "",
    sourceUrl: rights?.sourceUrl || "",
    checkedAt: rights?.checkedAt || "",
  });
}

function sourceLabel(record: PortraitRecord): string {
  return `${record.origin}:${record.key}`;
}

function referencedPortraitAssets(): string[] {
  return [
    ...new Set(
      allRecords
        .map((record) => record.portrait)
        .filter((value): value is string => Boolean(value))
        .map(normalizePortraitPath)
        .filter((value) => value.startsWith("assets/writer-portraits/"))
        .map((value) => value.slice("assets/writer-portraits/".length))
    ),
  ].sort();
}

describe("writer portrait integrity", () => {
  it("covers the complete public corpus", () => {
    expect(publicRecords).toHaveLength(1_684);
    expect(new Set(publicRecords.map((record) => record.key)).size).toBe(1_684);
  });

  it("keeps every published portrait bundle complete and locally reachable", () => {
    const issues: string[] = [];

    for (const record of publicRecords) {
      const label = sourceLabel(record);
      const bundleValues = [
        record.portraitAlt,
        record.portraitSourceUrl,
        record.portraitRights,
      ];

      if (!record.portrait) {
        if (bundleValues.some(Boolean)) {
          issues.push(`${label}: portrait metadata exists without portrait`);
        }
        continue;
      }

      const normalizedPath = normalizePortraitPath(record.portrait);
      if (!/^assets\/writer-portraits\/[^/]+\.webp$/iu.test(normalizedPath)) {
        issues.push(`${label}: portrait is not a local writer WebP (${record.portrait})`);
        continue;
      }

      if (!existsSync(path.join(projectRoot, "public", normalizedPath))) {
        issues.push(`${label}: portrait file does not exist (${normalizedPath})`);
      }
      if (!record.portraitAlt?.trim()) {
        issues.push(`${label}: portraitAlt is empty`);
      }
      if (!record.portraitSourceUrl?.trim()) {
        issues.push(`${label}: portraitSourceUrl is empty`);
      }

      const rights = record.portraitRights;
      if (!rights) {
        issues.push(`${label}: portraitRights is missing`);
        continue;
      }
      if (rights.status === "unverified") {
        issues.push(`${label}: portrait rights are unverified`);
      }
      if (!rights.licenseName?.trim()) {
        issues.push(`${label}: portrait licenseName is empty`);
      }
      if (!rights.checkedAt || !/^\d{4}-\d{2}-\d{2}$/u.test(rights.checkedAt)) {
        issues.push(`${label}: portrait checkedAt is missing or invalid`);
      }
      if (!rights.sourceUrl?.trim()) {
        issues.push(`${label}: portrait rights sourceUrl is empty`);
      }
      if (rights.sourceUrl !== record.portraitSourceUrl) {
        issues.push(`${label}: rights.sourceUrl differs from portraitSourceUrl`);
      }
      if (rights.status === "licensed") {
        if (!rights.licenseUrl?.trim()) {
          issues.push(`${label}: licensed portrait has no licenseUrl`);
        }
        if (!rights.creator?.trim()) {
          issues.push(`${label}: licensed portrait has no creator`);
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it("uses photographs for photography-era writers", () => {
    const nonPhotographicSourcePattern =
      /(?:^|[\/_%\-])(stamp|postage|bust|statue|sculpt(?:ure)?|monument|memorial|mural|painting|sketch|drawing|engraving|etching|lithograph|woodcut|coin|icon)(?:[\/_%\-.]|$)/iu;
    const issues: string[] = [];

    for (const country of countries) {
      for (const writer of country.writers) {
        if (!writer.portrait) continue;

        const key = `${country.id}:${writer.id}`;
        const yearMatches = String(
          writer.deathDate || writer.years || ""
        ).match(/\d{3,4}/gu);
        const deathYear = Number.parseInt(
          yearMatches?.[yearMatches.length - 1] || "",
          10
        );

        const decodedSource = decodeURIComponent(writer.portraitSourceUrl || "")
          .replace(/\s+/gu, "_")
          .toLocaleLowerCase("en");
        if (
          Number.isFinite(deathYear) &&
          // By 1880 portrait photography was established broadly enough that
          // an artwork should not silently replace a documented photograph.
          // Earlier borderline cases stay eligible for a verified historical
          // likeness when no authentic photograph is known to survive.
          deathYear >= 1880 &&
          nonPhotographicSourcePattern.test(decodedSource)
        ) {
          issues.push(`${key}: photography-era subject uses non-photographic media`);
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it("aligns q*.webp paths with the curated identity registry", () => {
    const issues: string[] = [];

    for (const record of allRecords) {
      if (!record.portrait || !registry[record.key]) continue;
      const qid = portraitQid(record.portrait);
      if (qid && qid !== registry[record.key].wikidataId) {
        issues.push(
          `${sourceLabel(record)}: ${qid} != ${registry[record.key].wikidataId}`
        );
      }
    }

    expect(issues).toEqual([]);
  });

  it("keeps shared portrait paths on one provenance and one curated identity", () => {
    const byPath = new Map<string, PortraitRecord[]>();
    for (const record of allRecords) {
      if (!record.portrait) continue;
      const normalizedPath = normalizePortraitPath(record.portrait);
      const records = byPath.get(normalizedPath) || [];
      records.push(record);
      byPath.set(normalizedPath, records);
    }

    const issues: string[] = [];
    for (const [portraitPath, records] of byPath) {
      const provenance = new Set(records.map(rightsSignature));
      if (provenance.size !== 1) {
        issues.push(
          `${portraitPath}: conflicting provenance in ${records
            .map(sourceLabel)
            .join(", ")}`
        );
      }

      const registryQids = new Set(
        records
          .map((record) => registry[record.key]?.wikidataId)
          .filter((value): value is string => Boolean(value))
      );
      if (registryQids.size > 1) {
        issues.push(
          `${portraitPath}: conflicting curated QIDs ${[...registryQids].join(", ")}`
        );
      }
    }

    expect(issues).toEqual([]);
  });

  it("does not publish a disproven portrait QID for its remediated writer", () => {
    const remediations = [
      ...identityRemediations.repairedMappings,
      ...identityRemediations.removedMappings,
    ];
    const issues: string[] = [];

    for (const remediation of remediations) {
      for (const record of allRecords.filter(
        (candidate) => candidate.key === remediation.key && candidate.portrait
      )) {
        if (portraitQid(record.portrait) === remediation.oldQid) {
          issues.push(
            `${sourceLabel(record)} still publishes ${remediation.oldQid}`
          );
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it("keeps the asset directory equal to all real portrait references", () => {
    const assets = readdirSync(portraitDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    const references = referencedPortraitAssets();

    expect(assets.every((filename) => /^q\d+\.webp$/u.test(filename))).toBe(
      true
    );
    expect(assets).toEqual(references);
  });

  it(
    "fully decodes every referenced portrait as a 384x480 WebP",
    async () => {
      const issues: string[] = [];
      const references = referencedPortraitAssets();
      const batchSize = 12;

      for (let offset = 0; offset < references.length; offset += batchSize) {
        const batch = references.slice(offset, offset + batchSize);
        await Promise.all(
          batch.map(async (filename) => {
            const filePath = path.join(portraitDirectory, filename);
            if (!existsSync(filePath)) {
              issues.push(`${filename}: file does not exist`);
              return;
            }
            try {
              const metadata = await sharp(filePath, {
                failOn: "error",
              }).metadata();
              if (
                metadata.format !== "webp" ||
                metadata.width !== 384 ||
                metadata.height !== 480
              ) {
                issues.push(
                  `${filename}: ${metadata.format || "unknown"} ${metadata.width || 0}x${metadata.height || 0}`
                );
              }

              // A raw pixel read forces a complete decode instead of checking
              // only the container header returned by metadata().
              await sharp(filePath, { failOn: "error" }).raw().toBuffer();
            } catch (error) {
              issues.push(
                `${filename}: decode failed (${error instanceof Error ? error.message : String(error)})`
              );
            }
          })
        );
      }

      expect(issues).toEqual([]);
    },
    120_000
  );
});

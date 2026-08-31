import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(
  cacheDirectory,
  `writer-biography-review-source-${process.pid}.mjs`
);
const runtimePath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerBiographyFactReviewCorrections.generated.json"
);
const rollupPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-fact-review-rollup.json"
);
const markdownPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-fact-review-rollup.md"
);
const writeMode = process.argv.includes("--write");
const russianBiographyReviewedAt = "2026-08-31";
const russianInstitutionalHosts = new Set([
  "bigenc.ru",
  "prlib.ru",
  "nlr.ru",
  "rsl.ru",
  "rusneb.ru",
  "ras.ru",
  "ruslang.ru",
  "pushkinskijdom.ru",
  "culture.ru",
  "goslitmuz.ru",
  "bulgakovmuseum.ru",
  "md.spb.ru",
  "museum-esenin.ru",
  "museumpushkin.ru",
  "pravenc.ru",
  "pushkinmuseum.ru",
  "kraslib.ru",
  "sholokhov.ru",
  "solzhenitsyn.ru",
  "tolstoymuseum.ru",
  "dommuseum.ru",
  "turgenevmus.ru",
  "chekhovmuseum.com",
]);

async function loadReviews() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [
      path.join(projectRoot, "scripts", "writer-biography-review-source.ts"),
    ],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: bundlePath,
    logLevel: "silent",
  });
  try {
    const module = await import(
      `${pathToFileURL(bundlePath).href}?v=${Date.now()}`
    );
    return {
      records: module.writerBiographyFactReviews,
      quarantinedKeys: new Set(
        module.writerBiographyFactReviewQuarantinedKeys || []
      ),
    };
  } finally {
    await rm(bundlePath, { force: true });
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function biographySentenceCount(value) {
  return value.trim().match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

function isRussianInstitutionalEvidence(evidence) {
  const hostname = new URL(evidence.url).hostname.toLowerCase();
  return [...russianInstitutionalHosts].some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

function russianInstitutionalEvidence(record) {
  return record.claims
    .flatMap((claim) => claim.evidence)
    .find(isRussianInstitutionalEvidence);
}

function validateRecord(record, index) {
  const label = `review[${index}]`;
  if (!record || typeof record !== "object") {
    throw new Error(`${label}: object expected`);
  }
  if (
    // One legacy Madagascar id contains an embedded soft hyphen. Preserve the
    // exact source key here so the review overlay can address the existing
    // record without silently renaming a public identity in a fact-review job.
    !/^[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+:[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+$/u.test(
      record.key || ""
    )
  ) {
    throw new Error(`${label}: invalid key ${JSON.stringify(record.key)}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(record.originalSha256 || "")) {
    throw new Error(`${record.key}: invalid original SHA-256`);
  }
  if (!new Set(["unchanged", "corrected", "held"]).has(record.decision)) {
    throw new Error(`${record.key}: invalid decision`);
  }
  if (record.decision === "held") {
    if (record.applicableTextRu !== null) {
      throw new Error(`${record.key}: held review must not be applicable`);
    }
  } else if (
    typeof record.applicableTextRu !== "string" ||
    !/[А-Яа-яЁё]/u.test(record.applicableTextRu)
  ) {
    throw new Error(`${record.key}: applicable Russian text is required`);
  }
  if (!Array.isArray(record.claims) || record.claims.length === 0) {
    throw new Error(`${record.key}: claim evidence is required`);
  }
  for (const claim of record.claims) {
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      throw new Error(`${record.key}: every claim needs evidence`);
    }
    for (const evidence of claim.evidence) {
      if (!/^https:\/\//u.test(evidence.url || "")) {
        throw new Error(`${record.key}: HTTPS evidence URL required`);
      }
    }
  }
}

function buildOutputs(records, quarantinedKeys) {
  records.forEach(validateRecord);
  const sorted = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en")
  );
  const keys = sorted.map((record) => record.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate writer biography review key");
  }

  const decisionCounts = { unchanged: 0, corrected: 0, held: 0 };
  const corrections = {};
  const russianBiographies = {};
  const excludedQuarantinedCorrectionKeys = [];
  for (const record of sorted) {
    decisionCounts[record.decision] += 1;
    if (record.decision === "corrected") {
      if (quarantinedKeys.has(record.key)) {
        excludedQuarantinedCorrectionKeys.push(record.key);
      } else {
        corrections[record.key] = record.applicableTextRu;
      }
    }
    if (
      record.key.startsWith("russia:") &&
      record.decision !== "held" &&
      !quarantinedKeys.has(record.key)
    ) {
      const text = record.applicableTextRu.trim();
      const sentenceCount = biographySentenceCount(text);
      if (sentenceCount < 2 || sentenceCount > 4) {
        throw new Error(
          `${record.key}: publishable Russian biography must contain 2-4 sentences`
        );
      }
      if (text.length < 120 || text.length > 1_600) {
        throw new Error(
          `${record.key}: publishable Russian biography must contain 120-1600 characters`
        );
      }
      const source = russianInstitutionalEvidence(record);
      if (!source) {
        throw new Error(
          `${record.key}: authoritative Russian-language institutional source is required`
        );
      }
      russianBiographies[record.key] = {
        text,
        reviewedAt: russianBiographyReviewedAt,
        source: {
          provider: source.provider,
          url: source.url,
          retrievedAt: source.checkedAt,
        },
      };
    }
  }
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        {
          records: sorted.map((record) => [
            record.key,
            record.originalSha256,
            record.decision,
            record.applicableTextRu,
          ]),
          excludedQuarantinedCorrectionKeys,
          russianBiographies,
        }
      ),
      "utf8"
    )
    .digest("hex");

  const runtime = {
    version: 3,
    reviewedCount: sorted.length,
    correctedCount: decisionCounts.corrected,
    publishedCorrectionCount: Object.keys(corrections).length,
    publishedRussianBiographyCount: Object.keys(russianBiographies).length,
    sourceFingerprint: `sha256:${fingerprint}`,
    corrections,
    russianBiographies,
  };
  const rollup = {
    version: 3,
    deterministic: true,
    sourceFingerprint: runtime.sourceFingerprint,
    summary: {
      records: sorted.length,
      ...decisionCounts,
    },
    publication: {
      corrections: runtime.publishedCorrectionCount,
      russianBiographies: runtime.publishedRussianBiographyCount,
      excludedQuarantinedCorrectionKeys,
    },
    reviewedKeys: keys,
  };
  const markdown = [
    "# Проверка русских биографий писателей",
    "",
    `- Проверено карточек: **${sorted.length}**`,
    `- Без изменения текста: **${decisionCounts.unchanged}**`,
    `- Исправлено: **${decisionCounts.corrected}**`,
    `- Удержано: **${decisionCounts.held}**`,
    `- Опубликовано исправлений: **${runtime.publishedCorrectionCount}**`,
    `- Опубликовано проверенных биографий российских авторов: **${runtime.publishedRussianBiographyCount}**`,
    `- Исключено карантинных ключей: **${excludedQuarantinedCorrectionKeys.length}**`,
    `- Отпечаток: \`${runtime.sourceFingerprint}\``,
    "",
    "Полные доказательства находятся в изолированных отчётах партий. Публичная сборка получает компактный слой исправленного русского текста; для российских авторов дополнительно публикуется одна основная русскоязычная институциональная ссылка с редакционной provenance.",
    "",
  ].join("\n");

  return { runtime, rollup, markdown };
}

async function verifyOrWrite(filePath, content) {
  if (writeMode) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    return;
  }
  const current = await readFile(filePath, "utf8").catch(() => null);
  if (current !== content) {
    throw new Error(
      `${path.relative(projectRoot, filePath)} is stale; run npm run writers:biographies:reviews:build`
    );
  }
}

const { records, quarantinedKeys } = await loadReviews();
const { runtime, rollup, markdown } = buildOutputs(records, quarantinedKeys);
await verifyOrWrite(runtimePath, stableJson(runtime));
await verifyOrWrite(rollupPath, stableJson(rollup));
await verifyOrWrite(markdownPath, markdown);

console.log(
  JSON.stringify(
    {
      mode: writeMode ? "write" : "check",
      ...rollup.summary,
      corrections: Object.keys(runtime.corrections).length,
      russianBiographies: Object.keys(runtime.russianBiographies).length,
      sourceFingerprint: runtime.sourceFingerprint,
    },
    null,
    2
  )
);

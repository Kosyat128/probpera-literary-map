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
  `book-evidence-v2-source-${process.pid}.mjs`
);
const reportsDirectory = path.join(projectRoot, "reports");
const canonRegistryPath = path.join(
  projectRoot,
  "data",
  "book-canon-source-registry.json"
);
const strict = process.argv.includes("--strict");

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  try {
    await build({
      absWorkingDir: projectRoot,
      entryPoints: [
        path.join(projectRoot, "scripts", "book-evidence-source.ts"),
      ],
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      target: "node22",
      outfile: bundlePath,
      logLevel: "silent",
    });
    return await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  } finally {
    await rm(bundlePath, { force: true });
  }
}

const source = await sourceArchive();
const canonRegistry = JSON.parse(await readFile(canonRegistryPath, "utf8"));
const issueCounts = new Map();
const records = source.archiveBooks.map((book) => {
  const recordKey = `${book.countryId}:${book.writerId}:${book.id}`;
  const descriptionSha256ByLocale = Object.fromEntries(
    ["ru", "en"].flatMap((locale) => {
      const description = book.translations?.[locale]?.description;
      if (typeof description !== "string" || !description) return [];
      return [
        [
          locale,
          createHash("sha256").update(description, "utf8").digest("hex"),
        ],
      ];
    })
  );
  const issues = source.bookEvidenceV2Issues(book, {
    canonRegistry,
    recordKey,
    originCountryIds: [book.countryId],
    descriptionSha256ByLocale,
  });
  for (const issue of issues) {
    issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
  }
  return {
    key: recordKey,
    title: book.translations?.ru?.title || book.title,
    writer: book.writerName,
    currentlyPublic: source.isPublicBook(book),
    evidenceV2Ready: issues.length === 0,
    issues,
  };
});

const publicRecords = records.filter((record) => record.currentlyPublic);
const publicBlocked = publicRecords.filter((record) => !record.evidenceV2Ready);
const readyRecords = records.filter((record) => record.evidenceV2Ready);
const canonClaimRecords = source.archiveBooks.filter((book) => book.canon);
const canonClaimIssues = records.filter((record) =>
  record.issues.some(
    (issue) => issue.startsWith("canon-") || issue === "malformed-work-canon-claim"
  )
);
const report = {
  generatedAt: new Date().toISOString(),
  contract:
    "Atomic future gate: published-edition RU/EN title evidence and immutable description provenance for every public card; canon evidence is additionally mandatory whenever canonical or landmark status is claimed.",
  summary: {
    canonicalRecords: records.length,
    currentlyPublic: publicRecords.length,
    evidenceV2Ready: readyRecords.length,
    currentlyPublicEvidenceV2Ready: publicRecords.length - publicBlocked.length,
    currentlyPublicReauditRequired: publicBlocked.length,
    canonClaims: canonClaimRecords.length,
    canonClaimsRequiringReview: canonClaimIssues.length,
  },
  issueCounts: Object.fromEntries(
    [...issueCounts.entries()].sort(
      ([leftIssue, leftCount], [rightIssue, rightCount]) =>
        rightCount - leftCount || leftIssue.localeCompare(rightIssue, "en")
    )
  ),
  currentlyPublicReauditQueue: publicBlocked,
};

await mkdir(reportsDirectory, { recursive: true });
await writeFile(
  path.join(reportsDirectory, "book-evidence-v2-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportsDirectory, "book-evidence-v2-audit.md"),
  [
    "# Аудит доказательности книжной базы v2",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    "> Новый gate измеряется параллельно и не снимает существующие карточки с публикации до завершения переаудита всего публичного набора.",
    "",
    `- Канонических записей корпуса после безопасного объединения: ${report.summary.canonicalRecords}.`,
    `- Сейчас публичны по прежнему RU/EN gate: ${report.summary.currentlyPublic}.`,
    `- Полностью готовы по evidence v2: ${report.summary.evidenceV2Ready}.`,
    `- Из публичных требуют переаудита: ${report.summary.currentlyPublicReauditRequired}.`,
    `- Явных заявлений canonical/landmark: ${report.summary.canonClaims}; требуют проверки: ${report.summary.canonClaimsRequiringReview}.`,
    "",
    "## Очередь переаудита текущих публичных карточек",
    "",
    ...publicBlocked.map(
      (record) =>
        `- **${record.title}** - ${record.writer}; ${record.key}; ${record.issues.join(", ")}`
    ),
    "",
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(report.summary, null, 2));
if (strict && publicBlocked.length > 0) process.exitCode = 1;

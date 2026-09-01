import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import {
  mergePortraitRightsQueue,
  PORTRAIT_RIGHTS_STATUSES,
  validatePortraitRightsQueue,
} from "./lib/writer-portrait-rights-workflow.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const queuePath = path.join(projectRoot, "data", "writer-portrait-rights-queue.json");
const curatedQidsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "curatedWriterQids.generated.json"
);
const reportPath = path.join(projectRoot, "reports", "writer-portrait-rights-queue.json");
const reportMarkdownPath = path.join(projectRoot, "reports", "writer-portrait-rights-queue.md");
const writeChanges = process.argv.includes("--write");
const today = new Date().toISOString().slice(0, 10);

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw new Error(`Cannot read ${path.relative(projectRoot, filename)}: ${error.message}`);
  }
}

async function loadPublicCountries() {
  const vite = await createServer({
    root: projectRoot,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/data/countries/index.ts");
    return module.countries;
  } finally {
    await vite.close();
  }
}

function writerName(writer) {
  return String(writer.name || writer.fullName || writer.id || "Автор").trim();
}

function publicWriterRoster(countries) {
  return countries.flatMap((country) =>
    country.writers.map((writer) => ({
      key: `${country.id}:${writer.id}`,
      countryId: country.id,
      countryName: country.name,
      writerId: writer.id,
      writerName: writerName(writer),
      hasPortrait: Boolean(String(writer.portrait || "").trim()),
    }))
  );
}

function markdownReport(report) {
  const counts = report.summary?.statusCounts || {};
  const lines = [
    "# Очередь юридической очистки портретов писателей",
    "",
    `Сформировано: ${report.generatedAt}`,
    "",
    "## Итог",
    "",
    `- Карточек без опубликованного портрета: **${report.summary?.expectedNoPortraitWriters ?? 0}**`,
    `- Записей в очереди: **${report.summary?.queueEntries ?? 0}**`,
    `- Commons search: **${counts["commons-search"] || 0}**`,
    `- Требуется разрешение: **${counts["permission-needed"] || 0}**`,
    `- Разрешение получено, нужна финальная юридическая проверка: **${counts["permission-received"] || 0}**`,
    `- Полностью очищено и готово к публикации: **${counts.licensed || 0}**`,
    `- Сохранено одобрений уже опубликованных новых фото: **${report.summary?.approvalLedgerEntries || 0}**`,
    `- Ошибок валидации: **${report.issues.length}**`,
    "",
    "## Fail-closed правило",
    "",
    "Реальную фотографию разрешено передавать в публичный manifest только из статуса `licensed` и только при полном rights bundle: установленный фотограф и правообладатель, всемирная территория, точная лицензия либо разрешение, неизменяемая ссылка на доказательство, HTTPS-источник, свежая дата проверки, отдельное доказательство личности изображённого человека и SHA-256 привязка к непубличному staging-файлу. Иконография, рисунки, живопись, скульптуры, марки, конверты, обложки, фотомонтажи и AI-двойники запрещены. Для остальных записей состояние означает «фото не опубликовано».",
    "",
    "## Ошибки",
    "",
  ];
  if (!report.issues.length) {
    lines.push("Ошибок нет.");
  } else {
    for (const item of report.issues.slice(0, 200)) {
      lines.push(`- \`${item.path}\` - ${item.code}: ${item.message}`);
    }
    if (report.issues.length > 200) {
      lines.push(`- … ещё ${report.issues.length - 200} ошибок; полный список находится в JSON-отчёте.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

const [countries, curatedQids] = await Promise.all([
  loadPublicCountries(),
  readJson(curatedQidsPath, { writers: {} }),
]);
const publicRoster = publicWriterRoster(countries);
const roster = publicRoster.filter((record) => !record.hasPortrait);
const duplicateRosterKeys = publicRoster
  .map((record) => record.key)
  .filter((key, index, values) => values.indexOf(key) !== index);
if (duplicateRosterKeys.length) {
  throw new Error(`Duplicate public writer keys: ${[...new Set(duplicateRosterKeys)].join(", ")}`);
}

const existingQueue = await readJson(queuePath, {
  schemaVersion: 1,
  updatedAt: today,
  writers: [],
});
const queue = writeChanges
  ? mergePortraitRightsQueue(existingQueue, roster, today, publicRoster)
  : existingQueue;
const validation = validatePortraitRightsQueue(queue, roster, {
  today,
  publicRecords: publicRoster,
  identityRegistry: curatedQids.writers,
});
const report = {
  generatedAt: new Date().toISOString(),
  source: "src/data/countries/index.ts#countries",
  queue: path.relative(projectRoot, queuePath).replaceAll("\\", "/"),
  policy: {
    finalStatus: "licensed",
    allowedStatuses: PORTRAIT_RIGHTS_STATUSES,
    worldwideRightsRequired: true,
    immutableEvidenceRequired: true,
    identityEvidenceRequired: true,
    stagedAssetSha256Required: true,
    aiGeneratedLikenessesAllowed: false,
    acceptedMediaKind: "photograph",
    unlicensedPresentation: "photo-not-published",
  },
  summary: validation.summary,
  issues: validation.issues,
};

if (writeChanges) {
  await writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportMarkdownPath, markdownReport(report), "utf8");
}

console.log(
  JSON.stringify(
    {
      queueEntries: validation.summary?.queueEntries || 0,
      noPortraitWriters: roster.length,
      statuses: validation.summary?.statusCounts || {},
      readyForPublication: validation.summary?.readyForPublication || 0,
      issues: validation.issues.length,
      mode: writeChanges ? "write" : "check",
    },
    null,
    2
  )
);

if (validation.issues.length) {
  for (const item of validation.issues.slice(0, 50)) {
    console.error(`${item.path}: ${item.code}: ${item.message}`);
  }
  if (validation.issues.length > 50) {
    console.error(`… ${validation.issues.length - 50} additional issue(s).`);
  }
  process.exitCode = 1;
}

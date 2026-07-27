import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);
const reportDirectory = path.join(projectRoot, "reports");
const currentYear = new Date().getUTCFullYear();
const literaryPattern =
  /писател|поэт|поэтесс|прозаик|романист|драматург|эссеист|литератур|автор (?:детских книг|романов|рассказов)|writer|poet|novelist|playwright|essayist|literary|short story|science fiction|children.?s author/iu;
const otherProfessionPattern =
  /певец|певица|музыкант|актёр|актер|режиссёр|режиссер|политик|шахмат|футбол|спорт|тяжелоатлет|лётч|летч|уфолог|учён|учен|профессор|юрист|врач|журналист|философ|историк|singer|musician|actor|director|politician|chess|football|sport|athlete|pilot|scientist|professor|lawyer|doctor|journalist|philosopher|historian/iu;

function deathYear(writer) {
  const source = writer.deathDate || writer.years || "";
  const matches = [...source.matchAll(/\d{4}/gu)];
  return Number(matches.at(-1)?.[0] || 0);
}

function issuesForWriter(countryId, writer) {
  const issues = [];
  if (!writer.id) issues.push("Отсутствует id");
  if (!writer.fullName) issues.push("Отсутствует полное имя");
  if (!/^Q\d+$/u.test(writer.wikidataId || "")) {
    issues.push("Некорректный Wikidata QID");
  }
  if (writer.editorial?.status !== "draft") {
    issues.push("Автоматическая карточка должна оставаться draft");
  }
  if (!writer.editorial?.sources?.some((source) => source.url === writer.sourceUrl)) {
    issues.push("Источник не связан с редакционной карточкой");
  }
  if (writer.portrait) {
    issues.push("Непроверенный портрет не должен публиковаться");
  }
  if (
    writer.portraitCandidateUrl &&
    writer.portraitRightsStatus !== "review-required"
  ) {
    issues.push("Кандидат портрета не помечен для проверки прав");
  }
  const futureDeathYear = deathYear(writer);
  if (futureDeathYear > currentYear) {
    issues.push(`Дата смерти ${futureDeathYear} находится в будущем`);
  }
  if (countryId === "russia" && writer.fullName?.split(/\s+/u).length < 3) {
    issues.push("Для российской карточки требуется полное ФИО");
  }

  const literaryMatch = literaryPattern.exec(writer.biography || "");
  const otherMatch = otherProfessionPattern.exec(writer.biography || "");
  if (!literaryMatch) {
    issues.push("Описание не подтверждает литературную специализацию");
  } else if (otherMatch && otherMatch.index < literaryMatch.index) {
    issues.push("Нелитературная профессия указана как основная");
  }
  return issues;
}

async function main() {
  const groups = JSON.parse(await readFile(generatedPath, "utf8"));
  const records = [];
  const duplicateCountryQids = [];

  for (const [countryId, writers] of Object.entries(groups)) {
    const qids = new Set();
    for (const writer of writers) {
      if (qids.has(writer.wikidataId)) {
        duplicateCountryQids.push(`${countryId}:${writer.wikidataId}`);
      }
      qids.add(writer.wikidataId);
      const issues = issuesForWriter(countryId, writer);
      records.push({
        countryId,
        id: writer.id,
        fullName: writer.fullName,
        wikidataId: writer.wikidataId,
        sourceUrl: writer.sourceUrl,
        issues,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      records: records.length,
      countryGroups: Object.keys(groups).length,
      valid: records.filter((record) => record.issues.length === 0).length,
      withIssues: records.filter((record) => record.issues.length > 0).length,
      duplicateCountryQids: duplicateCountryQids.length,
      russianFullNames: (groups.russia || []).filter(
        (writer) => writer.fullName?.split(/\s+/u).length >= 3
      ).length,
      russianRecords: (groups.russia || []).length,
    },
    duplicateCountryQids,
    records,
  };

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, "generated-writers-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(reportDirectory, "generated-writers-audit.md"),
    [
      "# Аудит автоматически добавленных писателей",
      "",
      `Сформирован: ${report.generatedAt}`,
      "",
      `- Записей: ${report.summary.records}`,
      `- Стран: ${report.summary.countryGroups}`,
      `- Без замечаний: ${report.summary.valid}`,
      `- Требуют внимания: ${report.summary.withIssues}`,
      `- Дубликатов QID внутри страны: ${report.summary.duplicateCountryQids}`,
      `- Российские записи с полным ФИО: ${report.summary.russianFullNames}/${report.summary.russianRecords}`,
      "",
      "## Редакционная очередь",
      "",
      ...records
        .filter((record) => record.issues.length > 0)
        .slice(0, 200)
        .flatMap((record) => [
          `### ${record.fullName || record.id}`,
          "",
          `Страна: ${record.countryId}; источник: ${record.sourceUrl || "нет"}`,
          "",
          ...record.issues.map((issue) => `- ${issue}`),
          "",
        ]),
    ].join("\n"),
    "utf8"
  );

  console.log(
    `Generated writers: ${report.summary.valid}/${report.summary.records} clean, ` +
      `${report.summary.withIssues} require review.`
  );
  if (report.summary.records !== 2356) process.exitCode = 2;
  if (report.summary.withIssues > 0 || duplicateCountryQids.length > 0) {
    process.exitCode = 1;
  }
}

await main();

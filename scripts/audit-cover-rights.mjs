import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const countriesDirectory = path.join(projectRoot, "src", "data", "countries");
const reportDirectory = path.join(projectRoot, "reports");
const allowedStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
  "external-preview",
]);

function field(block, name) {
  return (
    block.match(new RegExp(`\\b${name}:\\s*["']([^"']+)["']`, "u"))?.[1] || ""
  );
}

async function main() {
  const files = (await readdir(countriesDirectory)).filter((file) =>
    file.endsWith(".ts")
  );
  const covers = [];

  for (const file of files) {
    const source = await readFile(path.join(countriesDirectory, file), "utf8");
    for (const match of source.matchAll(/\bcoverUrl:\s*["']([^"']+)["']/gu)) {
      const block = source.slice(match.index, match.index + 900);
      const status = field(block, "status");
      const sourceUrl = field(block, "sourceUrl");
      const checkedAt = field(block, "checkedAt");
      const coverSourceUrl = field(block, "coverSourceUrl");
      covers.push({
        file,
        coverUrl: match[1],
        coverSourceUrl,
        status: status || "missing",
        sourceUrl,
        checkedAt,
        displayAllowed:
          allowedStatuses.has(status) && Boolean(sourceUrl || coverSourceUrl),
        issues: [
          ...(!status ? ["Нет статуса прав"] : []),
          ...(status && !allowedStatuses.has(status)
            ? ["Изображение не разрешено к показу"]
            : []),
          ...(!sourceUrl && !coverSourceUrl ? ["Нет ссылки на источник"] : []),
          ...(!checkedAt ? ["Не указана дата проверки"] : []),
          ...(match[1].startsWith("http://") ? ["Небезопасный HTTP URL"] : []),
        ],
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    policy: "docs/COVER_RIGHTS_POLICY.md",
    summary: {
      covers: covers.length,
      displayAllowed: covers.filter((cover) => cover.displayAllowed).length,
      blocked: covers.filter((cover) => !cover.displayAllowed).length,
      withIssues: covers.filter((cover) => cover.issues.length > 0).length,
    },
    covers,
  };

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, "cover-rights-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(reportDirectory, "cover-rights-audit.md"),
    [
      "# Аудит прав на обложки",
      "",
      `Сформирован: ${report.generatedAt}`,
      "",
      `- Найдено обложек: ${report.summary.covers}`,
      `- Разрешено к показу политикой проекта: ${report.summary.displayAllowed}`,
      `- Заблокировано до проверки: ${report.summary.blocked}`,
      `- Записей с замечаниями: ${report.summary.withIssues}`,
      "",
      ...covers.flatMap((cover) => [
        `## ${cover.file}`,
        "",
        `- Статус: ${cover.status}`,
        `- Показ: ${cover.displayAllowed ? "разрешён" : "заблокирован"}`,
        `- Источник: ${cover.sourceUrl || cover.coverSourceUrl || "не указан"}`,
        `- Проверено: ${cover.checkedAt || "не указано"}`,
        ...(cover.issues.length
          ? cover.issues.map((issue) => `- Замечание: ${issue}`)
          : ["- Замечаний нет"]),
        "",
      ]),
    ].join("\n"),
    "utf8"
  );

  console.log(
    `Cover audit: ${report.summary.displayAllowed}/${report.summary.covers} displayable, ` +
      `${report.summary.blocked} blocked.`
  );
}

await main();

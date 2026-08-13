import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const countriesDirectory = path.join(projectRoot, "src", "data", "countries");
const reportDirectory = path.join(projectRoot, "reports");
const userSuppliedCoverManifestFiles = [
  "userSuppliedBookCovers.generated.json",
  "userSuppliedBookCoversBatch20260813.generated.json",
];
const userSuppliedCoverManifestPaths = userSuppliedCoverManifestFiles.map((file) =>
  path.join(countriesDirectory, "generated", file)
);
const allowedStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
  "editorial-original",
  "external-preview",
]);

function field(block, name) {
  return (
    block.match(new RegExp(`["']?${name}["']?\\s*:\\s*["']([^"']+)["']`, "u"))?.[1] || ""
  );
}

async function main() {
  const userSuppliedCoverManifests = await Promise.all(
    userSuppliedCoverManifestPaths.map(async (manifestPath, index) => ({
      file: userSuppliedCoverManifestFiles[index],
      manifest: JSON.parse(await readFile(manifestPath, "utf8")),
    }))
  );
  const files = (await readdir(countriesDirectory))
    .filter((file) => file.endsWith(".ts"))
    .sort((left, right) => left.localeCompare(right, "en"));
  const covers = [];

  for (const file of files) {
    const source = await readFile(path.join(countriesDirectory, file), "utf8");
    for (const match of source.matchAll(/["']?coverUrl["']?\s*:\s*["']([^"']+)["']/gu)) {
      const block = source.slice(match.index, match.index + 900);
      const status = field(block, "status");
      const sourceUrl = field(block, "sourceUrl");
      const checkedAt = field(block, "checkedAt");
      const coverSourceUrl = field(block, "coverSourceUrl");
      const note = field(block, "note");
      covers.push({
        file,
        coverUrl: match[1],
        coverSourceUrl,
        status: status || "missing",
        sourceUrl,
        checkedAt,
        note,
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

  const existingCoverUrls = new Set(covers.map(({ coverUrl }) => coverUrl));
  for (const { file, manifest } of userSuppliedCoverManifests) {
    const manifestCheckedAt = manifest.generatedAt.slice(0, 10);
    for (const entry of manifest.entries) {
      if (existingCoverUrls.has(entry.coverUrl)) continue;
      covers.push({
        file: `generated/${file}`,
        coverUrl: entry.coverUrl,
        coverSourceUrl: entry.coverUrl,
        status: "editorial-original",
        sourceUrl: entry.coverUrl,
        checkedAt: manifestCheckedAt,
        coverWidth: entry.coverWidth,
        coverHeight: entry.coverHeight,
        coverThumbnailWidth: entry.coverThumbnailWidth,
        coverThumbnailHeight: entry.coverThumbnailHeight,
        provenance: entry.provenance,
        note: entry.provenance.note,
        displayAllowed: true,
        issues: [
          ...(entry.provenance?.kind !== "user-supplied"
            ? ["Некорректный provenance пользовательской обложки"]
            : []),
          ...(!entry.provenance?.archiveSha256 || !entry.provenance?.imageSha256
            ? ["Нет SHA-256 архива или исходного изображения"]
            : []),
          ...(!Number.isInteger(entry.coverWidth) || !Number.isInteger(entry.coverHeight)
            ? ["Нет размеров полной обложки"]
            : []),
          ...(
            !Number.isInteger(entry.coverThumbnailWidth) ||
            !Number.isInteger(entry.coverThumbnailHeight)
              ? ["Нет размеров миниатюры обложки"]
              : []
          ),
        ],
      });
      existingCoverUrls.add(entry.coverUrl);
    }
  }

  const userSuppliedFiles = new Set(
    userSuppliedCoverManifestFiles.map((file) => `generated/${file}`)
  );
  const generatedAt = userSuppliedCoverManifests
    .map(({ manifest }) => manifest.generatedAt)
    .sort()
    .at(-1);

  const report = {
    generatedAt,
    policy: "docs/COVER_RIGHTS_POLICY.md",
    summary: {
      covers: covers.length,
      countryCovers: covers.filter(
        (cover) => !userSuppliedFiles.has(cover.file)
      ).length,
      userSuppliedCovers: covers.filter(
        (cover) => userSuppliedFiles.has(cover.file)
      ).length,
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
      `- В country-файлах: ${report.summary.countryCovers}`,
      `- Из пользовательского manifest-overlay: ${report.summary.userSuppliedCovers}`,
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
        ...(cover.coverWidth
          ? [
              `- Размеры: ${cover.coverWidth}×${cover.coverHeight}; миниатюра ${cover.coverThumbnailWidth}×${cover.coverThumbnailHeight}`,
            ]
          : []),
        ...(cover.note ? [`- Примечание: ${cover.note}`] : []),
        ...(cover.provenance
          ? [
              `- Provenance: ${cover.provenance.kind}; archive SHA-256: ${cover.provenance.archiveSha256}; image SHA-256: ${cover.provenance.imageSha256}`,
            ]
          : []),
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

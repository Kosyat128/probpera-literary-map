import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

import {
  buildArticleBookAliasIndex,
  buildArticleBookWriterIdentityAliasMap,
  consolidateArticleBookCandidates,
  extractArticleBookCandidates,
  resolveArticleBookCandidate,
} from "./lib/article-book-coverage-policy.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "article-book-coverage-source.mjs");
const sourcePath = path.join(repositoryRoot, "scripts", "book-mentions-source.ts");
const publishedArticlesPath = path.join(
  repositoryRoot,
  "public",
  "cms",
  "published-articles.json"
);
const reportDirectory = path.join(repositoryRoot, "reports");

async function sourceArchive() {
  await fs.mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: repositoryRoot,
    entryPoints: [sourcePath],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    tsconfigRaw: {
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
      },
    },
    outfile: bundlePath,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
}

async function sourceArticles() {
  const manifest = JSON.parse(
    await fs.readFile(publishedArticlesPath, "utf8")
  );
  const articles = await Promise.all(
    manifest.articles.map(async (metadata) => {
      const documentPath = path.join(
        repositoryRoot,
        "public",
        metadata.documentPath
      );
      const document = JSON.parse(await fs.readFile(documentPath, "utf8"));
      return { ...metadata, ...document };
    })
  );
  return articles.sort((first, second) =>
    (first.legacyId || first.id).localeCompare(
      second.legacyId || second.id,
      "en"
    )
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((first, second) =>
    first.localeCompare(second, "en")
  );
}

function resultFrom(candidate, resolution) {
  return {
    author: candidate.author,
    title: candidate.title,
    kind: candidate.kind,
    articleId: candidate.articleId,
    cmsArticleId: candidate.cmsArticleId,
    articleTitle: candidate.articleTitle,
    articleUrl: candidate.articleUrl,
    sourceOccurrenceCount: candidate.occurrences.length,
    sourceArticleIds: unique(
      candidate.occurrences.map(
        (occurrence) => occurrence.cmsArticleId || occurrence.articleId
      )
    ),
    resolutionStatus: resolution.status,
    covered: resolution.covered,
    targetRecordKey: resolution.recordKey,
    countryId:
      resolution.book?.countryId || resolution.writer?.countryId || "",
    writerId: resolution.book?.writerId || resolution.writer?.writerId || "",
    writerName:
      resolution.book?.writerName || resolution.writer?.writerName || "",
    writerMatchAmbiguous: resolution.writerMatchAmbiguous,
    workMatchAmbiguous: resolution.workMatchAmbiguous,
    collisionReasonCodes: resolution.collisionReasonCodes,
    titleCollisionMatches: resolution.collisionReasonCodes.length
      ? resolution.titleMatches
      : [],
    authorWorkMatches:
      resolution.status === "ambiguous" ? resolution.authorTitleMatches : [],
  };
}

function collisionDetails(result) {
  const matches = result.titleCollisionMatches
    .map(
      (match) =>
        `${match.countryId}/${match.writerId}/${match.bookId} (${match.writerName})`
    )
    .join(", ");
  return `- ${result.author || "автор не указан"} - «${result.title}»: ${result.collisionReasonCodes.join(", ")} · ${matches || "совпадений в архиве нет"}`;
}

const source = await sourceArchive();
const articles = await sourceArticles();
const occurrences = articles.flatMap(extractArticleBookCandidates);
const candidates = consolidateArticleBookCandidates(occurrences);
const aliasIndex = buildArticleBookAliasIndex(source.archive);
const writerIdentityAliases = buildArticleBookWriterIdentityAliasMap(
  source.writerIdentityAliases
);
const results = candidates.map((candidate) =>
  resultFrom(
    candidate,
    resolveArticleBookCandidate(candidate, {
      aliasIndex,
      writers: source.writers,
      writerIdentityAliases,
    })
  )
);

const missing = results.filter(
  (result) => result.resolutionStatus === "missing"
);
const ambiguous = results.filter(
  (result) => result.resolutionStatus === "ambiguous"
);
const unmatchedWriter = results.filter(
  (result) => result.resolutionStatus === "unmatched-writer"
);
const collisions = results.filter(
  (result) => result.collisionReasonCodes.length > 0
);
const totals = {
  sourceOccurrences: occurrences.length,
  candidates: results.length,
  covered: results.filter((result) => result.resolutionStatus === "covered")
    .length,
  missing: missing.length,
  ambiguous: ambiguous.length,
  matchedWriter: results.filter((result) => result.writerId).length,
  unmatchedWriter: unmatchedWriter.length,
  ambiguousWriter: results.filter((result) => result.writerMatchAmbiguous)
    .length,
  titleCollisionCandidates: collisions.length,
  wrongAuthorTitleCollisions: results.filter((result) =>
    result.collisionReasonCodes.includes("wrong-author-title-collision")
  ).length,
};

await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(
  path.join(reportDirectory, "article-book-coverage.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      matchingPolicy: "normalized-title-author-and-reviewed-writer-alias-v3",
      writerIdentityAliasRegistry: {
        schemaVersion: source.writerIdentityAliasRegistry.schemaVersion,
        updatedAt: source.writerIdentityAliasRegistry.updatedAt,
        aliases: source.writerIdentityAliases.map((alias) => ({
          aliasWriterKey: alias.aliasWriterKey,
          canonicalWriterKey: alias.canonicalWriterKey,
          reviewedAt: alias.reviewedAt,
        })),
      },
      totals,
      collisions,
      results,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const markdown =
  [
    "# Покрытие произведений из статей",
    "",
    "Сопоставление выполняется по паре «автор + произведение». Одноимённая карточка другого автора не считается покрытием.",
    "Проверенные межстрановые дубли авторов разрешаются только через реестр идентичностей; исходные карточки и legacy-ключи сохраняются.",
    "",
    `- Исходных упоминаний в редакционных сериях: ${totals.sourceOccurrences}`,
    `- Уникальных пар «автор + произведение»: ${totals.candidates}`,
    `- Однозначно сопоставлены с архивом: ${totals.covered}`,
    `- Карточка нужного автора отсутствует: ${totals.missing}`,
    `- Неоднозначные карточки: ${totals.ambiguous}`,
    `- Автор не сопоставлен: ${totals.unmatchedWriter}`,
    `- Кандидаты с коллизиями названий: ${totals.titleCollisionCandidates}`,
    `- Ложные совпадения только по названию: ${totals.wrongAuthorTitleCollisions}`,
    "",
    "## Отсутствующие карточки нужного автора",
    "",
    ...(missing.length
      ? missing.map(
          (result) =>
            `- ${result.author} - «${result.title}» · предполагаемый автор: ${result.countryId || "страна не найдена"}/${result.writerId || "автор не найден"} · совпадения названия: ${result.titleCollisionMatches.map((match) => `${match.countryId}/${match.writerId}/${match.bookId}`).join(", ") || "нет"} · ${result.articleUrl}`
        )
      : ["- Нет."]),
    "",
    "## Неоднозначные карточки",
    "",
    ...(ambiguous.length
      ? ambiguous.map(
          (result) =>
            `- ${result.author || "автор не указан"} - «${result.title}» · ${result.authorWorkMatches.map((match) => match.recordKey).join(", ")} · ${result.articleUrl}`
        )
      : ["- Нет."]),
    "",
    "## Коллизии названий",
    "",
    ...(collisions.length ? collisions.map(collisionDetails) : ["- Нет."]),
    "",
  ].join("\n").trimEnd() + "\n";

await fs.writeFile(
  path.join(reportDirectory, "article-book-coverage.md"),
  markdown,
  "utf8"
);

console.log(JSON.stringify(totals, null, 2));

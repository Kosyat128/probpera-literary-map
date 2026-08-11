import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";
import { aliasCanIdentifyWork } from "./lib/book-article-mention-policy.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "book-mentions-source.mjs");
const sourcePath = path.join(repositoryRoot, "scripts", "book-mentions-source.ts");
const outputPath = path.join(
  repositoryRoot,
  "public",
  "articles",
  "book-mentions.json"
);
const userSuppliedCoverManifestPath = path.join(
  repositoryRoot,
  "src",
  "data",
  "countries",
  "generated",
  "userSuppliedBookCovers.generated.json"
);

export function normalizeMentionText(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/°/gu, " градус ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsPhrase(haystack, needle) {
  return Boolean(
    needle &&
      ` ${haystack} `.includes(` ${needle} `)
  );
}

function bookKey(book) {
  return `${book.countryId}:${book.writerId}:${book.id}`;
}

async function sourceData() {
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

  const moduleUrl = `${pathToFileURL(bundlePath).href}?v=${Date.now()}`;
  const module = await import(moduleUrl);
  return {
    archive: module.archive,
    articles: module.articles,
  };
}

async function jsonFiles(directory) {
  try {
    return (await fs.readdir(directory, { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".json") &&
          entry.name !== "index.json" &&
          entry.name !== "book-mentions.json"
      )
      .map((entry) => path.join(directory, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function sourceArticles(canonicalCatalog) {
  const files = [
    ...(await jsonFiles(path.join(repositoryRoot, "public", "articles"))),
    ...(await jsonFiles(
      path.join(repositoryRoot, "public", "cms", "articles")
    )),
  ];
  const documentsById = new Map();

  for (const file of files) {
    const article = JSON.parse(await fs.readFile(file, "utf8"));
    if (!article?.id || !article?.title) continue;
    documentsById.set(article.id, article);
  }

  return canonicalCatalog
    .map((metadata) => {
      const document =
        documentsById.get(metadata.id) ||
        (metadata.legacyId ? documentsById.get(metadata.legacyId) : null) ||
        {};
      const title = metadata.title || document.title || "";
      if (!metadata.id || !title) return null;

      const description = metadata.description || document.description || "";
      const titleText = normalizeMentionText(title);
      const descriptionText = normalizeMentionText(description);
      const bodyText = normalizeMentionText(
        document.plainText || document.contentHtml
      );
      return {
        id: metadata.id,
        title,
        sectionId: metadata.sectionId || "literary-essays",
        sectionLabel: metadata.sectionLabel || "Материалы",
        readingMinutes: Number(metadata.readingMinutes) || 1,
        slug: metadata.slug || "",
        imageUrl: metadata.imageUrl || "",
        titleText,
        descriptionText,
        bodyText,
        fullText: `${titleText} ${descriptionText} ${bodyText}`,
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.title.localeCompare(second.title, "ru"));
}

function writerSurname(writerName = "") {
  return (
    normalizeMentionText(writerName)
      .split(" ")
      .filter((part) => part.length >= 3)
      .at(-1) || ""
  );
}

function matchArticle(book, article) {
  const aliases = [
    ...new Set(
      [book.title, book.originalTitle, ...(book.alternateTitles || [])].filter(
        Boolean
      )
    ),
  ]
    .map(normalizeMentionText)
    .filter((alias) => alias.length >= 2);
  if (!aliases.length) return null;

  const surname = writerSurname(book.writerName);
  const authorPresent =
    surname.length >= 4 && containsPhrase(article.fullText, surname);

  const titleMatch = aliases.some(
    (alias) =>
      aliasCanIdentifyWork(alias, {
        authorPresent,
        exactTitle: article.titleText === alias,
      }) && containsPhrase(article.titleText, alias)
  );
  if (titleMatch) {
    return article.sectionId === "book-opinions" ? "review" : "feature";
  }

  const descriptionMatch = aliases.some(
    (alias) =>
      alias.length >= 4 &&
      aliasCanIdentifyWork(alias, { authorPresent }) &&
      containsPhrase(article.descriptionText, alias)
  );
  if (descriptionMatch) return "feature";

  const bodyMatch = aliases.some((alias) => {
    if (alias.length < 5) return false;
    if (!aliasCanIdentifyWork(alias, { authorPresent })) return false;
    return containsPhrase(article.bodyText, alias);
  });

  return bodyMatch ? "mention" : null;
}

const source = await sourceData();
const archive = source.archive;
const articles = await sourceArticles(source.articles);
const byBook = {};
const reverseRelations = {};
let relationCount = 0;

for (const book of archive) {
  const relations = articles
    .map((article) => {
      const kind = matchArticle(book, article);
      if (!kind) return null;
      const {
        titleText,
        descriptionText,
        bodyText,
        fullText,
        ...publicArticle
      } = article;
      return { ...publicArticle, kind };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const rank = { review: 0, feature: 1, mention: 2 };
      return (
        rank[first.kind] - rank[second.kind] ||
        first.title.localeCompare(second.title, "ru")
      );
    });

  if (!relations.length) continue;
  byBook[bookKey(book)] = relations;
  relationCount += relations.length;

  const recommendation = book.recommendation;
  if (
    !recommendation?.key ||
    !recommendation.localizations?.ru?.title ||
    !recommendation.localizations?.en?.title
  ) {
    continue;
  }

  for (const article of relations) {
    const articleRelations = (reverseRelations[article.id] ||= []);
    if (articleRelations.some((item) => item.key === recommendation.key)) continue;
    articleRelations.push({
      ...recommendation,
      kind: article.kind,
    });
  }
}

const relationRank = { review: 0, feature: 1, mention: 2 };
const byArticle = Object.fromEntries(
  Object.entries(reverseRelations).map(([articleId, books]) => [
    articleId,
    books
      .sort(
        (first, second) =>
          relationRank[first.kind] - relationRank[second.kind] ||
          Number(Boolean(second.coverUrl)) - Number(Boolean(first.coverUrl)) ||
          first.localizations.ru.title.localeCompare(
            second.localizations.ru.title,
            "ru"
          )
      )
      .slice(0, 6),
  ])
);
const articleBookRelationCount = Object.values(byArticle).reduce(
  (sum, books) => sum + books.length,
  0
);

const payload = {
  version: 2,
  bookCount: archive.length,
  articleCount: articles.length,
  linkedBookCount: Object.keys(byBook).length,
  linkedArticleCount: Object.keys(byArticle).length,
  relationCount,
  articleBookRelationCount,
  byBook,
  byArticle,
};

const serializedPayload = `${JSON.stringify(payload, null, 2)}\n`;
if (process.argv.includes("--check-user-cover-scope")) {
  const coverManifest = JSON.parse(
    await fs.readFile(userSuppliedCoverManifestPath, "utf8")
  );
  const coverPaths = new Set(
    coverManifest.entries.flatMap((entry) => [
      entry.coverUrl,
      entry.coverThumbnailUrl,
    ])
  );
  const leakedPaths = [...coverPaths].filter((coverPath) =>
    serializedPayload.includes(coverPath)
  );
  const coveredArticleRecommendations = Object.values(byArticle)
    .flat()
    .filter(
      (recommendation) =>
        coverManifest.entries.some(
          (entry) => entry.workKey === recommendation.key
        ) && recommendation.coverUrl
    );
  if (leakedPaths.length || coveredArticleRecommendations.length) {
    throw new Error(
      `Пользовательский cover-overlay попал в статьи: paths=${leakedPaths.length}, recommendations=${coveredArticleRecommendations.length}.`
    );
  }
  console.log(
    `Article cover scope: ${coverManifest.entries.length} user-supplied covers excluded from generated article recommendations.`
  );
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, serializedPayload, "utf8");
}

const seaWolfKey = Object.keys(byBook).find((key) =>
  archive.some(
    (book) =>
      bookKey(book) === key &&
      normalizeMentionText(book.title) === "морской волк"
  )
);
const seaWolfLinks = seaWolfKey ? byBook[seaWolfKey]?.length || 0 : 0;

console.log(
  `Связи книг и журнала: ${relationCount} связей, ${Object.keys(byBook).length} книг, ${articles.length} статей.`
);
console.log(
  `Рекомендации в статьях: ${articleBookRelationCount} карточек для ${Object.keys(byArticle).length} статей.`
);
console.log(`«Морской волк»: ${seaWolfLinks} связанных материалов.`);

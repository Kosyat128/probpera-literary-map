import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

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

export function normalizeMentionText(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
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

  const moduleUrl = `${pathToFileURL(bundlePath).href}?v=${Date.now()}`;
  const module = await import(moduleUrl);
  return module.archive;
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

async function sourceArticles() {
  const files = [
    ...(await jsonFiles(path.join(repositoryRoot, "public", "articles"))),
    ...(await jsonFiles(
      path.join(repositoryRoot, "public", "cms", "articles")
    )),
  ];
  const byId = new Map();

  for (const file of files) {
    const article = JSON.parse(await fs.readFile(file, "utf8"));
    if (!article?.id || !article?.title) continue;

    const titleText = normalizeMentionText(article.title);
    const descriptionText = normalizeMentionText(article.description);
    const bodyText = normalizeMentionText(
      article.plainText || article.contentHtml
    );
    byId.set(article.id, {
      id: article.id,
      title: article.title,
      sectionId: article.sectionId || "literary-essays",
      sectionLabel: article.sectionLabel || "Материалы",
      readingMinutes: Number(article.readingMinutes) || 1,
      slug: article.slug || "",
      titleText,
      descriptionText,
      bodyText,
      fullText: `${titleText} ${descriptionText} ${bodyText}`,
    });
  }

  return [...byId.values()].sort((first, second) =>
    first.title.localeCompare(second.title, "ru")
  );
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
  const aliases = [...new Set([book.title, book.originalTitle].filter(Boolean))]
    .map(normalizeMentionText)
    .filter((alias) => alias.length >= 2);
  if (!aliases.length) return null;

  const titleMatch = aliases.some((alias) =>
    containsPhrase(article.titleText, alias)
  );
  if (titleMatch) {
    return article.sectionId === "book-opinions" ? "review" : "feature";
  }

  const descriptionMatch = aliases.some(
    (alias) =>
      alias.length >= 4 &&
      containsPhrase(article.descriptionText, alias)
  );
  if (descriptionMatch) return "feature";

  const surname = writerSurname(book.writerName);
  const authorPresent =
    surname.length >= 4 && containsPhrase(article.fullText, surname);
  const bodyMatch = aliases.some((alias) => {
    const wordCount = alias.split(" ").length;
    if (alias.length < 5) return false;
    if (wordCount === 1 && alias.length < 7 && !authorPresent) return false;
    if (/^\d+$/u.test(alias) && !authorPresent) return false;
    return containsPhrase(article.bodyText, alias);
  });

  return bodyMatch ? "mention" : null;
}

const archive = await sourceArchive();
const articles = await sourceArticles();
const byBook = {};
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
}

const payload = {
  version: 1,
  bookCount: archive.length,
  articleCount: articles.length,
  linkedBookCount: Object.keys(byBook).length,
  relationCount,
  byBook,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

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
console.log(`«Морской волк»: ${seaWolfLinks} связанных материалов.`);

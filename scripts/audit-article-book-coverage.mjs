import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import * as cheerio from "cheerio";
import { build } from "esbuild";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "article-book-coverage-source.mjs");
const sourcePath = path.join(repositoryRoot, "scripts", "book-mentions-source.ts");
const articlesDirectory = path.join(repositoryRoot, "public", "articles");
const reportDirectory = path.join(repositoryRoot, "reports");

function normalize(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/°/gu, " градус ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stripHeading(value = "") {
  return value
    .replace(/^\s*\d+(?:[.)]\s*|\s+)/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseNovelHeading(value) {
  const heading = stripHeading(value);
  let match = heading.match(/^(.+?)\s+[—–-]\s+(.+)$/u);
  if (match) {
    const [, first, second] = match;
    if (/^[«“"]/.test(first)) {
      return {
        author: second.trim(),
        title: first.replace(/^[«“"]|[»”"]$/gu, "").trim(),
      };
    }
    return { author: first.trim(), title: second.trim() };
  }

  match = heading.match(/^(.+?)\s+[«“"](.+?)[»”"]$/u);
  if (match) return { author: match[1].trim(), title: match[2].trim() };

  match = heading.match(/^[«“"](.+?)[»”"]\s*,\s*(.+)$/u);
  if (match) return { author: match[2].trim(), title: match[1].trim() };

  return null;
}

function cleanCatalogText(value = "") {
  return stripHeading(value)
    .replace(/\s*\([^)]*(?:18|19|20)\d{2}[^)]*\)\s*$/u, "")
    .replace(/^[«“"]|[»”"]$/gu, "")
    .trim();
}

function parseCatalogHeading(value) {
  const heading = stripHeading(value).replace(
    /\s*\([^)]*(?:18|19|20)\d{2}[^)]*\)\s*$/u,
    ""
  );
  let match = heading.match(/^[«“"](.+?)[»”"]\s*[—–-]\s*(.+)$/u);
  if (match) return { title: match[1].trim(), author: match[2].trim() };
  match = heading.match(/^[«“"](.+?)[»”"]\s*,\s*(.+)$/u);
  if (match) return { title: match[1].trim(), author: match[2].trim() };
  match = heading.match(/^(.+?)\s*[—–-]\s*[«“"](.+?)[»”"]$/u);
  if (match) return { title: match[2].trim(), author: match[1].trim() };
  match = heading.match(/^(.+?)\s*[—–-]\s*(.+)$/u);
  if (match && !/\d{4}/u.test(match[1])) {
    return { title: match[1].trim(), author: match[2].trim() };
  }
  return { title: cleanCatalogText(heading), author: "" };
}

function quotedTitle(value = "") {
  return value.match(/[«“"](.+?)[»”"]/u)?.[1]?.trim() || "";
}

function candidateWriterScore(candidate, writer) {
  const wanted = normalize(candidate)
    .split(" ")
    .filter((part) => part.length > 1);
  const actual = normalize(writer.writerName)
    .split(" ")
    .filter((part) => part.length > 1);
  if (!wanted.length || !actual.length) return 0;
  const exact = normalize(candidate) === normalize(writer.writerName);
  const surname = wanted.at(-1);
  const surnameMatch = actual.includes(surname);
  const shared = wanted.filter((part) => actual.includes(part)).length;
  return (exact ? 100 : 0) + (surnameMatch ? 20 : 0) + shared;
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
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
}

async function sourceArticles() {
  const files = (await fs.readdir(articlesDirectory))
    .filter(
      (name) =>
        name.endsWith(".json") &&
        name !== "index.json" &&
        name !== "book-mentions.json"
    )
    .sort();
  return Promise.all(
    files.map(async (name) =>
      JSON.parse(await fs.readFile(path.join(articlesDirectory, name), "utf8"))
    )
  );
}

const source = await sourceArchive();
const archive = source.archive;
const articles = await sourceArticles();
const writers = source.writers;
const knownBooks = new Map();
for (const book of archive) {
  for (const title of [book.title, ...(book.alternateTitles || [])]) {
    knownBooks.set(normalize(title), book);
  }
}
const candidates = [];

for (const article of articles) {
  const articleUrl = article?.url || article?.sourceUrl || "";
  if (!article?.contentHtml || !articleUrl) continue;
  const $ = cheerio.load(article.contentHtml);
  const headings = $("h2, h3")
    .map((_, element) => $(element).text().replace(/\s+/gu, " ").trim())
    .get()
    .filter(Boolean);

  if (article.id?.includes("--topbooks--")) {
    for (const heading of headings) {
      const parsed = parseNovelHeading(heading);
      if (parsed) {
        candidates.push({
          ...parsed,
          kind: "novel",
          articleId: article.id,
          articleTitle: article.title,
          articleUrl,
        });
      }
    }
  }

  if (article.id?.includes("--topstories--")) {
    const author = article.title
      .replace(/^.*каждому!\s*/iu, "")
      .replace(/\s*\(.*$/u, "")
      .trim();
    for (const heading of headings) {
      const title = stripHeading(heading).replace(/^[«“"]|[»”"]$/gu, "");
      if (!title || /^(предисловие|заключение)$/iu.test(title)) continue;
      candidates.push({
        author,
        title,
        kind: "short-story",
        articleId: article.id,
        articleTitle: article.title,
        articleUrl,
      });
    }
  }

  const isCatalogList =
    article.id?.includes("--top--books--page--turners--") ||
    article.id?.includes("--luchshie--bestselleri--21--veka--") ||
    article.id?.includes("--knigniy--gid--") ||
    article.id?.includes("--luchshie--knigi--pisateley--");

  if (isCatalogList) {
    for (const heading of headings) {
      if (/^(предисловие|заключение)$/iu.test(heading)) continue;
      const pirateMatch = article.id?.includes("--knigniy--gid--")
        ? stripHeading(heading).match(/^(.+?)\s*[—–-]\s*[«“"](.+?)[»”"]/u)
        : null;
      const jackLondonTitle = article.id?.includes(
        "--luchshie--knigi--pisateley--"
      )
        ? quotedTitle(heading)
        : "";
      const parsed = pirateMatch
        ? { author: pirateMatch[1].trim(), title: pirateMatch[2].trim() }
        : jackLondonTitle
          ? { author: "Джек Лондон", title: jackLondonTitle }
          : parseCatalogHeading(heading);
      if (!parsed.title) continue;
      const author = article.id?.includes("--luchshie--knigi--pisateley--")
        ? "Джек Лондон"
        : parsed.author;
      candidates.push({
        author,
        title: parsed.title,
        kind: "catalog",
        articleId: article.id,
        articleTitle: article.title,
        articleUrl,
      });
    }
  }

  const isPrimaryBookArticle =
    article.id?.includes("--page--books--") ||
    article.id?.includes("--page--bookvsmovie--");
  if (isPrimaryBookArticle) {
    const title = quotedTitle(article.title);
    if (title) {
      candidates.push({
        author: "",
        title,
        kind: "primary",
        articleId: article.id,
        articleTitle: article.title,
        articleUrl,
      });
    }
  }
}

const candidatesByTitle = new Map();
for (const candidate of candidates) {
  const key = normalize(candidate.title);
  const current = candidatesByTitle.get(key);
  if (!current || (!current.author && candidate.author)) {
    candidatesByTitle.set(key, candidate);
  }
}
const uniqueCandidates = [...candidatesByTitle.values()];

const results = uniqueCandidates.map((candidate) => {
  const knownBook = knownBooks.get(normalize(candidate.title));
  const ranked = writers
    .map((writer) => ({ writer, score: candidateWriterScore(candidate.author, writer) }))
    .filter(({ score }) => score >= 20)
    .sort((first, second) => second.score - first.score);
  const writer = knownBook
    ? {
        countryId: knownBook.countryId,
        writerId: knownBook.writerId,
        writerName: knownBook.writerName,
      }
    : ranked[0]?.writer;
  return {
    ...candidate,
    covered: Boolean(knownBook),
    countryId: writer?.countryId || "",
    writerId: writer?.writerId || "",
    writerName: writer?.writerName || "",
    writerMatchAmbiguous:
      !knownBook && Boolean(ranked[1]) && ranked[0].score === ranked[1].score,
  };
});

const totals = {
  candidates: results.length,
  covered: results.filter((result) => result.covered).length,
  missing: results.filter((result) => !result.covered).length,
  matchedWriter: results.filter((result) => result.writerId).length,
  unmatchedWriter: results.filter((result) => !result.writerId).length,
  ambiguousWriter: results.filter((result) => result.writerMatchAmbiguous).length,
};

await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(
  path.join(reportDirectory, "article-book-coverage.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, results }, null, 2)}\n`,
  "utf8"
);

const missing = results.filter((result) => !result.covered);
const markdown = [
  "# Покрытие произведений из статей",
  "",
  `- Кандидатов из редакционных серий: ${totals.candidates}`,
  `- Уже есть в архиве: ${totals.covered}`,
  `- Пока отсутствуют: ${totals.missing}`,
  `- Автор сопоставлен с countries: ${totals.matchedWriter}`,
  `- Автор требует ручной привязки: ${totals.unmatchedWriter}`,
  `- Неоднозначные привязки: ${totals.ambiguousWriter}`,
  "",
  "## Отсутствующие произведения",
  "",
  ...missing.map(
    (result) =>
      `- ${result.author} — «${result.title}» · ${result.countryId || "страна не найдена"}/${result.writerId || "автор не найден"} · ${result.articleUrl}`
  ),
  "",
].join("\n").trimEnd() + "\n";
await fs.writeFile(
  path.join(reportDirectory, "article-book-coverage.md"),
  markdown,
  "utf8"
);

console.log(JSON.stringify(totals, null, 2));

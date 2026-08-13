import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const writeChanges = process.argv.includes("--write");
const articleDirectories = [
  path.join(projectRoot, "public", "articles"),
  path.join(projectRoot, "public", "cms", "articles"),
];

function normalizedText(value = "") {
  return String(value).replace(/\s+/gu, " ").trim();
}

export function plainTextFromArticleHtml(contentHtml = "") {
  const $ = load(`<main id="article-derived-text">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  return normalizedText($("#article-derived-text").text());
}

const mismatches = [];
let filesChecked = 0;
let filesChanged = 0;

for (const directory of articleDirectories) {
  let fileNames = [];
  try {
    fileNames = await fs.readdir(directory);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  for (const fileName of fileNames.sort()) {
    if (!fileName.endsWith(".json") || fileName === "index.json") continue;
    const filePath = path.join(directory, fileName);
    const article = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (
      typeof article.contentHtml !== "string" ||
      typeof article.plainText !== "string"
    ) {
      continue;
    }
    filesChecked += 1;
    const derivedPlainText = plainTextFromArticleHtml(article.contentHtml);
    if (normalizedText(article.plainText) === derivedPlainText) continue;
    mismatches.push({
      id: article.id || fileName,
      file: path.relative(projectRoot, filePath).replaceAll("\\", "/"),
    });
    if (!writeChanges) continue;
    article.plainText = derivedPlainText;
    await fs.writeFile(filePath, `${JSON.stringify(article, null, 2)}\n`, "utf8");
    filesChanged += 1;
  }
}

console.log(
  JSON.stringify(
    {
      status: mismatches.length && !writeChanges ? "out-of-date" : "ready",
      filesChecked,
      mismatches: mismatches.length,
      filesChanged,
      examples: mismatches.slice(0, 25),
    },
    null,
    2
  )
);

if (mismatches.length && !writeChanges) process.exitCode = 1;

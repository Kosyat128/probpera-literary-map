import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const articleDir = path.join(rootDir, "public", "articles");
const indexPath = path.join(articleDir, "index.json");
const catalogPath = path.join(
  rootDir,
  "src",
  "data",
  "articles",
  "catalog.generated.ts"
);

function normalizeTitle(title) {
  return title
    .replace(/^Книга\s+vs\s+Экранизация\.\s*/iu, "Книга и экранизация: ")
    .replace(/"([^"\n]+)"/g, "«$1»")
    .replace(/\s+\./g, ".")
    .trim();
}

const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
const titleChanges = new Map();

for (const article of index) {
  const normalized = normalizeTitle(article.title);
  if (normalized !== article.title) {
    titleChanges.set(article.title, normalized);
    article.title = normalized;
  }
}

await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

let changedDocuments = 0;
for (const fileName of await fs.readdir(articleDir)) {
  if (fileName === "index.json" || !fileName.endsWith(".json")) continue;
  const filePath = path.join(articleDir, fileName);
  const document = JSON.parse(await fs.readFile(filePath, "utf8"));
  const normalized = normalizeTitle(document.title || "");
  if (normalized === document.title) continue;
  document.title = normalized;
  await fs.writeFile(
    filePath,
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8"
  );
  changedDocuments += 1;
}

let catalogSource = await fs.readFile(catalogPath, "utf8");
for (const [before, after] of titleChanges) {
  catalogSource = catalogSource.replaceAll(
    JSON.stringify(before),
    JSON.stringify(after)
  );
}
await fs.writeFile(catalogPath, catalogSource, "utf8");

console.log(
  `Normalized ${titleChanges.size} catalog titles and ${changedDocuments} article documents.`
);

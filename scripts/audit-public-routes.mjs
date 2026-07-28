import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await fs.readFile(path.join(projectRoot, "public", "articles", "index.json"), "utf8")
);
const ids = new Set();
const oldPaths = new Set();
const errors = [];
const warnings = [];

for (const article of catalog) {
  if (!article.id || ids.has(article.id)) errors.push(`Дублирующийся id: ${article.id}`);
  ids.add(article.id);
  if (!article.title?.trim()) errors.push(`Нет заголовка: ${article.id}`);
  if (!article.description?.trim()) warnings.push(`Нет описания: ${article.id}`);
  if (article.imageUrl && !/^https:\/\//i.test(article.imageUrl)) {
    warnings.push(`Небезопасный адрес изображения: ${article.id}`);
  }
  try {
    const url = new URL(article.url);
    if (!url.hostname.endsWith("probpera.ru")) warnings.push(`Внешний legacy URL: ${article.id}`);
    if (oldPaths.has(url.pathname)) errors.push(`Дублирующийся старый путь: ${url.pathname}`);
    oldPaths.add(url.pathname);
  } catch {
    errors.push(`Некорректный адрес оригинала: ${article.id}`);
  }
}

console.log(JSON.stringify({
  articles: catalog.length,
  uniqueIds: ids.size,
  uniqueLegacyPaths: oldPaths.size,
  errors,
  warnings: warnings.slice(0, 50),
  warningCount: warnings.length,
}, null, 2));

if (errors.length) process.exitCode = 1;

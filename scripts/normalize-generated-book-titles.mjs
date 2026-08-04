import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "books.generated.json"
);

function normalizeTitle(value = "") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+([,:;!?])/gu, "$1")
    .replace(/\.{3,}/gu, "…")
    .replace(/([!?])\.{2,}/gu, "$1")
    .replace(/([!?])\1{2,}/gu, "$1$1")
    .replace(/([,;:])\1+/gu, "$1");
}

const archive = JSON.parse(await readFile(archivePath, "utf8"));
let changed = 0;

for (const books of Object.values(archive.works || {})) {
  for (const book of books) {
    const normalized = normalizeTitle(book.title);
    if (normalized === book.title) continue;
    book.title = normalized;
    changed += 1;
  }
}

await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
console.log(`Normalized generated book titles: ${changed}`);

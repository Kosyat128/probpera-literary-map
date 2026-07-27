import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articlesDirectory = path.join(projectRoot, "public", "articles");

const confirmedReplacements = [
  ["главной грозой общественному порядку", "главной угрозой общественному порядку"],
  [
    "становится в итоге описание всего американского общества",
    "становится в итоге описанием всего американского общества",
  ],
  ["необычный стил жизни", "необычный стиль жизни"],
  ["(1937-2055)", "(1937–2005)"],
  ["фактами, который он черпал", "фактами, которые он черпал"],
  ["Книга конечно же", "Книга, конечно же,"],
];

function applyConfirmedFixes(source) {
  let result = source;

  for (const [before, after] of confirmedReplacements) {
    result = result.replaceAll(before, after);
  }

  // Эти два правила присутствуют в редакционном аудите как безопасные:
  // пробел перед запятой или двоеточием в русском тексте не требуется.
  return result.replaceAll(" ,", ",").replaceAll(" :", ":");
}

const articleFiles = (await fs.readdir(articlesDirectory))
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();

let changedFiles = 0;

for (const fileName of articleFiles) {
  const filePath = path.join(articlesDirectory, fileName);
  const source = await fs.readFile(filePath, "utf8");
  const fixed = applyConfirmedFixes(source);

  if (fixed !== source) {
    await fs.writeFile(filePath, fixed, "utf8");
    changedFiles += 1;
  }
}

const catalogPath = path.join(
  projectRoot,
  "src",
  "data",
  "articles",
  "catalog.generated.ts"
);
const catalogSource = await fs.readFile(catalogPath, "utf8");
const fixedCatalog = applyConfirmedFixes(catalogSource);

if (fixedCatalog !== catalogSource) {
  await fs.writeFile(catalogPath, fixedCatalog, "utf8");
  changedFiles += 1;
}

console.log(`Editorial fixes applied to ${changedFiles} files.`);

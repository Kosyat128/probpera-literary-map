import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const files = [
  ...readdirSync(path.join(projectRoot, "public", "cms", "articles"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join("public/cms/articles", file)),
  path.join("public", "cms", "published-articles.json"),
  path.join("public", "cms", "published-content.json"),
  path.join("src", "data", "countries", "generated", "writers.generated.json"),
  path.join("src", "data", "countries", "generated", "books.generated.json"),
];

const TARGET_KEYS = new Set([
  "about",
  "bio",
  "biography",
  "birthplace",
  "comment",
  "content",
  "contenthtml",
  "country",
  "deathplace",
  "description",
  "excerpt",
  "fullName",
  "genre",
  "heading",
  "historicalNote",
  "history",
  "intro",
  "label",
  "lead",
  "name",
  "notes",
  "ogDescription",
  "province",
  "publication",
  "quote",
  "region",
  "review",
  "seoDescription",
  "series",
  "shortDescription",
  "subheading",
  "subtitle",
  "summary",
  "text",
  "title",
  "years",
]);

const PLACEHOLDER_TOKENS = ["TODO", "TBD", "FIXME", "XXX", "lorem ipsum", "Lorem ipsum"];

const placeholderRegex = new RegExp(
  PLACEHOLDER_TOKENS
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "giu"
);

function normalizeStringValue(value, key, context) {
  if (typeof value !== "string") return value;
  const isHtml = key.toLowerCase() === "contenthtml" || key.toLowerCase() === "content";

  let v = value
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\ufeff/g, "");

  if (isHtml) {
    // Only safe cleanup for html blocks: no destructive punctuation spacing edits.
    v = v.trim().replace(/[ \t]+\n/g, "\n").replace(/[\n ]+$/gm, "").trim();
  } else {
    // Normalize line whitespace while preserving intentional paragraphs.
    v = v
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  if (placeholderRegex.test(v)) {
    v = v
      .replace(placeholderRegex, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (key === "title" && v.includes("\n")) {
    const lines = v
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length) v = lines[0];
  }

  if (key === "years" && v.length === 0) {
    v = "—";
  }

  v = v
    .replace(/([,.:;!?\u00a0])\s+([,.:;!?\u00a0])/gu, "$1$2")
    .replace(/([а-яa-z0-9а-я])\s([,:.;!?\)])/giu, "$1$2")
    .replace(/\s([,:.;!?])/gu, "$1");

  if (v === value) return value;
  return v;
}

function walkAndFix(node, changed) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => walkAndFix(item, changed));
  }

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.trim();
    const matches = TARGET_KEYS.has(normalizedKey) || TARGET_KEYS.has(normalizedKey.toLowerCase());
    if (typeof value === "string" && matches) {
      const next = normalizeStringValue(value, normalizedKey, key);
      if (next !== value) {
        node[key] = next;
        changed.push({
          key,
          before: value,
          after: next,
        });
      }
    } else if (typeof value === "string" && normalizedKey === "title" && value.includes("\n")) {
      const next = normalizeStringValue(value, "title", key);
      if (next !== value) {
        node[key] = next;
        changed.push({
          key,
          before: value,
          after: next,
        });
      }
    } else {
      node[key] = walkAndFix(value, changed);
    }
  }
  return node;
}

function dedupePath(p) {
  return path.join(projectRoot, p.split(path.sep).join(path.posix.sep).replace(/^\.\\/, ""));
}

let totalChanges = 0;
const changedByFile = {};

for (const relativePath of files) {
  const absolutePath = dedupePath(relativePath);
  if (!existsSync(absolutePath)) continue;

  const raw = readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "");
  const data = JSON.parse(raw);
  const changed = [];
  const next = walkAndFix(data, changed);

  if (changed.length > 0) {
    changedByFile[relativePath] = changed.length;
    totalChanges += changed.length;
    writeFileSync(absolutePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
}

console.log(`Fixed text quality issues in ${Object.keys(changedByFile).length} files`);
console.log(`Total changes: ${totalChanges}`);
for (const [file, count] of Object.entries(changedByFile)) {
  console.log(`${file}: ${count}`);
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articleDirectory = path.join(projectRoot, "public", "articles");
const argumentsSet = new Set(process.argv.slice(2));
const dryRun = argumentsSet.has("--dry-run") || !argumentsSet.has("--apply");
const limitArgument = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArgument ? Number(limitArgument.split("=")[1]) : Number.POSITIVE_INFINITY;
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ownerId = process.env.CMS_OWNER_USER_ID || "";

const categoryBySection = {
  "book-opinions": "book-opinions",
  "screen-adaptations": "screen-adaptations",
  "writers-world": "writers-world",
  "book-guides": "book-guides",
  awards: "awards",
  folklore: "folklore",
  language: "language",
  "literary-essays": "literary-essays",
  "author-stories": "author-stories",
};

const routeBySection = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
};

const months = {
  ЯНВАРЯ: 0, ФЕВРАЛЯ: 1, МАРТА: 2, АПРЕЛЯ: 3, МАЯ: 4, ИЮНЯ: 5,
  ИЮЛЯ: 6, АВГУСТА: 7, СЕНТЯБРЯ: 8, ОКТЯБРЯ: 9, НОЯБРЯ: 10, ДЕКАБРЯ: 11,
};
const transliteration = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  return value.toLocaleLowerCase("ru").split("").map((letter) => transliteration[letter] ?? letter)
    .join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 170);
}

function parsePublishedLabel(label = "") {
  const match = label.match(/(\d{1,2})\s+([А-ЯЁ]+)\s+(\d{4})/u);
  if (!match || !(match[2] in months)) return null;
  return new Date(Date.UTC(Number(match[3]), months[match[2]], Number(match[1]), 9)).toISOString();
}

async function rest(table, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${options.query || ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const catalog = JSON.parse(await fs.readFile(path.join(articleDirectory, "index.json"), "utf8"));
const selected = catalog.slice(0, Number.isFinite(limit) ? limit : catalog.length);
const legacyPaths = new Set();
const duplicateLegacyPaths = [];
const payloads = [];

for (const article of selected) {
  const document = JSON.parse(await fs.readFile(path.join(articleDirectory, `${article.id}.json`), "utf8"));
  let legacyPath = null;
  try {
    const oldUrl = new URL(article.url);
    legacyPath = oldUrl.hostname.endsWith("probpera.ru") ? oldUrl.pathname : null;
  } catch {
    legacyPath = null;
  }
  if (legacyPath && legacyPaths.has(legacyPath)) duplicateLegacyPaths.push(legacyPath);
  if (legacyPath) legacyPaths.add(legacyPath);
  payloads.push({
    legacy_id: article.id,
    title: article.title,
    excerpt: article.description || "",
    content_json: { type: "doc", content: [] },
    content_html: document.contentHtml || "",
    cover_external_url: article.imageUrl || null,
    cover_alt: article.imageUrl ? `Иллюстрация к статье «${article.title}»` : "",
    status: "published",
    slug: slugify(article.title) || "material",
    legacy_path: legacyPath,
    published_at: parsePublishedLabel(article.publishedLabel) || new Date().toISOString(),
    seo_title: article.title,
    seo_description: article.description || `Авторский материал журнала «Проба Пера»: ${article.title}`,
    canonical_url: null,
    allow_indexing: true,
    section_id: article.sectionId,
  });
}

console.log(JSON.stringify({
  mode: dryRun ? "dry-run" : "apply",
  found: catalog.length,
  selected: payloads.length,
  duplicateLegacyPaths,
  sample: payloads.slice(0, 3).map(({ title, slug, legacy_path }) => ({ title, slug, legacy_path })),
}, null, 2));

if (dryRun) process.exit(0);
if (!supabaseUrl || !serviceRoleKey || !ownerId) {
  throw new Error("Для импорта нужны SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и CMS_OWNER_USER_ID.");
}

const categories = await rest("categories", {
  query: "?select=id,slug",
});
const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

for (const source of payloads) {
  const categorySlug = categoryBySection[source.section_id] || null;
  const article = {
    ...source,
    category_id: categorySlug ? categoryIds.get(categorySlug) || null : null,
    created_by: ownerId,
    updated_by: ownerId,
    canonical_url: `https://probpera.ru/stati/${routeBySection[source.section_id] || "materialy"}/${source.slug}`,
  };
  delete article.section_id;
  await rest("articles", {
    method: "POST",
    query: "?on_conflict=legacy_id",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: article,
  });
}

console.log(`Импортировано или обновлено: ${payloads.length}. Исходные JSON не изменены.`);

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { build } from "esbuild";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "literary-archive-source.mjs");
const applyChanges = process.argv.includes("--apply");

try {
  process.loadEnvFile(path.join(repositoryRoot, ".env.local"));
} catch {
  // В CI переменные передаются окружением; локальный файл необязателен.
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function asciiSlug(value) {
  const transliteration = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya",
  };

  return value
    .toLocaleLowerCase("ru")
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 145);
}

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    stdin: {
      contents: `
        import { countries } from "../../src/data/countries/index.ts";
        import { buildBookArchive } from "../../src/data/bookArchive.ts";

        export const archive = buildBookArchive(countries).map(
          ({ country, writer, ...entry }) => entry
        );
      `,
      resolveDir: cacheDirectory,
      sourcefile: "literary-archive-source.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const bundleUrl = `${pathToFileURL(bundlePath).href}?v=${Date.now()}`;
  const module = await import(bundleUrl);
  return module.archive;
}

function workRows(archive) {
  return archive.map((book) => {
    const legacyId = `${book.countryId}:${book.writerId}:${book.id}`;
    const slugBase = asciiSlug(book.id || book.title) || "work";

    return {
      legacy_id: legacyId,
      country_id: book.countryId,
      writer_id: book.writerId,
      title: book.title,
      slug: `${slugBase}-${stableHash(legacyId)}`.slice(0, 180),
      original_title: book.originalTitle || "",
      first_published: book.firstPublished || null,
      original_language: book.originalLanguage || "",
      genres: book.genres || [],
      tags: book.tags || [],
      description: book.description || "",
      source_url: book.sourceUrl || null,
      editorial_status: book.editorial?.status || "draft",
      reviewed_at: book.editorial?.reviewedAt || null,
      metadata: {
        countryName: book.countryName,
        writerName: book.writerName,
      },
    };
  });
}

function editionRow(book, workId) {
  if (!book.coverUrl || !book.coverRights) return null;

  const legacyWorkId = `${book.countryId}:${book.writerId}:${book.id}`;
  const rights = book.coverRights;

  return {
    legacy_id: `${legacyWorkId}:cover:${stableHash(book.coverUrl)}`,
    work_id: workId,
    title:
      rights.status === "editorial-original"
        ? "Редакционное оформление «Пробы Пера»"
        : "Издание по источнику обложки",
    language: book.originalLanguage || "",
    cover_url: book.coverUrl,
    cover_source_url:
      book.coverSourceUrl || rights.sourceUrl || book.sourceUrl || null,
    cover_rights_status: rights.status,
    license_name: rights.licenseName || "",
    license_url: rights.licenseUrl || null,
    creator: rights.creator || "",
    rights_holder: rights.rightsHolder || "",
    rights_checked_at: rights.checkedAt || null,
    source_url: book.coverSourceUrl || rights.sourceUrl || null,
    is_primary: true,
    metadata: {
      note: rights.note || "",
      sourceWorkId: book.id,
    },
  };
}

async function inBatches(items, size, callback) {
  for (let index = 0; index < items.length; index += size) {
    await callback(items.slice(index, index + size), index / size + 1);
  }
}

const archive = await sourceArchive();
const works = workRows(archive);
const covers = archive.filter((book) => book.coverUrl && book.coverRights);

console.log(
  `Источник countries: ${works.length} произведений, ${covers.length} проверенных обложек.`
);

if (!applyChanges) {
  console.log(
    "Проверочный режим: база не изменена. Для синхронизации используйте npm run books:sync:apply."
  );
  process.exit(0);
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.VITE_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Для синхронизации нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const workIds = new Map();

await inBatches(works, 250, async (batch, number) => {
  const { data, error } = await supabase
    .from("literary_works")
    .upsert(batch, { onConflict: "legacy_id" })
    .select("id,legacy_id");

  if (error) throw error;
  data.forEach((work) => workIds.set(work.legacy_id, work.id));
  console.log(`Произведения: пакет ${number} сохранён.`);
});

const editions = archive
  .map((book) => {
    const workId = workIds.get(`${book.countryId}:${book.writerId}:${book.id}`);
    return workId ? editionRow(book, workId) : null;
  })
  .filter(Boolean);

await inBatches(editions, 200, async (batch, number) => {
  const { error } = await supabase
    .from("book_editions")
    .upsert(batch, { onConflict: "legacy_id" });

  if (error) throw error;
  console.log(`Издания: пакет ${number} сохранён.`);
});

console.log(
  `Синхронизация завершена: ${works.length} произведений и ${editions.length} изданий.`
);

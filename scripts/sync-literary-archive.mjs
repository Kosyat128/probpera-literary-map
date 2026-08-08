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
    absWorkingDir: repositoryRoot,
    stdin: {
      contents: `
        import { countries } from "./src/data/countries/index.ts";
        import { buildBookArchive } from "./src/data/bookArchive.ts";

        export const archive = buildBookArchive(countries).map(
          ({ country, writer, ...entry }) => entry
        );
      `,
      resolveDir: repositoryRoot,
      sourcefile: "literary-archive-source.ts",
      loader: "ts",
    },
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
        distinctions: book.distinctions || [],
      },
    };
  });
}

function translationRows(archive, workIds) {
  return archive.flatMap((book) => {
    const workId = workIds.get(`${book.countryId}:${book.writerId}:${book.id}`);
    if (!workId) return [];
    return Object.values(book.translations || {}).map((translation) => ({
      work_id: workId,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      source_language: translation.sourceLanguage,
      translation_method: translation.method,
      editorial_status: translation.status,
      source_urls: translation.sourceUrls,
      reviewed_at: translation.reviewedAt || null,
      metadata: {},
    }));
  });
}

function sourceRows(archive, workIds) {
  return archive.flatMap((book) => {
    const workId = workIds.get(`${book.countryId}:${book.writerId}:${book.id}`);
    if (!workId) return [];
    return (book.sources || []).map((source) => ({
      work_id: workId,
      provider: source.provider,
      source_url: source.url,
      field_names: source.fields,
      license_name: source.license || null,
      usage: source.usage,
      retrieved_at: source.retrievedAt,
      metadata: {},
    }));
  });
}

function externalIdRows(archive, workIds) {
  return archive.flatMap((book) => {
    const workId = workIds.get(`${book.countryId}:${book.writerId}:${book.id}`);
    if (!workId) return [];
    return (book.externalIds || []).map((externalId) => ({
      work_id: workId,
      scheme: externalId.scheme,
      external_id: externalId.value,
      source_url: externalId.sourceUrl,
    }));
  });
}

function globalExternalIdConflicts(archive) {
  const owners = new Map();
  for (const book of archive) {
    const workKey = `${book.countryId}:${book.writerId}:${book.id}`;
    for (const externalId of book.externalIds || []) {
      const key = `${externalId.scheme}:${externalId.value}`.toLocaleLowerCase(
        "en"
      );
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(workKey);
    }
  }
  return [...owners.entries()]
    .filter(([, works]) => works.size > 1)
    .map(([externalId, works]) => ({ externalId, works: [...works] }));
}

function editionRow(book, workId) {
  if (!book.coverUrl || !book.coverRights) return null;
  if (
    ![
      "public-domain",
      "licensed",
      "permission",
      "external-preview",
    ].includes(book.coverRights.status)
  ) {
    return null;
  }

  const legacyWorkId = `${book.countryId}:${book.writerId}:${book.id}`;
  const rights = book.coverRights;

  return {
    legacy_id: `${legacyWorkId}:cover:${stableHash(book.coverUrl)}`,
    work_id: workId,
    title: "Издание по источнику обложки",
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
const covers = archive.filter((book) =>
  Boolean(
    book.coverUrl &&
      book.coverRights &&
      ["public-domain", "licensed", "permission", "external-preview"].includes(
        book.coverRights.status
      )
  )
);
const translationCount = archive.reduce(
  (total, book) => total + Object.keys(book.translations || {}).length,
  0
);
const sourceCount = archive.reduce(
  (total, book) => total + (book.sources || []).length,
  0
);
const externalIdCount = archive.reduce(
  (total, book) => total + (book.externalIds || []).length,
  0
);
const externalIdConflicts = globalExternalIdConflicts(archive);

console.log(
  `Источник countries: ${works.length} произведений, ${translationCount} RU/EN-переводов, ${sourceCount} записей provenance, ${externalIdCount} внешних идентификаторов, ${externalIdConflicts.length} конфликтов внешних идентификаторов и ${covers.length} проверенных обложек.`
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

if (externalIdConflicts.length) {
  throw new Error(
    `Синхронизация остановлена: ${externalIdConflicts.length} глобальных конфликтов внешних идентификаторов.`
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

const translations = translationRows(archive, workIds);
await inBatches(translations, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_translations")
    .upsert(batch, { onConflict: "work_id,locale" });
  if (error) throw error;
  console.log(`Переводы произведений: пакет ${number} сохранён.`);
});

const sources = sourceRows(archive, workIds);
await inBatches(sources, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_sources")
    .upsert(batch, { onConflict: "work_id,provider,source_url" });
  if (error) throw error;
  console.log(`Источники произведений: пакет ${number} сохранён.`);
});

const externalIds = externalIdRows(archive, workIds);
await inBatches(externalIds, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_external_ids")
    .upsert(batch, {
      onConflict: "scheme,external_id",
      ignoreDuplicates: true,
    });
  if (error) throw error;
  console.log(`Внешние идентификаторы: пакет ${number} сохранён.`);
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
  `Синхронизация завершена: ${works.length} произведений, ${translations.length} переводов, ${sources.length} источников, ${externalIds.length} внешних идентификаторов и ${editions.length} изданий.`
);

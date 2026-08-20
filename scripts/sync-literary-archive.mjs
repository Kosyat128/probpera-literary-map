import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "literary-archive-source.mjs");
const applyChanges = process.argv.includes("--apply");
const preflightOnly = process.argv.includes("--preflight");
const coverBatch20260820 = process.argv.includes("--batch-2026-08-20");

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
        import { bookArchiveCountries } from "./src/data/countries/index.ts";
        import { buildBookArchive } from "./src/data/bookArchive.ts";
        import { userSuppliedBookCoverArtworks } from "./src/data/userSuppliedBookCovers.ts";
        import { userSuppliedBookCoverBatch20260820Manifest } from "./src/data/userSuppliedBookCovers.ts";
        import { userSuppliedBookWorkSupplementsBatch20260820 } from "./src/data/countries/userSuppliedBookWorkSupplementsBatch20260820.ts";

        export const archive = buildBookArchive(bookArchiveCountries).map(
          ({ country, writer, ...entry }) => entry
        );
        export const editorialCoverEntries = userSuppliedBookCoverArtworks;
        export const batch20260820CoverEntries = userSuppliedBookCoverBatch20260820Manifest.entries.map(
          (entry) => ({ ...entry, checkedAt: "2026-08-20" })
        );
        export const batch20260820CreatedWorkKeys = Object.entries(
          userSuppliedBookWorkSupplementsBatch20260820
        ).flatMap(([countryId, writers]) => Object.entries(writers).flatMap(
          ([writerId, works]) => works.map((work) => [countryId, writerId, work.id].join(":"))
        ));
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
  return {
    archive: module.archive,
    editorialCoverEntries: module.editorialCoverEntries,
    batch20260820CoverEntries: module.batch20260820CoverEntries,
    batch20260820CreatedWorkKeys: module.batch20260820CreatedWorkKeys,
  };
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

function editorialArtworkRows(entries, workIds, lockedLegacyIds) {
  return entries.flatMap((entry) => {
    if (lockedLegacyIds.has(entry.workKey)) return [];
    const workId = workIds.get(entry.workKey);
    if (!workId) return [];
    const sourceRelativePath =
      entry.provenance.sourceRelativePath || entry.provenance.sourceFilename;
    return [{
      work_id: workId,
      cover_url: entry.coverUrl,
      thumbnail_url: entry.coverThumbnailUrl,
      cover_width: entry.coverWidth,
      cover_height: entry.coverHeight,
      thumbnail_width: entry.coverThumbnailWidth,
      thumbnail_height: entry.coverThumbnailHeight,
      rights_status: "editorial-original",
      cover_source_url: `https://probpera.ru/${entry.coverUrl}`,
      rights_checked_at: entry.checkedAt,
      source_archive_sha256: entry.provenance.archiveSha256,
      source_image_sha256: entry.provenance.imageSha256,
      source_filename: entry.provenance.sourceFilename,
      source_relative_path: sourceRelativePath,
      source_index: entry.provenance.sourceIndex,
      is_primary: entry.isPrimary,
      provenance: entry.provenance,
    }];
  });
}

async function inBatches(items, size, callback) {
  for (let index = 0; index < items.length; index += size) {
    await callback(items.slice(index, index + size), index / size + 1);
  }
}

const source = await sourceArchive();
const archive = source.archive;
const batchCreatedWorkKeys = new Set(source.batch20260820CreatedWorkKeys);
const batchArtworkWorkKeys = new Set(
  source.batch20260820CoverEntries.map((entry) => entry.workKey)
);
if (
  source.batch20260820CoverEntries.length !== 43 ||
  batchArtworkWorkKeys.size !== 41 ||
  batchCreatedWorkKeys.size !== 17
) {
  throw new Error("Batch 2026-08-20 must remain exactly 43 artworks → 41 works, including 17 newly curated works.");
}
const syncArchive = coverBatch20260820
  ? archive.filter((book) =>
      batchArtworkWorkKeys.has(`${book.countryId}:${book.writerId}:${book.id}`)
    )
  : archive;
const editorialCoverEntries = coverBatch20260820
  ? source.batch20260820CoverEntries
  : source.editorialCoverEntries;
const works = workRows(syncArchive);
if (coverBatch20260820 && works.length !== 41) {
  throw new Error(`Batch 2026-08-20 canonical coverage is ${works.length}, expected 41.`);
}
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
const editorialArtworkCount = editorialCoverEntries.length;
const externalIdConflicts = globalExternalIdConflicts(archive);

console.log(
  `Источник countries: ${works.length} произведений к синхронизации, ${translationCount} RU/EN-переводов во всём архиве, ${sourceCount} записей provenance, ${externalIdCount} внешних идентификаторов, ${externalIdConflicts.length} конфликтов внешних идентификаторов, ${covers.length} обложек изданий и ${editorialArtworkCount} редакционных иллюстраций произведений${coverBatch20260820 ? " в batch 2026-08-20" : ""}.`
);

if (!applyChanges && !preflightOnly) {
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

async function preflightDatabaseContract(supabase) {
  const requiredRelations = [
    ["literary_works", "id,legacy_id,is_cms_locked"],
    ["literary_work_translations", "work_id,locale"],
    ["literary_work_sources", "work_id,provider,source_url"],
    ["literary_work_external_ids", "work_id,scheme,external_id"],
    ["book_editions", "id,legacy_id,work_id"],
    [
      "literary_work_cover_artworks",
      "work_id,cover_url,source_archive_sha256,source_image_sha256,is_primary",
    ],
  ];
  for (const [relation, columns] of requiredRelations) {
    const { error } = await supabase.from(relation).select(columns).limit(1);
    if (error) {
      throw new Error(
        `Database preflight failed for public.${relation}: ${error.message}`
      );
    }
  }
  const { error: healthRpcError } = await supabase.rpc(
    "get_editorial_schema_health"
  );
  if (healthRpcError) {
    throw new Error(
      `Database preflight failed for get_editorial_schema_health(): ${healthRpcError.message}`
    );
  }
  console.log(
    `Database preflight passed: ${requiredRelations.length} required relations and the schema-health RPC are reachable; no writes performed.`
  );
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
await preflightDatabaseContract(supabase);
const workIds = new Map();
const { data: lockedWorks, error: lockedWorksError } = await supabase
  .from("literary_works")
  .select("id,legacy_id")
  .eq("is_cms_locked", true);
if (lockedWorksError) throw lockedWorksError;
const lockedLegacyIds = new Set(
  (lockedWorks || []).map((work) => work.legacy_id)
);
(lockedWorks || []).forEach((work) => workIds.set(work.legacy_id, work.id));
const artworkLegacyIds = [
  ...new Set(editorialCoverEntries.map((entry) => entry.workKey)),
];
const lockedArtworkTargets = artworkLegacyIds.filter((legacyId) =>
  lockedLegacyIds.has(legacyId)
);
if (coverBatch20260820 && lockedArtworkTargets.length) {
  throw new Error(
    `Batch 2026-08-20 preflight rejected ${lockedArtworkTargets.length} CMS-locked artwork targets: ${lockedArtworkTargets.join(", ")}`
  );
}
await inBatches(artworkLegacyIds, 200, async (batch) => {
  const { data, error } = await supabase
    .from("literary_works")
    .select("id,legacy_id")
    .in("legacy_id", batch);
  if (error) throw error;
  for (const work of data || []) workIds.set(work.legacy_id, work.id);
});
const existingLegacyByWorkId = new Map(
  [...workIds.entries()].map(([legacyId, workId]) => [workId, legacyId])
);
const incomingPrimaryArtworkByLegacyId = new Map(
  editorialCoverEntries
    .filter((entry) => entry.isPrimary)
    .map((entry) => [entry.workKey, entry])
);
const existingArtworkWorkIds = [
  ...new Set(
    artworkLegacyIds.map((legacyId) => workIds.get(legacyId)).filter(Boolean)
  ),
];
const preflightPrimaryArtwork = [];
await inBatches(existingArtworkWorkIds, 200, async (batch) => {
  const { data, error } = await supabase
    .from("literary_work_cover_artworks")
    .select("work_id,cover_url,source_archive_sha256,source_image_sha256")
    .in("work_id", batch)
    .eq("is_primary", true);
  if (error) throw error;
  preflightPrimaryArtwork.push(...(data || []));
});
for (const existing of preflightPrimaryArtwork) {
  const legacyId = existingLegacyByWorkId.get(existing.work_id);
  const incoming = incomingPrimaryArtworkByLegacyId.get(legacyId);
  if (
    incoming &&
    (existing.cover_url !== incoming.coverUrl ||
      existing.source_archive_sha256 !== incoming.provenance.archiveSha256 ||
      existing.source_image_sha256 !== incoming.provenance.imageSha256)
  ) {
    throw new Error(
      `Редакционная иллюстрация ${legacyId} уже зафиксирована другим источником; синхронизация не перезаписывает её.`
    );
  }
}
console.log(
  `Artwork data preflight passed for ${artworkLegacyIds.length} canonical works before the first mutation.`
);
if (preflightOnly) {
  console.log("Preflight-only mode complete: database was not changed.");
  process.exit(0);
}
const synchronizableWorks = works.filter(
  (work) => !lockedLegacyIds.has(work.legacy_id)
);

await inBatches(synchronizableWorks, 250, async (batch, number) => {
  const { data, error } = await supabase
    .from("literary_works")
    .upsert(batch, { onConflict: "legacy_id" })
    .select("id,legacy_id");

  if (error) throw error;
  data.forEach((work) => workIds.set(work.legacy_id, work.id));
  console.log(`Произведения: пакет ${number} сохранён.`);
});
if (lockedLegacyIds.size) {
  console.log(
    `Произведения: ${lockedLegacyIds.size} ручных CMS-редакций защищены от перезаписи синхронизацией.`
  );
}

const translations = translationRows(syncArchive, workIds);
await inBatches(translations, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_translations")
    .upsert(batch, { onConflict: "work_id,locale" });
  if (error) throw error;
  console.log(`Переводы произведений: пакет ${number} сохранён.`);
});

const sources = sourceRows(syncArchive, workIds);
await inBatches(sources, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_sources")
    .upsert(batch, { onConflict: "work_id,provider,source_url" });
  if (error) throw error;
  console.log(`Источники произведений: пакет ${number} сохранён.`);
});

const externalIds = externalIdRows(syncArchive, workIds);
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
const unresolvedArtworkTargets = artworkLegacyIds.filter(
  (legacyId) => !workIds.has(legacyId)
);
if (unresolvedArtworkTargets.length) {
  throw new Error(
    `Artwork linkage failed closed: ${unresolvedArtworkTargets.length} canonical work IDs are unresolved.`
  );
}

const editorialArtworks = editorialArtworkRows(
  editorialCoverEntries,
  workIds,
  lockedLegacyIds
);
await inBatches(editorialArtworks, 200, async (batch, number) => {
  const { error } = await supabase
    .from("literary_work_cover_artworks")
    .upsert(batch, {
      onConflict: "work_id,source_archive_sha256,source_image_sha256",
    });
  if (error) throw error;
  console.log(`Редакционные иллюстрации произведений: пакет ${number} сохранён.`);
});

const editions = syncArchive
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
  `Синхронизация завершена: ${works.length} произведений, ${translations.length} переводов, ${sources.length} источников, ${externalIds.length} внешних идентификаторов, ${editions.length} изданий и ${editorialArtworks.length} редакционных иллюстраций произведений.`
);

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256 =
  "0ad2a8f1c49573d51418bea2acf023a36b87db6e767b75dc869aa92f59b05cd3";
export const BOOK_COVER_BATCH_20260820_EXPECTED = Object.freeze({
  artworks: 43,
  works: 41,
  primary: 31,
  secondary: 12,
  supplementalWorks: 17,
});

const EXPECTED_PRODUCTION_PROJECT_REF = "sjqejjmwpzfsczxdghvw";
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const manifestPath = path.join(
  repositoryRoot,
  "src/data/countries/generated/userSuppliedBookCoversBatch20260820.generated.json"
);
const reportPath = path.join(
  repositoryRoot,
  "reports/user-supplied-book-cover-import-2026-08-20.json"
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactSet(actual, expected) {
  return (
    actual.size === expected.size &&
    [...expected].every((value) => actual.has(value))
  );
}

function parseJsonFile(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`The reviewed ${label} cannot be read as JSON.`);
  }
  return parsed;
}

export function buildBookCoverBatch20260820Contract({
  manifest = parseJsonFile(manifestPath, "cover manifest"),
  report = parseJsonFile(reportPath, "cover import report"),
} = {}) {
  const expected = BOOK_COVER_BATCH_20260820_EXPECTED;
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  invariant(
    manifest?.archive?.sha256 === BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256,
    "The cover manifest archive SHA-256 is not the reviewed batch."
  );
  invariant(
    report?.archive?.sha256 === BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256,
    "The cover import report archive SHA-256 is not the reviewed batch."
  );
  invariant(
    entries.length === expected.artworks,
    "The reviewed cover manifest must contain exactly 43 artwork entries."
  );
  invariant(
    entries.every(
      (entry) =>
        entry?.provenance?.archiveSha256 ===
        BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256
    ),
    "Every cover entry must retain the reviewed archive SHA-256."
  );
  invariant(
    entries.every((entry) => typeof entry?.isPrimary === "boolean"),
    "Every cover entry must declare whether it is primary."
  );

  const workKeys = [...new Set(entries.map((entry) => entry.workKey))];
  const sourceImageSha256 = [
    ...new Set(entries.map((entry) => entry?.provenance?.imageSha256)),
  ];
  const sourceIndexes = [
    ...new Set(entries.map((entry) => entry?.provenance?.sourceIndex)),
  ];
  const primary = entries.filter((entry) => entry.isPrimary).length;
  const secondary = entries.length - primary;
  invariant(
    workKeys.length === expected.works,
    "The reviewed cover manifest must target exactly 41 canonical works."
  );
  invariant(
    sourceImageSha256.length === expected.artworks &&
      sourceImageSha256.every((value) => /^[0-9a-f]{64}$/u.test(value)),
    "The reviewed cover manifest must contain 43 unique lowercase image SHA-256 values."
  );
  invariant(
    sourceIndexes.length === expected.artworks &&
      sourceIndexes.every(
        (value) =>
          Number.isInteger(value) && value >= 1 && value <= expected.artworks
      ),
    "The reviewed cover manifest must contain each source index from 1 through 43 exactly once."
  );
  invariant(
    primary === expected.primary && secondary === expected.secondary,
    "The reviewed cover manifest primary/secondary split is not 31/12."
  );

  const createdWorks = Array.isArray(report?.createdWorks)
    ? report.createdWorks
    : [];
  const supplementalWorkKeys = [
    ...new Set(createdWorks.map((work) => work.workKey)),
  ];
  invariant(
    report?.summary?.createdWorks === expected.supplementalWorks &&
      supplementalWorkKeys.length === expected.supplementalWorks,
    "The reviewed import report must contain exactly 17 supplemental works."
  );
  invariant(
    supplementalWorkKeys.every((workKey) => workKeys.includes(workKey)),
    "Every supplemental work must be one of the 41 covered canonical works."
  );
  invariant(
    createdWorks.every(
      (work) =>
        typeof work?.titleRu === "string" &&
        work.titleRu.trim() &&
        typeof work?.titleEn === "string" &&
        work.titleEn.trim() &&
        Array.isArray(work?.sourceUrls) &&
        work.sourceUrls.length > 0
    ),
    "Every supplemental work must retain reviewed RU/EN titles and source evidence."
  );

  const artworkRows = entries.map((entry) => {
    const row = {
      workKey: entry.workKey,
      cover_url: entry.coverUrl,
      thumbnail_url: entry.coverThumbnailUrl,
      cover_width: entry.coverWidth,
      cover_height: entry.coverHeight,
      thumbnail_width: entry.coverThumbnailWidth,
      thumbnail_height: entry.coverThumbnailHeight,
      source_archive_sha256: entry.provenance.archiveSha256,
      source_image_sha256: entry.provenance.imageSha256,
      source_index: entry.provenance.sourceIndex,
      is_primary: entry.isPrimary,
    };
    invariant(
      typeof row.workKey === "string" &&
        row.workKey.trim() &&
        typeof row.cover_url === "string" &&
        row.cover_url.trim() &&
        typeof row.thumbnail_url === "string" &&
        row.thumbnail_url.trim() &&
        [
          row.cover_width,
          row.cover_height,
          row.thumbnail_width,
          row.thumbnail_height,
        ].every((value) => Number.isInteger(value) && value > 0),
      "Every reviewed artwork row must retain its work, URLs, and positive dimensions."
    );
    return Object.freeze(row);
  });

  return Object.freeze({
    archiveSha256: BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256,
    workKeys: Object.freeze(workKeys),
    supplementalWorkKeys: Object.freeze(supplementalWorkKeys),
    sourceImageSha256: Object.freeze(sourceImageSha256),
    artworkRows: Object.freeze(artworkRows),
  });
}

export function verifyBookCoverBatch20260820Snapshot(contract, snapshot) {
  const expected = BOOK_COVER_BATCH_20260820_EXPECTED;
  const artworks = Array.isArray(snapshot?.artworks) ? snapshot.artworks : [];
  const works = Array.isArray(snapshot?.works) ? snapshot.works : [];
  const translations = Array.isArray(snapshot?.translations)
    ? snapshot.translations
    : [];
  const sources = Array.isArray(snapshot?.sources) ? snapshot.sources : [];

  invariant(
    snapshot?.artworkCount === expected.artworks &&
      artworks.length === expected.artworks,
    "Production must contain exactly 43 artwork rows for the reviewed archive."
  );
  invariant(
    artworks.every(
      (artwork) => artwork.source_archive_sha256 === contract.archiveSha256
    ),
    "Every verified artwork row must belong to the reviewed archive SHA-256."
  );
  const actualImageSha256 = new Set(
    artworks.map((artwork) => artwork.source_image_sha256)
  );
  invariant(
    exactSet(actualImageSha256, new Set(contract.sourceImageSha256)),
    "Production artwork rows do not match the exact 43 reviewed source images."
  );

  const primary = artworks.filter((artwork) => artwork.is_primary === true).length;
  const secondary = artworks.filter(
    (artwork) => artwork.is_primary === false
  ).length;
  invariant(
    primary === expected.primary && secondary === expected.secondary,
    "Production artwork rows must retain the exact 31/12 primary/secondary split."
  );

  invariant(
    works.length === expected.works,
    "Production must contain all 41 canonical work keys."
  );
  const workByKey = new Map(works.map((work) => [work.legacy_id, work.id]));
  invariant(
    exactSet(new Set(workByKey.keys()), new Set(contract.workKeys)) &&
      new Set(workByKey.values()).size === expected.works &&
      [...workByKey.values()].every(Boolean),
    "Production work identity does not match the exact 41-key batch contract."
  );
  invariant(
    exactSet(
      new Set(artworks.map((artwork) => artwork.work_id)),
      new Set(workByKey.values())
    ),
    "The 43 artwork rows must be linked to exactly the 41 reviewed works."
  );
  const artworkByImageSha256 = new Map(
    artworks.map((artwork) => [artwork.source_image_sha256, artwork])
  );
  invariant(
    contract.artworkRows.every((expectedArtwork) => {
      const actualArtwork = artworkByImageSha256.get(
        expectedArtwork.source_image_sha256
      );
      return (
        actualArtwork?.work_id === workByKey.get(expectedArtwork.workKey) &&
        actualArtwork.cover_url === expectedArtwork.cover_url &&
        actualArtwork.thumbnail_url === expectedArtwork.thumbnail_url &&
        actualArtwork.cover_width === expectedArtwork.cover_width &&
        actualArtwork.cover_height === expectedArtwork.cover_height &&
        actualArtwork.thumbnail_width === expectedArtwork.thumbnail_width &&
        actualArtwork.thumbnail_height === expectedArtwork.thumbnail_height &&
        actualArtwork.source_archive_sha256 ===
          expectedArtwork.source_archive_sha256 &&
        actualArtwork.source_index === expectedArtwork.source_index &&
        actualArtwork.is_primary === expectedArtwork.is_primary
      );
    }),
    "Production artwork rows do not match the exact work/image/primary/asset/index contract."
  );

  const supplementalIds = new Set(
    contract.supplementalWorkKeys.map((workKey) => workByKey.get(workKey))
  );
  invariant(
    supplementalIds.size === expected.supplementalWorks &&
      !supplementalIds.has(undefined),
    "All 17 supplemental works must resolve to production identities."
  );
  const localesByWork = new Map();
  for (const translation of translations) {
    if (!supplementalIds.has(translation.work_id)) continue;
    if (!localesByWork.has(translation.work_id)) {
      localesByWork.set(translation.work_id, new Set());
    }
    localesByWork.get(translation.work_id).add(translation.locale);
  }
  invariant(
    [...supplementalIds].every((workId) => {
      const locales = localesByWork.get(workId);
      return locales?.has("ru") && locales?.has("en");
    }),
    "Every supplemental work must have both RU and EN production translations."
  );
  const sourcedWorkIds = new Set(
    sources
      .map((source) => source.work_id)
      .filter((workId) => supplementalIds.has(workId))
  );
  invariant(
    exactSet(sourcedWorkIds, supplementalIds),
    "Every supplemental work must have production source provenance."
  );

  return Object.freeze({
    artworks: expected.artworks,
    works: expected.works,
    primary: expected.primary,
    secondary: expected.secondary,
    supplementalWorks: expected.supplementalWorks,
  });
}

export function resolveBookCoverBatchProductionEnvironment(environment) {
  const supabaseUrl = String(environment?.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(
    environment?.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  invariant(
    supabaseUrl && serviceRoleKey,
    "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("VITE_SUPABASE_URL is not a valid production API URL.");
  }
  invariant(
    parsedUrl.protocol === "https:" &&
      parsedUrl.hostname === `${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co` &&
      parsedUrl.port === "" &&
      parsedUrl.username === "" &&
      parsedUrl.password === "" &&
      parsedUrl.pathname === "/" &&
      parsedUrl.search === "" &&
      parsedUrl.hash === "",
    "VITE_SUPABASE_URL does not identify the pinned production project."
  );
  invariant(
    serviceRoleKey.length >= 20,
    "SUPABASE_SERVICE_ROLE_KEY is not configured as a production credential."
  );
  return Object.freeze({
    supabaseUrl: parsedUrl.origin,
    serviceRoleKey,
  });
}

export function redactBookCoverBatchSensitive(value, sensitiveValues = []) {
  let redacted = String(value ?? "");
  for (const sensitiveValue of sensitiveValues) {
    const normalized = String(sensitiveValue || "");
    if (normalized.length >= 4) {
      redacted = redacted.split(normalized).join("[REDACTED]");
    }
  }
  return redacted;
}

function safeDatabaseErrorCode(error) {
  const code = String(error?.code || "unknown");
  return /^[A-Za-z0-9_-]{1,32}$/u.test(code) ? code : "unknown";
}

async function requireQuery(label, query) {
  const result = await query;
  if (result.error) {
    throw new Error(
      `${label} failed (database error code ${safeDatabaseErrorCode(result.error)}).`
    );
  }
  return result;
}

export async function verifyProductionBookCoverBatch20260820({
  supabase,
  contract = buildBookCoverBatch20260820Contract(),
}) {
  const artworkResult = await requireQuery(
    "Artwork verification",
    supabase
      .from("literary_work_cover_artworks")
      .select(
        "work_id,cover_url,thumbnail_url,cover_width,cover_height,thumbnail_width,thumbnail_height,is_primary,source_archive_sha256,source_image_sha256,source_index",
        { count: "exact" }
      )
      .eq("source_archive_sha256", contract.archiveSha256)
  );
  const workResult = await requireQuery(
    "Work verification",
    supabase
      .from("literary_works")
      .select("id,legacy_id")
      .in("legacy_id", contract.workKeys)
  );
  const workIds = (workResult.data || []).map((work) => work.id);
  invariant(
    workIds.length === BOOK_COVER_BATCH_20260820_EXPECTED.works,
    "Production did not resolve the exact 41-work batch."
  );
  const supplementalIds = (workResult.data || [])
    .filter((work) => contract.supplementalWorkKeys.includes(work.legacy_id))
    .map((work) => work.id);
  invariant(
    supplementalIds.length ===
      BOOK_COVER_BATCH_20260820_EXPECTED.supplementalWorks,
    "Production did not resolve all 17 supplemental works."
  );
  const translationResult = await requireQuery(
    "Translation verification",
    supabase
      .from("literary_work_translations")
      .select("work_id,locale")
      .in("work_id", supplementalIds)
      .in("locale", ["ru", "en"])
  );
  const sourceResult = await requireQuery(
    "Source verification",
    supabase
      .from("literary_work_sources")
      .select("work_id")
      .in("work_id", supplementalIds)
  );

  return verifyBookCoverBatch20260820Snapshot(contract, {
    artworkCount: artworkResult.count,
    artworks: artworkResult.data || [],
    works: workResult.data || [],
    translations: translationResult.data || [],
    sources: sourceResult.data || [],
  });
}

async function main() {
  const environment = resolveBookCoverBatchProductionEnvironment(process.env);
  buildBookCoverBatch20260820Contract();
  if (process.argv.includes("--validate-environment-only")) {
    console.log(
      "Production atomic-archive environment and reviewed cover postflight contract are valid."
    );
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    environment.supabaseUrl,
    environment.serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  const summary = await verifyProductionBookCoverBatch20260820({ supabase });
  console.log(
    `Atomic archive cover postflight verified: ${summary.artworks} artworks / ${summary.works} works / ${summary.primary} primary / ${summary.secondary} secondary; ${summary.supplementalWorks} supplemental works have RU+EN and source provenance.`
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Verification failed.";
    console.error(
      redactBookCoverBatchSensitive(message, [
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.VITE_SUPABASE_URL,
      ])
    );
    process.exitCode = 1;
  });
}

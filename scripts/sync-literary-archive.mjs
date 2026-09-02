import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { build } from "esbuild";
import { authorshipRowsFromArchive } from "./lib/book-authorship-roundtrip.mjs";
import {
  BOOK_EVIDENCE_V2_CONTRACT,
  BOOK_EVIDENCE_V2_SCHEMA_VERSION,
  BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES,
  BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
  canonicalUtf8ContentSha256,
  evidenceV2DatabaseContentProjection,
  evidenceV2AttestationCandidatesFromArchive,
  evidenceV2ValidatorImplementationSha256,
} from "./lib/book-evidence-v2-attestations.mjs";
import {
  canonicalLiteraryArchiveReleasePayload,
  isLiteraryArchiveReleasePreEvidencePublishable,
  literaryArchiveReleaseLogicalTargetManifestSha256,
  literaryArchiveReleasePostReleasePredecessorExpectation,
  literaryArchiveReleaseTargetManifestSha256,
  literaryArchiveReleaseUnlockedScopeSha256,
  publishLiteraryArchiveAtomicRelease,
  validateLiteraryArchiveChildEditPreservationReceipt,
  validateLiteraryArchiveReleasePrecondition,
} from "./lib/literary-archive-atomic-release.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "literary-archive-source.mjs");
const ATOMIC_WORKFLOW_RECEIPT_SCHEMA =
  "literary-archive-workflow-receipt-v2";
const applyChanges = process.argv.includes("--apply");
const preflightOnly = process.argv.includes("--preflight");
const postflightOnly = process.argv.includes("--postflight");
const coverBatch20260820 = process.argv.includes("--batch-2026-08-20");
const enableEvidenceV2 = process.argv.includes("--enable-evidence-v2");
const receiptOptionIndexes = process.argv.flatMap((argument, index) =>
  argument === "--receipt-file" ? [index] : []
);
if (receiptOptionIndexes.length > 1) {
  throw new Error("--receipt-file may be provided only once.");
}
const receiptOptionIndex = receiptOptionIndexes[0];
const receiptArgument = receiptOptionIndex === undefined
  ? null
  : process.argv[receiptOptionIndex + 1];
if (
  receiptOptionIndex !== undefined &&
  (!receiptArgument || receiptArgument.startsWith("--"))
) {
  throw new Error("--receipt-file requires a JSON path.");
}
const receiptDirectory = path.join(repositoryRoot, "reconciliation");
const receiptFile = receiptArgument
  ? path.resolve(repositoryRoot, receiptArgument)
  : null;
if (receiptFile) {
  const relativeReceiptPath = path.relative(receiptDirectory, receiptFile);
  if (
    path.isAbsolute(relativeReceiptPath) ||
    relativeReceiptPath.startsWith(`..${path.sep}`) ||
    relativeReceiptPath === ".." ||
    path.extname(receiptFile).toLowerCase() !== ".json"
  ) {
    throw new Error(
      "--receipt-file must be a JSON file inside the reconciliation directory."
    );
  }
}

if ([applyChanges, preflightOnly, postflightOnly].filter(Boolean).length > 1) {
  throw new Error(
    "Choose at most one database mode: --preflight, --postflight or --apply."
  );
}
if ((applyChanges || postflightOnly) && coverBatch20260820) {
  throw new Error(
    "Atomic apply/postflight always covers the complete archive; batch-only publication is forbidden."
  );
}
if (postflightOnly && !receiptFile) {
  throw new Error("--postflight requires --receipt-file from the atomic apply.");
}
if (receiptFile && !applyChanges && !postflightOnly) {
  throw new Error("--receipt-file is valid only with --apply or --postflight.");
}

try {
  process.loadEnvFile(path.join(repositoryRoot, ".env.local"));
} catch {
  // В CI переменные передаются окружением; локальный файл необязателен.
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function fullHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function metadataWithDefinedValues(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
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
        import { bookEvidenceV2Issues } from "./src/data/bookEvidence.ts";

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
        export { bookEvidenceV2Issues };
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
    bookEvidenceV2Issues: module.bookEvidenceV2Issues,
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
        ...metadataWithDefinedValues({
          canon: book.canon,
          localizedTitles: book.localizedTitles,
        }),
      },
      authorship_kind: book.authorship?.kind ?? null,
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
      metadata: metadataWithDefinedValues({
        titleEvidence: translation.titleEvidence,
        descriptionProvenance: translation.descriptionProvenance,
      }),
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
      metadata: metadataWithDefinedValues({
        authorityId: source.authorityId,
        authorityTier: source.authorityTier,
        country: source.country,
        market: source.market,
        language: source.language,
        recordKind: source.recordKind,
        recordId: source.recordId,
      }),
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
    isbn_10: null,
    isbn_13: null,
    publisher: "",
    publication_year: null,
    language: book.originalLanguage || "",
    format: "",
    page_count: null,
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
const canonRegistrySource = await readFile(
  path.join(repositoryRoot, "data", "book-canon-source-registry.json")
);
const validatorSourcesByPath = new Map(
  await Promise.all(
    BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES.map(async (sourcePath) => [
      sourcePath,
      await readFile(path.join(repositoryRoot, ...sourcePath.split("/"))),
    ])
  )
);
const canonRegistry = JSON.parse(canonRegistrySource.toString("utf8"));
const canonRegistrySha256 = canonicalUtf8ContentSha256(canonRegistrySource);
const validatorSha256 =
  evidenceV2ValidatorImplementationSha256(validatorSourcesByPath);
const evidenceV2Review = evidenceV2AttestationCandidatesFromArchive(
  syncArchive,
  {
    canonRegistry,
    canonRegistrySha256,
    issuesForWork: source.bookEvidenceV2Issues,
    validatorSha256,
  }
);
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
console.log(
  `Evidence V2: ${evidenceV2Review.candidates.length} локальных карточек прошли полный gate; ${evidenceV2Review.rejected.length} карточек не будут аттестованы.`
);

if (!applyChanges && !preflightOnly && !postflightOnly) {
  console.log(
    "Локальная проверка завершена: база не изменена. Используйте --preflight до публикации, --postflight для exact live-target проверки; --apply публикует только через staged atomic release."
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
    ["literary_works", "id,legacy_id,authorship_kind,is_cms_locked,updated_at"],
    [
      "literary_work_authors",
      "work_id,position,writer_country_id,writer_id,credit_name_ru,credit_name_en,attribution_status",
    ],
    ["literary_work_translations", "work_id,locale"],
    ["literary_work_sources", "work_id,provider,source_url"],
    ["literary_work_external_ids", "work_id,scheme,external_id"],
    [
      "literary_work_evidence_v2_controls",
      "singleton,enforcement_enabled,contract_version,validator_id,validator_version,validator_sha256,canon_registry_version,canon_registry_sha256",
    ],
    [
      "literary_work_evidence_v2_attestations",
      "work_id,contract_version,work_content_sha256,evidence_sha256",
    ],
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
  const { data: evidenceHealth, error: healthRpcError } = await supabase.rpc(
    "assert_literary_work_evidence_v2_health",
    {
      p_expected_contract_version: BOOK_EVIDENCE_V2_CONTRACT,
      p_expected_validator_version: BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
      p_expected_validator_sha256: validatorSha256,
      p_expected_canon_registry_version: canonRegistry.registryVersion,
      p_expected_canon_registry_sha256: canonRegistrySha256,
    }
  );
  if (healthRpcError) {
    throw new Error(
      `Database preflight failed for Evidence V2 health assertion: ${healthRpcError.message}`
    );
  }
  const expectedHealthKeys = [
    "attestationsRlsForced",
    "canonRegistryVersion",
    "contractVersion",
    "controlsRlsForced",
    "enforcementEnabled",
    "invalidAttestationCount",
    "invalidationTriggerCount",
    "manifestSha256",
    "ok",
    "policyCount",
    "predecessorPublicCount",
    "rpcOnlyEvidenceWrites",
    "schemaVersion",
    "validatorVersion",
  ];
  const actualHealthKeys = Object.keys(evidenceHealth || {}).sort();
  if (JSON.stringify(actualHealthKeys) !== JSON.stringify(expectedHealthKeys)) {
    throw new Error("Evidence V2 health assertion returned an unknown schema.");
  }
  if (
    evidenceHealth.ok !== true ||
    evidenceHealth.schemaVersion !== BOOK_EVIDENCE_V2_SCHEMA_VERSION ||
    evidenceHealth.contractVersion !== BOOK_EVIDENCE_V2_CONTRACT ||
    evidenceHealth.validatorVersion !== BOOK_EVIDENCE_V2_VALIDATOR_VERSION ||
    evidenceHealth.canonRegistryVersion !== canonRegistry.registryVersion ||
    typeof evidenceHealth.enforcementEnabled !== "boolean" ||
    evidenceHealth.rpcOnlyEvidenceWrites !== true ||
    evidenceHealth.controlsRlsForced !== true ||
    evidenceHealth.attestationsRlsForced !== true ||
    evidenceHealth.policyCount !== 7 ||
    evidenceHealth.invalidationTriggerCount !== 7 ||
    !Number.isInteger(evidenceHealth.predecessorPublicCount) ||
    evidenceHealth.predecessorPublicCount < 0 ||
    !Number.isInteger(evidenceHealth.invalidAttestationCount) ||
    evidenceHealth.invalidAttestationCount < 0 ||
    evidenceHealth.invalidAttestationCount >
      evidenceHealth.predecessorPublicCount ||
    (evidenceHealth.enforcementEnabled &&
      evidenceHealth.invalidAttestationCount !== 0) ||
    !/^[0-9a-f]{64}$/u.test(evidenceHealth.manifestSha256)
  ) {
    throw new Error("Evidence V2 health assertion returned invalid values.");
  }
  const { error: evidenceHashRpcError } = await supabase.rpc(
    "literary_work_evidence_v2_content_sha256_batch",
    { p_work_ids: [] }
  );
  if (evidenceHashRpcError) {
    throw new Error(
      `Database preflight failed for Evidence V2 hash RPC: ${evidenceHashRpcError.message}`
    );
  }
  console.log(
    `Database preflight passed: ${requiredRelations.length} required relations, the exact service-role Evidence V2 contract and the hash RPC are valid; no writes performed.`
  );
  return evidenceHealth;
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
function rowsGroupedByWorkId(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.work_id)) grouped.set(row.work_id, []);
    grouped.get(row.work_id).push(row);
  }
  return grouped;
}

function withoutWorkId(row) {
  const { work_id: _workId, ...payload } = row;
  return payload;
}

function utf8Order(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function readAtomicPrecondition(client) {
  const { data, error } = await client.rpc(
    "get_literary_archive_release_precondition",
    {}
  );
  if (error) {
    throw new Error(
      `Atomic release precondition RPC failed: ${error.message}`
    );
  }
  return validateLiteraryArchiveReleasePrecondition(data);
}

async function assertAtomicLiveTarget(client, expected) {
  const { data, error } = await client.rpc(
    "assert_literary_archive_live_target",
    {
      p_release_id: expected.releaseId,
      p_expected_committed_manifest_sha256:
        expected.committedManifestSha256,
    }
  );
  if (error) {
    throw new Error(`Atomic live-target postflight failed: ${error.message}`);
  }
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !isDeepStrictEqual(Object.keys(data).sort(), [
      "childEditPreservation",
      "committedManifestSha256",
      "liveTargetManifestSha256",
      "predecessorPublic",
      "predecessorPublicManifestSha256",
      "releaseId",
      "unlockedWorks",
    ]) ||
    data.releaseId !== expected.releaseId ||
    data.committedManifestSha256 !== expected.committedManifestSha256 ||
    !isDeepStrictEqual(
      data.childEditPreservation,
      expected.childEditPreservation
    ) ||
    data.unlockedWorks !== expected.unlockedWorks ||
    !/^[0-9a-f]{64}$/u.test(data.liveTargetManifestSha256 || "") ||
    data.predecessorPublic !== expected.predecessorPublic ||
    data.predecessorPublicManifestSha256 !==
      expected.predecessorPublicManifestSha256
  ) {
    throw new Error("Atomic live-target postflight returned an invalid receipt.");
  }
  return data;
}

async function readAtomicWorkflowReceipt() {
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptFile, "utf8"));
  } catch (error) {
    throw new Error(
      `Atomic workflow receipt cannot be read: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    !isDeepStrictEqual(Object.keys(receipt).sort(), [
      "childEditPreservation",
      "committedManifestSha256",
      "expectedItems",
      "expectedPredecessorPublic",
      "expectedPredecessorPublicManifestSha256",
      "logicalTargetManifestSha256",
      "releaseId",
      "schemaVersion",
    ]) ||
    receipt.schemaVersion !== ATOMIC_WORKFLOW_RECEIPT_SCHEMA ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      receipt.releaseId || ""
    ) ||
    !/^[0-9a-f]{64}$/u.test(receipt.committedManifestSha256 || "") ||
    !/^[0-9a-f]{64}$/u.test(receipt.logicalTargetManifestSha256 || "") ||
    !isDeepStrictEqual(
      validateLiteraryArchiveChildEditPreservationReceipt(
        receipt.childEditPreservation
      ),
      receipt.childEditPreservation
    ) ||
    !Number.isSafeInteger(receipt.expectedItems) ||
    receipt.expectedItems < 1 ||
    !Number.isSafeInteger(receipt.expectedPredecessorPublic) ||
    receipt.expectedPredecessorPublic < 0 ||
    !/^[0-9a-f]{64}$/u.test(
      receipt.expectedPredecessorPublicManifestSha256 || ""
    )
  ) {
    throw new Error("Atomic workflow receipt has an invalid schema.");
  }
  return receipt;
}

async function fetchAllLiveWorks(client) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("literary_works")
      .select("id,legacy_id,is_cms_locked,updated_at")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Literary work snapshot failed: ${error.message}`);
    }
    if (!Array.isArray(data)) {
      throw new Error("Literary work snapshot returned no row array.");
    }
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  const ids = new Set();
  const legacyIds = new Set();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      typeof row.legacy_id !== "string" ||
      row.legacy_id !== row.legacy_id.trim() ||
      typeof row.is_cms_locked !== "boolean" ||
      typeof row.updated_at !== "string" ||
      !row.updated_at ||
      ids.has(row.id) ||
      legacyIds.has(row.legacy_id)
    ) {
      throw new Error("Literary work snapshot contains an invalid identity.");
    }
    ids.add(row.id);
    legacyIds.add(row.legacy_id);
  }
  return rows;
}

async function fetchUnlockedContentHashes(client, unlockedWorks) {
  const hashesByWorkId = new Map();
  await inBatches(unlockedWorks, 500, async (batch, number) => {
    const requestedIds = batch.map((work) => work.id);
    const requestedSet = new Set(requestedIds);
    const { data, error } = await client.rpc(
      "literary_work_evidence_v2_content_sha256_batch",
      { p_work_ids: requestedIds }
    );
    if (error) {
      throw new Error(
        `Unlocked content hash batch ${number} failed: ${error.message}`
      );
    }
    if (!Array.isArray(data) || data.length !== batch.length) {
      throw new Error(
        `Unlocked content hash batch ${number} returned incomplete coverage.`
      );
    }
    for (const row of data) {
      if (
        !row ||
        !requestedSet.has(row.work_id) ||
        hashesByWorkId.has(row.work_id) ||
        !/^[0-9a-f]{64}$/u.test(row.content_sha256 || "")
      ) {
        throw new Error(
          `Unlocked content hash batch ${number} returned an invalid receipt.`
        );
      }
      hashesByWorkId.set(row.work_id, row.content_sha256);
    }
  });
  if (hashesByWorkId.size !== unlockedWorks.length) {
    throw new Error("Unlocked content hash coverage is incomplete.");
  }
  return hashesByWorkId;
}

const evidenceHealth = await preflightDatabaseContract(supabase);
const preconditionBefore = await readAtomicPrecondition(supabase);
const atomicEnableEvidenceV2 =
  enableEvidenceV2 || evidenceHealth.enforcementEnabled;
if (
  atomicEnableEvidenceV2 &&
  preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds.length
) {
  throw new Error(
    `Evidence V2 enablement is blocked by ${preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds.length} CMS-locked predecessor-public works without a valid current attestation. Manually review and re-attest their exact database content before retrying: ${preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds.join(", ")}`
  );
}
const liveWorks = await fetchAllLiveWorks(supabase);
const unlockedWorks = liveWorks.filter((work) => !work.is_cms_locked);
const lockedWorks = liveWorks.filter((work) => work.is_cms_locked);
if (unlockedWorks.length !== preconditionBefore.unlockedWorks) {
  throw new Error(
    "Atomic precondition count does not match the exact unlocked work snapshot."
  );
}
const lockedLegacyIds = new Set(lockedWorks.map((work) => work.legacy_id));
for (const legacyId of preconditionBefore.cmsLockedPredecessorLegacyIds) {
  if (!lockedLegacyIds.has(legacyId)) {
    throw new Error(
      `Atomic precondition identifies a non-locked preserved work: ${legacyId}`
    );
  }
}
const liveContentSha256ByWorkId = await fetchUnlockedContentHashes(
  supabase,
  unlockedWorks
);
const localUnlockedScopeSha256 = literaryArchiveReleaseUnlockedScopeSha256(
  unlockedWorks.map((work) => ({
    legacyId: work.legacy_id,
    updatedAt: work.updated_at,
    integritySha256: liveContentSha256ByWorkId.get(work.id),
  }))
);
if (localUnlockedScopeSha256 !== preconditionBefore.unlockedScopeSha256) {
  throw new Error(
    "Exact unlocked work snapshot does not match the server scope manifest."
  );
}
const precondition = await readAtomicPrecondition(supabase);
if (!isDeepStrictEqual(precondition, preconditionBefore)) {
  throw new Error(
    "Atomic release precondition drifted while the exact live snapshot was read."
  );
}

const liveWorkByLegacyId = new Map(
  liveWorks.map((work) => [work.legacy_id, work])
);
const workIds = new Map(
  liveWorks.map((work) => [work.legacy_id, work.id])
);
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

const existingLegacyByWorkId = new Map(
  [...workIds.entries()].map(([legacyId, workId]) => [workId, legacyId])
);
const incomingPrimaryArtworkByLegacyId = new Map(
  editorialCoverEntries
    .filter((entry) => entry.isPrimary && !lockedLegacyIds.has(entry.workKey))
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
  `Artwork data preflight passed for ${artworkLegacyIds.length} canonical works before private staging.`
);

const synchronizableArchive = syncArchive.filter(
  (book) =>
    !lockedLegacyIds.has(`${book.countryId}:${book.writerId}:${book.id}`)
);
const synchronizableWorks = works.filter(
  (work) => !lockedLegacyIds.has(work.legacy_id)
);
const identityWorkIds = new Map(
  synchronizableWorks.map((work) => [work.legacy_id, work.legacy_id])
);
const synchronizableLegacyIds = new Set(identityWorkIds.keys());
const unresolvedArtworkTargets = editorialCoverEntries
  .map((entry) => entry.workKey)
  .filter(
    (legacyId) =>
      !lockedLegacyIds.has(legacyId) &&
      !synchronizableLegacyIds.has(legacyId)
  );
if (unresolvedArtworkTargets.length) {
  throw new Error(
    `Artwork linkage failed closed: ${unresolvedArtworkTargets.length} canonical work IDs are unresolved.`
  );
}

const translations = translationRows(synchronizableArchive, identityWorkIds);
const sources = sourceRows(synchronizableArchive, identityWorkIds);
const externalIds = externalIdRows(synchronizableArchive, identityWorkIds);
const authors = authorshipRowsFromArchive(
  synchronizableArchive,
  identityWorkIds
);
const editions = synchronizableArchive
  .map((book) => {
    const legacyId = `${book.countryId}:${book.writerId}:${book.id}`;
    return editionRow(book, identityWorkIds.get(legacyId));
  })
  .filter(Boolean);
const editorialArtworks = editorialArtworkRows(
  editorialCoverEntries,
  identityWorkIds,
  lockedLegacyIds
);

const bookByLegacyId = new Map(
  synchronizableArchive.map((book) => [
    `${book.countryId}:${book.writerId}:${book.id}`,
    book,
  ])
);
const translationsByWorkId = rowsGroupedByWorkId(translations);
const sourcesByWorkId = rowsGroupedByWorkId(sources);
const externalIdsByWorkId = rowsGroupedByWorkId(externalIds);
const authorsByWorkId = rowsGroupedByWorkId(authors);
const editionsByWorkId = rowsGroupedByWorkId(editions);
const artworksByWorkId = rowsGroupedByWorkId(editorialArtworks);
const evidenceCandidateByLegacyId = new Map(
  evidenceV2Review.candidates.map((candidate) => [candidate.recordKey, candidate])
);

const releaseItems = [...synchronizableWorks]
  .sort((left, right) => utf8Order(left.legacy_id, right.legacy_id))
  .map((workRow, ordinal) => {
    const legacyId = workRow.legacy_id;
    const book = bookByLegacyId.get(legacyId);
    if (!book) {
      throw new Error(`Atomic target book is unresolved: ${legacyId}`);
    }
    const translationRowsForWork = translationsByWorkId.get(legacyId) || [];
    const sourceRowsForWork = sourcesByWorkId.get(legacyId) || [];
    const externalIdRowsForWork = externalIdsByWorkId.get(legacyId) || [];
    const authorRowsForWork = authorsByWorkId.get(legacyId) || [];
    const editionRowsForWork = editionsByWorkId.get(legacyId) || [];
    const artworkRowsForWork = artworksByWorkId.get(legacyId) || [];
    const evidenceCandidate = evidenceCandidateByLegacyId.get(legacyId);
    const expectedContent = evidenceV2DatabaseContentProjection({
      workRow,
      authorshipKind: workRow.authorship_kind,
      translationRows: translationRowsForWork,
      sourceRows: sourceRowsForWork,
      externalIdRows: externalIdRowsForWork,
      authorRows: authorRowsForWork,
      editionRows: editionRowsForWork,
      artworkRows: artworkRowsForWork,
    });
    const existing = liveWorkByLegacyId.get(legacyId);
    if (existing?.is_cms_locked) {
      throw new Error(`CMS-locked work leaked into atomic target: ${legacyId}`);
    }
    const integritySha256 = existing
      ? liveContentSha256ByWorkId.get(existing.id)
      : null;
    if (existing && !integritySha256) {
      throw new Error(`Existing target hash is unresolved: ${legacyId}`);
    }
    return {
      ordinal,
      legacyId,
      expectedLive: existing
        ? {
            exists: true,
            updatedAt: existing.updated_at,
            integritySha256,
          }
        : { exists: false, updatedAt: null, integritySha256: null },
      work: workRow,
      expectedContent,
      authors: authorRowsForWork.map(withoutWorkId),
      translations: translationRowsForWork.map(withoutWorkId),
      sources: sourceRowsForWork.map(withoutWorkId),
      externalIds: externalIdRowsForWork.map(withoutWorkId),
      editions: editionRowsForWork.map(withoutWorkId),
      artworks: artworkRowsForWork.map(withoutWorkId),
      attestation: evidenceCandidate
        ? {
            expectedContent,
            evidence: evidenceCandidate.evidence,
            reviewer: evidenceCandidate.reviewer,
            reviewedAt: evidenceCandidate.reviewedAt,
          }
        : null,
    };
  });

const logicalTargetManifestSha256 =
  literaryArchiveReleaseLogicalTargetManifestSha256(releaseItems);

const targetPredecessorLegacyIds = releaseItems
  .filter(isLiteraryArchiveReleasePreEvidencePublishable)
  .map((item) => item.legacyId);
const predecessorExpectation =
  literaryArchiveReleasePostReleasePredecessorExpectation({
    targetPredecessorLegacyIds,
    preservedCmsLockedPredecessorLegacyIds:
      precondition.cmsLockedPredecessorLegacyIds,
  });
const unattestedTargetPredecessors = releaseItems.filter(
  (item) =>
    isLiteraryArchiveReleasePreEvidencePublishable(item) &&
    item.attestation === null
);
if (atomicEnableEvidenceV2 && unattestedTargetPredecessors.length) {
  throw new Error(
    `Evidence V2 enablement is blocked by ${unattestedTargetPredecessors.length} unattested target works.`
  );
}

const targetManifestSha256 =
  literaryArchiveReleaseTargetManifestSha256(releaseItems);
const sourceRevision = fullHash(
  [
    "literary-archive-release-v1",
    targetManifestSha256,
    precondition.unlockedScopeSha256,
    canonicalLiteraryArchiveReleasePayload(
      precondition.childEditPreservation
    ),
    predecessorExpectation.expectedPredecessorPublicManifestSha256,
    validatorSha256,
    canonRegistrySha256,
    atomicEnableEvidenceV2 ? "enable-evidence-v2" : "preserve-evidence-v2",
  ].join("\n")
);
const releaseKey = `books:${sourceRevision}`;
const releaseMetadata = {
  workflow: "literary-archive-release-v1",
  targetManifestSha256,
  logicalTargetManifestSha256,
  predecessorPublicManifestSha256:
    predecessorExpectation.expectedPredecessorPublicManifestSha256,
  canonRegistryVersion: canonRegistry.registryVersion,
  canonRegistrySha256,
  validatorVersion: BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
  validatorSha256,
  targetWorks: releaseItems.length,
  preservedCmsLockedWorks: lockedWorks.length,
  childEditPreservation: precondition.childEditPreservation,
};

console.log(
  `Atomic target verified: ${releaseItems.length} unlocked works, ${lockedWorks.length} CMS-locked works preserved, ${targetPredecessorLegacyIds.length} target predecessor-public works, staging manifest ${targetManifestSha256}, logical target manifest ${logicalTargetManifestSha256}.`
);
if (postflightOnly) {
  const workflowReceipt = await readAtomicWorkflowReceipt();
  if (
    workflowReceipt.logicalTargetManifestSha256 !==
      logicalTargetManifestSha256 ||
    workflowReceipt.expectedItems !== releaseItems.length ||
    workflowReceipt.expectedPredecessorPublic !==
      predecessorExpectation.expectedPredecessorPublicCount ||
    workflowReceipt.expectedPredecessorPublicManifestSha256 !==
      predecessorExpectation.expectedPredecessorPublicManifestSha256 ||
    !isDeepStrictEqual(
      workflowReceipt.childEditPreservation,
      precondition.childEditPreservation
    )
  ) {
    throw new Error(
      "Atomic workflow receipt is not bound to the exact local postflight target."
    );
  }
  const postflightPrecondition = await readAtomicPrecondition(supabase);
  if (!isDeepStrictEqual(postflightPrecondition, precondition)) {
    throw new Error(
      "Atomic release precondition drifted before the exact live-target postflight."
    );
  }
  const liveReceipt = await assertAtomicLiveTarget(supabase, {
    releaseId: workflowReceipt.releaseId,
    committedManifestSha256:
      workflowReceipt.committedManifestSha256,
    childEditPreservation: precondition.childEditPreservation,
    unlockedWorks: releaseItems.length,
    predecessorPublic:
      predecessorExpectation.expectedPredecessorPublicCount,
    predecessorPublicManifestSha256:
      predecessorExpectation.expectedPredecessorPublicManifestSha256,
  });
  console.log(
    `Exact full-archive postflight passed read-only for release ${workflowReceipt.releaseId}: ${releaseItems.length} unlocked works and every core child/Evidence attestation match committed manifest ${workflowReceipt.committedManifestSha256} (live ${liveReceipt.liveTargetManifestSha256}, logical ${logicalTargetManifestSha256}); ${lockedWorks.length} CMS-locked works remain outside replacement scope.`
  );
  process.exit(0);
}
if (preflightOnly) {
  console.log("Preflight-only mode complete: database was not changed.");
  process.exit(0);
}

const releaseResult = await publishLiteraryArchiveAtomicRelease({
  supabase,
  items: releaseItems,
  expectedPrecondition: precondition,
  releaseKey,
  sourceRevision,
  expectedPredecessorPublicCount:
    predecessorExpectation.expectedPredecessorPublicCount,
  expectedPredecessorPublicManifestSha256:
    predecessorExpectation.expectedPredecessorPublicManifestSha256,
  enableEvidenceV2: atomicEnableEvidenceV2,
  metadata: releaseMetadata,
  logger: console.log,
});

if (receiptFile) {
  const workflowReceipt = {
    schemaVersion: ATOMIC_WORKFLOW_RECEIPT_SCHEMA,
    releaseId: releaseResult.releaseId,
    childEditPreservation: precondition.childEditPreservation,
    committedManifestSha256: releaseResult.commitReceipt.manifestSha256,
    logicalTargetManifestSha256,
    expectedItems: releaseItems.length,
    expectedPredecessorPublic:
      predecessorExpectation.expectedPredecessorPublicCount,
    expectedPredecessorPublicManifestSha256:
      predecessorExpectation.expectedPredecessorPublicManifestSha256,
  };
  await writeFile(
    receiptFile,
    `${JSON.stringify(workflowReceipt, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  console.log(
    `Redacted atomic workflow receipt written to ${path.relative(repositoryRoot, receiptFile)}.`
  );
}

console.log(
  `Atomic sync committed: release ${releaseResult.releaseId}, ${releaseItems.length} works, ${authors.length} author credits, ${translations.length} translations, ${sources.length} sources, ${externalIds.length} external IDs, ${editions.length} editions, ${editorialArtworks.length} artworks; manifest ${releaseResult.targetManifestSha256}.`
);

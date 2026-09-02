import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOK_EVIDENCE_V2_CONTRACT,
  BOOK_EVIDENCE_V2_SCHEMA_VERSION,
  BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES,
  BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
  bindEvidenceV2AttestationPayloads,
  canonicalUtf8ContentSha256,
  evidenceV2AttestationCandidatesFromArchive,
  evidenceV2DatabaseContentProjection,
  evidenceV2ValidatorImplementationSha256,
} from "../lib/book-evidence-v2-attestations.mjs";

const root = path.resolve(process.cwd());
const raw = (file) => readFileSync(path.join(root, file));
const read = (file) =>
  raw(file).toString("utf8").replace(/\r\n?/gu, "\n");
const migration = read(
  "supabase/migrations/20260902_literary_work_evidence_v2_attestations.sql"
);
const syncSource = read("scripts/sync-literary-archive.mjs");
const proofSource = read("scripts/lib/book-evidence-v2-attestations.mjs");
const validatorSha256 = evidenceV2ValidatorImplementationSha256(
  new Map(
    BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES.map((sourcePath) => [
      sourcePath,
      raw(sourcePath),
    ])
  )
);
const canonRegistrySource = raw("data/book-canon-source-registry.json");
const canonRegistry = JSON.parse(canonRegistrySource.toString("utf8"));
const canonRegistrySha256 = canonicalUtf8ContentSha256(canonRegistrySource);

describe("literary-work Evidence V2 production boundary", () => {
  it("installs shadow controls and keeps all mutations RPC-only", () => {
    expect(migration).toContain(
      "enforcement_enabled boolean not null default false"
    );
    expect(migration).toContain(
      "create table if not exists public.literary_work_evidence_v2_attestations"
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;"
    );
    expect(migration).not.toMatch(
      /grant\s+all\s+on\s+table\s+public\.literary_work_evidence_v2/iu
    );
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      expect(migration).toContain(`'${privilege}'`);
    }
    expect(migration).toContain(
      "alter table public.literary_work_evidence_v2_attestations force row level security;"
    );
    expect(migration).toContain(
      "alter table public.literary_work_evidence_v2_controls force row level security;"
    );
  });

  it("resolves pgcrypto's actual schema and never trusts a mutable search path", () => {
    expect(migration).toContain("extension_record.extname = 'pgcrypto'");
    expect(migration).toContain("%I.digest(");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("extensions.digest(");
    expect(migration).toContain(
      "public.literary_work_evidence_v2_sha256(p_expected_content::text)"
    );
  });

  it("rejects missing or malformed JSON instead of accepting SQL NULL", () => {
    expect(migration).toContain(
      "p_evidence ->> 'contractVersion' is distinct from 'book-evidence-v2'"
    );
    expect(migration).toContain(
      "p_evidence #>> '{validation,status}' is distinct from 'passed'"
    );
    expect(migration).toMatch(
      /when jsonb_typeof\([\s\S]+?localizedTitles,ru,evidence[\s\S]+?\) = 'array'[\s\S]+?else true/iu
    );
    expect(migration).toMatch(
      /when jsonb_typeof\([\s\S]+?descriptions,en,sourceUrls[\s\S]+?\) = 'array'[\s\S]+?else true/iu
    );
    expect(migration).toContain(
      "Evidence must contain a zero-issue local V2 validation"
    );
    for (const identity of [
      "validatorVersion",
      "validatorSha256",
      "canonRegistryVersion",
      "canonRegistrySha256",
    ]) {
      expect(migration).toContain(`{validation,${identity}}`);
      expect(proofSource).toContain(identity);
    }
  });

  it("pins proofs to portable canonical UTF-8 validator/registry content", () => {
    expect(migration).toContain(
      `default '${validatorSha256}'`
    );
    expect(migration).toContain(
      `default '${canonRegistrySha256}'`
    );
    expect(migration).toContain(
      `default '${BOOK_EVIDENCE_V2_VALIDATOR_VERSION}'`
    );
    expect(migration).toContain(
      `default '${canonRegistry.registryVersion}'`
    );
    expect(migration).toContain(
      "Evidence validator or canon registry identity is stale"
    );
    expect(migration).toContain(
      "attestation.evidence #>> '{validation,validatorSha256}'"
    );
    expect(migration).toContain(
      "attestation.evidence #>> '{validation,canonRegistrySha256}'"
    );
    expect(canonicalUtf8ContentSha256("one\r\ntwo\rthree")).toBe(
      canonicalUtf8ContentSha256("one\ntwo\nthree")
    );
    const normalizedValidatorSources = new Map(
      BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES.map((sourcePath) => [
        sourcePath,
        raw(sourcePath).toString("utf8").replace(/\r\n?/gu, "\n"),
      ])
    );
    const crlfValidatorSources = new Map(
      [...normalizedValidatorSources].map(([sourcePath, sourceText]) => [
        sourcePath,
        sourceText.replace(/\n/gu, "\r\n"),
      ])
    );
    expect(
      evidenceV2ValidatorImplementationSha256(crlfValidatorSources)
    ).toBe(
      evidenceV2ValidatorImplementationSha256(normalizedValidatorSources)
    );
  });

  it("binds the complete local projection and closes hash/invalidation races", () => {
    expect(migration).toContain(
      "create or replace function public.literary_work_evidence_v2_content("
    );
    expect(migration).toContain(
      "current_content is distinct from p_expected_content"
    );
    expect(migration).toContain(
      "Database content differs from the local V2 projection"
    );
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(migration).toContain("array[old.work_id, new.work_id]");
    for (const table of [
      "literary_works",
      "literary_work_translations",
      "literary_work_sources",
      "literary_work_external_ids",
      "literary_work_authors",
      "book_editions",
      "literary_work_cover_artworks",
    ]) {
      expect(migration).toContain(
        `${table}_invalidate_evidence_v2`
      );
    }
    expect(migration).toContain(
      "reviewed_at date not null check (reviewed_at <= current_date)"
    );
    expect(migration).toContain("or p_reviewed_at > current_date then");
    expect(migration).toContain(
      "order by (listed.value ->> 'workId')::uuid"
    );
  });

  it("rebinds every public relation to the wrapper gate", () => {
    expect(migration).toContain("pg_catalog.pg_get_functiondef(");
    expect(migration).not.toMatch(
      /alter function public\.is_publishable_literary_work\(uuid\)\s+rename/iu
    );
    const policyGateUses = migration.match(
      /public\.is_publishable_literary_work\((?:id|work_id)\)/gu
    );
    expect(policyGateUses).toHaveLength(7);
    expect(migration).toContain(
      'drop policy if exists "Public read verified book editions"'
    );
    expect(migration).toContain(
      "and public.is_publishable_literary_work(work_id)"
    );
    expect(migration).toContain("and 7 = (");
    expect(migration).toContain(
      "'%is_publishable_literary_work_pre_evidence_v2(%'"
    );
  });

  it("enables enforcement only against one locked predecessor snapshot", () => {
    const toggleBody = migration.slice(
      migration.indexOf(
        "create or replace function public.set_literary_work_evidence_v2_enforcement("
      ),
      migration.indexOf(
        "revoke all on function public.set_literary_work_evidence_v2_enforcement("
      )
    );
    expect(migration).toMatch(
      /from public\.literary_work_evidence_v2_controls control[\s\S]+?for update;/iu
    );
    expect(migration).toContain("lock table");
    for (const table of [
      "public.literary_works",
      "public.literary_work_translations",
      "public.literary_work_sources",
      "public.literary_work_external_ids",
      "public.literary_work_authors",
      "public.book_editions",
      "public.literary_work_cover_artworks",
      "public.literary_work_evidence_v2_attestations",
    ]) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("in share mode;");
    const orderedLocks = [
      "public.literary_work_authors",
      "public.literary_work_translations",
      "public.literary_work_sources",
      "public.literary_work_external_ids",
      "public.book_editions",
      "public.literary_work_cover_artworks",
      "public.literary_works",
      "public.literary_work_evidence_v2_attestations",
      "for update;",
    ];
    let precedingIndex = -1;
    for (const lockTarget of orderedLocks) {
      const currentIndex = toggleBody.indexOf(lockTarget);
      expect(currentIndex).toBeGreaterThan(precedingIndex);
      precedingIndex = currentIndex;
    }
    expect(migration).toContain(
      "public.literary_work_evidence_v2_predecessor_manifest_sha256()"
    );
    expect(migration).toContain(
      "p_expected_predecessor_manifest_sha256"
    );
    expect(migration).toContain(
      "Predecessor public manifest changed"
    );
    expect(migration).not.toContain("p_expected_predecessor_public_count");
    expect(migration).toContain(
      "if p_enabled and invalid_attestation_count <> 0 then"
    );
  });

  it("syncs only zero-issue unlocked local cards without enabling the gate", () => {
    expect(syncSource).toContain(
      "--apply публикует только через staged atomic release."
    );
    expect(syncSource).toContain(
      "evidenceV2AttestationCandidatesFromArchive"
    );
    expect(proofSource).toContain(
      'validator: BOOK_EVIDENCE_V2_VALIDATOR'
    );
    expect(proofSource).toContain('status: "passed"');
    expect(proofSource).toContain("issues: []");
    expect(syncSource).toContain(
      "!lockedLegacyIds.has(`${book.countryId}:${book.writerId}:${book.id}`)"
    );
    expect(syncSource).toContain(
      "evidenceV2DatabaseContentProjection"
    );
    expect(syncSource).toContain(
      '"literary_work_evidence_v2_content_sha256_batch"'
    );
    expect(syncSource).not.toContain(
      '"sync_literary_work_evidence_v2_batch"'
    );
    expect(syncSource).toContain("attestation: evidenceCandidate");
    expect(syncSource).toContain("publishLiteraryArchiveAtomicRelease({");
    expect(syncSource).toContain(
      '"assert_literary_work_evidence_v2_health"'
    );
    expect(syncSource).not.toContain('"get_editorial_schema_health"');
    expect(syncSource).not.toContain(
      "set_literary_work_evidence_v2_enforcement"
    );
    expect(syncSource).toContain(
      "translationRows(synchronizableArchive, identityWorkIds)"
    );
    expect(syncSource).toContain(
      "sourceRows(synchronizableArchive, identityWorkIds)"
    );
    expect(syncSource).toContain(
      "externalIdRows(synchronizableArchive, identityWorkIds)"
    );
    expect(syncSource).toContain("editionRows: editionRowsForWork");
    expect(syncSource).toContain("artworkRows: artworkRowsForWork");
  });

  it("uses a service-only health assertion with one exact response schema", () => {
    expect(migration).toContain(
      "create or replace function public.assert_literary_work_evidence_v2_health("
    );
    expect(migration).toContain(
      "raise exception 'Evidence V2 database invariants are not healthy'"
    );
    expect(migration).toContain("invalidation_trigger_count <> 7");
    for (const key of [
      "ok",
      "schemaVersion",
      "contractVersion",
      "validatorVersion",
      "canonRegistryVersion",
      "enforcementEnabled",
      "rpcOnlyEvidenceWrites",
      "controlsRlsForced",
      "attestationsRlsForced",
      "policyCount",
      "invalidationTriggerCount",
      "predecessorPublicCount",
      "invalidAttestationCount",
      "manifestSha256",
    ]) {
      expect(migration).toContain(`'${key}'`);
      expect(syncSource).toContain(`"${key}"`);
    }
    expect(syncSource).toContain(
      `evidenceHealth.schemaVersion !== BOOK_EVIDENCE_V2_SCHEMA_VERSION`
    );
    expect(BOOK_EVIDENCE_V2_SCHEMA_VERSION).toBe(
      "20260902_literary_work_evidence_v2_attestations"
    );
  });

  it("preserves a newer predecessor schema-health version", () => {
    expect(migration).toContain(
      "get_editorial_schema_health_pre_literary_work_evidence_v2()"
    );
    expect(migration).not.toContain(
      "'version', '20260901_zzzzzz_admin_completion_health'"
    );
  });

  it("builds and binds a deterministic zero-issue proof projection", () => {
    const titleEvidence = {
      evidence: [
        { checkedAt: "2026-09-01" },
        { checkedAt: "2026-09-02" },
      ],
    };
    const ruProvenance = {
      sourceUrls: ["https://one.example", "https://two.example"],
      reviewedBy: "Fact reviewer",
      reviewedAt: "2026-09-02",
    };
    const enProvenance = {
      ...ruProvenance,
      reviewedBy: "Bilingual reviewer",
      translatedFromSourceHash: "a".repeat(64),
    };
    const book = {
      id: "work",
      countryId: "country",
      writerId: "writer",
      localizedTitles: { ru: titleEvidence, en: titleEvidence },
      translations: {
        ru: { description: "Русское описание.", descriptionProvenance: ruProvenance },
        en: { description: "English description.", descriptionProvenance: enProvenance },
      },
    };
    const review = evidenceV2AttestationCandidatesFromArchive([book], {
      canonRegistry,
      canonRegistrySha256,
      issuesForWork: () => [],
      validatorSha256,
      today: "2026-09-02",
    });
    expect(review.rejected).toEqual([]);
    expect(review.candidates).toHaveLength(1);
    expect(review.candidates[0].evidence.contractVersion).toBe(
      BOOK_EVIDENCE_V2_CONTRACT
    );
    expect(review.candidates[0].evidence.validation).toMatchObject({
      validatorVersion: BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
      validatorSha256,
      canonRegistryVersion: canonRegistry.registryVersion,
      canonRegistrySha256,
      status: "passed",
      issues: [],
      reviewedAt: "2026-09-02",
    });

    const expectedContent = evidenceV2DatabaseContentProjection({
      workRow: {
        legacy_id: "country:writer:work",
        country_id: "country",
        writer_id: "writer",
        title: "Произведение",
        slug: "work-hash",
        original_title: "Work",
        first_published: 1900,
        original_language: "English",
        genres: [],
        tags: [],
        description: "",
        source_url: null,
        editorial_status: "verified",
        reviewed_at: "2026-09-02",
        metadata: {},
      },
    });
    expect(expectedContent.work.authorshipKind).toBeNull();
    expect(expectedContent.translations).toEqual([]);

    const payloads = bindEvidenceV2AttestationPayloads(
      review.candidates,
      new Map([["country:writer:work", "00000000-0000-0000-0000-000000000001"]]),
      new Map([["00000000-0000-0000-0000-000000000001", "b".repeat(64)]]),
      new Map([["country:writer:work", expectedContent]])
    );
    expect(payloads[0]).toMatchObject({
      expectedContentSha256: "b".repeat(64),
      expectedContent,
    });
  });

  it("mirrors all edition/artwork fields and PostgreSQL C byte ordering", () => {
    const baseWorkRow = {
      legacy_id: "country:writer:work",
      country_id: "country",
      writer_id: "writer",
      title: "Произведение",
      slug: "work-hash",
      original_title: "Work",
      first_published: 1900,
      original_language: "English",
      genres: [],
      tags: [],
      description: "",
      source_url: null,
      editorial_status: "verified",
      reviewed_at: "2026-09-02",
      metadata: {},
    };
    const minimalEdition = (legacyId) => ({
      legacy_id: legacyId,
      title: "Edition",
      language: "English",
      cover_url: "https://covers.example/cover.jpg",
      cover_source_url: "https://covers.example/source",
      cover_rights_status: "licensed",
      license_name: "CC BY 4.0",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
      creator: "Artist",
      rights_holder: "Archive",
      rights_checked_at: "2026-09-02",
      source_url: "https://catalog.example/edition",
      is_primary: true,
      metadata: { source: "catalog" },
    });
    const artwork = (archiveSha, imageSha) => ({
      cover_url: "brand/book-covers/cover.webp",
      thumbnail_url: "brand/book-covers/thumbs/cover.webp",
      cover_width: 1200,
      cover_height: 1800,
      thumbnail_width: 400,
      thumbnail_height: 600,
      rights_status: "editorial-original",
      cover_source_url: "https://probpera.ru/brand/book-covers/cover.webp",
      rights_checked_at: "2026-09-02",
      source_archive_sha256: archiveSha,
      source_image_sha256: imageSha,
      source_filename: "cover.png",
      source_relative_path: "covers/cover.png",
      source_index: 1,
      is_primary: true,
      provenance: { kind: "user-supplied" },
    });
    const projected = evidenceV2DatabaseContentProjection({
      workRow: baseWorkRow,
      sourceRows: [
        {
          provider: "ä-provider",
          source_url: "https://source.example/a",
          field_names: ["title"],
          license_name: null,
          usage: "reference-only",
          retrieved_at: "2026-09-02",
          metadata: {},
        },
        {
          provider: "z-provider",
          source_url: "https://source.example/z",
          field_names: ["title"],
          license_name: null,
          usage: "reference-only",
          retrieved_at: "2026-09-02",
          metadata: {},
        },
      ],
      editionRows: [minimalEdition("ä-edition"), minimalEdition("z-edition")],
      artworkRows: [
        artwork("b".repeat(64), "a".repeat(64)),
        artwork("a".repeat(64), "b".repeat(64)),
      ],
    });

    expect(projected.sources.map((row) => row.provider)).toEqual([
      "z-provider",
      "ä-provider",
    ]);
    expect(projected.editions.map((row) => row.legacyId)).toEqual([
      "z-edition",
      "ä-edition",
    ]);
    expect(projected.artworks.map((row) => row.sourceArchiveSha256)).toEqual([
      "a".repeat(64),
      "b".repeat(64),
    ]);
    expect(Object.keys(projected.editions[0])).toEqual([
      "legacyId",
      "title",
      "isbn10",
      "isbn13",
      "publisher",
      "publicationYear",
      "language",
      "format",
      "pageCount",
      "coverUrl",
      "coverSourceUrl",
      "coverRightsStatus",
      "licenseName",
      "licenseUrl",
      "creator",
      "rightsHolder",
      "rightsCheckedAt",
      "sourceUrl",
      "isPrimary",
      "metadata",
    ]);
    expect(projected.editions[0]).toMatchObject({
      isbn10: null,
      isbn13: null,
      publisher: "",
      publicationYear: null,
      format: "",
      pageCount: null,
    });
    expect(Object.keys(projected.artworks[0])).toEqual([
      "coverUrl",
      "thumbnailUrl",
      "coverWidth",
      "coverHeight",
      "thumbnailWidth",
      "thumbnailHeight",
      "rightsStatus",
      "coverSourceUrl",
      "rightsCheckedAt",
      "sourceArchiveSha256",
      "sourceImageSha256",
      "sourceFilename",
      "sourceRelativePath",
      "sourceIndex",
      "isPrimary",
      "provenance",
    ]);
    for (const [jsonKey, column] of [
      ["legacyId", "legacy_id"],
      ["isbn10", "isbn_10"],
      ["isbn13", "isbn_13"],
      ["publicationYear", "publication_year"],
      ["pageCount", "page_count"],
      ["coverRightsStatus", "cover_rights_status"],
      ["rightsCheckedAt", "rights_checked_at"],
      ["isPrimary", "is_primary"],
    ]) {
      expect(migration).toContain(`'${jsonKey}', edition.${column}`);
    }
    for (const [jsonKey, column] of [
      ["thumbnailUrl", "thumbnail_url"],
      ["coverWidth", "cover_width"],
      ["thumbnailHeight", "thumbnail_height"],
      ["sourceArchiveSha256", "source_archive_sha256"],
      ["sourceImageSha256", "source_image_sha256"],
      ["sourceRelativePath", "source_relative_path"],
      ["sourceIndex", "source_index"],
    ]) {
      expect(migration).toContain(`'${jsonKey}', artwork.${column}`);
    }
    expect(proofSource).toContain("Buffer.compare(");
  });

  it("fails closed when either checked-in source hash is absent", () => {
    expect(() =>
      evidenceV2AttestationCandidatesFromArchive([], {
        canonRegistry,
        canonRegistrySha256,
        issuesForWork: () => [],
      })
    ).toThrow("Validator SHA-256 is required");
    expect(() =>
      evidenceV2AttestationCandidatesFromArchive([], {
        canonRegistry,
        issuesForWork: () => [],
        validatorSha256,
      })
    ).toThrow("Canon registry SHA-256 is required");
  });

  it("remains additive and transaction-wrapper neutral", () => {
    expect(migration).not.toMatch(/\bdrop\s+(?:table|schema|column)\b/iu);
    expect(migration).not.toMatch(
      /^\s*(?:begin|commit|rollback)\s*;/gimu
    );
  });
});

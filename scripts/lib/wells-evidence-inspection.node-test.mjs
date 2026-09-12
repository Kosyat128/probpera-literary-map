import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectWellsEvidence, serializeWellsInspection, WELLS_LEGACY_ID } from "../inspect-wells-evidence.mjs";

const WORK_ID = "12345678-1234-4234-8234-123456789abc";
const KEY = "test-only-service-credential-not-a-real-key";
const HASH = "a".repeat(64);
const SHA = "b".repeat(40);
const OPTIONS = { supabaseUrl: "https://test-project.supabase.co", serviceRoleKey: KEY, expectedMainSha: SHA };

function fixture() {
  const scoped = (id, extra) => ({ id, work_id: WORK_ID, ...extra });
  return {
    literary_works: [{
      id: WORK_ID, legacy_id: WELLS_LEGACY_ID, country_id: "england", writer_id: "h_g_wells",
      title: "Когда спящий проснётся", slug: "when-the-sleeper-wakes", original_title: "When the Sleeper Wakes",
      first_published: 1899, original_language: "английский", genres: ["роман"], tags: ["будущее"],
      description: "The preserved manual CMS description.", source_url: "https://example.org/work",
      editorial_status: "verified", reviewed_at: "2026-08-20", metadata: { manual: true },
      authorship_kind: "single", is_cms_locked: true, updated_at: "2026-09-09T10:14:24Z",
    }],
    literary_work_evidence_v2_controls: [{
      singleton: true, enforcement_enabled: false, contract_version: "book-evidence-v2",
      validator_id: "src/data/bookEvidence.ts#bookEvidenceV2Issues", validator_version: "validator-current",
      validator_sha256: HASH, canon_registry_version: "canon-current", canon_registry_sha256: "c".repeat(64),
      updated_at: "2026-09-02T00:00:00Z",
    }],
    literary_work_evidence_v2_attestations: [],
    literary_work_translations: [scoped("ru", {
      locale: "ru", title: "Когда спящий проснётся", description: "The distinct Russian description.",
      source_language: "ru", translation_method: "editorial-original", editorial_status: "draft",
      source_urls: ["https://example.org/ru"], reviewed_at: null, metadata: { titleEvidence: { exact: true } },
    })],
    literary_work_sources: Array.from({ length: 101 }, (_, index) => scoped(`source-${index}`, {
      provider: "Library", source_url: `https://example.org/source/${index}`, field_names: ["title"],
      license_name: null, usage: "reference-only", retrieved_at: "2026-08-20", metadata: { index },
    })),
    literary_work_external_ids: [scoped("external", { scheme: "loc", external_id: "99002363", source_url: "https://lccn.loc.gov/99002363" })],
    literary_work_authors: [{ work_id: WORK_ID, position: 0, writer_country_id: "england", writer_id: "h_g_wells", credit_name_ru: "Уэллс", credit_name_en: "Wells", attribution_status: "credited", metadata: { preserved: true } }],
    book_editions: [scoped("edition", {
      legacy_id: "wells-original", title: "When the Sleeper Wakes", isbn_10: null, isbn_13: null,
      publisher: "Harper", publication_year: 1899, language: "en", format: "hardcover", page_count: 300,
      cover_url: null, cover_source_url: null, cover_rights_status: "unverified", license_name: "", license_url: null,
      creator: "", rights_holder: "", rights_checked_at: null, source_url: "https://example.org/edition", is_primary: true,
      metadata: { noCoverButStillIncluded: true },
    })],
    literary_work_cover_artworks: [scoped("artwork", {
      cover_url: "brand/book-covers/wells.webp", thumbnail_url: "brand/book-covers/thumbs/wells.webp",
      cover_width: 600, cover_height: 900, thumbnail_width: 200, thumbnail_height: 300,
      rights_status: "editorial-original", cover_source_url: "https://example.org/cover", rights_checked_at: "2026-08-20",
      source_archive_sha256: HASH, source_image_sha256: "d".repeat(64), source_filename: "Wells.png",
      source_relative_path: "covers/Wells.png", source_index: 1, is_primary: true, provenance: { kind: "user-supplied" },
    })],
  };
}

function mockDatabase(data = fixture(), changeResponse) {
  const calls = [];
  let hashReads = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(url.origin, OPTIONS.supabaseUrl);
    assert.ok(!url.href.includes(KEY));
    const table = url.pathname.replace("/rest/v1/", "");
    calls.push({ table, parameters: Object.fromEntries(url.searchParams), range: options.headers.Range });
    let body;
    let contentRange;
    if (table === "rpc/literary_work_evidence_v2_content_sha256") {
      assert.deepEqual(Object.fromEntries(url.searchParams), { target_work_id: WORK_ID });
      hashReads += 1;
      body = HASH;
    } else {
      assert.ok(Object.hasOwn(data, table), `Unexpected table: ${table}`);
      assert.notEqual(url.searchParams.get("select"), "*");
      if (table === "literary_works") {
        assert.equal(url.searchParams.get("legacy_id"), `eq.${WELLS_LEGACY_ID}`);
      } else if (table === "literary_work_evidence_v2_controls") {
        assert.equal(url.searchParams.get("singleton"), "eq.true");
        assert.ok(!url.searchParams.get("select").includes("updated_by"));
      } else {
        assert.equal(url.searchParams.get("work_id"), `eq.${WORK_ID}`);
        assert.equal(url.searchParams.has("editorial_status"), false);
      }
      body = structuredClone(data[table]);
      if (options.headers.Range) {
        assert.equal(options.headers.Prefer, "count=exact");
        const [from, to] = options.headers.Range.split("-").map(Number);
        body = body.slice(from, to + 1);
        contentRange = body.length ? `${from}-${from + body.length - 1}/${data[table].length}` : `*/${data[table].length}`;
      }
      // A real PostgREST select returns only the requested columns.
      const selected = url.searchParams.get("select").split(",");
      body = body.map((row) => Object.fromEntries(selected.map((key) => [key, row[key]])));
    }
    const changed = changeResponse?.({ table, body, contentRange, hashReads, calls });
    return new Response(JSON.stringify(changed?.body ?? body), {
      status: 200,
      headers: contentRange ? { "content-range": changed?.contentRange ?? contentRange } : {},
    });
  };
  return { fetchImpl, calls };
}

test("reads only the fixed Wells scope, all child pages and exact evidence fields", async () => {
  const database = mockDatabase();
  const result = await inspectWellsEvidence({ ...OPTIONS, ...database, legacyId: "another:work" });
  assert.equal(result.workIdentity.legacyId, WELLS_LEGACY_ID);
  assert.equal(result.workIdentity.isCmsLocked, true);
  assert.equal(result.databaseContentSha256, HASH);
  assert.equal(result.attestationPerformed, false);
  assert.equal(result.content.work.description, "The preserved manual CMS description.");
  assert.deepEqual(result.content.work.metadata, { manual: true });
  assert.equal(result.content.translations[0].status, "draft");
  assert.deepEqual(result.content.translations[0].metadata.titleEvidence, { exact: true });
  assert.equal(result.content.sources.length, 101);
  assert.equal(result.content.sources.at(-1).metadata.index, 99); // SQL byte order: /99 sorts last.
  assert.equal(result.content.externalIds[0].value, "99002363");
  assert.equal(result.content.authors[0].position, 0);
  assert.equal(result.content.editions[0].coverUrl, null);
  assert.deepEqual(result.content.editions[0].metadata, { noCoverButStillIncluded: true });
  assert.deepEqual(result.content.artworks[0].provenance, { kind: "user-supplied" });
  assert.equal(result.controls.canon_registry_version, "canon-current");
  assert.equal(database.calls.filter(({ table }) => table.startsWith("rpc/")).length, 3);
  assert.deepEqual(database.calls.filter(({ table }) => table === "literary_work_sources").map(({ range }) => range), ["0-99", "100-199", "0-99", "100-199"]);
  assert.ok(!serializeWellsInspection(result, KEY).includes(KEY));
});

test("refuses a different work before reading any children", async () => {
  const data = fixture();
  data.literary_works[0].legacy_id = "england:h_g_wells:ann-veronica";
  const database = mockDatabase(data);
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...database }), /fixed Wells inspection scope/u);
  assert.equal(database.calls.length, 1);
});

test("refuses foreign child rows and foreign stored attestations", async () => {
  for (const table of ["literary_work_sources", "literary_work_evidence_v2_attestations"]) {
    const data = fixture();
    data[table] = [{ ...data.literary_work_sources[0], work_id: "unrelated-work" }];
    await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...mockDatabase(data) }), /escaped the fixed work scope/u);
  }
});

test("does not silently accept a truncated child page", async () => {
  const database = mockDatabase(fixture(), ({ table, contentRange }) => table === "literary_work_sources" && contentRange?.startsWith("100-") ? { body: [], contentRange: "*/101" } : undefined);
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...database }), /stopped at 100 of 101/u);
});

test("rejects a changed content hash", async () => {
  const database = mockDatabase(fixture(), ({ table, hashReads }) => table.startsWith("rpc/") && hashReads > 1 ? { body: "e".repeat(64) } : undefined);
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...database }), /Evidence changed during inspection/u);
});

test("rejects changed related rows even if a hash response is stale", async () => {
  let reads = 0;
  const database = mockDatabase(fixture(), ({ table, body }) => {
    if (table === "literary_work_translations" && ++reads === 2) {
      body[0].metadata = { changedDuringRead: true };
      return { body };
    }
  });
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...database }), /Evidence changed during inspection/u);
});

test("rejects a changed validator identity during inspection", async () => {
  let reads = 0;
  const database = mockDatabase(fixture(), ({ table, body }) => {
    if (table === "literary_work_evidence_v2_controls" && ++reads === 2) {
      body[0].validator_sha256 = "f".repeat(64);
      return { body };
    }
  });
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...database }), /Evidence changed during inspection/u);
});

test("never returns credential-bearing metadata or raw network errors", async () => {
  for (const metadata of [{ note: KEY }, { access_token: "accidentally-stored-token" }]) {
    const data = fixture();
    data.literary_works[0].metadata = metadata;
    await assert.rejects(inspectWellsEvidence({ ...OPTIONS, ...mockDatabase(data) }), /Credential-shaped data/u);
  }
  await assert.rejects(
    inspectWellsEvidence({ ...OPTIONS, fetchImpl: async () => { throw new Error(`private request ${KEY}`); } }),
    (error) => !error.message.includes(KEY) && error.message.includes("bounded read failed")
  );
});

test("refuses unsafe origins and invalid commit IDs before sending credentials", async () => {
  const fetchImpl = async () => assert.fail("No network request is permitted");
  for (const supabaseUrl of ["http://test-project.supabase.co", "https://test-project.supabase.co.evil.invalid", "https://user:pass@test-project.supabase.co", "https://test-project.supabase.co/path"]) {
    await assert.rejects(inspectWellsEvidence({ ...OPTIONS, supabaseUrl, fetchImpl }), /HTTPS origin/u);
  }
  await assert.rejects(inspectWellsEvidence({ ...OPTIONS, expectedMainSha: "main", fetchImpl }), /exact main SHA/u);
});

test("manual main-only workflow has no mutation tools or broad artifact uploads", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/inspect-wells-evidence.yml", import.meta.url), "utf8");
  const script = await readFile(new URL("../inspect-wells-evidence.mjs", import.meta.url), "utf8");
  assert.match(workflow, /on:\n  workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /pull_request:|push:|schedule:|workflow_run:|always\(\)|write-all|contents: write/u);
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /environment:\n      name: production/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/u);
  assert.match(workflow, /git rev-parse HEAD/u);
  assert.match(workflow, /git\/ref\/heads\/main/u);
  assert.match(workflow, /sha256sum --check SHA256SUMS/u);
  const uploadPaths = workflow.split("          path: |\n")[1].split("          if-no-files-found:")[0].trim().split("\n").map((line) => line.trim());
  assert.deepEqual(uploadPaths, ["reconciliation/wells-evidence-inspection/wells-evidence.json", "reconciliation/wells-evidence-inspection/SHA256SUMS"]);
  assert.doesNotMatch(`${workflow}\n${script}`, /loadEnvFile|dotenv|SUPABASE_DB_URL|pg_dump|psql|sync-literary-archive|attest_literary_work_evidence_v2|method: ["'](?:POST|PUT|PATCH|DELETE)["']/u);
  assert.match(script, /method: "GET"/u);
  assert.match(script, /AbortSignal.timeout\(15_000\)/u);
  assert.match(script, /AbortSignal.timeout\(120_000\)/u);
});

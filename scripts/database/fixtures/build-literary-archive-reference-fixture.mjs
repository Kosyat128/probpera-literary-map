import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalLiteraryArchiveReleasePayload, encodeLiteraryArchiveReleaseItem } from "../../lib/literary-archive-atomic-release.mjs";
import { buildEvidenceV2ReviewedWriterReference, buildEvidenceV2DraftWriterReference } from "../../lib/book-evidence-v2-registry-rotation.mjs";
import { buildWellsEditorialRepairFixture } from "./build-wells-editorial-repair-fixture.mjs";

const root = new URL("../../../", import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8").replace(/\r\n?/gu, "\n");
export const referenceMigration = read("supabase/migrations/20260914_literary_archive_editorial_references.sql");
const rotation = read("supabase/migrations/20260912_literary_work_evidence_v2_registry_rotation.sql");
const wells = read("supabase/migrations/20260913_wells_editorial_evidence_repair.sql");
const artifact = JSON.parse(read("reports/literary-archive-reference-catalog-20260914.json"));
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = value => `${literal(JSON.stringify(value))}::jsonb`;
const envelope = { contract: artifact.contract, payloadSha256: artifact.payloadSha256,
  payloadText: canonicalLiteraryArchiveReleasePayload(artifact.payload) };
const primary = artifact.payload.writers[0];
const linked = artifact.payload.writers.find(row => row.countryId !== primary.countryId && row.countryId !== "usa");
const unused = artifact.payload.writers.find(row => ![primary.countryId,linked.countryId,"usa"].includes(row.countryId));
assert.ok(primary && linked && unused);
const item = (key, countryId, writerId, extra = {}) => ({ legacyId: key,
  work: { legacy_id: key, country_id: countryId, writer_id: writerId, editorial_status: "draft", first_published: 1868 },
  authors: [], expectedContent: { work: { legacyId: key } }, attestation: null, ...extra });
const reviewed = item("usa:harriet_beecher_stowe:uncle-toms-cabin", "usa", "harriet_beecher_stowe", {
  attestation: { evidence: { recordKey: "usa:harriet_beecher_stowe:uncle-toms-cabin", validation: {
    status: "passed", issues: [], validatorSha256: "f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026",
    canonRegistrySha256: "c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c" } } } });
const draft = item("usa:louisa_may_alcott:little-women", "usa", "louisa_may_alcott");
const ordinary = item(`${primary.countryId}:${primary.id}:fixture-reference`, primary.countryId, primary.id, {
  authors: [{ writer_country_id: linked.countryId, writer_id: linked.id, attribution_status: "disputed" },
    { writer_country_id: null, writer_id: null, credit_name_ru: "Unlinked fixture credit", attribution_status: "attributed" }] });
const items = [reviewed, draft, ordinary].map((value,ordinal)=>({...value,ordinal}));
const metadata = { referenceCatalog: envelope,
  reviewedWriterReference: buildEvidenceV2ReviewedWriterReference(items),
  draftWriterReference: buildEvidenceV2DraftWriterReference(items) };
const itemInserts = items.map(value => {
  const encoded = encodeLiteraryArchiveReleaseItem(value);
  return `insert into public.fixture_items values(${literal(value.legacyId)},${literal(encoded.canonicalPayload)},${sqlJson(value)},${literal(encoded.payloadSha256)});`;
}).join("\n");

export function buildLiteraryArchiveReferenceFixture({ fullScale = false } = {}) {
  // Reuse the real historical attester/storage harness so replaying migration37
  // exercises its actual anchored patch, rather than a synthetic stand-in.
  const prelude = buildWellsEditorialRepairFixture().split("create table public.fixture_attester_identity")[0];
  const fixture = read("scripts/database/fixtures/literary-archive-editorial-references.sql")
    .replace("-- __STORAGE_AND_REAL_ATTESTER__", () => prelude)
    .replaceAll("-- __REPLAY_36_37_38__", () => `${rotation}\n${wells}\n${referenceMigration}`)
    .replace("-- __INSTALLER_SOURCE__", () => `insert into public.fixture_installer values(${literal(referenceMigration.slice(referenceMigration.indexOf("do $literary_archive_editorial_reference_hook_20260914$")))});`)
    .replace("-- __REFERENCE_CATALOG_FIXTURE__", () => `insert into public.fixture_metadata values(${sqlJson(metadata)});\n${itemInserts}`)
    .replaceAll("__PRIMARY_COUNTRY__", () => primary.countryId)
    .replaceAll("__PRIMARY_WRITER__", () => primary.id)
    .replaceAll("__LINKED_COUNTRY__", () => linked.countryId)
    .replaceAll("__LINKED_WRITER__", () => linked.id)
    .replaceAll("__UNUSED_COUNTRY__", () => unused.countryId)
    .replaceAll("__UNUSED_WRITER__", () => unused.id);
  return fixture.replace("-- __OPTIONAL_FULL_SCALE__", () => fullScale ? `
select public.fixture_reset_references();
delete from public.literary_archive_release_items;
update public.literary_archive_releases set expected_item_count=9762,
  metadata=jsonb_build_object('referenceCatalog',(select value -> 'referenceCatalog' from public.fixture_metadata));
with catalog as materialized (select (value #>> '{referenceCatalog,payloadText}')::jsonb as data from public.fixture_metadata),
writers as materialized (select writer,ordinality from catalog
  cross join lateral jsonb_array_elements(data -> 'writers') with ordinality entry(writer,ordinality)),
items as (
  select 'fixture:scale:' || n as legacy_id, jsonb_build_object('work',jsonb_build_object(
    'country_id',writer ->> 'countryId','writer_id',writer ->> 'id'), 'authors','[]'::jsonb,
    'fixturePadding',repeat('x',3000)) as payload
  from generate_series(1,9762) n join writers on ordinality=((n-1) % 1681)+1
)
insert into public.literary_archive_release_items
select '00000000-0000-4000-8000-000000000001',legacy_id,payload,payload::text,
  public.literary_work_evidence_v2_sha256(payload::text) from items;
select set_config('probpera.literary_archive_atomic_release','on',true);
create table public.fixture_scale_timing(started_at timestamptz,elapsed_ms numeric);
insert into public.fixture_scale_timing(started_at) values(clock_timestamp());
select public.prepare_literary_archive_editorial_references_20260914('00000000-0000-4000-8000-000000000001');
update public.fixture_scale_timing set elapsed_ms=extract(epoch from clock_timestamp()-started_at)*1000;
select public.fixture_assert((select count(*) from public.editorial_countries)=191,'full-scale191 required countries');
select public.fixture_assert((select count(*) from public.editorial_writers)=1679,'full-scale1681 writers minus2 reserved proof helpers');
select jsonb_build_object('fullScaleItems',9762,'countries',191,'writerTuples',1681,
  'insertedWriters',1679,'initializerMilliseconds',elapsed_ms)::text as scale_receipt from public.fixture_scale_timing;
` : "");
}

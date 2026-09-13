import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLiteraryArchiveReferenceMetadata, deriveEditorialReferencePayload,
  referenceItemsFromArchive, requiredEditorialReferences, referenceCatalogSha256,
  LITERARY_ARCHIVE_REFERENCE_ARTIFACT, LITERARY_ARCHIVE_REFERENCE_ARTIFACT_SHA256,
  LITERARY_ARCHIVE_REFERENCE_PAYLOAD_SHA256,
} from "./literary-archive-reference-catalog.mjs";
import { canonicalLiteraryArchiveReleasePayload } from "./literary-archive-atomic-release.mjs";

const read = file => readFileSync(file, "utf8").replace(/\r\n?/gu, "\n");
const artifact = JSON.parse(read(LITERARY_ARCHIVE_REFERENCE_ARTIFACT));
const item = (countryId = "usa", id = "jack_london", authors = []) => ({ work: { country_id: countryId, writer_id: id }, authors });
const writer = (id, label) => ({ id, label, fields: { fullName: "", biography: "private biography", status: "verified" } });
const country = (id, writers) => ({ id, label: id, fields: { code: "us", history: "private history" }, writers });

describe("fixed staged-target editorial references", () => {
  it("pins only structural fields and preserves the two reserved proof-owned writer identities", () => {
    expect(referenceCatalogSha256(read(LITERARY_ARCHIVE_REFERENCE_ARTIFACT))).toBe(LITERARY_ARCHIVE_REFERENCE_ARTIFACT_SHA256);
    expect(artifact.target).toMatchObject({ works: 9763, countries: 191, writers: 1681, linkedAuthorRows: 2 });
    expect(artifact.fallbackWriters).toHaveLength(47);
    expect(artifact.sourceFiles).toHaveLength(288);
    expect(Object.keys(artifact.payload).sort()).toEqual(["countries", "writers"]);
    for (const row of artifact.payload.countries) expect(Object.keys(row).sort()).toEqual(["id", "isoCode", "nameEn", "nameRu"]);
    for (const row of artifact.payload.writers) expect(Object.keys(row).sort()).toEqual(["countryId", "id", "nameEn", "nameRu"]);
    for (const id of ["harriet_beecher_stowe", "louisa_may_alcott"])
      expect(artifact.payload.writers.find(row => row.countryId === "usa" && row.id === id).nameEn).toBe("");
    const metadata = buildLiteraryArchiveReferenceMetadata([item()], artifact);
    expect(referenceCatalogSha256(metadata.payloadText)).toBe(LITERARY_ARCHIVE_REFERENCE_PAYLOAD_SHA256);
    expect(JSON.parse(metadata.payloadText)).toEqual(artifact.payload);
  });

  it("requires both primary and linked-author tuples but excludes collective name-only credits", () => {
    const authors = [
      { writer_country_id: "canada", writer_id: "margaret_atwood" },
      { writer_country_id: null, writer_id: null, credit_name_ru: "Collective" },
    ];
    expect(requiredEditorialReferences([item("usa", "jack_london", authors), item()])).toEqual({
      countries: ["canada", "usa"],
      writers: [{ countryId: "canada", id: "margaret_atwood" }, { countryId: "usa", id: "jack_london" }],
    });
  });

  it.each([
    { writer_country_id: null, writer_id: "writer" },
    { writer_country_id: "usa", writer_id: null },
    { writer_country_id: "usa", writer_id: "unknown:injected" },
  ])("rejects partial or malformed linked-author reference %j", author => {
    expect(() => requiredEditorialReferences([item("usa", "jack_london", [author])])).toThrow("Invalid required editorial reference tuple");
  });

  it("uses the same author fallback and normalization as actual archive transport", () => {
    const archive = [{ countryId: "usa", writerId: "jack_london", id: "sample", authorship: {
      kind: "multiple", authors: [{ writerId: "jack_london" }, { countryId: "canada", writerId: "margaret_atwood" }],
    } }];
    const result = requiredEditorialReferences(referenceItemsFromArchive(archive));
    expect(result.writers).toEqual([{ countryId: "canada", id: "margaret_atwood" }, { countryId: "usa", id: "jack_london" }]);
    expect(() => referenceItemsFromArchive([...archive, ...archive])).toThrow("Duplicate archive work identity");
  });

  it("derives only needed labels and ignores biography changes or unused writers", () => {
    const catalog = { countries: [country("usa", [writer("jack_london", "Джек Лондон"), writer("unused", "Unused")])] };
    const args = { catalog, fallbackCatalog: { countries: [] }, items: [item()] };
    const first = deriveEditorialReferencePayload(args);
    expect(first.payload).toEqual({ countries: [{ id: "usa", nameRu: "usa", nameEn: "", isoCode: "US" }],
      writers: [{ countryId: "usa", id: "jack_london", nameRu: "Джек Лондон", nameEn: "" }] });
    catalog.countries[0].writers[0].fields.biography = "different private biography";
    expect(deriveEditorialReferencePayload(args)).toEqual(first);
  });

  it("records an exact required archive fallback without guessing absent names", () => {
    const args = { catalog: { countries: [country("usa", [])] },
      fallbackCatalog: { countries: [country("usa", [writer("jack_london", "Джек Лондон")])] }, items: [item()] };
    expect(deriveEditorialReferencePayload(args).fallbackWriters).toEqual([{ countryId: "usa", id: "jack_london", sourceKind: "archive-fallback" }]);
    args.fallbackCatalog.countries[0].writers[0].label = "";
    expect(() => deriveEditorialReferencePayload(args)).toThrow("Missing or invalid canonical reference name");
    args.fallbackCatalog.countries[0].writers = [];
    expect(() => deriveEditorialReferencePayload(args)).toThrow("Required writer is absent");
  });

  it.each(["name", "addition", "status", "removal"])("rejects artifact %s tampering even with a recomputed claimed checksum", kind => {
    const changed = structuredClone(artifact);
    if (kind === "name") changed.payload.writers[0].nameRu = "Substituted name";
    if (kind === "addition") changed.payload.writers.push({ countryId: "usa", id: "injected", nameRu: "Injected", nameEn: "" });
    if (kind === "status") changed.payload.writers[0].status = "verified";
    if (kind === "removal") changed.payload.writers.pop();
    changed.payloadSha256 = referenceCatalogSha256(canonicalLiteraryArchiveReleasePayload(changed.payload));
    expect(() => buildLiteraryArchiveReferenceMetadata([item()], changed)).toThrow("checksum");
  });

  it("rejects unknown staged primary and linked identities before private staging", () => {
    expect(() => buildLiteraryArchiveReferenceMetadata([item("usa", "injected")], artifact)).toThrow("Unapproved staged reference writer");
    expect(() => buildLiteraryArchiveReferenceMetadata([item("usa", "jack_london", [{ writer_country_id: "usa", writer_id: "injected" }])], artifact)).toThrow("Unapproved staged reference writer");
    expect(() => buildLiteraryArchiveReferenceMetadata([item("injected_country", "writer")], artifact)).toThrow("Unapproved staged reference country");
  });

  it("reproduces the fixed identity projection from the current checked-in full catalogue", () => {
    const check = spawnSync(process.execPath, ["scripts/build-literary-archive-reference-catalog.mjs", "--check"], {
      encoding: "utf8", windowsHide: true, timeout: 30000,
    });
    expect(check.status, check.stderr || check.stdout).toBe(0);
  }, 35000);

  it("binds the fixed reference metadata into the existing source revision and atomic request", () => {
    const source = read("scripts/sync-literary-archive.mjs");
    expect(source).toContain("buildLiteraryArchiveReferenceMetadata(referenceItemsFromArchive(syncArchive), referenceCatalogArtifact)");
    expect(source).toContain("const referenceCatalog = buildLiteraryArchiveReferenceMetadata(releaseItems, referenceCatalogArtifact);");
    expect(source).toContain("    canonicalLiteraryArchiveReleasePayload(referenceCatalog),");
    expect(source).toContain("  referenceCatalog,\n};");
    expect(source).toContain("buildEvidenceV2ReviewedWriterReference(releaseItems)");
    expect(source).toContain("buildEvidenceV2DraftWriterReference(releaseItems)");
  });
});

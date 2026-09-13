import { createHash } from "node:crypto";
import { authorshipRowsFromArchive } from "./book-authorship-roundtrip.mjs";
import { canonicalLiteraryArchiveReleasePayload } from "./literary-archive-atomic-release.mjs";

export const LITERARY_ARCHIVE_REFERENCE_CONTRACT = "literary-archive-reference-catalog-20260914";
export const LITERARY_ARCHIVE_REFERENCE_ARTIFACT = "reports/literary-archive-reference-catalog-20260914.json";
export const LITERARY_ARCHIVE_REFERENCE_PAYLOAD_SHA256 = "df634b2a54d67df1fbd46b5cda33ddff926a337630bb6246290ff06e33b25c0b";
export const LITERARY_ARCHIVE_REFERENCE_ARTIFACT_SHA256 = "306cfdd28dda66130b3ee2c95bc1abf9821e50a938379cc9065aa69a2244be53";

export const referenceCatalogSha256 = value => createHash("sha256").update(value, "utf8").digest("hex");
const text = value => typeof value === "string" ? value.trim() : "";
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const tupleKey = (countryId, id) => `${countryId}:${id}`;

function exactTuple(countryId, id) {
  if (typeof countryId !== "string" || !/^[a-z0-9][a-z0-9_-]{1,119}$/u.test(countryId) ||
      typeof id !== "string" || id.length < 2 || id.length > 180 || /[\s\p{Cc}/:]/u.test(id)) {
    throw new Error(`Invalid required editorial reference tuple: ${String(countryId)}:${String(id)}`);
  }
  return { countryId, id };
}

export function requiredEditorialReferences(items) {
  const tuples = new Map();
  const add = (countryId, id) => {
    const tuple = exactTuple(countryId, id);
    tuples.set(tupleKey(countryId, id), tuple);
  };
  for (const item of items) {
    add(item.work?.country_id, item.work?.writer_id);
    for (const author of item.authors || []) {
      if (author.writer_country_id == null && author.writer_id == null) continue;
      add(author.writer_country_id, author.writer_id);
    }
  }
  const writers = [...tuples.values()].sort((a, b) => compare(tupleKey(a.countryId, a.id), tupleKey(b.countryId, b.id)));
  return { countries: [...new Set(writers.map(writer => writer.countryId))].sort(compare), writers };
}

export function referenceItemsFromArchive(archive) {
  const workIds = new Map(archive.map(book => {
    const key = [book.countryId, book.writerId, book.id].join(":");
    return [key, key];
  }));
  if (workIds.size !== archive.length) throw new Error("Duplicate archive work identity in reference target");
  const authors = new Map();
  for (const row of authorshipRowsFromArchive(archive, workIds)) {
    if (!authors.has(row.work_id)) authors.set(row.work_id, []);
    authors.get(row.work_id).push(row);
  }
  return archive.map(book => {
    const legacyId = [book.countryId, book.writerId, book.id].join(":");
    return { legacyId, work: { country_id: book.countryId, writer_id: book.writerId }, authors: authors.get(legacyId) || [] };
  });
}

function catalogIndex(catalog) {
  const countries = new Map();
  const writers = new Map();
  for (const country of catalog.countries) {
    if (countries.has(country.id)) throw new Error(`Duplicate reference country: ${country.id}`);
    countries.set(country.id, country);
    for (const writer of country.writers) {
      const key = tupleKey(country.id, writer.id);
      if (writers.has(key)) throw new Error(`Duplicate reference writer: ${key}`);
      writers.set(key, writer);
    }
  }
  return { countries, writers };
}

function name(value, max, label, required = false) {
  const result = text(value);
  if ((required && !result) || result.length > max) throw new Error(`Missing or invalid canonical reference name: ${label}`);
  return result;
}

/** Exact existing Data Studio field mapping, with explicitly recorded archive-only identities. */
export function deriveEditorialReferencePayload({ catalog, fallbackCatalog, items }) {
  const required = requiredEditorialReferences(items);
  const primary = catalogIndex(catalog);
  const fallback = catalogIndex(fallbackCatalog);
  const fallbackWriters = [];
  const countries = required.countries.map(id => {
    const country = primary.countries.get(id);
    if (!country) throw new Error(`Required country is absent from the canonical catalog: ${id}`);
    const isoCode = text(country.fields.code).toUpperCase();
    if (isoCode && !/^[A-Z]{2,3}$/u.test(isoCode)) throw new Error(`Invalid canonical country code: ${id}`);
    return { id, nameRu: name(country.label, 240, id, true), nameEn: name(country.fields.nameEn, 240, id), isoCode };
  });
  const writers = required.writers.map(({ countryId, id }) => {
    const key = tupleKey(countryId, id);
    let writer = primary.writers.get(key);
    if (!writer) {
      writer = fallback.writers.get(key);
      if (!writer) throw new Error(`Required writer is absent from the canonical archive: ${key}`);
      fallbackWriters.push({ countryId, id, sourceKind: "archive-fallback" });
    }
    return { countryId, id, nameRu: name(writer.label, 300, key, true), nameEn: name(writer.fields.fullName, 300, key) };
  });
  return { payload: { countries, writers }, fallbackWriters };
}

/** The caller cannot replace the approved artifact or expand the staged identity allowlist. */
export function buildLiteraryArchiveReferenceMetadata(items, artifact) {
  if (artifact?.contract !== LITERARY_ARCHIVE_REFERENCE_CONTRACT) throw new Error("Unknown editorial reference artifact contract");
  const payloadText = canonicalLiteraryArchiveReleasePayload(artifact.payload);
  const payloadSha256 = referenceCatalogSha256(payloadText);
  if (artifact.payloadSha256 !== LITERARY_ARCHIVE_REFERENCE_PAYLOAD_SHA256 || payloadSha256 !== LITERARY_ARCHIVE_REFERENCE_PAYLOAD_SHA256) {
    throw new Error("Editorial reference artifact checksum does not match the fixed release");
  }
  const countries = new Set(artifact.payload.countries.map(country => country.id));
  const writers = new Set(artifact.payload.writers.map(writer => tupleKey(writer.countryId, writer.id)));
  const required = requiredEditorialReferences(items);
  for (const countryId of required.countries) if (!countries.has(countryId)) throw new Error(`Unapproved staged reference country: ${countryId}`);
  for (const { countryId, id } of required.writers) if (!writers.has(tupleKey(countryId, id))) throw new Error(`Unapproved staged reference writer: ${countryId}:${id}`);
  return { contract: LITERARY_ARCHIVE_REFERENCE_CONTRACT, payloadSha256, payloadText };
}

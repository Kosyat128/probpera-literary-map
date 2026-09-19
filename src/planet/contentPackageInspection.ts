import { compareContentCandidates, validContentUnitIdentity, type ContentDependencyChange } from "./contentDependencies";
import { contentRecordHash, contentUnitId } from "./contentExportHash";
import type { ContentCandidateSnapshot, ContentCandidateUnit, ContentEntityRef, ContentLocale } from "./contentExportTypes";
import type { ContentPackageReadRequest, ContentPackageReadResult } from "./contentPackageCache";
import { CONTENT_PACKAGE_MAX_FILE_BYTES, contentPackageCanonicalJson, contentPackageFileInventory, contentPackageHash,
  inspectContentPackageEnvelope, normalizeContentPackageExpected, type ContentPackageBytes } from "./contentPackageProtocol.mjs";

const PATHS = ["dependency-index.json", "en/catalog.json", "ru/catalog.json"];
const HASH = /^[a-f0-9]{64}$/u, COMMIT = /^[a-f0-9]{40}$/u;
type StagedUnit = Readonly<Omit<ContentCandidateUnit, "entityRef" | "dependencyIds"> & {
  entityRef: Readonly<ContentEntityRef>; dependencyIds: readonly string[];
}>;
export type ContentInspectionDiagnostic = Readonly<
  { kind: "missing-locale-counterpart"; unitId: string; missingLocale: ContentLocale }
  | { kind: "excluded-stale-unit" | "removed-unit"; unitId: string }>;
export interface StagedContentInspection {
  readonly schemaVersion: 1;
  readonly contract: "literary-planet-staged-content-inspection-v1";
  readonly namespace: "adult";
  readonly packageId: string; readonly version: number; readonly sourceCommit: string;
  readonly manifestSha256: string; readonly selectionSha256: string; readonly selectedCurrentManifestSha256: string;
  readonly selectionRole: "current" | "rollback";
  /** Signed metadata for the FULL candidate, before stale units were excluded.
   * The downloaded subset cannot independently reproduce this hash. */
  readonly fullCandidateHash: string;
  readonly deliveredUnitsHash: string;
  readonly units: readonly StagedUnit[];
  readonly diagnostics: readonly ContentInspectionDiagnostic[];
  readonly activationAllowed: false; readonly releaseReady: false;
}
export type ContentPackageInspectionResult = Readonly<{ ok: true; view: StagedContentInspection; activationAllowed: false }
  | { ok: false; reason: string; activationAllowed: false }>;
class InspectionError extends Error {}
function fail(code: string): never { throw new InspectionError(code); }
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) fail("cancelled"); };
function exact(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(code);
}
function identity(id: unknown): Pick<ContentCandidateUnit, "id" | "entityRef" | "field" | "locale"> {
  if (typeof id !== "string" || !id || id.length > 1000) return fail("invalid-dependency-index");
  let parts: unknown;
  try { parts = JSON.parse(id); } catch { return fail("invalid-dependency-index"); }
  if (!Array.isArray(parts) || parts.length !== 6) return fail("invalid-dependency-index");
  const [kind, countryId, writerId, workId, field, locale] = parts;
  const entityRef = (kind === "country" ? { kind, countryId } : kind === "writer" ? { kind, countryId, writerId }
    : { kind, countryId, writerId, workId }) as ContentEntityRef;
  const value = { id, entityRef, field, locale } as Pick<ContentCandidateUnit, "id" | "entityRef" | "field" | "locale">;
  if (!validContentUnitIdentity(value)) return fail("invalid-dependency-index");
  return value;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200_000 || new Set(value).size !== value.length) return fail("invalid-dependency-index");
  for (const id of value) identity(id);
  return value as string[];
}
function dependencies(value: unknown, sourceCommit: string): ContentDependencyChange {
  exact(value, ["schemaVersion", "contract", "sourceCommit", "previousSourceCommit", "currentCandidateHash", "previousCandidateHash",
    "addedUnitIds", "changedUnitIds", "removedUnitIds", "staleUnitIds", "tombstones", "invalidatedOutputs", "releaseReady"], "invalid-dependency-index");
  if (value.schemaVersion !== 1 || value.contract !== "literary-planet-content-dependencies-v1" || value.sourceCommit !== sourceCommit
    || value.releaseReady !== false || typeof value.currentCandidateHash !== "string" || !HASH.test(value.currentCandidateHash)
    || !(value.previousSourceCommit === null && value.previousCandidateHash === null)
      && !(typeof value.previousSourceCommit === "string" && COMMIT.test(value.previousSourceCommit)
        && typeof value.previousCandidateHash === "string" && HASH.test(value.previousCandidateHash))) fail("invalid-dependency-index");
  const added = ids(value.addedUnitIds), changed = ids(value.changedUnitIds), removed = ids(value.removedUnitIds), stale = ids(value.staleUnitIds);
  const changedSet = new Set(changed), removedSet = new Set(removed);
  if (added.some(id => changedSet.has(id) || removedSet.has(id)) || changed.some(id => removedSet.has(id))
    || stale.some(id => removedSet.has(id)) || (value.previousSourceCommit === null && (changed.length || removed.length))) fail("invalid-dependency-index");
  if (!Array.isArray(value.tombstones) || value.tombstones.length !== removed.length) fail("invalid-dependency-index");
  const tombstones = new Set<string>();
  for (const tombstone of value.tombstones) {
    exact(tombstone, ["id", "entityRef", "field", "locale"], "invalid-dependency-index");
    const unit = tombstone as Pick<ContentCandidateUnit, "id" | "entityRef" | "field" | "locale">;
    if (!validContentUnitIdentity(unit) || !removedSet.has(unit.id) || tombstones.has(unit.id)) fail("invalid-dependency-index");
    tombstones.add(unit.id);
  }
  const affected = [...new Set([...added, ...changed, ...removed, ...stale])];
  const expectedOutputs = ["ru", "en"].flatMap(locale => {
    const reasonUnitIds = affected.filter(id => identity(id).locale === locale).sort();
    return reasonUnitIds.length ? ["search", "package"].map(kind => ({ kind, locale, reasonUnitIds })) : [];
  });
  if (!Array.isArray(value.invalidatedOutputs) || value.invalidatedOutputs.length !== expectedOutputs.length) fail("invalid-dependency-index");
  const outputs = value.invalidatedOutputs.map(output => {
    exact(output, ["kind", "locale", "reasonUnitIds"], "invalid-dependency-index");
    if (!["search", "package"].includes(output.kind as string) || !["ru", "en"].includes(output.locale as string)) fail("invalid-dependency-index");
    return { kind: output.kind, locale: output.locale, reasonUnitIds: [...ids(output.reasonUnitIds)].sort() };
  });
  const ordered = (entries: typeof outputs) => [...entries].sort((a, b) => `${a.locale}:${a.kind}`.localeCompare(`${b.locale}:${b.kind}`));
  if (contentRecordHash(ordered(outputs)) !== contentRecordHash(ordered(expectedOutputs))) fail("invalid-dependency-index");
  return value as unknown as ContentDependencyChange;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function snapshotBytes(value: ContentPackageBytes["bytes"]): Uint8Array {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) return fail("package-file-inventory-mismatch");
  if (!value.length || value.length > CONTENT_PACKAGE_MAX_FILE_BYTES) return fail("package-file-inventory-mismatch");
  if (typeof value !== "string") return new Uint8Array(value);
  // Bound UTF8 bytes before allocating their copy, including surrogate pairs
  // and the replacement bytes TextEncoder produces for lone surrogates.
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    length += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (length > CONTENT_PACKAGE_MAX_FILE_BYTES) return fail("package-file-inventory-mismatch");
  }
  return new TextEncoder().encode(value);
}

/** Inspect only a trusted cache.read capability: that boundary authenticates the
 * application-pinned signature. Recheck its detached bytes and semantic format;
 * this returns a point-in-time staged view, never a catalog/activation handle. */
export async function inspectContentPackage(input: {
  readonly cache: { read(request: ContentPackageReadRequest): Promise<ContentPackageReadResult> };
  readonly expected: ContentPackageReadRequest["expected"];
  readonly manifestSha256: string;
  readonly selectionSha256: string;
  readonly signal?: AbortSignal;
}): Promise<ContentPackageInspectionResult> {
  try {
    const signal = input.signal, pin = input.manifestSha256, selectionPin = input.selectionSha256;
    cancelled(signal);
    let expected: ContentPackageReadRequest["expected"];
    try { expected = normalizeContentPackageExpected(input.expected); } catch { return fail("invalid-inspection-context"); }
    if (expected.namespace !== "adult" || expected.childPolicy !== null) fail("adult-content-inspection-required");
    if (!HASH.test(pin) || !HASH.test(selectionPin)) fail("invalid-inspection-context");
    const read = await input.cache.read({ expected, manifestSha256: pin, signal });
    cancelled(signal);
    if (!read?.ok || read.activationAllowed !== false || read.releaseReady !== false) fail("content-read-rejected");
    if (read.manifestSha256 !== pin) fail("manifest-pin-mismatch");
    if (read.selectionSha256 !== selectionPin || !HASH.test(read.selectedCurrentManifestSha256)) fail("selection-receipt-mismatch");
    const selectedCurrentManifestSha256 = read.selectedCurrentManifestSha256;
    const envelope = JSON.parse(contentPackageCanonicalJson(read.envelope));
    const { manifest } = inspectContentPackageEnvelope(envelope, expected);
    if (contentPackageHash(contentPackageCanonicalJson(manifest)) !== pin) fail("manifest-pin-mismatch");
    if (!Array.isArray(read.files) || read.files.length !== 3 || read.files.map(file => file.path).sort().join(",") !== PATHS.join(",")
      || manifest.files.map(file => file.path).sort().join(",") !== PATHS.join(",")) fail("package-file-inventory-mismatch");
    const files: ContentPackageBytes[] = read.files.map(file => ({ path: file.path, bytes: snapshotBytes(file.bytes) }));
    // The protocol inventory already rejects malformed UTF8, duplicate/escaped
    // keys, executable data and overlarge structures. Reuse its strict decoder.
    try {
      const inventory = contentPackageFileInventory(files, manifest);
      if (contentPackageCanonicalJson(inventory) !== contentPackageCanonicalJson(manifest.files)) fail("package-file-inventory-mismatch");
    } catch { return fail("invalid-content-bytes"); }
    const parsed = new Map(files.map(file => [file.path, JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes as Uint8Array)) as unknown]));
    const units: ContentCandidateUnit[] = [];
    for (const locale of ["ru", "en"] as const) {
      const catalog = parsed.get(`${locale}/catalog.json`);
      exact(catalog, ["schemaVersion", "contract", "sourceCommit", "namespace", "locale", "units", "releaseReady"], "invalid-catalog-header");
      if (catalog.schemaVersion !== 1 || catalog.contract !== "literary-planet-content-candidate-v1" || catalog.sourceCommit !== expected.sourceCommit
        || catalog.namespace !== "adult" || catalog.locale !== locale || catalog.releaseReady !== false || !Array.isArray(catalog.units)) fail("invalid-catalog-header");
      for (const unit of catalog.units) {
        exact(unit, ["id", "entityRef", "field", "locale", "text", "contentHash", "observedRuSourceHash", "reviewedRuSourceHash",
          "sourceHashContract", "dependencyIds", "publicationBasis", ...["observedTargetHash", "reviewTargetHash"].filter(key => Object.prototype.hasOwnProperty.call(unit ?? {}, key))], "invalid-content-unit");
        if (unit.locale !== locale) fail("invalid-content-unit");
        units.push(unit as unknown as ContentCandidateUnit);
      }
    }
    const snapshot: ContentCandidateSnapshot = { schemaVersion: 1, contract: "literary-planet-content-candidate-v1", namespace: "adult",
      sourceCommit: expected.sourceCommit, requiredLocales: ["ru", "en"], units, held: [], releaseReady: false };
    let checked: ContentDependencyChange;
    try { checked = compareContentCandidates(null, snapshot); } catch { return fail("invalid-content-unit"); }
    if (checked.staleUnitIds.length) fail("content-dependency-inconsistent");
    const declared = dependencies(parsed.get("dependency-index.json"), expected.sourceCommit);
    const delivered = new Set(units.map(unit => unit.id)), stale = new Set(declared.staleUnitIds), removed = new Set(declared.removedUnitIds);
    if (units.some(unit => stale.has(unit.id))) fail("stale-content-unit-delivered");
    if (units.some(unit => removed.has(unit.id))) fail("removed-content-unit-delivered");
    if ([...declared.addedUnitIds, ...declared.changedUnitIds].some(id => !delivered.has(id) && !stale.has(id))) fail("content-dependency-inconsistent");
    if (declared.previousSourceCommit === null) {
      const initialIds = new Set([...delivered, ...stale]);
      if (declared.addedUnitIds.length !== initialIds.size || declared.addedUnitIds.some(id => !initialIds.has(id))) fail("content-dependency-inconsistent");
    }
    const orderedUnits = units.map(unit => ({ ...unit, entityRef: { ...unit.entityRef }, dependencyIds: [...unit.dependencyIds].sort() }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const diagnostics: ContentInspectionDiagnostic[] = [];
    for (const unit of orderedUnits) {
      const missingLocale = unit.locale === "ru" ? "en" : "ru";
      if (!delivered.has(contentUnitId(unit.entityRef, unit.field, missingLocale))) diagnostics.push({ kind: "missing-locale-counterpart", unitId: unit.id, missingLocale });
    }
    for (const unitId of [...stale].sort()) diagnostics.push({ kind: "excluded-stale-unit", unitId });
    for (const unitId of [...removed].sort()) diagnostics.push({ kind: "removed-unit", unitId });
    const deliveredUnitsHash = contentRecordHash({ contract: "literary-planet-delivered-content-units-v1", sourceCommit: expected.sourceCommit,
      namespace: "adult", requiredLocales: ["ru", "en"], units: orderedUnits });
    cancelled(signal);
    const view: StagedContentInspection = { schemaVersion: 1, contract: "literary-planet-staged-content-inspection-v1", namespace: "adult",
      packageId: expected.packageId, version: expected.version, sourceCommit: expected.sourceCommit, manifestSha256: pin,
      selectionSha256: selectionPin, selectedCurrentManifestSha256, selectionRole: pin === selectedCurrentManifestSha256 ? "current" : "rollback",
      fullCandidateHash: declared.currentCandidateHash, deliveredUnitsHash, units: orderedUnits, diagnostics, activationAllowed: false, releaseReady: false };
    return freeze({ ok: true as const, view, activationAllowed: false as const });
  } catch (error) {
    return Object.freeze({ ok: false, reason: input.signal?.aborted ? "cancelled" : error instanceof InspectionError ? error.message : "content-inspection-unavailable", activationAllowed: false });
  }
}

import { contentRecordHash, contentTextHash, contentUnitId } from "./contentExportHash";
import type { ContentCandidateSnapshot, ContentCandidateUnit, ContentEntityRef, ContentLocale } from "./contentExportTypes";

const locales: ContentLocale[] = ["ru", "en"];
const hashPattern = /^[a-f0-9]{64}$/u;
const bases = new Set(["canonical-name-candidate", "evidenced-title-candidate", "authored-public-prose", "reviewed-source-bound-prose"]);
const fields = { country: ["name"], writer: ["name", "biography"], work: ["title", "description"] };
const revision = (unit: ContentCandidateUnit) => contentRecordHash({ ...unit, dependencyIds: [...unit.dependencyIds].sort() });

function candidateUnitsHash(snapshot: ContentCandidateSnapshot, units: Map<string, ContentCandidateUnit>) {
  return contentRecordHash({ sourceCommit: snapshot.sourceCommit, contract: snapshot.contract,
    namespace: snapshot.namespace, requiredLocales: snapshot.requiredLocales,
    units: [...units.values()].map(unit => [unit.id, revision(unit)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0) });
}

function validEntity(entity: ContentEntityRef): boolean {
  if (!entity || typeof entity !== "object" || !Object.prototype.hasOwnProperty.call(fields, entity.kind)) return false;
  const names = entity.kind === "country" ? ["kind", "countryId"]
    : entity.kind === "writer" ? ["kind", "countryId", "writerId"] : ["kind", "countryId", "writerId", "workId"];
  return Object.keys(entity).sort().join(",") === names.sort().join(",") && Object.values(entity).every(value =>
    typeof value === "string" && value.length > 0 && value.length <= 256 && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
}

/** Shared identity validation for candidate units and package dependency IDs. */
export function validContentUnitIdentity(unit: Pick<ContentCandidateUnit, "id" | "entityRef" | "field" | "locale">): boolean {
  return Boolean(unit && validEntity(unit.entityRef) && locales.includes(unit.locale)
    && fields[unit.entityRef.kind].includes(unit.field) && unit.id === contentUnitId(unit.entityRef, unit.field, unit.locale));
}

function checkedUnits(snapshot: ContentCandidateSnapshot): Map<string, ContentCandidateUnit> {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.contract !== "literary-planet-content-candidate-v1"
    || !/^[a-f0-9]{40}$/u.test(snapshot.sourceCommit) || snapshot.namespace !== "adult" || snapshot.releaseReady !== false
    || !Array.isArray(snapshot.requiredLocales) || snapshot.requiredLocales.join(",") !== "ru,en"
    || !Array.isArray(snapshot.units) || snapshot.units.length > 200_000 || !Array.isArray(snapshot.held)) {
    throw new Error("Invalid canonical content candidate");
  }
  const byId = new Map<string, ContentCandidateUnit>();
  for (const unit of snapshot.units) {
    if (!unit || !validContentUnitIdentity(unit) || byId.has(unit.id)
      || typeof unit.text !== "string" || !unit.text.trim() || unit.text.length > 100_000 || unit.contentHash !== contentTextHash(unit.text)
      || !bases.has(unit.publicationBasis) || ![null, "utf8-sha256", "writer-biography-review-v1"].includes(unit.sourceHashContract)
      || [unit.observedRuSourceHash, unit.reviewedRuSourceHash].some(hash => hash !== null && !hashPattern.test(hash))
      || [unit.observedTargetHash, unit.reviewTargetHash].some(hash => hash !== undefined && !hashPattern.test(hash))
      || !Array.isArray(unit.dependencyIds) || unit.dependencyIds.length > 32
      || unit.dependencyIds.some(id => typeof id !== "string" || id.length > 1000 || id === unit.id)
      || new Set(unit.dependencyIds).size !== unit.dependencyIds.length) {
      throw new Error("Invalid or ambiguous canonical content unit");
    }
    byId.set(unit.id, unit);
  }
  // Linear traversal detects cycles without recursive calls on long chains.
  const pending = new Map<string, number>(), dependants = new Map<string, string[]>();
  for (const unit of byId.values()) {
    const dependencies = unit.dependencyIds.filter(id => byId.has(id));
    pending.set(unit.id, dependencies.length);
    for (const id of dependencies) {
      const values = dependants.get(id) || []; values.push(unit.id); dependants.set(id, values);
    }
  }
  const ready = [...pending].filter(([, count]) => count === 0).map(([id]) => id);
  for (let position = 0; position < ready.length; position++) {
    for (const id of dependants.get(ready[position]) || []) {
      const count = pending.get(id)! - 1; pending.set(id, count); if (count === 0) ready.push(id);
    }
  }
  if (ready.length !== byId.size) throw new Error("Cyclic canonical content dependencies");
  return byId;
}

/** Only a current exact binding can clear source staleness. Observing today's
 * hash, changing a generic status or changing the Git SHA is not a review. */
function hasCurrentReview(unit: ContentCandidateUnit, source: ContentCandidateUnit | undefined): boolean {
  return Boolean(source && source.locale === "ru" && unit.locale === "en"
    && source.id === contentUnitId(unit.entityRef, unit.field, "ru")
    && unit.publicationBasis === "reviewed-source-bound-prose"
    && unit.sourceHashContract !== null && unit.sourceHashContract === source.sourceHashContract
    && unit.observedRuSourceHash !== null && unit.observedRuSourceHash === source.observedRuSourceHash
    && unit.reviewedRuSourceHash === unit.observedRuSourceHash
    && unit.observedTargetHash && unit.reviewTargetHash === unit.observedTargetHash);
}

export type ContentDependencyChange = {
  schemaVersion: 1;
  contract: "literary-planet-content-dependencies-v1";
  sourceCommit: string;
  previousSourceCommit: string | null;
  currentCandidateHash: string;
  previousCandidateHash: string | null;
  addedUnitIds: string[];
  changedUnitIds: string[];
  removedUnitIds: string[];
  staleUnitIds: string[];
  tombstones: Array<{ id: string; entityRef: ContentEntityRef; field: ContentCandidateUnit["field"]; locale: ContentLocale }>;
  invalidatedOutputs: Array<{ kind: "search" | "package"; locale: ContentLocale; reasonUnitIds: string[] }>;
  releaseReady: false;
};

/** Compare derivative generations, never edit canonical facts or approve
 * translations. Invalidated outputs refer to previous search/package artifacts. */
export function compareContentCandidates(previous: ContentCandidateSnapshot | null, current: ContentCandidateSnapshot,
  previousState?: ContentDependencyChange): ContentDependencyChange {
  const before = previous ? checkedUnits(previous) : new Map<string, ContentCandidateUnit>();
  const after = checkedUnits(current);
  const previousCandidateHash = previous ? candidateUnitsHash(previous, before) : null;
  const currentCandidateHash = candidateUnitsHash(current, after);
  if (previousState && (!previous || previousState.schemaVersion !== 1
    || previousState.contract !== "literary-planet-content-dependencies-v1" || previousState.releaseReady !== false
    || previousState.sourceCommit !== previous.sourceCommit || previousState.currentCandidateHash !== previousCandidateHash
    || !Array.isArray(previousState.staleUnitIds) || previousState.staleUnitIds.length > before.size
    || previousState.staleUnitIds.some(id => typeof id !== "string" || !before.has(id))
    || new Set(previousState.staleUnitIds).size !== previousState.staleUnitIds.length)) {
    throw new Error("Previous dependency state does not match its canonical generation");
  }
  const addedUnitIds = [...after.keys()].filter(id => !before.has(id)).sort();
  const changedUnitIds = [...after.keys()].filter(id => before.has(id) && revision(before.get(id)!) !== revision(after.get(id)!)).sort();
  const removedUnitIds = [...before.keys()].filter(id => !after.has(id)).sort();
  const changedSources = new Set([...changedUnitIds, ...removedUnitIds]);
  const reverse = new Map<string, string[]>();
  for (const unit of after.values()) for (const dependency of unit.dependencyIds) {
    const dependants = reverse.get(dependency) || []; dependants.push(unit.id); reverse.set(dependency, dependants);
  }
  const stale = new Set<string>();
  // Persist an unresolved correction across unchanged exports. An ordinary
  // rebuild, Git commit or newly observed hash never constitutes review.
  for (const id of previousState?.staleUnitIds || []) {
    const unit = after.get(id);
    if (unit && !hasCurrentReview(unit, after.get(contentUnitId(unit.entityRef, unit.field, "ru")))) stale.add(id);
  }
  for (const unit of after.values()) {
    if (unit.dependencyIds.some(id => !after.has(id)) || (unit.locale === "en" && unit.publicationBasis === "reviewed-source-bound-prose"
      && !hasCurrentReview(unit, after.get(contentUnitId(unit.entityRef, unit.field, "ru"))))) stale.add(unit.id);
  }
  const queue = [...new Set([...changedSources, ...stale])];
  for (let position = 0; position < queue.length; position++) {
    const dependency = queue[position];
    for (const id of reverse.get(dependency) || []) {
      const unit = after.get(id)!;
      if (stale.has(id) || (!stale.has(dependency) && hasCurrentReview(unit, after.get(dependency)))) continue;
      stale.add(id); queue.push(id);
    }
  }
  const affected = new Set([...addedUnitIds, ...changedUnitIds, ...removedUnitIds, ...stale]);
  const invalidatedOutputs: ContentDependencyChange["invalidatedOutputs"] = [];
  for (const locale of locales) {
    const reasonUnitIds = [...affected].filter(id => (after.get(id) || before.get(id))?.locale === locale).sort();
    if (reasonUnitIds.length) for (const kind of ["search", "package"] as const) invalidatedOutputs.push({ kind, locale, reasonUnitIds });
  }
  return {
    schemaVersion: 1, contract: "literary-planet-content-dependencies-v1", sourceCommit: current.sourceCommit,
    previousSourceCommit: previous?.sourceCommit ?? null, currentCandidateHash, previousCandidateHash,
    addedUnitIds, changedUnitIds, removedUnitIds,
    staleUnitIds: [...stale].sort(), tombstones: removedUnitIds.map(id => {
      const unit = before.get(id)!; return { id, entityRef: { ...unit.entityRef }, field: unit.field, locale: unit.locale };
    }), invalidatedOutputs, releaseReady: false,
  };
}

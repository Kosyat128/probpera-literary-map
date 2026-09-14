import { describe, expect, it } from "vitest";
import { compareContentCandidates } from "./contentDependencies";
import { contentTextHash, contentUnitId } from "./contentExportHash";
import type { ContentCandidateSnapshot, ContentCandidateUnit, ContentEntityRef } from "./contentExportTypes";

const entity: ContentEntityRef = { kind: "writer", countryId: "synthetic-country", writerId: "synthetic-author" };
function fixture(): ContentCandidateSnapshot {
  const ruText = "Условный русский исходник для теста зависимости.";
  const enText = "Synthetic English text for a dependency test.";
  const sourceHash = contentTextHash("Synthetic source profile revision one");
  const ru: ContentCandidateUnit = { id: contentUnitId(entity, "biography", "ru"), entityRef: { ...entity }, field: "biography", locale: "ru",
    text: ruText, contentHash: contentTextHash(ruText), observedRuSourceHash: sourceHash, reviewedRuSourceHash: null,
    sourceHashContract: "writer-biography-review-v1", dependencyIds: [], publicationBasis: "authored-public-prose" };
  const en: ContentCandidateUnit = { ...ru, id: contentUnitId(entity, "biography", "en"), locale: "en", text: enText,
    contentHash: contentTextHash(enText), reviewedRuSourceHash: sourceHash,
    observedTargetHash: contentTextHash("Synthetic reviewed target revision"), reviewTargetHash: contentTextHash("Synthetic reviewed target revision"),
    dependencyIds: [ru.id], publicationBasis: "reviewed-source-bound-prose" };
  return { schemaVersion: 1, contract: "literary-planet-content-candidate-v1", requiredLocales: ["ru", "en"],
    sourceCommit: "a".repeat(40), namespace: "adult", releaseReady: false, units: [ru, en], held: [] };
}
function correctSource(snapshot: ContentCandidateSnapshot) {
  const ru = snapshot.units[0], en = snapshot.units[1];
  ru.text = "Исправленный условный русский источник."; ru.contentHash = contentTextHash(ru.text);
  ru.observedRuSourceHash = contentTextHash("Synthetic corrected source profile");
  en.observedRuSourceHash = ru.observedRuSourceHash;
}

describe("canonical content dependency correction", () => {
  it("builds initial RU/EN outputs and ignores Git-only changes without mutating canonical units", () => {
    const initial = fixture(), copy = structuredClone(initial);
    const first = compareContentCandidates(null, initial);
    expect(first.addedUnitIds).toEqual(initial.units.map(unit => unit.id).sort());
    expect(first.staleUnitIds).toEqual([]);
    expect(first.invalidatedOutputs.map(output => [output.locale, output.kind])).toEqual([
      ["ru", "search"], ["ru", "package"], ["en", "search"], ["en", "package"],
    ]);
    expect(initial).toEqual(copy);
    const same = structuredClone(initial); same.sourceCommit = "b".repeat(40); same.units.reverse();
    const next = compareContentCandidates(initial, same);
    expect(next.addedUnitIds).toEqual([]); expect(next.changedUnitIds).toEqual([]);
    expect(next.invalidatedOutputs).toEqual([]); expect(next.staleUnitIds).toEqual([]);
  });

  it("makes English text and both existing output generations stale after a Russian correction", () => {
    const before = fixture(), after = structuredClone(before); correctSource(after);
    const change = compareContentCandidates(before, after);
    expect(change.staleUnitIds).toEqual([after.units[1].id]);
    expect(change.invalidatedOutputs.filter(output => output.locale === "en").map(output => output.kind)).toEqual(["search", "package"]);
    expect(after.units[1].reviewedRuSourceHash).toBe(before.units[1].reviewedRuSourceHash);
  });

  it("propagates source-profile and review metadata corrections even with unchanged prose", () => {
    const before = fixture(), after = structuredClone(before);
    after.units[0].observedRuSourceHash = contentTextHash("Synthetic withdrawn or corrected profile metadata");
    expect(compareContentCandidates(before, after).staleUnitIds).toEqual([after.units[1].id]);
  });

  it("clears source staleness only for a newly matching immutable source and target review", () => {
    const before = fixture(), after = structuredClone(before); correctSource(after);
    after.units[1].reviewedRuSourceHash = after.units[1].observedRuSourceHash;
    expect(compareContentCandidates(before, after).staleUnitIds).toEqual([]);
    after.units[1].reviewTargetHash = contentTextHash("Synthetic other target review");
    expect(compareContentCandidates(before, after).staleUnitIds).toEqual([after.units[1].id]);
  });

  it("does not treat today's observed hash or a missing target binding as review", () => {
    const before = fixture(), after = structuredClone(before); correctSource(after);
    after.units[1].reviewedRuSourceHash = after.units[1].observedRuSourceHash;
    delete after.units[1].reviewTargetHash;
    expect(compareContentCandidates(before, after).staleUnitIds).toEqual([after.units[1].id]);
  });

  it("keeps unbound display-name candidates stale after their canonical Russian source changes", () => {
    const before = fixture();
    for (const unit of before.units) {
      unit.field = "name"; unit.id = contentUnitId(entity, "name", unit.locale); unit.publicationBasis = "canonical-name-candidate";
      unit.sourceHashContract = null; unit.observedRuSourceHash = null; unit.reviewedRuSourceHash = null;
      delete unit.observedTargetHash; delete unit.reviewTargetHash;
    }
    before.units[1].dependencyIds = [before.units[0].id];
    const after = structuredClone(before); after.units[0].text = "Исправленное имя"; after.units[0].contentHash = contentTextHash(after.units[0].text);
    const changed = compareContentCandidates(before, after);
    expect(changed.staleUnitIds).toEqual([after.units[1].id]);
    const rebuilt = structuredClone(after); rebuilt.sourceCommit = "c".repeat(40);
    expect(compareContentCandidates(after, rebuilt, changed).staleUnitIds).toEqual([after.units[1].id]);
  });

  it("binds persisted staleness to the exact previous generation", () => {
    const before = fixture(), corrected = structuredClone(before); correctSource(corrected);
    const state = compareContentCandidates(before, corrected);
    const wrong = structuredClone(corrected); wrong.units[0].observedRuSourceHash = contentTextHash("Other source profile");
    expect(() => compareContentCandidates(wrong, corrected, state)).toThrow(/Previous dependency state/);
    const reviewed = structuredClone(corrected); reviewed.units[1].reviewedRuSourceHash = reviewed.units[1].observedRuSourceHash;
    expect(compareContentCandidates(corrected, reviewed, state).staleUnitIds).toEqual([]);
  });

  it("produces ID-only tombstones for a withdrawn unit and invalidates dependants transitively", () => {
    const before = fixture(), after = structuredClone(before);
    const dependant: ContentCandidateUnit = { ...after.units[1], entityRef: { ...entity, writerId: "synthetic-dependent" },
      id: contentUnitId({ ...entity, writerId: "synthetic-dependent" }, "biography", "en"),
      publicationBasis: "authored-public-prose", dependencyIds: [after.units[1].id] };
    after.units.push(dependant);
    after.units.shift();
    const change = compareContentCandidates(before, after);
    expect(change.staleUnitIds).toEqual([before.units[1].id, dependant.id].sort());
    expect(change.tombstones).toEqual([{ id: before.units[0].id, entityRef: entity, field: "biography", locale: "ru" }]);
    expect(JSON.stringify(change.tombstones)).not.toContain(before.units[0].text);
    expect(change.releaseReady).toBe(false);
  });

  it("turns removal into a tombstone even if a held diagnostic replaces the previous field", () => {
    const before = fixture(), after = structuredClone(before), unit = after.units.pop()!;
    after.held.push({ id: unit.id, entityRef: unit.entityRef, field: unit.field, locale: unit.locale, reasons: ["source-changed"] });
    expect(compareContentCandidates(before, after).removedUnitIds).toEqual([unit.id]);
  });

  it.each(["duplicate", "identity", "text-hash", "self-cycle", "cross-cycle", "production", "locale"])("rejects ambiguous or incompatible %s input", mutation => {
    const snapshot = fixture();
    if (mutation === "duplicate") snapshot.units.push(structuredClone(snapshot.units[0]));
    if (mutation === "identity") snapshot.units[0].id = "replacement-entity-key";
    if (mutation === "text-hash") snapshot.units[0].text = "Unhashed mutation";
    if (mutation === "self-cycle") snapshot.units[0].dependencyIds = [snapshot.units[0].id];
    if (mutation === "cross-cycle") snapshot.units[0].dependencyIds = [snapshot.units[1].id];
    if (mutation === "production") (snapshot as unknown as {releaseReady:boolean}).releaseReady = true;
    if (mutation === "locale") snapshot.requiredLocales.reverse();
    expect(() => compareContentCandidates(null, snapshot)).toThrow();
  });
});

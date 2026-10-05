import { describe, expect, it, vi } from "vitest";
import { decodeChildNativeDiscovery, decodeChildNativePassport, decodeChildNativeCountryOpen, decodeChildNativeRemovalTarget } from "./childNativeDiscoveryPassport";
import type { ChildNativeContext } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";

// AUTHORED_NOT_RUN. DTO fixtures never provide native policy/review/storage approval.
const c = { profileId: "profile-a", locale: "en", generation: 1, package: { version: 1 } } as ChildNativeContext;
const ref = (kind: ChildEntityReference["kind"], id: string) => ({ kind, id, contentChecksum: "a".repeat(64) });
const entity = (kind: ChildEntityReference["kind"], id: string) => ({ reference: ref(kind, id), payload: { title: "Fixture " + id, text: "Synthetic presentation only.", terms: [], references: [] } });
const binding = { profileId: c.profileId, locale: c.locale, generation: c.generation };
const shelf = () => ({ ...binding, shelf: "writers", items: [entity("writer", "writer-a")] });
const passport = () => ({ schemaVersion: 1, ...binding, revision: 3, countries: [entity("country", "country-a")], writers: [entity("writer", "writer-a")],
  works: [entity("work", "work-a")], journeys: [{ journeyId: "journey-a", journeyVersion: 1, contentVersion: 1, title: "Fixture journey", description: "Synthetic route.", nodeCount: 3 }],
  unresolvedCompletedNodeIds: ["old-untyped", "writer-prefix-is-not-a-kind"], badges: { status: "unavailable", items: [] }, downloadedRoutes: { status: "unavailable", items: [] } });
describe("native child discovery and passport correlation", () => {
  it("retires profile, locale and generation mismatches and never accepts a different shelf", () => {
    expect(decodeChildNativeDiscovery(shelf(), c, "writers")?.items[0].reference.id).toBe("writer-a");
    for (const delta of [{ profileId: "profile-b" }, { locale: "ru" }, { generation: 2 }, { generation: -0 }, { shelf: "books" }, { approved: true }]) {
      expect(decodeChildNativeDiscovery({ ...shelf(), ...delta }, c, "writers")).toBeNull();
    }
    for (const delta of [{ profileId: "profile-b" }, { locale: "ru" }, { generation: 2 }]) expect(decodeChildNativePassport({ ...passport(), ...delta }, c)).toBeNull();
  });
  it("requires bounded independently typed rows and a concrete recommendation wrapper target", () => {
    for (const items of [[entity("work", "writer-a")], [entity("writer", "writer-a"), entity("writer", "writer-a")], Array.from({ length: 65 }, (_, n) => entity("writer", "writer-" + n))]) {
      expect(decodeChildNativeDiscovery({ ...shelf(), items }, c, "writers")).toBeNull();
    }
    const collection = { ...binding, shelf: "collections", items: [{ ...entity("recommendation", "gentle-a"), payload: { title: "Fixture collection", text: "Synthetic.", terms: [], references: [ref("work", "work-a")] } }] };
    expect(decodeChildNativeDiscovery(collection, c, "collections")?.items[0].reference.kind).toBe("recommendation");
    for (const references of [[], [ref("work", "work-a"), ref("writer", "writer-a")], [ref("favorite", "favorite-a")]]) {
      expect(decodeChildNativeDiscovery({ ...collection, items: [{ ...collection.items[0], payload: { ...collection.items[0].payload, references } }] }, c, "collections")).toBeNull();
    }
  });
  it("preserves unresolved legacy IDs without inventing typed study or reward facts", () => {
    const raw = passport(), decoded = decodeChildNativePassport(raw, c)!;
    expect(decoded.unresolvedCompletedNodeIds).toEqual(raw.unresolvedCompletedNodeIds);
    expect(decoded.writers.map(v => v.reference.id)).toEqual(["writer-a"]);
    raw.writers[0].payload.title = "Changed caller input";
    expect(decoded.writers[0].payload.title).toBe("Fixture writer-a");
    expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded.writers)).toBe(true);
    for (const delta of [{ badges: { status: "available", items: [] } }, { badges: { status: "unavailable", items: ["fixture-award"] } },
      { downloadedRoutes: { status: "available", items: [] } }, { countries: [entity("writer", "country-a")] },
      { unresolvedCompletedNodeIds: ["old-untyped", "old-untyped"] }, { journeys: [{ ...raw.journeys[0], contentVersion: 2 }] }]) {
      expect(decodeChildNativePassport({ ...passport(), ...delta }, c)).toBeNull();
    }
  });
  it("accepts an explicit exact country receipt only and rejects title/credit getters without evaluating them", () => {
    const country = entity("country", "country-a"), raw = { ...binding, revision: 4, country };
    expect(decodeChildNativeCountryOpen(raw, c, country.reference)?.country.reference.id).toBe("country-a");
    expect(decodeChildNativeCountryOpen(raw, c, ref("country", "other-country"))).toBeNull();
    expect(decodeChildNativeCountryOpen(raw, c, ref("country", "country-a") as ChildEntityReference)?.revision).toBe(4);
    expect(decodeChildNativeCountryOpen({ ...raw, creditConfirmed: true }, c, country.reference)).toBeNull();
    const getter = vi.fn(() => "Adult title"), poisoned = shelf();
    Object.defineProperty(poisoned.items[0].payload, "title", { enumerable: true, get: getter });
    expect(decodeChildNativeDiscovery(poisoned, c, "writers")).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("requires an explicit exact profile/history deletion target and refuses implicit full-store deletion", () => {
    expect(decodeChildNativeRemovalTarget({ profileId: "profile-a", scope: "history" })).toEqual({ profileId: "profile-a", scope: "history" });
    expect(decodeChildNativeRemovalTarget({ profileId: "profile-a", scope: "profile" })?.scope).toBe("profile");
    for (const raw of [null, {}, { scope: "all" }, { profileId: "profile-a", scope: "all" }, { profileId: "../profile-a", scope: "profile" },
      { profileId: "profile-a", scope: "history", approved: true }]) expect(decodeChildNativeRemovalTarget(raw)).toBeNull();
  });
});
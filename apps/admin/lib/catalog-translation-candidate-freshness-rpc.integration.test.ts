import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { parseCatalogTranslationCandidateFreshnessReceipt, readCatalogTranslationCandidateFreshness,
  type CatalogTranslationCandidateFreshnessBinding } from "./catalog-translation-candidate-freshness-rpc";

const native = createRequire(import.meta.url), { getRedirectError } = native("next/dist/client/components/redirect");
const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", privateError = "PRIVATE_METADATA_DIAGNOSTIC";
function setup(entityType: "literary_work" | "country") {
  const binding: CatalogTranslationCandidateFreshnessBinding = { entityType, entityId: entityType === "literary_work" ? uuid : "controlled-country",
    draftId: "11111111-1111-4111-8111-111111111111", draftVersion: 1, candidateHash: "a".repeat(64), sourceHash: "b".repeat(64) };
  const input = { ...binding, catalogSourceHash: entityType === "country" ? "c".repeat(64) : null,
    catalogSourceFields: entityType === "country" ? { rawRights: { permission: "Exact raw permission" }, coordinates: [1, 2], translations: { fr: { untouched: true } } } : null };
  const receipt = (patch: Record<string, unknown> = {}) => ({ version: 1, ...binding, linked: true, canPromote: true, reason: null, ...patch });
  return { binding, input, receipt };
}

describe.each(["literary_work", "country"] as const)("Catalog %s metadata receipt cannot grant unbound approval", kind => {
  it("uses exactly eight metadata arguments and preserves raw server catalog fields", async () => {
    const { input, receipt } = setup(kind), before = structuredClone(input), rpc = vi.fn(async (..._args: unknown[]) => ({ data: receipt(), error: null }));
    expect(await readCatalogTranslationCandidateFreshness({ rpc } as never, input)).toEqual(receipt());
    expect(rpc.mock.calls).toEqual([["get_catalog_translation_candidate_freshness", { p_entity_type: input.entityType, p_entity_id: input.entityId,
      p_draft_id: input.draftId, p_expected_version: input.draftVersion, p_candidate_hash: input.candidateHash, p_source_hash: input.sourceHash,
      p_catalog_source_hash: input.catalogSourceHash, p_catalog_source_fields: input.catalogSourceFields }]]);
    expect(input).toEqual(before);
  });
  it.each([
    ["wrong kind", { entityType: "writer_biography" }], ["wrong entity", { entityId: "another-entity" }],
    ["wrong draft", { draftId: "22222222-2222-4222-8222-222222222222" }], ["wrong version", { draftVersion: 2 }],
    ["wrong candidate", { candidateHash: "0".repeat(64) }], ["wrong source", { sourceHash: "0".repeat(64) }],
    ["raw body leak", { body: "Private source body" }], ["inconsistent deny", { canPromote: false }],
    ["inconsistent allow", { reason: "source_changed" }], ["unknown reason", { canPromote: false, reason: "untrusted_legacy" }],
    ["unsafe version", { draftVersion: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects %s without treating it as legacy", async (_name, patch) => {
    const { binding, input, receipt } = setup(kind), value = receipt(patch);
    expect(parseCatalogTranslationCandidateFreshnessReceipt(value, binding)).toBeNull();
    const rpc = vi.fn(async () => ({ data: value, error: null }));
    await expect(readCatalogTranslationCandidateFreshness({ rpc } as never, input)).rejects.toMatchObject({ code: "unconfirmed" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, undefined, {}, { version: 1 }])("missing or incomplete response %j never enables legacy fallback", async value => {
    const { input } = setup(kind), rpc = vi.fn(async () => ({ data: value, error: null }));
    await expect(readCatalogTranslationCandidateFreshness({ rpc } as never, input)).rejects.toMatchObject({ code: "unconfirmed" });
  });
  it.each(["candidate_missing", "candidate_changed", "source_changed"] as const)("returns a bound denial for %s", async reason => {
    const { input, receipt } = setup(kind), value = receipt({ linked: reason !== "candidate_missing", canPromote: false, reason });
    const rpc = vi.fn(async () => ({ data: value, error: null })); expect(await readCatalogTranslationCandidateFreshness({ rpc } as never, input)).toEqual(value);
  });
  it("accepts confirmed existing unlinked legacy without private cache contents", async () => {
    const { binding, input, receipt } = setup(kind), value = receipt({ linked: false });
    expect(parseCatalogTranslationCandidateFreshnessReceipt(value, binding)).toEqual(value);
    const rpc = vi.fn(async () => ({ data: value, error: null })); expect(await readCatalogTranslationCandidateFreshness({ rpc } as never, input)).toEqual(value);
  });
  it.each(["PGRST202", "42501", "57014", "XX000"])("database %s is unavailable and never approval", async code => {
    const { input } = setup(kind), rpc = vi.fn(async () => ({ data: null, error: { code, message: privateError } }));
    await expect(readCatalogTranslationCandidateFreshness({ rpc } as never, input)).rejects.toMatchObject({ code: "unavailable" });
    try { await readCatalogTranslationCandidateFreshness({ rpc } as never, input); } catch (error) { expect(String(error)).not.toContain(privateError); }
  });
  it("thrown transport and Next navigation stay distinct", async () => {
    const { input } = setup(kind), rpc = vi.fn(async () => { throw new TypeError(privateError); });
    await expect(readCatalogTranslationCandidateFreshness({ rpc } as never, input)).rejects.toMatchObject({ code: "unavailable" });
    const signal = getRedirectError("/login", "replace", 307), signalRpc = vi.fn(async () => { throw signal; });
    await expect(readCatalogTranslationCandidateFreshness({ rpc: signalRpc } as never, input)).rejects.toBe(signal);
  });
  it("invalid catalog argument pairing fails before any SDK request", async () => {
    const { input, receipt } = setup(kind), rpc = vi.fn(async () => ({ data: receipt(), error: null }));
    const invalid = kind === "country" ? { ...input, catalogSourceHash: null } : { ...input, catalogSourceFields: { untrusted: true } };
    await expect(readCatalogTranslationCandidateFreshness({ rpc } as never, invalid)).rejects.toMatchObject({ code: "unconfirmed" }); expect(rpc).not.toHaveBeenCalled();
  });
});

it("preserves uppercase legacy book TEXT identity and rejects mismatched case", async () => {
  const { binding, input, receipt } = setup("literary_work"), exact = { ...binding, entityId: uuid.toUpperCase() }, value = receipt({ entityId: uuid.toUpperCase(), linked: false });
  expect(parseCatalogTranslationCandidateFreshnessReceipt(value, exact)).toEqual(value);
  expect(parseCatalogTranslationCandidateFreshnessReceipt(value, binding)).toBeNull();
  const rpc = vi.fn(async (..._args: unknown[]) => ({ data: value, error: null }));
  expect(await readCatalogTranslationCandidateFreshness({ rpc } as never, { ...input, entityId: exact.entityId })).toEqual(value);
  expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_entity_id).toBe(exact.entityId);
});

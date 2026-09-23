import { beforeAll, describe, expect, it } from "vitest";
import { createBookDossierGraphFixture } from "../../scripts/lib/book-dossier-graph-fixture";
import { buildBookDossierDiagram } from "./bookDossierDiagram";
import type { BookDossierDocumentV2 } from "./bookDossierDocument";
import { bookDossierCharacterRequestToken, consumeBookDossierCharacterViewToken, createBookDossierCharacterViewToken,
  isFreshBookDossierCharacterViewToken, resolveBookDossierCharacterView, sameBookDossierCharacterView,
  type BookDossierCharacterViewRequest } from "./bookDossierCharacterView";

const now = Date.parse("2026-09-23T10:00:00.000Z");
let document: BookDossierDocumentV2;
function fixture() {
  const dossier: BookDossierDocumentV2 = JSON.parse(JSON.stringify(document));
  const page = dossier.pages.find(page => page.id === "graph-context")!;
  const diagram = buildBookDossierDiagram(dossier, page)!;
  const node = diagram.nodes.find(node => node.item.id === "character-c")!;
  const request: BookDossierCharacterViewRequest = { token: createBookDossierCharacterViewToken(),
    bookKey: dossier.bookKey, cacheKey: dossier.cacheKey, anchor: { ...node.anchor, itemId: node.item.id } };
  return { dossier, page, diagram, node, request };
}
describe("explicit exact-character view requests", () => {
  beforeAll(async () => { document = (await createBookDossierGraphFixture({ now })).document; });

  it("resolves a second block's exact current item without changing its page anchor", () => {
    const f = fixture(), pageAnchor = JSON.stringify(f.page.anchor);
    expect(f.request.anchor.blockId).not.toBe(f.page.anchor.blockId);
    const target = resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, now)!;
    expect(target.node).toBe(f.node);
    expect(target.receipt.anchor).toEqual(f.request.anchor);
    expect(target.receipt.token).toBe(f.request.token);
    expect(Object.isFrozen(target.receipt) && Object.isFrozen(target.receipt.anchor)).toBe(true);
    expect(JSON.stringify(f.page.anchor)).toBe(pageAnchor);
    expect(target.expiresAt).toBe(now + 60_000);
  });

  it("issues opaque frozen one-shot tokens whose consumption survives request copies", () => {
    const token = createBookDossierCharacterViewToken();
    expect(isFreshBookDossierCharacterViewToken(token)).toBe(true);
    expect(Object.isFrozen(token)).toBe(true); expect(Reflect.ownKeys(token)).toEqual([]);
    expect(consumeBookDossierCharacterViewToken(token)).toBe(true);
    expect(isFreshBookDossierCharacterViewToken(token)).toBe(false);
    expect(consumeBookDossierCharacterViewToken(token)).toBe(false);
    expect(consumeBookDossierCharacterViewToken(Object.freeze({}))).toBe(false);
    const f = fixture(), duplicate = { ...f.request };
    expect(consumeBookDossierCharacterViewToken(bookDossierCharacterRequestToken(f.request))).toBe(true);
    expect(consumeBookDossierCharacterViewToken(bookDossierCharacterRequestToken(duplicate))).toBe(false);
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, now)).not.toBeNull();
    expect(consumeBookDossierCharacterViewToken(createBookDossierCharacterViewToken())).toBe(true);
  });

  it("rejects wrong book/cache/version/locale/mode/section/block/item without locale or first-item fallback", () => {
    const f = fixture();
    const changes = [{ bookKey: "test:writer:other" }, { cacheKey: "stale" },
      ...[{ dossierVersion: "v2" }, { locale: "en" }, { readingMode: "AFTER_READING" }, { sectionId: "identity" },
        { blockId: "graph-team" }, { itemId: "character-hidden" }, { itemId: "missing" }]
        .map(change => ({ anchor: { ...f.request.anchor, ...change } }))];
    for (const change of changes) expect(resolveBookDossierCharacterView(f.dossier, f.diagram, { ...f.request, ...change }, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, { ...f.request, token: Object.freeze({}) }, now)).toBeNull();
  });

  it("requires the exact current character node, not a relation, duplicate, detached or foreign diagram", () => {
    const f = fixture();
    const relation = f.diagram.edges[0];
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, { ...f.request, anchor: relation.anchor }, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, { ...f.diagram, nodes: [...f.diagram.nodes, f.node] }, f.request, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, JSON.parse(JSON.stringify(f.diagram)), f.request, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, { ...f.diagram, anchor: { ...f.diagram.anchor, locale: "en" } }, f.request, now)).toBeNull();
    const block = f.page.blocks.find(block => block.id === f.request.anchor.blockId)!;
    (block.items as unknown[]).push(block.items[0]);
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, now)).toBeNull();
  });

  it("requires a fresh published lease and never lets an unchanged key freeze expiry", () => {
    const f = fixture();
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, now + 60_000)).toBeNull();
    for (const patch of [{ validUntil: undefined }, { validUntil: "invalid" }, { validUntil: new Date(now + 65_001).toISOString() },
      { profile: null, tier: null }]) {
      expect(resolveBookDossierCharacterView({ ...f.dossier, ...patch }, f.diagram, f.request, now)).toBeNull();
    }
    expect(resolveBookDossierCharacterView(null, f.diagram, f.request, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, null, f.request, now)).toBeNull();
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, NaN)).toBeNull();
  });

  it("does not execute request accessors and binds observations to their original one-shot token", () => {
    const f = fixture(); let reads = 0;
    const request = { ...f.request };
    Object.defineProperty(request, "anchor", { enumerable: true, get() { ++reads; return f.request.anchor; } });
    expect(resolveBookDossierCharacterView(f.dossier, f.diagram, request, now)).toBeNull();
    expect(bookDossierCharacterRequestToken(request)).toBeNull();
    expect(reads).toBe(0);
    const first = resolveBookDossierCharacterView(f.dossier, f.diagram, f.request, now)!.receipt;
    expect(sameBookDossierCharacterView(first, { ...first })).toBe(true);
    expect(sameBookDossierCharacterView(first, { ...first, token: createBookDossierCharacterViewToken() })).toBe(false);
    expect(sameBookDossierCharacterView(first, { ...first, anchor: { ...first.anchor, itemId: "character-a" } })).toBe(false);
  });
});

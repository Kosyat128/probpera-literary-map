import { beforeAll, describe, expect, it, vi } from "vitest";
import { createBookDossierGraphFixture } from "../../scripts/lib/book-dossier-graph-fixture";
import type { BookDossierDocumentV2 } from "../books/bookDossierDocument";
import { buildBookDossierDiagram } from "../books/bookDossierDiagram";
import { consumeBookDossierCharacterViewToken, isFreshBookDossierCharacterViewToken, resolveBookDossierCharacterView } from "../books/bookDossierCharacterView";
import type { Country, BookArchiveEntry } from "../planet/types";
import type { BookyJourneyPlan } from "./bookyJourney";
import { inspectBookyDossierCharacter } from "./bookyDossierCharacter";
import { getBookyJourneyCharacterChecksum, type BookyJourneyCharacterSpec } from "./bookyJourneyCharacter";
import { createBookyJourneyCharacterSession, type BookyJourneyCharacterSessionCurrent } from "./bookyJourneyCharacterSession";

const now = Date.parse("2026-09-23T10:00:00.000Z");
let document: BookDossierDocumentV2;
const work = { kind: "work" as const, countryId: "test", writerId: "writer", workId: "book" };
const countries = [{ id: "test", writers: [{ id: "writer" }] }] as unknown as Country[];
const books = [{ id: "book", countryId: "test", writerId: "writer", editorial: { status: "reviewed" } }] as unknown as BookArchiveEntry[];
function setup(consecutive = false) {
  const dossier = structuredClone(document), page = dossier.pages.find(p => p.id === "graph-context")!;
  const reference = { work, locale: "ru" as const, dossierVersion: "test-v1", sectionId: "graph-context", blockId: "graph-guests", itemId: "character-c" };
  const projection = inspectBookyDossierCharacter({ reference, dossier, publicCountries: countries, publicBooks: books }, now)!;
  const spec: BookyJourneyCharacterSpec = { schemaVersion: 1, id: "synthetic.character", version: 1, work, bindings: [
    { ...reference, work: undefined, readingMode: "BEFORE_READING", projectionChecksum: projection.semanticChecksum, dialogue: { id: "synthetic.copy", version: 1, contentChecksum: "a".repeat(64) } },
    { ...reference, work: undefined, locale: "en", readingMode: "BEFORE_READING", projectionChecksum: "b".repeat(64), dialogue: { id: "synthetic.copy", version: 1, contentChecksum: "b".repeat(64) } },
  ].map(({ work: _work, ...binding }) => binding) as unknown as BookyJourneyCharacterSpec["bindings"] };
  // Admission is the injected host's responsibility; these static plan fields
  // are a synthetic admitted boundary, not production editorial approval.
  const plan = { id: "synthetic.route", version: 1, locale: "ru", title: "Synthetic", definitionChecksum: "d".repeat(64), nodes: [
    { id: "character", kind: "character", screen: "collection", entity: work,
      character: { spec, semanticChecksum: getBookyJourneyCharacterChecksum(spec)! } },
  ] } as unknown as BookyJourneyPlan;
  if (consecutive) (plan.nodes as Array<BookyJourneyPlan["nodes"][number]>).push(
    { ...plan.nodes[0], id: "next-character" }, { ...plan.nodes[0], id: "later-character" });
  let current: BookyJourneyCharacterSessionCurrent | null = Object.freeze({ identity: {}, profileKey: "adult-policy", host: Object.freeze({
    revision: 1, enabled: true, active: true, access: "adult", locale: "ru", countryStatus: "ready", booksStatus: "ready",
    dossier, publicCountries: countries, publicBooks: books }) });
  let clock = now;
  const readCurrent = vi.fn((_plan: BookyJourneyPlan, nodeId: string) => plan.nodes.some(node => node.id === nodeId) ? current : null);
  const session = createBookyJourneyCharacterSession({ readCurrent, readNow: () => clock });
  const open = () => session.request(plan, "character")!;
  const receipt = (request = open()) => {
    expect(consumeBookDossierCharacterViewToken(request.token)).toBe(true);
    const target = resolveBookDossierCharacterView(dossier, buildBookDossierDiagram(dossier, page), request, clock)!;
    expect(target).not.toBeNull(); return target.receipt;
  };
  return { plan, dossier, session, open, receipt, readCurrent, current: () => current!,
    setCurrent: (value: BookyJourneyCharacterSessionCurrent | null) => { current = value; }, setClock: (value: number) => { clock = value; } };
}

describe("current-only character modal session", () => {
  beforeAll(async () => { document = (await createBookDossierGraphFixture({ now })).document; });
  it("does no constructor IO and opening or initial null cannot acknowledge", () => {
    const f = setup(); expect(f.readCurrent).not.toHaveBeenCalled();
    const request = f.open(), advance = vi.fn(() => true);
    expect(f.session.observe(request, null)).toBe(true); expect(f.session.canPresent(request)).toBe(true);
    expect(f.session.canAcknowledge(f.plan, "character", request)).toBe(false);
    expect(f.session.acknowledge(request, advance)).toBe(false); expect(advance).not.toHaveBeenCalled();
  });
  it("accepts one explicit acknowledgement after the opening token is consumed and exact modal is observed", () => {
    const f = setup(), request = f.open(), receipt = f.receipt(request);
    expect(isFreshBookDossierCharacterViewToken(request.token)).toBe(false);
    expect(f.session.observe(request, receipt)).toBe(true);
    const advance = vi.fn(() => {
      expect(f.session.canAcknowledge(f.plan, "character", receipt)).toBe(true);
      expect(f.session.acknowledge(receipt, () => true)).toBe(false);
      f.session.clear(); return true;
    });
    expect(f.session.acknowledge(receipt, advance)).toBe(true);
    expect(f.session.acknowledge(receipt, advance)).toBe(false); expect(advance).toHaveBeenCalledTimes(1);
  });
  it("Close after observation retires the token and requires a fresh explicit Open", () => {
    const f = setup(), request = f.open(), receipt = f.receipt(request);
    f.session.observe(request, receipt); f.session.observe(request, null);
    expect(f.session.getRequest()).toBeNull(); expect(f.session.canPresent(request)).toBe(false);
    expect(f.session.acknowledge(receipt, () => true)).toBe(false);
    const next = f.open(); expect(next.token).not.toBe(request.token); expect(f.session.canPresent(next)).toBe(true);
  });
  it("ignores an old child null or receipt without clearing a replacement request", () => {
    const f = setup(), old = f.open(), oldReceipt = f.receipt(old); f.session.observe(old, oldReceipt);
    const next = f.open(); expect(f.session.observe(old, null)).toBe(false); expect(f.session.observe(old, oldReceipt)).toBe(false);
    expect(f.session.getRequest()).toBe(next); expect(f.session.acknowledge(oldReceipt, () => true)).toBe(false);
  });
  it("preserves an activation across receipt-only host rendering and equivalent plan recompilation", () => {
    const f = setup(), request = f.open(), receipt = f.receipt(request); f.session.observe(request, receipt);
    f.setCurrent(Object.freeze({ ...f.current(), host: Object.freeze({ ...f.current().host, revision: 2 }) }));
    expect(f.session.canPresent(request)).toBe(true);
    expect(f.session.canAcknowledge({ ...f.plan, nodes: [...f.plan.nodes] }, "character", receipt)).toBe(true);
  });
  it.each(["identity", "profile", "document", "inactive", "locale", "expiry"] as const)("retires authority after %s changes and never revives it on return", change => {
    const f = setup(), request = f.open(), receipt = f.receipt(request), original = f.current(); f.session.observe(request, receipt);
    if (change === "expiry") f.setClock(now + 60_001);
    else if (change === "identity") f.setCurrent({ ...original, identity: {} });
    else if (change === "profile") f.setCurrent({ ...original, profileKey: "another-profile" });
    else f.setCurrent({ ...original, host: { ...original.host, revision: 2,
      ...(change === "document" ? { dossier: structuredClone(f.dossier) } : change === "inactive" ? { active: false } : { locale: "en" }) } });
    expect(f.session.canPresent(request)).toBe(false); f.setCurrent(original); f.setClock(now);
    expect(f.session.canAcknowledge(f.plan, "character", receipt)).toBe(false); expect(f.session.getRequest()).toBeNull();
  });
  it("rejects missing publication and wrong current projection without issuing a token", () => {
    const f = setup(), original = f.current(); f.setCurrent({ ...original, host: { ...original.host, dossier: null } });
    expect(f.open()).toBeNull(); expect(f.session.canOpen(f.plan, "character")).toBe(false);
    f.setCurrent(original); const changed = { ...f.plan, nodes: f.plan.nodes.map(node => ({ ...node, character: { ...node.character!, semanticChecksum: "c".repeat(64) } })) };
    expect(f.session.request(changed, "character")).toBeNull();
  });
  it("rejects owner changes inside the live reader and leaves progress callbacks untouched", () => {
    const f = setup(), request = f.open(), receipt = f.receipt(request); f.session.observe(request, receipt);
    f.readCurrent.mockImplementationOnce(() => { f.session.clear(); return f.current(); });
    const advance = vi.fn(() => true); expect(f.session.acknowledge(receipt, advance)).toBe(false); expect(advance).not.toHaveBeenCalled();
  });
  it("failed advance retains the current observation for an explicit retry; disposal prevents replay", () => {
    const f = setup(), request = f.open(), receipt = f.receipt(request); f.session.observe(request, receipt);
    expect(f.session.acknowledge(receipt, () => false)).toBe(false); expect(f.session.getRequest()).toBe(request);
    f.session.dispose(); expect(f.session.canOpen(f.plan, "character")).toBe(false); expect(f.open()).toBeNull();
  });
  it("hands the exact acknowledged owner to one consecutive character and retains the new request", () => {
    const f = setup(true), request = f.open(), receipt = f.receipt(request); f.session.observe(request, receipt);
    let next: ReturnType<typeof f.open> | null = null;
    expect(f.session.acknowledge(receipt, () => {
      expect(f.session.request(f.plan, "next-character")).toBeNull();
      next = f.session.request(f.plan, "next-character", request);
      expect(next).not.toBeNull(); expect(next!.token).not.toBe(request.token);
      expect(f.session.request(f.plan, "later-character", request)).toBeNull();
      return true;
    })).toBe(true);
    expect(f.session.getRequest()).toBe(next); expect(f.session.observe(request, null)).toBe(false);
    expect(f.session.acknowledge(receipt, () => true)).toBe(false);
    const nextReceipt = f.receipt(next!); expect(f.session.observe(next!, nextReceipt)).toBe(true);
    expect(f.session.canAcknowledge(f.plan, "next-character", nextReceipt)).toBe(true);
  });
  it("rejects wrong, replayed, same-node, skipped-node and cross-route transaction handoffs", () => {
    const f = setup(true), request = f.open(), receipt = f.receipt(request); f.session.observe(request, receipt);
    expect(f.session.request(f.plan, "next-character", request)).toBeNull();
    expect(f.session.acknowledge(receipt, () => {
      expect(f.session.request(f.plan, "next-character", { ...request })).toBeNull();
      expect(f.session.request(f.plan, "character", request)).toBeNull();
      expect(f.session.request(f.plan, "later-character", request)).toBeNull();
      expect(f.session.request({ ...f.plan, id: "other" }, "next-character", request)).toBeNull();
      expect(f.session.getRequest()).toBe(request); return false;
    })).toBe(false);
    expect(f.session.getRequest()).toBe(request);
  });
});

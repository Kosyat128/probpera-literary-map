import type { BookDossierDocumentV2, BookDossierItem, BookDossierPublicBlock, BookDossierSemanticAnchor } from "./bookDossierDocument";
import type { BookDossierDiagram, BookDossierDiagramNode } from "./bookDossierDiagram";

declare const tokenBrand: unique symbol;
export type BookDossierCharacterViewToken = Readonly<{ [tokenBrand]: true }>;
export type BookDossierCharacterViewRequest = Readonly<{
  token: BookDossierCharacterViewToken;
  bookKey: string;
  cacheKey: string;
  anchor: Readonly<BookDossierSemanticAnchor & { itemId: string }>;
}>;
/** Observation of the committed open dialog only. Never editorial authority,
 * acknowledgement, reading progress or permission to navigate elsewhere. */
export type BookDossierCharacterViewReceipt = BookDossierCharacterViewRequest;
/** Caller-owned explicit intent inside the committed native modal. Observation
 * alone never acknowledges a journey, and Close must revoke before any credit. */
export type BookDossierCharacterViewAction = Readonly<{
  receipt: BookDossierCharacterViewReceipt;
  label: string;
  onAcknowledge: (receipt: BookDossierCharacterViewReceipt) => boolean;
}>;
export type BookDossierCharacterViewTarget = Readonly<{
  receipt: BookDossierCharacterViewReceipt;
  node: BookDossierDiagramNode;
  expiresAt: number;
}>;

const issued = new WeakSet<object>(), consumed = new WeakSet<object>();
/** Call only for a new explicit gesture, after the caller presents its target
 * page. Tokens are ephemeral capabilities, never serialized or stored. */
export function createBookDossierCharacterViewToken(): BookDossierCharacterViewToken {
  const token = Object.freeze(Object.create(null)) as BookDossierCharacterViewToken;
  issued.add(token);
  return token;
}
export function isFreshBookDossierCharacterViewToken(token: unknown): token is BookDossierCharacterViewToken {
  return !!token && typeof token === "object" && issued.has(token) && !consumed.has(token);
}
export function consumeBookDossierCharacterViewToken(token: unknown): boolean {
  if (!isFreshBookDossierCharacterViewToken(token)) return false;
  consumed.add(token); return true;
}
function row(input: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).length !== fields.length) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    result[field] = descriptor.value;
  }
  return result;
}
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9_.:-]{0,95}$/u.test(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0
  && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
export function bookDossierCharacterRequestToken(input: unknown): BookDossierCharacterViewToken | null {
  try {
    const request = row(input, ["token", "bookKey", "cacheKey", "anchor"]), token = request?.token;
    return token && typeof token === "object" && issued.has(token) ? token as BookDossierCharacterViewToken : null;
  } catch { return null; }
}
export function sameBookDossierCharacterView(left: BookDossierCharacterViewReceipt, right: BookDossierCharacterViewReceipt): boolean {
  return left.token === right.token && left.bookKey === right.bookKey && left.cacheKey === right.cacheKey
    && left.anchor.sectionId === right.anchor.sectionId && left.anchor.blockId === right.anchor.blockId
    && left.anchor.itemId === right.anchor.itemId && left.anchor.dossierVersion === right.anchor.dossierVersion
    && left.anchor.locale === right.anchor.locale && left.anchor.readingMode === right.anchor.readingMode;
}

/** The caller supplies its already filtered trusted public document/diagram.
 * A matching preview shape is not published-delivery authority. No fallback,
 * locale remapping, source fetch, public-catalog discovery or page navigation. */
export function resolveBookDossierCharacterView(dossier: BookDossierDocumentV2 | null,
  diagram: BookDossierDiagram | null, input: unknown, now: number): BookDossierCharacterViewTarget | null {
  try {
    const request = row(input, ["token", "bookKey", "cacheKey", "anchor"]), token = bookDossierCharacterRequestToken(input);
    const anchor = request && row(request.anchor, ["sectionId", "blockId", "itemId", "dossierVersion", "locale", "readingMode"]);
    if (!request || !token || !anchor || !dossier || !diagram || !Number.isFinite(now)
      || !text(request.bookKey, 240) || !text(request.cacheKey, 4096)
      || ![anchor.sectionId, anchor.blockId, anchor.itemId, anchor.dossierVersion].every(key)
      || anchor.locale !== "ru" && anchor.locale !== "en"
      || !["BEFORE_READING", "DURING_READING", "AFTER_READING"].includes(String(anchor.readingMode))) return null;
    const expiresAt = typeof dossier.validUntil === "string" ? Date.parse(dossier.validUntil) : NaN;
    if (dossier.schemaVersion !== 2 || dossier.contentMode !== "DOSSIER_ONLY" || !dossier.profile || !dossier.tier
      || dossier.bookKey !== request.bookKey || dossier.cacheKey !== request.cacheKey
      || dossier.dossierVersion !== anchor.dossierVersion || dossier.locale !== anchor.locale || dossier.readingMode !== anchor.readingMode
      || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 65_000
      || !Array.isArray(dossier.pages) || dossier.pages.length > 18 || !Array.isArray(diagram.nodes) || diagram.nodes.length > 18 * 8 * 24) return null;
    const pages = dossier.pages.filter(page => page.sectionId === anchor.sectionId);
    if (pages.length !== 1 || pages[0].blocks.length > 8) return null;
    const blocks = pages[0].blocks.filter((block: BookDossierPublicBlock) => block.id === anchor.blockId && block.kind === "characters");
    if (blocks.length !== 1 || blocks[0].items.length > 24) return null;
    const items = blocks[0].items.filter((item: BookDossierItem) => item.id === anchor.itemId);
    if (items.length !== 1 || items[0].fromId !== undefined || items[0].toId !== undefined) return null;
    const nodes = diagram.nodes.filter(node => node.item.id === anchor.itemId);
    const scope = diagram.anchor;
    if (nodes.length !== 1 || nodes[0].item !== items[0] || scope.sectionId !== anchor.sectionId
      || scope.locale !== anchor.locale || scope.dossierVersion !== anchor.dossierVersion || scope.readingMode !== anchor.readingMode) return null;
    const receipt: BookDossierCharacterViewReceipt = Object.freeze({ token, bookKey: request.bookKey, cacheKey: request.cacheKey,
      anchor: Object.freeze({ sectionId: anchor.sectionId as string, blockId: anchor.blockId as string,
        itemId: anchor.itemId as string, dossierVersion: anchor.dossierVersion as string,
        locale: anchor.locale, readingMode: anchor.readingMode as BookDossierSemanticAnchor["readingMode"] }) });
    if (!sameBookDossierCharacterView(receipt, { ...receipt, anchor: nodes[0].anchor as typeof receipt.anchor })) return null;
    return Object.freeze({ receipt, node: nodes[0], expiresAt });
  } catch { return null; }
}

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKY_DIALOGUE_DRAFTS, BOOKY_DIALOGUE_DRAFT_INVENTORY } from "./bookyDialogueDrafts";
import {
  createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialogueRecord,
} from "./bookyDialogueRegistry";
import { BOOKY_SUPPORT_COPY_METADATA, getBookySupport, type BookySupportInput } from "./bookySupport";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const ready: BookySupportInput = {
  connectivity: "online", screen: "globe", countryStatus: "ready", booksStatus: "ready",
};
const scenarios = [
  ["countries-error", { countryStatus: "error" }],
  ["books-error", { screen: "collection", booksStatus: "error" }],
  ["countries-loading", { countryStatus: "loading" }],
  ["books-loading", { screen: "collection", booksStatus: "loading" }],
  ["offline", { connectivity: "offline" }],
  ["network-unknown", { connectivity: "unknown" }],
] as const satisfies readonly (readonly [string, Partial<BookySupportInput>])[];
const policy = { canonicalEntityIds: [], approvedReviews: [] } as const;
const request = ({ payload }: BookyDialogueRecord) => ({
  id: payload.id, locale: payload.locale, audience: "adult", age: 30,
  readingLevel: payload.readingLevel, intent: payload.intent, screen: payload.screens[0],
  context: payload.context, entityIds: [], now: "2026-09-20T00:00:00.000Z",
});

describe("unreviewed bilingual Booky support inventory", () => {
  it("binds the fixed source version and LF checksum without regenerating either", () => {
    const source = readFileSync(new URL("./bookySupport.ts", import.meta.url), "utf8");
    const provenance = BOOKY_DIALOGUE_DRAFT_INVENTORY.source;
    expect(provenance).toEqual({
      sourcePath: "src/host/bookySupport.ts",
      sourceCommit: "707044e708cb5b0ce1b564b378cc5adffd574f12",
      sourceVersion: 1,
      sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
      sourceHashEncoding: "sha256:utf8:lf",
      copyHashEncoding: "sha256:utf8:JSON.stringify({title,body})",
    });
    expect(sha256(source.replace(/\r\n/g, "\n"))).toBe(provenance.sourceSha256);
    expect(sha256(source.replace(/\r\n/g, "\n") + "\n")).not.toBe(provenance.sourceSha256);
    expect(BOOKY_SUPPORT_COPY_METADATA).toEqual({ status: "draft", releaseReady: false });
  });

  it.each(scenarios)("keeps exact RU/EN %s text and independently verifiable declared hashes", (state, changes) => {
    const live = getBookySupport({ ...ready, ...changes });
    expect(live?.id).toBe(state);
    const rows = BOOKY_DIALOGUE_DRAFTS.filter(record => record.payload.context === state);
    expect(rows.map(record => record.payload.locale).sort()).toEqual(["en", "ru"]);
    for (const { payload, review, checksum } of rows) {
      const { title, body } = payload.copy;
      expect(payload.id).toBe("support." + state);
      expect(title).toBe(live?.title[payload.locale]);
      expect(body).toBe(live?.body[payload.locale]);
      expect(payload.copy.caption).toBe(title);
      expect(payload.copy.reduced).toBe(title);
      expect(payload.provenance).toEqual({
        kind: "existing-interface-copy", sourcePath: BOOKY_DIALOGUE_DRAFT_INVENTORY.source.sourcePath,
        sourceVersion: 1,
        sourceRef: BOOKY_DIALOGUE_DRAFT_INVENTORY.source.sourceCommit + ":" + state + ":" + payload.locale,
        sourceSha256: BOOKY_DIALOGUE_DRAFT_INVENTORY.source.sourceSha256,
        copySha256: sha256(JSON.stringify({ title, body })),
      });
      expect(review.contentChecksum).toBe(getBookyDialogueContentChecksum(payload));
      expect(checksum).toBe(getBookyDialogueChecksum({ payload, review }));
    }
  });

  it("retains twelve structural drafts but admits none as adult or child reviewed dialogue", () => {
    const registry = createBookyDialogueRegistry(BOOKY_DIALOGUE_DRAFTS, policy);
    expect(BOOKY_DIALOGUE_DRAFTS).toHaveLength(12);
    expect(registry.size).toBe(12);
    expect(registry.rejections).toEqual([]);
    expect(BOOKY_DIALOGUE_DRAFT_INVENTORY).toMatchObject({
      recordCount: 12, status: "draft", humanReviewed: false, childApproved: false,
      narrationApproved: false, releaseReady: false,
    });
    for (const record of BOOKY_DIALOGUE_DRAFTS) {
      expect(record.review).toMatchObject({ status: "draft", reviewer: null, reviewedAt: null });
      expect(record.payload).toMatchObject({
        audience: "adult", ageRange: { min: 18, max: 120 }, readingLevel: "plain",
        claimKind: "interface-guidance", entityIds: [], factualSources: [], narration: null, prohibitedTags: [],
      });
      for (const screen of record.payload.screens) {
        expect(registry.resolve({ ...request(record), screen })).toBeNull();
        expect(registry.resolve({ ...request(record), screen, audience: "child", age: 10 })).toBeNull();
      }
    }
  });

  it("rejects a changed line under the original declarations and keeps exported inventory immutable", () => {
    const first = BOOKY_DIALOGUE_DRAFTS[0];
    const changed = { ...first, payload: { ...first.payload, copy: { ...first.payload.copy, body: "Changed." } } };
    const registry = createBookyDialogueRegistry([changed], policy);
    expect(registry.size).toBe(0);
    expect(registry.rejections).toHaveLength(1);
    expect(registry.resolve(request(first))).toBeNull();
    function assertFrozen(value: unknown): void {
      if (value !== null && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        for (const child of Object.values(value)) assertFrozen(child);
      }
    }
    assertFrozen(BOOKY_DIALOGUE_DRAFTS);
    assertFrozen(BOOKY_DIALOGUE_DRAFT_INVENTORY);
  });
});

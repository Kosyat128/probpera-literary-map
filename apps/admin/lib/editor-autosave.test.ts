import { describe, expect, it } from "vitest";

import {
  advanceEditorAutosaveSequence,
  editorAutosaveSessionStorageKey,
  normalizeEditorDraftScope,
  parseEditorAutosaveSnapshot,
  resolveEditorAutosaveSession,
} from "./editor-autosave";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const locator = {
  entityType: "article" as const,
  entityId: null,
  draftScope: " Новая статья / Иван ",
  localeScope: "BILINGUAL",
  baseUpdatedAt: null,
};

describe("editor autosave client contract", () => {
  it("normalizes scopes into a stable per-tab storage key", () => {
    expect(normalizeEditorDraftScope(locator.draftScope)).toBe(
      "Новая-статья-Иван"
    );
    expect(editorAutosaveSessionStorageKey(locator)).toBe(
      "probpera-editor-autosave:article:Новая-статья-Иван:bilingual"
    );
  });

  it("keeps one session id and advances a monotonic sequence", () => {
    const storage = new MemoryStorage();
    const uuid = "7ad1ab89-8a77-407d-b59a-6147c0e2a7a6";
    const created = resolveEditorAutosaveSession(storage, locator, () => uuid);
    const next = advanceEditorAutosaveSequence(storage, created);
    const restored = resolveEditorAutosaveSession(storage, locator, () => {
      throw new Error("must reuse the stored session");
    });
    expect(next.sequence).toBe(1);
    expect(restored).toEqual(next);
  });

  it("accepts object snapshots and rejects arrays", () => {
    expect(parseEditorAutosaveSnapshot('{"title":"Текст"}')).toEqual({
      title: "Текст",
    });
    expect(() => parseEditorAutosaveSnapshot("[]")).toThrow(
      "должна быть объектом"
    );
  });
});

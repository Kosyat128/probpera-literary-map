import { describe, expect, it, vi } from "vitest";
import { advanceEditorAutosaveSequence, resolveEditorAutosaveSession, type EditorAutosaveLocator } from "./editor-autosave";
import { createEditorAutosaveMetadataStorage } from "./editor-autosave-storage";

const sessionId = "12345678\u002d1234\u002d4234\u002d9234\u002d123456789012";
const locator: EditorAutosaveLocator = {
  entityType: "page", entityId: sessionId, draftScope: sessionId, localeScope: "default", baseUpdatedAt: null,
};
function persistentStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}
function unavailable(): never { throw new Error("Private browser storage fixture"); }

describe("editor autosave metadata storage availability", () => {
  it("passes known metadata through without rewriting stored representation", () => {
    const persistent = persistentStorage({ receipt: "  exact metadata  ", empty: "" });
    const storage = createEditorAutosaveMetadataStorage(() => persistent);
    expect(storage.getItem("receipt")).toBe("  exact metadata  ");
    expect(storage.getItem("empty")).toBe("");
    expect(storage.getItem("absent")).toBeNull();
    storage.setItem("receipt", "new exact metadata");
    expect(persistent.values.get("receipt")).toBe("new exact metadata");
    storage.removeItem("receipt");
    expect(persistent.values.has("receipt")).toBe(false);
  });

  it.each(["getter", "getItem", "setItem"] as const)("uses the actual resolver and monotonic sequence when %s is unavailable", (failure) => {
    const persistent = persistentStorage();
    const getStorage = vi.fn(() => {
      if (failure === "getter") unavailable();
      return persistent;
    });
    if (failure === "getItem") persistent.getItem.mockImplementation(unavailable);
    if (failure === "setItem") persistent.setItem.mockImplementation(unavailable);
    const storage = createEditorAutosaveMetadataStorage(getStorage);
    const randomUuid = vi.fn(() => sessionId);
    const initial = resolveEditorAutosaveSession(storage, locator, randomUuid);
    const next = advanceEditorAutosaveSequence(storage, initial);
    const final = advanceEditorAutosaveSequence(storage, next);
    const restored = resolveEditorAutosaveSession(storage, locator, randomUuid);
    expect(randomUuid).toHaveBeenCalledOnce();
    expect(initial.sequence).toBe(0); expect(next.sequence).toBe(1); expect(final.sequence).toBe(2);
    expect(restored).toEqual(final); expect(restored.id).toBe(sessionId);
    const callsAfterFailure = getStorage.mock.calls.length;
    storage.setItem("receipt", "confirmed metadata");
    expect(storage.getItem("receipt")).toBe("confirmed metadata");
    storage.removeItem("receipt"); expect(storage.getItem("receipt")).toBeNull();
    expect(getStorage).toHaveBeenCalledTimes(callsAfterFailure);
  });

  it("keeps unknown durable metadata intact after a failed initial read", () => {
    const persistent = persistentStorage({ unknown: "must remain intact" });
    persistent.getItem.mockImplementation(unavailable);
    const storage = createEditorAutosaveMetadataStorage(() => persistent);
    resolveEditorAutosaveSession(storage, locator, () => sessionId);
    storage.removeItem("unknown");
    expect(persistent.values.get("unknown")).toBe("must remain intact");
    expect(persistent.setItem).not.toHaveBeenCalled(); expect(persistent.removeItem).not.toHaveBeenCalled();
  });

  it("retains the known session identity when storage becomes unavailable after initial load", () => {
    const persistent = persistentStorage();
    const storage = createEditorAutosaveMetadataStorage(() => persistent);
    const initial = resolveEditorAutosaveSession(storage, locator, () => sessionId);
    const oldValue = persistent.values.get(initial.storageKey);
    persistent.setItem.mockImplementation(unavailable);
    const next = advanceEditorAutosaveSequence(storage, initial);
    expect(resolveEditorAutosaveSession(storage, locator, unavailable)).toEqual(next);
    expect(persistent.values.get(initial.storageKey)).toBe(oldValue);
  });

  it("retains a known receipt in memory when its storage write fails", () => {
    const persistent = persistentStorage();
    const storage = createEditorAutosaveMetadataStorage(() => persistent);
    storage.getItem("receipt");
    persistent.setItem.mockImplementation(unavailable);
    storage.setItem("receipt", "server receipt only");
    expect(storage.getItem("receipt")).toBe("server receipt only");
    expect(persistent.values.has("receipt")).toBe(false);
  });

  it("handles remove failure without retrying against unknown durable metadata", () => {
    const persistent = persistentStorage({ receipt: "acknowledged metadata", other: "unrelated" });
    const storage = createEditorAutosaveMetadataStorage(() => persistent);
    expect(storage.getItem("receipt")).toBe("acknowledged metadata");
    persistent.removeItem.mockImplementation(unavailable);
    expect(() => storage.removeItem("receipt")).not.toThrow();
    expect(storage.getItem("receipt")).toBeNull();
    storage.removeItem("other");
    expect(persistent.removeItem).toHaveBeenCalledOnce();
    expect(persistent.values.get("receipt")).toBe("acknowledged metadata");
    expect(persistent.values.get("other")).toBe("unrelated");
  });

  it("isolates ephemeral metadata between component mounts", () => {
    const first = createEditorAutosaveMetadataStorage(unavailable);
    const second = createEditorAutosaveMetadataStorage(unavailable);
    first.setItem("receipt", "first mount only");
    expect(first.getItem("receipt")).toBe("first mount only");
    expect(second.getItem("receipt")).toBeNull();
  });
});

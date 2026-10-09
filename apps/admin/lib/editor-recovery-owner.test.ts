import { describe, expect, it } from "vitest";
import { canUseRecoveryCopy, discardRecoveryCopy, persistRecoveryCopy, readRecoveryCopy, recoveryCopyOwnerState,
  recoveryCopyStorageKey, withRecoveryCopyOwner } from "./editor-recovery-owner";

const actorA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authorCopy = Object.freeze({
  version: 2,
  title: "Ручной RU текст: дефис - сохранён",
  contentHtml: "<p>Manual EN &amp; RU</p>",
  contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Manual author text"}]}]}',
  sourceText: "Author source URL and credit",
  english: Object.freeze({ title: "Manual EN title", sourceText: "English author source" }),
  savedAt: 1700000000000,
});

function copyStorage(entries: Array<[string, string]> = []) {
  const values = new Map(entries);
  const writes: Array<[string, string]> = [];
  const removals: string[] = [];
  return {
    values, writes, removals,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); writes.push([key, value]); },
    removeItem: (key: string) => { values.delete(key); removals.push(key); },
  };
}

describe("Owned recovery copy storage", () => {
  const baseKey = "probpera-editor-cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const keyA = recoveryCopyStorageKey(baseKey, actorA);
  const keyB = recoveryCopyStorageKey(baseKey, actorB);
  const rawA = JSON.stringify(withRecoveryCopyOwner(authorCopy, actorA));

  it("reads the actor's primary first and only falls back when it is absent", () => {
    const storage = copyStorage([[baseKey, rawA], [keyB, JSON.stringify(withRecoveryCopyOwner({ ...authorCopy, title: "Own B" }, actorB))]]);
    expect(JSON.parse(readRecoveryCopy(storage, baseKey, actorB)!).title).toBe("Own B");
    expect(readRecoveryCopy(storage, baseKey, actorA)).toBe(rawA);
    expect(readRecoveryCopy(storage, baseKey)).toBe(rawA);
    expect(storage.writes).toEqual([]);
    expect(storage.removals).toEqual([]);
  });

  it("keeps A and B author copies independently while preserving the foreign shared bytes", () => {
    const storage = copyStorage();
    persistRecoveryCopy(storage, baseKey, authorCopy, actorA);
    const sharedA = storage.getItem(baseKey);
    persistRecoveryCopy(storage, baseKey, { ...authorCopy, title: "Fresh own B" }, actorB);
    expect(storage.getItem(baseKey)).toBe(sharedA);
    expect(storage.getItem(keyA)).toBe(sharedA);
    const ownB = JSON.parse(storage.getItem(keyB)!);
    expect(ownB.title).toBe("Fresh own B");
    expect(ownB.recoveryActorId).toBe(actorB);
    expect(ownB.contentJson).toBe(authorCopy.contentJson);
    expect(readRecoveryCopy(storage, baseKey, actorA)).toBe(sharedA);
    expect(readRecoveryCopy(storage, baseKey, actorB)).toBe(storage.getItem(keyB));
  });

  it("retains corrupted primary bytes instead of falling back, overwriting or discarding", () => {
    const storage = copyStorage([[keyA, "{damaged"], [baseKey, rawA]]);
    expect(readRecoveryCopy(storage, baseKey, actorA)).toBe("{damaged");
    expect(() => persistRecoveryCopy(storage, baseKey, authorCopy, actorA)).toThrow("Preserved original recovery copy");
    expect(discardRecoveryCopy(storage, baseKey, actorA)).toBe(false);
    expect(storage.getItem(keyA)).toBe("{damaged");
    expect(storage.getItem(baseKey)).toBe(rawA);
    expect(storage.writes).toEqual([]);
    expect(storage.removals).toEqual([]);
  });

  it("refuses an unexpected foreign owner under the current actor's primary key", () => {
    const storage = copyStorage([[keyB, rawA]]);
    expect(() => persistRecoveryCopy(storage, baseKey, authorCopy, actorB)).toThrow("Preserved original recovery copy");
    expect(discardRecoveryCopy(storage, baseKey, actorB)).toBe(false);
    expect(storage.getItem(keyB)).toBe(rawA);
    expect(storage.writes).toEqual([]);
    expect(storage.removals).toEqual([]);
  });

  it("preserves a corrupt shared mirror while confirming an independent owned primary", () => {
    const storage = copyStorage([[baseKey, "{broken mirror"]]);
    persistRecoveryCopy(storage, baseKey, authorCopy, actorA);
    expect(storage.getItem(baseKey)).toBe("{broken mirror");
    expect(storage.getItem(keyA)).toBe(rawA);
    expect(storage.writes).toEqual([[keyA, rawA]]);
  });

  it("allows a legacy shared copy without assigning ownership during read or discard", () => {
    const legacy = JSON.stringify(authorCopy);
    const storage = copyStorage([[baseKey, legacy]]);
    expect(readRecoveryCopy(storage, baseKey, actorA)).toBe(legacy);
    expect(storage.getItem(baseKey)).toBe(legacy);
    expect(discardRecoveryCopy(storage, baseKey, actorA)).toBe(true);
    expect(storage.getItem(baseKey)).toBeNull();
    expect(storage.writes).toEqual([]);
  });

  it("discards only A's confirmed copies while B's independent author data survives", () => {
    const storage = copyStorage();
    persistRecoveryCopy(storage, baseKey, authorCopy, actorA);
    persistRecoveryCopy(storage, baseKey, { ...authorCopy, title: "Own B remains" }, actorB);
    const ownB = storage.getItem(keyB);
    expect(discardRecoveryCopy(storage, baseKey, actorA)).toBe(true);
    expect(storage.getItem(keyA)).toBeNull();
    expect(storage.getItem(baseKey)).toBeNull();
    expect(storage.getItem(keyB)).toBe(ownB);
    expect(storage.removals).toEqual([keyA, baseKey]);
  });

  it("keeps a distinct newer mirror even when its owner matches the discarded primary", () => {
    const newer = JSON.stringify(withRecoveryCopyOwner({ ...authorCopy, title: "Later C" }, actorA));
    const storage = copyStorage([[keyA, rawA], [baseKey, newer]]);
    expect(discardRecoveryCopy(storage, baseKey, actorA)).toBe(true);
    expect(storage.getItem(keyA)).toBeNull();
    expect(storage.getItem(baseKey)).toBe(newer);
  });

  it("refuses a foreign fallback and an absent copy without issuing any removal", () => {
    const storage = copyStorage([[baseKey, rawA]]);
    expect(discardRecoveryCopy(storage, baseKey, actorB)).toBe(false);
    expect(discardRecoveryCopy(copyStorage(), baseKey, actorB)).toBe(false);
    expect(storage.getItem(baseKey)).toBe(rawA);
    expect(storage.removals).toEqual([]);
  });

  it("keeps the actorless legacy write shape and rejects an unconfirmed primary write", () => {
    const legacy = copyStorage();
    persistRecoveryCopy(legacy, baseKey, authorCopy);
    expect(legacy.getItem(baseKey)).toBe(JSON.stringify(authorCopy));
    const denied = { getItem: () => null, setItem: () => {} };
    expect(() => persistRecoveryCopy(denied, baseKey, authorCopy, actorA)).toThrow("Unconfirmed recovery copy");
  });

  it("uses the confirmed primary when the optional mirror cannot be written", () => {
    const storage = copyStorage();
    const blockedMirror = { getItem: storage.getItem, setItem: (key: string, value: string) => {
      if (key === baseKey) throw new Error("Mirror denied");
      storage.setItem(key, value);
    } };
    expect(() => persistRecoveryCopy(blockedMirror, baseKey, authorCopy, actorA)).not.toThrow();
    expect(readRecoveryCopy(storage, baseKey, actorA)).toBe(rawA);
    expect(storage.getItem(baseKey)).toBeNull();
  });

  it("never claims successful discard when primary or compatible mirror removal fails", () => {
    const storage = copyStorage([[keyA, rawA], [baseKey, rawA]]);
    const deniedPrimary = { getItem: storage.getItem, removeItem: () => {} };
    expect(() => discardRecoveryCopy(deniedPrimary, baseKey, actorA)).toThrow("Unconfirmed recovery discard");
    expect(storage.getItem(keyA)).toBe(rawA);
    const deniedMirror = { getItem: storage.getItem, removeItem: (key: string) => {
      if (key !== baseKey) storage.removeItem(key);
    } };
    expect(() => discardRecoveryCopy(deniedMirror, baseKey, actorA)).toThrow("Unconfirmed recovery mirror discard");
    expect(storage.getItem(baseKey)).toBe(rawA);
  });

  it("propagates unavailable primary storage instead of silently using the shared key", () => {
    const denied = { getItem: () => { throw new Error("Primary read denied"); }, setItem: () => {}, removeItem: () => {} };
    expect(() => readRecoveryCopy(denied, baseKey, actorA)).toThrow("Primary read denied");
    expect(() => persistRecoveryCopy(denied, baseKey, authorCopy, actorA)).toThrow("Primary read denied");
    expect(() => discardRecoveryCopy(denied, baseKey, actorA)).toThrow("Primary read denied");
  });
});

describe("Local editor recovery ownership", () => {
  it("keeps a legacy copy usable and unknown-owner without adding metadata on read", () => {
    expect(recoveryCopyOwnerState(authorCopy, actorA)).toBe("legacy");
    expect(canUseRecoveryCopy(authorCopy, actorA)).toBe(true);
    expect(canUseRecoveryCopy(authorCopy)).toBe(true);
    expect(Object.hasOwn(authorCopy, "recoveryActorId")).toBe(false);
  });

  it("accepts the same UUID irrespective of case without rewriting stored bytes", () => {
    const copy = Object.freeze({ ...authorCopy, recoveryActorId: actorA.toUpperCase() });
    expect(recoveryCopyOwnerState(copy, actorA)).toBe("own");
    expect(recoveryCopyOwnerState(copy, actorA.toUpperCase())).toBe("own");
    expect(canUseRecoveryCopy(copy, actorA)).toBe(true);
    expect(copy.recoveryActorId).toBe(actorA.toUpperCase());
  });

  it("refuses another actor's plain copy even when a locator names the current actor", () => {
    const copy = Object.freeze({ ...authorCopy, recoveryActorId: actorA, pendingPageOperation: { actorId: actorB } });
    expect(recoveryCopyOwnerState(copy, actorB)).toBe("foreign");
    expect(canUseRecoveryCopy(copy, actorB)).toBe(false);
    expect(copy.recoveryActorId).toBe(actorA);
  });

  it("never treats a marked copy as owned when the current actor is absent or malformed", () => {
    const copy = { ...authorCopy, recoveryActorId: actorA };
    for (const actor of [undefined, "", "invalid-actor"]) {
      expect(recoveryCopyOwnerState(copy, actor)).toBe("foreign");
      expect(canUseRecoveryCopy(copy, actor)).toBe(false);
    }
  });

  it.each([
    ["missing value", undefined], ["null", null], ["false", false], ["number", 1],
    ["array", [actorA]], ["object", { actorId: actorA }], ["invalid UUID", "not-a-uuid"],
  ])("preserves but refuses a present malformed owner marker: %s", (_name, recoveryActorId) => {
    const copy = Object.freeze({ ...authorCopy, recoveryActorId });
    expect(recoveryCopyOwnerState(copy, actorA)).toBe("invalid");
    expect(canUseRecoveryCopy(copy, actorA)).toBe(false);
    expect(copy.recoveryActorId).toBe(recoveryActorId);
  });

  it("refuses non-object and array copies, including an array carrying a valid marker", () => {
    const taggedArray = Object.assign([], { recoveryActorId: actorA });
    for (const value of [undefined, null, false, 3, "copy", [], taggedArray]) {
      expect(recoveryCopyOwnerState(value, actorA)).toBe("invalid");
      expect(canUseRecoveryCopy(value, actorA)).toBe(false);
    }
  });

  it("fails closed when a damaged owner property cannot be read", () => {
    const copy = Object.defineProperty({ ...authorCopy }, "recoveryActorId", {
      get() { throw new Error("Unreadable recovery owner"); },
    });
    expect(recoveryCopyOwnerState(copy, actorA)).toBe("invalid");
    expect(canUseRecoveryCopy(copy, actorA)).toBe(false);
  });

  it("tags a new full copy without changing author text, nested data or the input", () => {
    const tagged = withRecoveryCopyOwner(authorCopy, actorA);
    expect(tagged).toEqual({ ...authorCopy, recoveryActorId: actorA });
    expect(tagged).not.toBe(authorCopy);
    expect(tagged.english).toBe(authorCopy.english);
    expect(Object.hasOwn(authorCopy, "recoveryActorId")).toBe(false);
    expect(recoveryCopyOwnerState(tagged, actorA)).toBe("own");
  });

  it("does not claim legacy ownership when no actor is supplied for a new write", () => {
    const copied = withRecoveryCopyOwner(authorCopy);
    expect(copied).toEqual(authorCopy);
    expect(Object.hasOwn(copied, "recoveryActorId")).toBe(false);
    expect(recoveryCopyOwnerState(copied, actorB)).toBe("legacy");
    const alreadyMarked = Object.freeze({ ...authorCopy, recoveryActorId: actorA });
    expect(withRecoveryCopyOwner(alreadyMarked)).toEqual(alreadyMarked);
  });

  it("rejects a supplied malformed actor before writing any ownership metadata", () => {
    for (const actor of ["", "bad", " " + actorA, actorA + " "]) {
      expect(() => withRecoveryCopyOwner(authorCopy, actor)).toThrow("Invalid recovery copy actor");
    }
    expect(Object.hasOwn(authorCopy, "recoveryActorId")).toBe(false);
  });

  it("gives each actor a stable copy key while retaining the original entity key", () => {
    const baseKey = "probpera-page-editor-cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect(recoveryCopyStorageKey(baseKey)).toBe(baseKey);
    expect(recoveryCopyStorageKey(baseKey, actorA)).toBe(`${baseKey}:actor:${actorA}`);
    expect(recoveryCopyStorageKey(baseKey, actorA.toUpperCase())).toBe(recoveryCopyStorageKey(baseKey, actorA));
    expect(recoveryCopyStorageKey(baseKey, actorB)).not.toBe(recoveryCopyStorageKey(baseKey, actorA));
  });

  it("refuses malformed actor keys rather than falling back to the shared copy", () => {
    for (const actor of ["", "bad", " " + actorA]) {
      expect(() => recoveryCopyStorageKey("probpera-editor-new", actor)).toThrow("Invalid recovery copy actor");
    }
  });
});

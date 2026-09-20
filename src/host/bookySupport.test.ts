import { describe, expect, it } from "vitest";
import { BOOKY_SUPPORT_COPY_METADATA, getBookySupport, type BookySupportInput } from "./bookySupport";

const ready: BookySupportInput = Object.freeze({
  connectivity: "online", screen: "globe", countryStatus: "ready", booksStatus: "ready",
});
const guidance = (changes: Partial<BookySupportInput> = {}) => getBookySupport({ ...ready, ...changes });

describe("adult Booky support guidance", () => {
  it.each(["online", "offline", "unknown"] as const)("keeps a visible collection error actionable with %s connectivity", connectivity => {
    const result = guidance({ connectivity, screen: "collection", countryStatus: "error", booksStatus: "error" });
    expect(result?.id).toBe("books-error");
    expect(result?.retry).toBe("books");
    expect(result?.kind).toBe("error");
  });

  it.each(["online", "offline", "unknown"] as const)("does not hide a country error behind loading or %s connectivity", connectivity => {
    const result = guidance({ connectivity, screen: "collection", countryStatus: "error", booksStatus: "loading" });
    expect(result?.id).toBe("countries-error");
    expect(result?.retry).toBe("countries");
    expect(result?.kind).toBe("error");
  });

  it.each(["error", "loading"] as const)("ignores %s collection state while exploring the globe", booksStatus => {
    expect(guidance({ booksStatus })).toBeNull();
    expect(guidance({ booksStatus, countryStatus: "error" })?.id).toBe("countries-error");
    expect(guidance({ booksStatus, countryStatus: "loading" })?.id).toBe("countries-loading");
    expect(guidance({ booksStatus, connectivity: "offline" })?.id).toBe("offline");
  });

  it("describes the visible collection loading before a concurrent country load", () => {
    const result = guidance({ screen: "collection", countryStatus: "loading", booksStatus: "loading" });
    expect(result?.id).toBe("books-loading");
    expect(result?.kind).toBe("loading");
    expect(result?.retry).toBeNull();
  });

  it.each(["offline", "unknown"] as const)("keeps a real load visible with %s connectivity without offering a duplicate retry", connectivity => {
    for (const changes of [
      { countryStatus: "loading" },
      { screen: "collection", booksStatus: "loading" },
    ] satisfies Partial<BookySupportInput>[]) {
      const result = guidance({ connectivity, ...changes });
      expect(result?.kind).toBe("loading");
      expect(result?.retry).toBeNull();
    }
  });

  it("distinguishes unknown connectivity from offline without claiming online content success", () => {
    const offline = guidance({ connectivity: "offline" });
    const unknown = guidance({ connectivity: "unknown" });
    expect(offline?.id).toBe("offline");
    expect(unknown?.id).toBe("network-unknown");
    expect(unknown).not.toBe(offline);
    expect(offline?.retry).toBeNull();
    expect(unknown?.retry).toBeNull();
    expect(guidance()).toBeNull();
    expect(guidance({ countryStatus: "idle", booksStatus: "idle" })).toBeNull();
    expect(offline?.body.en).toContain("only materials already available on this device");
    expect(offline?.body.ru).toContain("только материалами, уже доступными на устройстве");
    expect(unknown?.body.en).toContain("not yet known");
    expect(unknown?.body.ru).toContain("Пока неизвестно");
  });

  it("keeps all six RU/EN draft messages complete, deeply immutable and referentially stable", () => {
    const scenarios: Partial<BookySupportInput>[] = [
      { countryStatus: "error" },
      { screen: "collection", booksStatus: "error" },
      { countryStatus: "loading" },
      { screen: "collection", booksStatus: "loading" },
      { connectivity: "offline" },
      { connectivity: "unknown" },
    ];
    const ids = new Set<string>();
    for (const changes of scenarios) {
      const input = Object.freeze({ ...ready, ...changes });
      const result = getBookySupport(input)!;
      ids.add(result.id);
      expect(getBookySupport({ ...input })).toBe(result);
      expect(Object.isFrozen(result)).toBe(true);
      for (const text of [result.title, result.body]) {
        expect(Object.isFrozen(text)).toBe(true);
        expect(text.ru).toMatch(/[А-Яа-яЁё]/u);
        expect(text.en).toMatch(/[A-Za-z]/u);
        expect(text.en).not.toMatch(/[А-Яа-яЁё]/u);
        expect(text.ru).not.toBe(text.en);
      }
      expect(input).toEqual({ ...ready, ...changes });
    }
    expect(ids.size).toBe(6);
    expect(BOOKY_SUPPORT_COPY_METADATA).toEqual({ status: "draft", releaseReady: false });
    expect(Object.isFrozen(BOOKY_SUPPORT_COPY_METADATA)).toBe(true);
  });
});

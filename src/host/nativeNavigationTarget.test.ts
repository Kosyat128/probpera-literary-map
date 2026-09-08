import { describe, expect, it } from "vitest";
import { parseNativeNavigationUrl } from "./NativeNavigation";
import { nativeNavigationEntryState, nativeNavigationTarget } from "./nativeNavigationTarget";

const current = "https://localhost/ru/?country=russia&writer=dostoevsky&atlasView=immersive&book=russia:dostoevsky:crime&archiveShelf=all#books";
const merge = (link: string, from = current) => {
  const intent = parseNativeNavigationUrl(link);
  if (!intent) throw new Error("Invalid test link");
  return nativeNavigationTarget(from, intent);
};
describe("canonical native partial navigation", () => {
  it("changes only the locale path without losing book, writer, shelf, view or fragment", () => {
    expect(merge("https://probpera.ru/en/")).toEqual({
      relative: current.replace("https://localhost/ru/", "/en/"), localeOnly: true,
    });
    expect(merge("https://probpera.ru/")).toEqual({
      relative: current.replace("https://localhost", ""), localeOnly: true,
    });
  });
  it("changes the destination section while retaining the current scene selection", () => {
    const result = merge("https://probpera.ru/en/#calendar");
    expect(result.localeOnly).toBe(false);
    expect(result.relative).toBe(current.replace("https://localhost/ru/", "/en/").replace("#books", "#calendar"));
  });
  it("switches country without retaining an unrelated writer or open work", () => {
    const result = new URL(merge("https://probpera.ru/?country=france").relative, "https://localhost");
    expect(result.pathname).toBe("/ru/");
    expect(result.searchParams.get("country")).toBe("france");
    expect(result.searchParams.has("writer")).toBe(false);
    expect(result.searchParams.has("book")).toBe(false);
    expect(result.searchParams.get("atlasView")).toBe("immersive");
  });
  it("derives a book destination from its canonical key and preserves immersion", () => {
    const result = new URL(merge("https://probpera.ru/en/?book=russia:tolstoy:war-and-peace").relative, "https://localhost");
    expect(result.pathname).toBe("/en/");
    expect(result.searchParams.get("country")).toBe("russia");
    expect(result.searchParams.get("writer")).toBe("tolstoy");
    expect(result.searchParams.get("book")).toBe("russia:tolstoy:war-and-peace");
    expect(result.searchParams.get("atlasView")).toBe("immersive");
    expect(result.hash).toBe("#books");
  });
  it("honors an explicit embedded view without resetting the selected work", () => {
    const result = new URL(merge("https://probpera.ru/?atlasView=embedded").relative, "https://localhost");
    expect(result.searchParams.has("atlasView")).toBe(false);
    expect(result.searchParams.get("book")).toBe("russia:dostoevsky:crime");
    expect(result.searchParams.get("writer")).toBe("dostoevsky");
  });
  it.each(["https://localhost/read/example/", "https://localhost/en/stati/example/"])(
    "returns an entity or section link from %s to the locale homepage", from => {
      const expected = from.includes("/en/") ? "/en/" : "/";
      for (const link of ["https://probpera.ru/?country=france", "https://probpera.ru/#calendar"]) {
        expect(new URL(merge(link, from).relative, "https://localhost").pathname).toBe(expected);
      }
    },
  );
  it("does not inherit a previous book or immersive entry's Back markers", () => {
    const previous = { probperaBookDetail: "old:writer:book", probperaBookArchiveContext: "old context",
      probperaBookDetailShelfChanged: true, probperaBookArchiveShelf: "old shelf",
      probperaAtlasImmersiveUiEntry: { source: "hero", version: 1 }, unrelated: { keep: true } };
    expect(nativeNavigationEntryState(previous)).toEqual({ unrelated: previous.unrelated });
    expect(previous.probperaBookDetail).toBe("old:writer:book");
    expect(nativeNavigationEntryState(null)).toEqual({});
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { usePreparedSearchIndex } from "./usePreparedSearchIndex";

describe("prepared search index server rendering", () => {
  it("renders an empty loading state without touching the catalog or preparing records", () => {
    const source = vi.fn((): Iterable<string> => {
      throw new Error("Catalog access must wait for a client effect");
    });
    const prepare = vi.fn((item: string) => ({ label: item }));

    function Consumer() {
      const index = usePreparedSearchIndex(source, prepare);
      expect(index.items).toEqual([]);
      expect(index.error).toBeNull();
      expect(index.retry).toBeTypeOf("function");
      return <output aria-busy={index.loading}>{index.items.map(item => item.label).join(",")}</output>;
    }

    expect(renderToStaticMarkup(<Consumer />)).toBe('<output aria-busy="true"></output>');
    expect(source).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
});

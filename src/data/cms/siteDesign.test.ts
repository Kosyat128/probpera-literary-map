import { describe, expect, it } from "vitest";

import { buildCmsSiteDesignStylesheet, readCmsSiteDesignSnapshot } from "./siteDesign";

const id = "10000000-0000-4000-8000-000000000001";

function token(overrides: Record<string, unknown> = {}) {
  return {
    id,
    layer: "component",
    targetKey: "site-header",
    key: "orange",
    category: "color",
    valueType: "color",
    breakpoint: "base",
    state: "default",
    value: "#ff7619",
    ...overrides,
  };
}

describe("Site Studio public runtime", () => {
  it("emits only typed declarations inside fixed scopes", () => {
    const css = buildCmsSiteDesignStylesheet({
      release: { id, number: 1, action: "publish" },
      tokens: [token(), token({ id: id.replace(/1$/u, "2"), key: "gap", category: "spacing", valueType: "length", value: { value: 12, unit: "px" } })],
    });
    expect(css).toContain('.site-header{--orange:#ff7619;--gap:12px;gap:12px}');
    expect(css).not.toContain("url(");
    expect(css).not.toContain("javascript");
  });

  it("fails closed for unknown components, fields and invalid values", () => {
    expect(readCmsSiteDesignSnapshot({ release: null, tokens: [token({ targetKey: "unknown" })] }).tokens).toEqual([]);
    expect(readCmsSiteDesignSnapshot({ release: null, tokens: [token({ value: "url(https://bad.test)" })] }).tokens).toEqual([]);
    expect(readCmsSiteDesignSnapshot({ release: null, tokens: [{ ...token(), css: "position:fixed" }] }).tokens).toEqual([]);
  });

  it("compiles responsive states and a reduced-motion fallback", () => {
    const css = buildCmsSiteDesignStylesheet({
      release: null,
      tokens: [token({ breakpoint: "mobile", state: "hover" })],
    });
    expect(css).toContain("@media (max-width:639px){.site-header:hover{--orange:#ff7619}}");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });
});

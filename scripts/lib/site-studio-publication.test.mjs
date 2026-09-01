import { describe, expect, it } from "vitest";

import { normalizePublishedSiteDesign } from "./site-studio-publication.mjs";

const id = "10000000-0000-4000-8000-000000000001";
function snapshot() {
  return {
    release: { id, number: 4, action: "publish" },
    tokens: [
      {
        id,
        layer: "component",
        targetKey: "site-header",
        key: "orange",
        category: "color",
        valueType: "color",
        breakpoint: "base",
        state: "default",
        value: "#ff7619",
      },
    ],
    components: [
      {
        key: "site-header",
        capabilities: ["tokens", "layout"],
        slots: ["brand", "navigation"],
        states: ["default", "focus"],
        ownerLock: false,
      },
    ],
  };
}

describe("published Site Studio snapshot", () => {
  it("normalizes the bounded public contract", () => {
    expect(normalizePublishedSiteDesign(snapshot())).toEqual(snapshot());
  });

  it("fails closed on unknown properties and executable-looking values", () => {
    expect(() =>
      normalizePublishedSiteDesign({ ...snapshot(), privateDraft: {} })
    ).toThrow("site_design_snapshot_invalid");
    expect(() =>
      normalizePublishedSiteDesign(snapshot(), () => {
        throw new Error("unsafe");
      })
    ).toThrow("site_design_token_value_invalid");
  });

  it("rejects unknown components and duplicate identities", () => {
    const invalid = snapshot();
    invalid.components[0].key = "script-widget";
    expect(() => normalizePublishedSiteDesign(invalid)).toThrow(
      "site_design_component_invalid"
    );
    const duplicate = snapshot();
    duplicate.tokens.push({ ...duplicate.tokens[0] });
    expect(() => normalizePublishedSiteDesign(duplicate)).toThrow(
      "site_design_token_duplicate"
    );
  });
});

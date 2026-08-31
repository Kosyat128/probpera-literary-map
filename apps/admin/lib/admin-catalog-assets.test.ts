import { describe, expect, it } from "vitest";

import {
  readAdminCatalogText,
  type AdminCatalogNamespace,
} from "./admin-catalog-assets";
import {
  loadEditorialCatalog,
  parseEditorialCatalog,
} from "./editorial-catalog";
import {
  loadAllSiteCopyCatalog,
  parseInterfaceCopyCatalog,
} from "./site-copy-catalog";

function namespaceWith(value: string | null): AdminCatalogNamespace {
  return {
    async get() {
      return value;
    },
  };
}

describe("private admin catalog assets", () => {
  it("reads bounded catalog values through the KV binding boundary", async () => {
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        namespace: namespaceWith('{"version":1,"countries":[]}'),
      })
    ).resolves.toContain('"version":1');
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        namespace: namespaceWith(null),
      })
    ).rejects.toThrow("key is unavailable");
  });

  it("loads the complete checked-in editorial catalog without static imports", async () => {
    const catalog = await loadEditorialCatalog({ namespace: null });
    expect(catalog.countries).toHaveLength(200);
    expect(
      catalog.countries.reduce(
        (total, country) => total + country.writers.length,
        0
      )
    ).toBe(1_684);
  });

  it("rejects duplicate editorial country ids", () => {
    const country = {
      id: "same",
      label: "Same",
      fields: {},
      writers: [],
    };
    expect(() =>
      parseEditorialCatalog(
        JSON.stringify({
          version: 1,
          countries: Array.from({ length: 100 }, () => country),
        })
      )
    ).toThrow("duplicate country");
  });

  it("loads and validates the complete interface-copy catalog", async () => {
    const catalog = await loadAllSiteCopyCatalog({ namespace: null });
    expect(catalog.length).toBeGreaterThanOrEqual(790);
    expect(
      catalog.filter((definition) => definition.group === "Названия стран")
    ).toHaveLength(200);
  });

  it("rejects duplicate interface-copy keys", () => {
    const definition = {
      key: "interface.same",
      group: "Test",
      label: "Test",
      defaultRu: "Тест",
    };
    expect(() =>
      parseInterfaceCopyCatalog(
        JSON.stringify(Array.from({ length: 100 }, () => definition))
      )
    ).toThrow("duplicate key");
  });
});

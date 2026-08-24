import { describe, expect, it } from "vitest";

import {
  readAdminCatalogText,
  type AdminCatalogBucket,
} from "./admin-catalog-assets";
import {
  loadEditorialCatalog,
  parseEditorialCatalog,
} from "./editorial-catalog";
import {
  loadAllSiteCopyCatalog,
  parseInterfaceCopyCatalog,
} from "./site-copy-catalog";

function bucketWith(value: string | null): AdminCatalogBucket {
  return {
    async get() {
      return value === null
        ? null
        : {
            async text() {
              return value;
            },
          };
    },
  };
}

describe("private admin catalog assets", () => {
  it("reads bounded catalog objects through the R2 binding boundary", async () => {
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        bucket: bucketWith('{"version":1,"countries":[]}'),
      })
    ).resolves.toContain('"version":1');
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        bucket: bucketWith(null),
      })
    ).rejects.toThrow("object is unavailable");
  });

  it("loads the complete checked-in editorial catalog without static imports", async () => {
    const catalog = await loadEditorialCatalog({ bucket: null });
    expect(catalog.countries).toHaveLength(200);
    expect(
      catalog.countries.reduce(
        (total, country) => total + country.writers.length,
        0
      )
    ).toBe(1_678);
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
    const catalog = await loadAllSiteCopyCatalog({ bucket: null });
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

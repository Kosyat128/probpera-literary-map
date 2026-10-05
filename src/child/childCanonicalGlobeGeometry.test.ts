import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChildNativeEntity } from "./childNativeAppBridge";
import { childCanonicalCountryCode, childCanonicalGlobeAtlasCountries, childCanonicalGlobeBindings,
  projectChildNativeGlobeCountry, resolveChildGlobeCountry } from "./childCanonicalGlobeGeometry";

function canonicalDeclarations(): Array<readonly [string, string]> {
  const indexUrl = new URL("../data/countries/index.ts", import.meta.url);
  const index = readFileSync(indexUrl, "utf8");
  const list = index.match(/const curatedCountries: Country\[\] = \[([\s\S]*?)\r?\n\];/);
  if (!list) throw new Error("Canonical country list missing");
  const imports = new Map([...index.matchAll(/import\s+\{\s*(\w+)\s*\}\s+from\s+"(\.[^"]+)";/g)]
    .map(match => [match[1], match[2]]));
  return list[1].split(",").map(value => value.trim()).filter(Boolean).map(symbol => {
    const path = imports.get(symbol);
    if (!path || !/^\.[/][a-z_]+$/.test(path)) throw new Error("Canonical country import missing");
    const source = readFileSync(new URL(path + ".ts", indexUrl), "utf8");
    let declarationSymbol = symbol, declaration: RegExpMatchArray | null = null;
    const visited = new Set<string>();
    for (let hop = 0; hop < 8; hop += 1) {
      if (visited.has(declarationSymbol)) throw new Error("Cyclic canonical export alias");
      visited.add(declarationSymbol);
      declaration = source.match(new RegExp("export\\s+const\\s+" + declarationSymbol + "\\s*:\\s*Country\\s*=\\s*\\{([\\s\\S]*?)\\bwriters\\s*:"));
      if (declaration) break;
      const alias = source.match(new RegExp("export\\s+const\\s+" + declarationSymbol + "\\s*=\\s*(\\w+)\\s*;"));
      if (!alias) throw new Error("Canonical literal declaration missing");
      declarationSymbol = alias[1];
    }
    const id = declaration?.[1].match(/^\s*id:\s*"([^"]+)"/m)?.[1];
    const code = declaration?.[1].match(/^\s*code:\s*"([^"]+)"/m)?.[1];
    if (!id || !code || !/^[a-z]{2}$/.test(code)) throw new Error("Canonical country binding missing");
    return [id, code] as const;
  });
}

function nativeCountry(id: string, title: string, text: string, checksum = "a".repeat(64)): ChildNativeEntity {
  return { reference: { kind: "country", id, contentChecksum: checksum },
    payload: { title, text, terms: [], references: [] } };
}

describe("child canonical globe geometry", () => {
  it("binds every exact curated ID and ISO code to raw declarations without importing the adult runtime", () => {
    const original = canonicalDeclarations();
    expect(childCanonicalGlobeBindings).toEqual(original);
    expect(new Set(original.map(([id]) => id)).size).toBe(original.length);
    expect(new Set(original.map(([, code]) => code)).size).toBe(original.length);
    expect(original.length).toBeGreaterThan(190);
    const source = readFileSync(new URL("./childCanonicalGlobeGeometry.ts", import.meta.url), "utf8");
    expect([...source.matchAll(/^import .*$/gm)].every(([line]) => line.startsWith("import type "))).toBe(true);
    expect(childCanonicalCountryCode("england")).toBe("gb");
    expect(childCanonicalCountryCode("russia")).toBe("ru");
  });

  it("keeps a stable immutable geometry-only atlas while admitted RU/EN rows change", () => {
    const atlas = childCanonicalGlobeAtlasCountries;
    const ru = projectChildNativeGlobeCountry(nativeCountry("russia", "Допущенное имя", "Свежий текст"))!;
    const en = projectChildNativeGlobeCountry(nativeCountry("russia", "Admitted name", "Fresh text", "b".repeat(64)))!;
    expect(childCanonicalGlobeAtlasCountries).toBe(atlas);
    expect(Object.isFrozen(atlas)).toBe(true);
    expect(atlas.map(row => [row.id, row.code])).toEqual(childCanonicalGlobeBindings);
    for (const row of atlas) {
      expect(Object.keys(row).sort()).toEqual(["code", "description", "id", "name", "writers"]);
      expect(row.name).toBe(""); expect(row.description).toBe(""); expect(row.writers).toEqual([]);
      expect(Object.isFrozen(row)).toBe(true); expect(Object.isFrozen(row.writers)).toBe(true);
    }
    expect(ru).toMatchObject({ id: "russia", code: "ru", name: "Допущенное имя", description: "Свежий текст", writers: [] });
    expect(en).toMatchObject({ id: "russia", code: "ru", name: "Admitted name", description: "Fresh text", writers: [] });
    expect(ru.name).toBe("Допущенное имя");
    expect(en).not.toHaveProperty("reference"); expect(en).not.toHaveProperty("contentChecksum");
  });

  it("resolves atlas hits and retired hover/keyboard objects only to fresh admitted rows", () => {
    const geometry = childCanonicalGlobeAtlasCountries.find(row => row.id === "russia")!;
    const retired = projectChildNativeGlobeCountry(nativeCountry("russia", "Старая подпись", "Старый текст"))!;
    const current = projectChildNativeGlobeCountry(nativeCountry("russia", "Current native title", "Current native text"))!;
    expect(resolveChildGlobeCountry(geometry, [current])).toBe(current);
    expect(resolveChildGlobeCountry(retired, [current])).toBe(current);
    expect(resolveChildGlobeCountry(retired, [])).toBeNull();
    expect(resolveChildGlobeCountry(geometry, [])).toBeNull();
    expect(resolveChildGlobeCountry(null, [current])).toBeNull();
    const removed = projectChildNativeGlobeCountry(nativeCountry("france", "France native title", "Fresh"))!;
    expect(resolveChildGlobeCountry(retired, [removed])).toBeNull();
  });

  it("does not invent aliases or map bindings for unknown native IDs or non-country entities", () => {
    for (const id of ["uk", "RUSSIA", "Russia", "russia ", "RU", "unknown-country", "__proto__", "constructor"]) {
      expect(childCanonicalCountryCode(id)).toBeUndefined();
      const textOnly = projectChildNativeGlobeCountry(nativeCountry(id, "Native text", "Native body"))!;
      expect(textOnly).not.toHaveProperty("code");
      expect(textOnly.name).toBe("Native text");
      expect(resolveChildGlobeCountry({ id }, [textOnly])).toBeNull();
    }
    const source = nativeCountry("russia", "A writer", "Native body");
    const writer = { ...source, reference: { ...source.reference, kind: "writer" as const } };
    expect(projectChildNativeGlobeCountry(writer)).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectV12S04HostSource, projectV12S04HostPackage, v12S04HostCompatibility as fixture } from "./v12-s04-host-compatibility.mjs";
const read = p => readFileSync(p, "utf8").replace(/\r\n/gu, "\n");

describe("bounded native host historical projection", () => {
  it("touches one provider and exactly nine additive package pins", () => {
    expect(fixture.projections).toHaveLength(4);
    expect([...new Set(fixture.projections.map(x => x.path))]).toEqual(["src/i18n/InterfaceLanguage.tsx"]);
    expect(fixture.packageProjections).toHaveLength(9);
    expect(fixture.packageProjections.every(x => x.path[1].startsWith("@capacitor/"))).toBe(true);
  });
  for (const delta of fixture.projections) it(`requires exact occurrence of ${delta.id}`, () => {
    const source = read(delta.path);
    const projected = projectV12S04HostSource(delta.path, source);
    expect(() => projectV12S04HostSource(delta.path, source.replace(delta.after, delta.before))).toThrow("compatibility delta");
    expect(() => projectV12S04HostSource(delta.path, source + delta.after)).toThrow("compatibility delta");
    expect(projectV12S04HostSource(delta.path, source + "\n// unrelated drift\n")).toBe(projected + "\n// unrelated drift\n");
    const changed = source.replace('"Explore the globe"', '"Changed editorial copy"');
    expect(projectV12S04HostSource(delta.path, changed)).toContain('"Changed editorial copy"');
  });
  it("retains all unrelated package drift and rejects changed or missing pins", () => {
    const value = JSON.parse(read("package.json"));
    for (const delta of fixture.packageProjections) {
      const [group, name] = delta.path;
      const changed = structuredClone(value);
      changed[group][name] += "-changed";
      expect(() => projectV12S04HostPackage(changed)).toThrow("package property");
      delete changed[group][name];
      expect(() => projectV12S04HostPackage(changed)).toThrow("package property");
    }
    value.dependencies.unapproved = "1.0.0";
    expect(projectV12S04HostPackage(value).dependencies.unapproved).toBe("1.0.0");
    expect(value.dependencies["@capacitor/core"]).toBe("8.5.1");
  });
});

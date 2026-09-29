import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectReviewedCalendarSecurityFollowup } from "./reviewed-calendar-security-followup.mjs";
import { describe, expect, it } from "vitest";
import { loadR10ExactSourcePunctuation, normalizeR10ExactSourcePunctuation as normalize,
  r10PunctuationLiteralRanges as ranges } from "./r10-exact-source-punctuation.mjs";
import { normalizeShortHyphens } from "./short-hyphens.mjs";
import { r10PunctuationAttestation as packet, r10PunctuationSha256 as sourceSha,
  projectReviewedR10SourcePunctuation as project } from "./reviewed-r10-source-punctuation.mjs";

const registry = loadR10ExactSourcePunctuation();
const read = path => projectReviewedCalendarSecurityFollowup(path, readFileSync(path, "utf8"));
const sha = value => createHash("sha256").update(value).digest("hex");
const dash = String.fromCodePoint(0x2014);
const reviewedPath = "data/news/reviewed.json";
const reviewedEntry = registry.files.find(item => item.path === reviewedPath);
const protectedPin = reviewedEntry.fields[0];
function checkedFixturePath(path) {
  if (!Array.isArray(path) || path.some(part => typeof part !== "string"
    || !/^[A-Za-z0-9_.:-]+$/u.test(part) || ["__proto__", "prototype", "constructor"].includes(part))) {
    throw new Error("Unsafe fixture property path.");
  }
  return path;
}
function at(value, path) {
  for (const part of checkedFixturePath(path)) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, part)) throw new Error("Missing own fixture property.");
    value = Reflect.get(value, part);
  }
  return value;
}
function set(value, path, next) {
  checkedFixturePath(path);
  if (!path.length) throw new Error("Missing fixture property path.");
  Object.defineProperty(at(value, path.slice(0, -1)), path.at(-1),
    {value:next, enumerable:true, writable:true, configurable:true});
}
function remove(value, path) {
  checkedFixturePath(path);
  if (!path.length) throw new Error("Missing fixture property path.");
  return Reflect.deleteProperty(at(value, path.slice(0, -1)), path.at(-1));
}

describe("R10 literal source punctuation with continued editorial enforcement", () => {
  it("fixture property mutations reject prototype traversal and inherited properties without changing negative-test meaning", () => {
    const fixture = {own:{}};
    for (const path of [["__proto__","r10Injected"],["constructor","prototype","r10Injected"],
      ["own","prototype"],["own","__proto__"],["own","constructor"],[1],[""]]) {
      expect(() => set(fixture,path,"changed")).toThrow("Unsafe fixture property path");
      expect(() => remove(fixture,path)).toThrow("Unsafe fixture property path");
    }
    expect(() => at(fixture,["toString"])).toThrow("Missing own fixture property");
    expect(Object.prototype.r10Injected).toBeUndefined();
    set(fixture,["own","sourceTitle"],"Fixture value");
    expect(at(fixture,["own","sourceTitle"])).toBe("Fixture value");
    expect(remove(fixture,["own","sourceTitle"])).toBe(true);
    expect(Object.hasOwn(fixture.own,"sourceTitle")).toBe(false);
  });

  it("pins precisely the captured file/field identities without a wildcard or display exception", () => {
    expect(sha(JSON.stringify(registry))).toBe("52124a630bf7c1fb63312d8c763c034ef264fad5bc09b4f9d4aa75fbed873690");
    expect(registry.files).toHaveLength(44);
    expect(registry.files.reduce((count, file) => count + file.fields.length, 0)).toBe(242);
    expect(new Set(registry.files.map(file => file.path)).size).toBe(44);
    expect(registry.authorization).toEqual({humanReview:false,releaseAccepted:false,productionApplied:false});
    for (const file of registry.files) {
      expect(file.path).not.toContain("*");
      expect(new Set(file.fields.map(pin => JSON.stringify(pin.path))).size).toBe(file.fields.length);
      for (const pin of file.fields) {
        expect(pin.valueSha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(pin.path.at(-1)).not.toBe("name");
        expect(pin.path).not.toContain("summary");
      }
    }
    expect(() => loadR10ExactSourcePunctuation({readRegistry: () => JSON.stringify({...registry, files:[]})}))
      .toThrow("registry hash mismatch");
  });

  it("preserves every approved raw literal and its neighboring source identities, including CRLF", () => {
    for (const file of registry.files) {
      const source = read(file.path);
      expect(normalize(file.path, source)).toBe(source);
      expect(normalize(file.path.replaceAll("/", "\\"), source.replace(/\r\n?/gu, "\n").replaceAll("\n", "\r\n")))
        .toBe(source.replace(/\r\n?/gu, "\n").replaceAll("\n", "\r\n"));
      const positions = ranges(file.path, source);
      for (const pin of file.fields) {
        const literal = positions.get(JSON.stringify(pin.path));
        expect(sha(literal.value)).toBe(pin.valueSha256);
        expect(normalizeShortHyphens(literal.value)).not.toBe(literal.value);
      }
    }
  });

  it("normalizes own prose and unrelated copies even when they exactly equal a protected quote", () => {
    const value = JSON.parse(read(reviewedPath)), original = at(value, protectedPin.path);
    value[Number(protectedPin.path[0])].summary.ru = original;
    value[Number(protectedPin.path[0])].unreviewedMetadata = {title: original};
    const source = JSON.stringify(value);
    const changed = JSON.parse(normalize(reviewedPath, source));
    expect(at(changed, protectedPin.path)).toBe(original);
    expect(changed[Number(protectedPin.path[0])].summary.ru).toBe(normalizeShortHyphens(original));
    expect(changed[Number(protectedPin.path[0])].unreviewedMetadata.title).toBe(normalizeShortHyphens(original));
    expect(normalize(reviewedPath, JSON.stringify(changed))).toBe(JSON.stringify(changed));
  });

  it("rejects changed, missing, moved or normalized source quotes", () => {
    for (const change of [" changed", "normalized", "missing", "moved"]) {
      const value = JSON.parse(read(reviewedPath)), original = at(value, protectedPin.path);
      if (change === "missing") remove(value, protectedPin.path);
      else if (change === "moved") {
        set(value, protectedPin.path, "Different source title");
        value[Number(protectedPin.path[0])].unreviewedMetadata = original;
      } else set(value, protectedPin.path, change === "normalized" ? normalizeShortHyphens(original) : original + change);
      expect(() => normalize(reviewedPath, JSON.stringify(value))).toThrow("value drift");
    }
  });

  it("rejects source identity drift even when the quote itself is untouched", () => {
    const value = JSON.parse(read(reviewedPath));
    const identity = protectedPin.identities.find(item => item.path.at(-1) === "url");
    expect(identity).toBeDefined();
    set(value, identity.path, "https://example.org/different-source");
    expect(() => normalize(reviewedPath, JSON.stringify(value))).toThrow("identity drift");
  });

  it("rejects duplicate JSON keys, including escaped key spellings", () => {
    for (const duplicate of ['"id": "duplicate"', '"\\u0069d": "duplicate"']) {
      const source = read(reviewedPath).replace(/"id":\s*"[^"]*"/u, match => match + ", " + duplicate);
      expect(() => normalize(reviewedPath, source)).toThrow("Duplicate JSON key");
    }
  });

  it("keeps unregistered file paths, source-report lookalikes and ordinary UI outside protection", () => {
    for (const path of ["data/news/unreviewed.json", "reports/r10/sources/unreviewed-source.json",
      "reports/r10/sources/nested/book-riot.json", "apps/admin/components/Unreviewed.tsx"]) {
      expect(normalize(path, JSON.stringify({title:"Source" + dash + "quote"}))).toBeNull();
    }
    expect(normalizeShortHyphens("Own" + dash + "prose")).toBe("Own-prose");
  });

  it("preserves the already-approved calendar artifact hash and rejects whitespace or date changes", () => {
    const path = "reports/r10/calendar/scoped-wikidata-evidence.json", source = read(path);
    expect(sourceSha(source)).toBe("60279ade45be806631c75fdd9fec4ef5d1aed5f2c3d6a6a665d7f214dc25da06");
    expect(normalize(path, source)).toBe(source);
    expect(() => normalize(path, source + " ")).toThrow("immutable source artifact hash mismatch");
    expect(() => normalize(path, source.replace("1912", "1913"))).toThrow("immutable source artifact hash mismatch");
  });

  it("parses source-profile literals without evaluating their executable expressions", () => {
    const path = "scripts/lib/literary-news-source-profiles.mjs", source = read(path);
    const withCode = source + "\nglobalThis.r10UnreviewedSourceExecuted = true;\n";
    expect(normalize(path, withCode)).toBe(withCode);
    expect(globalThis.r10UnreviewedSourceExecuted).toBeUndefined();
    expect(() => normalize(path, source.replace("export const R10_SOURCE_PROFILES", "export const SpoofedProfiles")))
      .toThrow("declaration identity");
    const quote = registry.files.find(file => file.path === path).fields[0];
    const position = ranges(path, source).get(JSON.stringify(quote.path));
    expect(() => normalize(path, source.slice(0,position.start) + '"changed"' + source.slice(position.end)))
      .toThrow("value drift");
  });

  it("keeps both checked-in reviewed batches equivalent after editorial normalization", () => {
    const value = JSON.parse(read(reviewedPath));
    const batch = JSON.parse(read("reports/r10/publication/current-news-reviewed-20260929.json"));
    for (const record of batch.records) expect(value.find(item => item.id === record.id)).toEqual(record);
    for (const record of batch.records) for (const locale of ["ru", "en"]) {
      expect(normalizeShortHyphens(record.summary[locale])).toBe(record.summary[locale]);
    }
  });
});

describe("Additive R10 punctuation integration preserves historical checker pins", () => {
  it("pins exactly seven fragments and the source-only authorization scope", () => {
    expect(sourceSha(JSON.stringify(packet))).toBe("69b81edd20c5d5d1fca8931856f5c7f60f5392352b325fdeb5b085b3a6152e69");
    expect(packet.projections).toHaveLength(7);
    expect(packet.allowedProjectionPaths).toEqual(["scripts/normalize-short-hyphens.mjs",
      "scripts/lib/cms-exact-source-punctuation.test.mjs", "scripts/lib/reviewed-undici-security-followup.mjs",
      "scripts/lib/reviewed-undici-security-followup.test.mjs"]);
    expect(packet.authorization).toMatchObject({humanReview:false,releaseAccepted:false,productionApplied:false});
    for (const entry of packet.additions) expect(sourceSha(read(entry.path))).toBe(entry.sha256Lf);
    expect(sourceSha(read(packet.immutableCalendarEvidence.path))).toBe(packet.immutableCalendarEvidence.sha256Lf);
  });

  it.each(packet.allowedProjectionPaths)("restores exact prior bytes and rejects changed/missing/duplicate fragments: %s", path => {
    const source = read(path).replace(/\r\n?/gu,"\n"), before = project(path,source);
    expect(sourceSha(source)).toBe(packet.reviewedSources[path]);
    expect(sourceSha(before)).toBe(packet.sourceBaselines[path]);
    expect(project(path,before)).toBe(before);
    expect(project(path,source.replaceAll("\n","\r\n"))).toBe(before);
    const outside="\n/* Unreviewed changes remain visible. */\n";
    expect(project(path,source+outside)).toBe(before+outside);
    expect(sourceSha(before+outside)).not.toBe(packet.sourceBaselines[path]);
    for (const delta of packet.projections.filter(item => item.path === path)) for (const changed of [
      source.replace(delta.after,""),source+delta.after,source.replace(delta.after,delta.after.replace(/\S/u,"?")),
    ]) expect(() => project(path,changed)).toThrow("Missing or duplicate reviewed R10 source-punctuation delta");
  });

  it("leaves all unrelated historical source bytes visible", () => {
    expect(project("src/data/bookArchive.ts","Unreviewed source\n")).toBe("Unreviewed source\n");
  });
});

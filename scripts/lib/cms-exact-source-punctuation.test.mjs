import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCmsExactSourcePunctuation, normalizeCmsExactSourcePunctuation } from "./cms-exact-source-punctuation.mjs";
import { normalizeShortHyphens } from "./short-hyphens.mjs";

const notes = loadCmsExactSourcePunctuation(process.cwd());
const modulePath = "src/data/cms/literaryWorks.generated.ts";
const snapshotPath = "public/cms/published-content.json";
const dash = String.fromCodePoint(0x2014);
const temporaryDirectories = [];
const get = (value, keys) => keys.reduce((current, key) => current?.[key], value);
function set(value, keys, child) {
  for (const key of keys.slice(0, -1)) value = value[key] ??= {};
  value[keys.at(-1)] = child;
}
function fixture() {
  const works = {};
  for (const note of notes) {
    const [countryId, writerId, ...localId] = note.legacyId.split(":");
    const work = works[note.legacyId] ??= { legacyId: note.legacyId, countryId, writerId,
      localId: localId.join(":"), title: "Display title", description: "Display description" };
    for (const location of [["localizedTitles", note.locale], ["translations", note.locale, "titleEvidence"]]) {
      set(work, location, { expressionId: `${note.legacyId}:${note.locale}`, locale: note.locale });
      set(work, [...location, ...note.suffix], note.value);
    }
  }
  return works;
}
const snapshot = works => JSON.stringify({ version: 1, articles: [], literaryWorksByLegacyId: works }, null, 2) + "\n";
const moduleSource = works => `// Generated fixture.\nexport const cmsLiteraryWorksByLegacyId = ${JSON.stringify(works, null, 2)} as const;\n`;
const normalize = (relativePath, source) => normalizeCmsExactSourcePunctuation(relativePath, source, () => notes);
function assertNotesUnchanged(works) {
  for (const note of notes) for (const location of [["localizedTitles", note.locale], ["translations", note.locale, "titleEvidence"]]) {
    expect(get(works[note.legacyId], [...location, ...note.suffix])).toBe(note.value);
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("cms-punctuation-"));
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("generated CMS exact-source punctuation", () => {
  it("preserves all fourteen identity-bound source literals in both generated formats", () => {
    expect(notes).toHaveLength(7);
    for (const [file, source] of [[modulePath, moduleSource(fixture())], [snapshotPath, snapshot(fixture())]]) {
      expect(source.match(/[\u2013\u2014]/gu)).toHaveLength(14);
      expect(normalizeShortHyphens(source)).not.toBe(source);
      expect(normalize(file, source)).toBe(source);
      expect(normalize(file.replaceAll("/", "\\"), source.replaceAll("\n", "\r\n")))
        .toBe(source.replaceAll("\n", "\r\n"));
    }
  });

  it("still checks display and unknown metadata even when their values equal a protected source string", () => {
    const works = fixture(), work = works[notes[0].legacyId];
    work.description = notes[0].value;
    work.unreviewedMetadata = { editionStatement: notes[0].value };
    work.translations[notes[0].locale].title = `Display${dash}title`;
    const source = snapshot(works), normalized = normalize(snapshotPath, source);
    expect(normalized).not.toBe(source);
    const changed = JSON.parse(normalized).literaryWorksByLegacyId;
    assertNotesUnchanged(changed);
    expect(changed[notes[0].legacyId].description).toBe(normalizeShortHyphens(notes[0].value));
    expect(changed[notes[0].legacyId].unreviewedMetadata.editionStatement).toBe(normalizeShortHyphens(notes[0].value));
    expect(changed[notes[0].legacyId].translations[notes[0].locale].title).toBe("Display-title");
    expect(normalize(snapshotPath, normalized)).toBe(normalized);
  });

  it("rejects changed or missing source metadata and spoofed work or expression identities", () => {
    const note = notes[0], location = ["localizedTitles", note.locale];
    const changes = [
      work => set(work, [...location, ...note.suffix], normalizeShortHyphens(note.value)),
      work => set(work, [...location, ...note.suffix], note.value + " changed"),
      work => set(work, [...location, ...note.suffix], undefined),
      work => { work.legacyId = "unreviewed:writer:book"; },
      work => { work.writerId = "unreviewed"; },
      work => { get(work, location).expressionId = "unreviewed:writer:book:ru"; },
      work => { get(work, location).locale = "en"; },
    ];
    for (const change of changes) {
      const works = fixture(); change(works[note.legacyId]);
      expect(() => normalize(snapshotPath, snapshot(works))).toThrow(/identity drift|metadata drift/u);
    }
    const unknown = structuredClone(fixture()[note.legacyId]);
    const source = snapshot({ "unreviewed:writer:book": unknown });
    expect(normalize(snapshotPath, source)).toBe(normalizeShortHyphens(source));
  });

  it("rejects duplicate keys, executable initializers and appended module code without evaluating them", () => {
    const source = snapshot(fixture());
    expect(() => normalize(snapshotPath, source.replace('"version": 1', '"version": 1, "version": 1')))
      .toThrow("Duplicate JSON key");
    expect(() => normalize(snapshotPath, source.replace('"version": 1', '"version": 1, "\\u0076ersion": 1')))
      .toThrow("Duplicate JSON key");
    expect(() => normalize(modulePath, moduleSource(fixture()).replace('"title": "Display title"', '"title": "Display title", "title": "duplicate"')))
      .toThrow("Duplicate JSON key");
    for (const invalid of [
      "export const cmsLiteraryWorksByLegacyId = JSON.parse('{}') as const;",
      "export const cmsLiteraryWorksByLegacyId = { ...{} } as const;",
      moduleSource(fixture()) + "globalThis.unreviewedCmsCode = true;",
      "export const cmsLiteraryWorksByLegacyId = {} as unknown;",
    ]) expect(() => normalize(modulePath, invalid)).toThrow();
    expect(globalThis.unreviewedCmsCode).toBeUndefined();
  });

  it("rejects immutable source drift and never extends protection to another artifact path", () => {
    expect(() => loadCmsExactSourcePunctuation(process.cwd(), {
      readSource: file => readFileSync(file, "utf8") + "\n// changed source\n",
    })).toThrow("rejected changed bytes");
    const loader = vi.fn(() => notes);
    expect(normalizeCmsExactSourcePunctuation("public/cms/unreviewed.json", snapshot(fixture()), loader)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it("runs the real check and --write CLI while preserving each approved raw literal byte", () => {
    const directory = mkdtempSync(path.join(path.resolve(tmpdir()), "cms-punctuation-"));
    temporaryDirectories.push(directory);
    for (const file of ["scripts/normalize-short-hyphens.mjs", "scripts/lib/short-hyphens.mjs",
      "scripts/lib/short-hyphen-exact-source.mjs", "scripts/lib/cms-exact-source-punctuation.mjs",
      "scripts/governance/book-r49n-dickens-reviewed-20260912.json",
      "scripts/governance/book-r49n-package-reviewed-20260912.json",
      "reports/book-r49n-package-reviewed-20260912.json",
      "src/data/countries/bookR49nDickensReviewed20260912.ts",
      "src/data/countries/bookR49nExistingReviewed20260912.ts"]) {
      const target = path.join(directory, file); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(file, target);
    }
    symlinkSync(realpathSync("node_modules"), path.join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const works = fixture(); works[notes[0].legacyId].description = notes[0].value;
    const before = new Map([[modulePath, moduleSource(works)], [snapshotPath, snapshot(works)]]);
    for (const [file, source] of before) {
      const target = path.join(directory, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, source);
    }
    const run = args => spawnSync(process.execPath, ["scripts/normalize-short-hyphens.mjs", ...args],
      { cwd: directory, encoding: "utf8", timeout: 30000, maxBuffer: 128 * 1024 });
    const check = run([]); expect(check.status, check.stderr).toBe(1);
    expect(check.stderr).toContain("Found forbidden long dashes in 2 file(s)");
    const write = run(["--write"]); expect(write.status, write.stderr).toBe(0);
    for (const [file, source] of before) {
      const after = readFileSync(path.join(directory, file), "utf8");
      expect(after).toBe(normalize(file, source));
      for (const note of notes) expect(after.split(JSON.stringify(note.value))).toHaveLength(3);
    }
    const finalCheck = run([]); expect(finalCheck.status, finalCheck.stderr).toBe(0);
  }, 30000);
});

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const admin = path.join(root, "apps/admin"), nativeRequire = createRequire(import.meta.url);
const baseline = process.env.M07_ARTICLE_SOURCES_BASELINE_ROOT;
const graph = new Map<string, Row>(), traces: Row[] = [];
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const standard = "app/(dashboard)/articles/atomic-standard-save-action.ts";
const legacy = "app/(dashboard)/articles/save-article-action.ts";
const articleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stamp = "2026-10-08T10:00:00.123456+00:00";

// Compile the complete actual modules. The appended export exposes their
// existing private parser for inspection; its implementation is never copied.
function load(relative: string, mocks: Row, cache = new Map<string, Row>()): Row {
  if (cache.has(relative)) return cache.get(relative)!;
  const repoRelative = "apps/admin/" + relative.replaceAll("\\", "/");
  const actual = path.join(baseline || root, repoRelative);
  if (!existsSync(actual)) throw new Error("Missing exact captured source: " + actual);
  const bytes = readFileSync(actual);
  graph.set(repoRelative, { source: repoRelative, actual: path.relative(root, actual).replaceAll("\\", "/"), sha256: digest(bytes) });
  const module = { exports: {} as Row }; cache.set(relative, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(admin, name.slice(2)) : path.resolve(path.dirname(path.join(admin, relative)), name);
      for (const extension of ["", ".ts", ".tsx"]) {
        const file = target + extension, candidate = path.relative(admin, file).replaceAll("\\", "/");
        if (existsSync(path.join(baseline || root, "apps/admin", candidate))) return load(candidate, mocks, cache);
      }
      throw new Error("Missing captured dependency: " + name);
    }
    return nativeRequire(name);
  };
  const expose = relative === standard || relative === legacy ? "\nmodule.exports.__actualLineItems = lineItems;" : "";
  const compiled = ts.transpileModule(bytes.toString(), { fileName: actual,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", compiled + expose)(require, module, module.exports);
  return module.exports;
}
function form(patch: Record<string, string> = {}) {
  const values = { title: "Авторский материал", subtitle: "Авторский подзаголовок", excerpt: "Авторское описание", slug: "authored-article",
    content_html: "<p>Авторский текст и права сохранены.</p>", content_json: '{"type":"doc","content":[]}',
    status: "draft", intent: "save", article_result_mode: "receipt", sources: "Source", bibliography: "Bibliography",
    english_enabled: "on", english_title: "Authored English", english_subtitle: "English subtitle", english_excerpt: "English excerpt",
    english_slug: "authored-english", english_content_html: "<p>Manual English content and rights retained.</p>",
    english_content_json: '{"type":"doc","content":[]}', english_status: "draft", english_sources: "English source",
    english_bibliography: "English bibliography", english_canonical_url: "https://fixture.invalid/en/article", ...patch };
  const value = new FormData(); Object.entries(values).forEach(([name, text]) => value.set(name, text)); return value;
}
function setup(existingEnglish: Row | null = null, auto = false) {
  const calls: Row = { client: 0, queries: [], rpc: [], provider: [], standard: [], formatBoundary: 0 };
  const client = { from(table: string) {
    const query: Row = { select(columns: string) { calls.queries.push({ table, columns }); return query; }, eq() { return query; },
      maybeSingle: async () => ({ data: table === "article_translations" ? structuredClone(existingEnglish) : { slug: "fixture-category" }, error: null }),
      single: async () => ({ data: null, error: null }) }; return query;
  }, async rpc(name: string, args: Row) {
    calls.rpc.push({ name, args: structuredClone(args) });
    if (name !== "save_article_bundle") throw new Error("Unexpected controlled RPC: " + name);
    return { data: [{ article_id: articleId, article_updated_at: stamp,
      english_updated_at: args.p_english_mode === "none" ? null : stamp, homepage_replaced: 0 }], error: null };
  } };
  const common: Row = {
    "next/cache": { revalidatePath() {} }, "next/server": { after(callback: () => void) { callback(); } },
    "next/navigation": { unstable_rethrow() {} },
    "@/lib/auth": { requireStaff: async () => ({ user: { id: articleId }, role: "owner" }) },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid", openAiAutoTranslateArticles: auto,
      openAiApiKey: auto ? "CONTROLLED_NO_PROVIDER" : "" } },
    "@/lib/navigation": { redirect() { throw new Error("Unexpected redirect outside receipt mode"); } },
    "@/lib/short-hyphens": { normalizeShortHyphensFormData() { calls.formatBoundary += 1; } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { calls.client += 1; return client; } },
    "@/lib/publication": { requestPublicBuild: async () => { throw new Error("Unexpected public build"); } },
    "@/lib/auto-translate-article": { translateArticleSourceToEnglish: async (source: Row) => {
      calls.provider.push(structuredClone(source)); throw new Error("CONTROLLED_TRANSLATION_STOP_NO_NETWORK");
    } },
  };
  const actualStandard = load(standard, common);
  const actualLegacy = load(legacy, { ...common, "./atomic-standard-save-action": {
    saveStandardArticleAtomically: async (data: FormData) => { calls.standard.push(Object.fromEntries(data.entries()));
      return { outcome: "rejected", reason: "validation" }; },
  } });
  return { calls, standard: actualStandard, legacy: actualLegacy, common };
}
const samples = [
  { name: "leading and trailing spaces", raw: "  Author source and permission  ", expected: [{ text: "  Author source and permission  " }] },
  { name: "CRLF and original order", raw: "  First source  \r\n\tSecond source\t", expected: [{ text: "  First source  " }, { text: "\tSecond source\t" }] },
  { name: "Unicode and nonbreaking spaces", raw: "\u00a0Études \u2014 ё / ISBN 978-1-234\u00a0", expected: [{ text: "\u00a0Études \u2014 ё / ISBN 978-1-234\u00a0" }] },
  { name: "explicit authored edits", raw: "  Changed source URL https://fixture.invalid/edited  ", expected: [{ text: "  Changed source URL https://fixture.invalid/edited  " }] },
  { name: "repeated entries retain order", raw: "  Same  \n  Other  \n  Same  ", expected: [{ text: "  Same  " }, { text: "  Other  " }, { text: "  Same  " }] },
  { name: "blank lines keep existing empty-list behavior", raw: "\t \r\n\u00a0\n", expected: [] },
];
const fields = ["sources", "bibliography", "english_sources", "english_bibliography"] as const;
const hundred = Array.from({ length: 100 }, (_, index) => "  Authored source " + index + "  ");
const thousand = " " + "x".repeat(998) + " ";
const hundredOne = Array.from({ length: 101 }, (_, index) => "Source " + index).join("\n");
const thousandOne = " " + "x".repeat(999) + " ";
const expectedList = (values: string[]) => values.map(text => ({ text }));
function record(name: string, value: Row) { traces.push({ name, ...value }); }

describe("M07 actual Article line-list parsing preserves authored text", () => {
  for (const action of ["standard", "legacy"] as const) {
    for (const sample of samples) it(`${action}: ${sample.name}`, () => {
      const fixture = setup(), actual = fixture[action].__actualLineItems(sample.raw);
      record(action + ": " + sample.name, { actual, expected: sample.expected });
      expect(actual).toEqual(sample.expected);
    });
    it(`${action}: exactly 100 entries remain complete`, () => {
      const actual = setup()[action].__actualLineItems(hundred.join("\n"));
      record(action + ": max100", { actualCount: actual.length, expectedCount: 100 });
      expect(actual).toEqual(expectedList(hundred));
    });
    it(`${action}: does not silently truncate the 101st entry before validation`, () => {
      const actual = setup()[action].__actualLineItems(hundredOne);
      record(action + ": count101", { actualCount: actual.length, expectedCount: 101 });
      expect(actual).toHaveLength(101); expect(actual[100]).toEqual({ text: "Source 100" });
    });
    it(`${action}: exactly 1000 authored UTF16 units remain complete`, () => {
      const actual = setup()[action].__actualLineItems(thousand);
      record(action + ": text1000", { actualLength: actual[0]?.text.length, expectedLength: 1000 });
      expect(actual).toEqual([{ text: thousand }]);
    });
  }
});
describe("M07 actual guarded atomic action carries exact RU and EN source wrappers", () => {
  for (const field of fields) {
    for (const sample of samples) it(`${field}: ${sample.name} reaches prepared bundle unchanged`, async () => {
      const fixture = setup(), data = form({ [field]: sample.raw });
      const result = await fixture.standard.saveStandardArticleAtomically(data);
      const args = fixture.calls.rpc[0]?.args, payload = field.startsWith("english_") ? args?.p_english_payload : args?.p_article_payload;
      const key = field.replace(/^english_/u, "");
      record(field + ": " + sample.name, { result, actual: payload?.[key], expected: sample.expected, rpcCalls: fixture.calls.rpc.length });
      expect(result.outcome).toBe("saved"); expect(fixture.calls.rpc).toHaveLength(1);
      expect(payload[key]).toEqual(sample.expected); expect(data.get(field)).toBe(sample.raw);
    });
    for (const [name, raw, expected] of [["max100", hundred.join("\n"), expectedList(hundred)], ["max1000", thousand, [{ text: thousand }]]] as const) {
      it(`${field}: existing maximum ${name} passes real validators without trimming`, async () => {
        const fixture = setup(), result = await fixture.standard.saveStandardArticleAtomically(form({ [field]: raw }));
        const args = fixture.calls.rpc[0]?.args, payload = field.startsWith("english_") ? args?.p_english_payload : args?.p_article_payload;
        record(field + ": " + name, { outcome: result.outcome, rpcCalls: fixture.calls.rpc.length });
        expect(result.outcome).toBe("saved"); expect(payload[field.replace(/^english_/u, "")]).toEqual(expected);
      });
    }
    for (const [name, raw] of [["count101", hundredOne], ["length1001", thousandOne]] as const) {
      it(`${field}: ${name} is rejected by existing actual validator before SDK or write`, async () => {
        const fixture = setup(), data = form({ [field]: raw }), result = await fixture.standard.saveStandardArticleAtomically(data);
        record(field + ": reject " + name, { result, clientCalls: fixture.calls.client, rpcCalls: fixture.calls.rpc.length });
        expect(result).toEqual({ outcome: "rejected", reason: field.startsWith("english_") ? "english-validation" : "validation" });
        expect(fixture.calls.client).toBe(0); expect(fixture.calls.rpc).toHaveLength(0); expect(data.get(field)).toBe(raw);
      });
    }
  }
});
describe("M07 actual legacy automatic branch refuses invalid source input before provider", () => {
  for (const field of ["sources", "bibliography"] as const) {
    for (const [name, raw] of [["count101", hundredOne], ["length1001", thousandOne]] as const) it(`${field}: ${name} blocks provider and SDK`, async () => {
      const fixture = setup(null, true), data = form({ intent: "publish", english_title: "", english_excerpt: "", english_content_html: "", english_sources: "", english_bibliography: "", [field]: raw });
      const result = await fixture.legacy.saveArticleAction(data);
      record("legacy " + field + ": reject " + name, { result, providerCalls: fixture.calls.provider.length, clientCalls: fixture.calls.client, standardCalls: fixture.calls.standard.length });
      expect(result).toEqual({ outcome: "rejected", reason: "validation" }); expect(fixture.calls.provider).toHaveLength(0);
      expect(fixture.calls.client).toBe(0); expect(fixture.calls.standard).toHaveLength(0); expect(data.get(field)).toBe(raw);
    });
    for (const [name, raw, expected] of [["max100", hundred.join("\n"), hundred], ["max1000", thousand, [thousand]]] as const) it(`${field}: ${name} reaches controlled provider boundary complete`, async () => {
      const fixture = setup(null, true), data = form({ intent: "publish", english_title: "", english_excerpt: "", english_content_html: "", english_sources: "", english_bibliography: "", [field]: raw });
      await fixture.legacy.saveArticleAction(data);
      record("legacy " + field + ": " + name, { providerCalls: fixture.calls.provider.length, actual: fixture.calls.provider[0]?.[field], expected });
      expect(fixture.calls.provider).toHaveLength(1); expect(fixture.calls.provider[0][field]).toEqual(expected);
    });
  }
});
function machineEnglish() {
  const data = form(), row: Row = { title: data.get("english_title"), subtitle: data.get("english_subtitle"), excerpt: data.get("english_excerpt"),
    slug: data.get("english_slug"), content_html: data.get("english_content_html"), cover_alt: "", seo_title: "", seo_description: "", seo_keywords: [],
    canonical_url: data.get("english_canonical_url"), og_title: "", og_description: "", status: "draft", source_content_hash: "a".repeat(64),
    sources: [{ text: "  Original English source  " }], bibliography: [{ text: "\tOriginal English bibliography\t" }],
    content_json: { type: "doc", content: [], __probperaPremiumTranslation: { version: 1, method: "machine-translation", sourceHash: "a".repeat(64) } } };
  data.set("id", articleId); data.set("english_sources", row.sources[0].text); data.set("english_bibliography", row.bibliography[0].text);
  return { data, row };
}
describe("M07 unchanged ownership classifier semantics alongside exact authored lists", () => {
  it("retains existing machine ownership for unchanged English lists with surrounding whitespace", async () => {
    const { data, row } = machineEnglish(), fixture = setup(row);
    await fixture.legacy.saveArticleAction(data);
    const saved = fixture.calls.standard[0]; record("unchanged machine ownership", { calls: fixture.calls.standard.length, json: saved?.english_content_json });
    expect(fixture.calls.standard).toHaveLength(1); expect(fixture.calls.provider).toHaveLength(0);
    expect(JSON.parse(saved.english_content_json).__probperaPremiumTranslation).toEqual(row.content_json.__probperaPremiumTranslation);
    expect(saved.english_sources).toBe(row.sources[0].text); expect(saved.english_bibliography).toBe(row.bibliography[0].text);
  });
  for (const field of ["english_sources", "english_bibliography"] as const) it(`explicit ${field} edit still transfers ownership while retaining typed text`, async () => {
    const { data, row } = machineEnglish(), fixture = setup(row), edited = "  Explicit human edit and source rights  "; data.set(field, edited);
    await fixture.legacy.saveArticleAction(data);
    const saved = fixture.calls.standard[0]; record("human edit " + field, { calls: fixture.calls.standard.length, json: saved?.english_content_json, text: saved?.[field] });
    expect(fixture.calls.standard).toHaveLength(1); expect(fixture.calls.provider).toHaveLength(0);
    expect(JSON.parse(saved.english_content_json)).not.toHaveProperty("__probperaPremiumTranslation"); expect(saved[field]).toBe(edited);
  });
});
afterAll(() => {
  const prefix = process.env.M07_ARTICLE_SOURCES_PROOF_PREFIX;
  if (!prefix) return;
  const sourceGraph = [...graph.values()].sort((a, b) => a.source.localeCompare(b.source));
  const proof = { createdAt: new Date().toISOString(), sourceMode: baseline ? "captured-before" : "current", baseline: baseline || null,
    fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: digest(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph, sourceUnchanged: sourceGraph.every(row => digest(readFileSync(path.join(root, row.actual))) === row.sha256), traces,
    boundaries: { actual: "complete actual Article actions, their private lineItems functions, real Zod schemas and guarded bundle parser/dependencies",
      controlled: "current staff role, SDK/RPC output, no-op excluded formatter boundary, Next effects and provider entry spy that always throws before transport",
      notVerified: ["managed Auth/DB/RLS/PostgREST", "real provider or charges", "native browser or production", "arbitrary source wrapper keys, bare string array or embedded newline provenance"] } };
  writeFileSync(path.join(root, prefix + "-proof.json"), JSON.stringify(proof, null, 2) + "\n", { flag: "wx" });
});

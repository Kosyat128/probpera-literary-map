import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import { artifactPath, bootstrapClosure, bootstrapSourcePath, capturePwaModuleOwnership, createPwaModuleOwnershipPlugin, scopeCanonicalCssUrls, normalizePwaAuthority, pwaAuthoritySha256, previousPwaGeneration, loadPwaAuthority } from "./pwa-artifact.mjs";
import { normalizePwaWorkerConfig } from "../../src/pwa/serviceWorkerRuntime.js";

const roots = [];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("pwa-previous-test-")) throw new Error("Unsafe fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
});
async function previousFixture() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/pwa-previous-test-")); roots.push(root);
  const data = new Map([["ru/index.html", "<html lang=ru>RU</html>"], ["en/index.html", "<html lang=en>EN</html>"], ["assets/app.js", "export const version = 'previous';"]]);
  const manifest = { schemaVersion: 1, scopePath: "/planet/", buildId: "a".repeat(64), entrypoints: { ru: "/planet/ru/", en: "/planet/en/" }, files: [...data].map(([name, bytes]) => ({ url: "/planet/" + name.replace(/index\.html$/u, ""), bytes: Buffer.byteLength(bytes), sha256: sha(bytes), kind: name.endsWith(".html") ? "shell" : "asset" })) };
  const metadata = { schemaVersion: 1, kind: "literary-planet-controlled-pwa-preparation", buildId: manifest.buildId, sourceInputs: { sha256: "e".repeat(64) }, authoritySha256: pwaAuthoritySha256(null), releaseReady: false, productionActionsAuthorized: false, localQaAuthority: false, inventory: [...data].map(([name, bytes]) => ({ path: name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) })) };
  const write = async (name, bytes) => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), bytes); };
  for (const [name, bytes] of data) await write(name, bytes);
  const refresh = async () => { await write("artifact.json", JSON.stringify(metadata)); await write("bootstrap-integrity.json", JSON.stringify(manifest)); await write("license-authority.json", "null"); };
  await refresh();
  return { root, manifest, metadata, write, refresh, read: () => previousPwaGeneration(root, pwaAuthoritySha256(null)) };
}

describe("previous preparation authority and core integrity", () => {
  it("separates public configured preparation from explicit QA and records exact source bytes", async () => {
    const env = await previousFixture();
    const authority = { issuer: "fixture", audience: "fixture", product: "base", trustedKeys: [{ kid: "one", jwk: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" }) }] };
    const bytes = JSON.stringify(authority, null, 2) + "\n";
    await env.write("configuration/public.json", bytes);
    await env.write(".tmp/pwa-qa/public.json", bytes);
    const publicBuild = await loadPwaAuthority(env.root, ["--authority", "configuration/public.json"]);
    expect(publicBuild).toEqual({ authority: normalizePwaAuthority(authority), localQaAuthority: false, authoritySource: { path: "configuration/public.json", sha256: sha(bytes) } });
    expect(await loadPwaAuthority(env.root, ["--qa-authority", ".tmp/pwa-qa/public.json"])).toMatchObject({ authority: normalizePwaAuthority(authority), localQaAuthority: true });
    expect(await loadPwaAuthority(env.root, [])).toEqual({ authority: null, localQaAuthority: false, authoritySource: null });
  });
  it.each([
    ["--authority", "public.json", "--qa-authority", "public.json"],
    ["--authority"], ["--authority", "../outside.json"], ["--qa-authority", "configuration/public.json"],
  ])("refuses ambiguous or escaping explicit authority arguments %j", async (...args) => {
    const env = await previousFixture();
    await expect(loadPwaAuthority(env.root, args)).rejects.toThrow();
  });
  it.each(["private", "signing", "invalid curve point", "null", "oversized"])("rejects %s authority before a build can use it", async reason => {
    const env = await previousFixture();
    const authority = { issuer: "fixture", audience: "fixture", product: "base", trustedKeys: [{ kid: "one", jwk: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" }) }] };
    if (reason === "private") authority.trustedKeys[0].jwk.d = "private";
    if (reason === "signing") authority.trustedKeys[0].jwk.key_ops = ["sign"];
    if (reason === "invalid curve point") { authority.trustedKeys[0].jwk.x = "A".repeat(43); authority.trustedKeys[0].jwk.y = "A".repeat(43); }
    await env.write("public.json", reason === "null" ? "null" : JSON.stringify(authority) + (reason === "oversized" ? " ".repeat(16_384) : ""));
    await expect(loadPwaAuthority(env.root, ["--authority", "public.json"])).rejects.toThrow();
  });
  it("does not anchor a QA artifact from a public build even with exactly the same verification key", async () => {
    const env = await previousFixture();
    const authority = { issuer: "fixture", audience: "fixture", product: "base", trustedKeys: [{ kid: "one", jwk: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" }) }] };
    env.metadata.authoritySha256 = pwaAuthoritySha256(authority); env.metadata.localQaAuthority = true;
    await env.refresh(); await env.write("license-authority.json", JSON.stringify(authority));
    expect(await previousPwaGeneration(env.root, env.metadata.authoritySha256, false)).toBeNull();
    expect(await previousPwaGeneration(env.root, env.metadata.authoritySha256, true)).toMatchObject({ localQaAuthority: true });
  });
  it("canonicalizes public authority key order and binds a different key to a different fingerprint", () => {
    const jwk = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" });
    const authority = { issuer: "fixture", audience: "fixture", product: "base", trustedKeys: [{ kid: "one", jwk }] };
    const reordered = { trustedKeys: [{ jwk: { y: jwk.y, x: jwk.x, crv: jwk.crv, kty: jwk.kty }, kid: "one" }], product: "base", audience: "fixture", issuer: "fixture" };
    expect(pwaAuthoritySha256(authority)).toBe(pwaAuthoritySha256(reordered));
    reordered.trustedKeys[0].kid = "two";
    expect(pwaAuthoritySha256(authority)).not.toBe(pwaAuthoritySha256(reordered));
    expect(normalizePwaAuthority(null)).toBeNull();
  });
  it.each([{ d: "private" }, { key_ops: ["sign"] }, { alg: "HS256" }, { use: "enc" }, { ext: "true" }])("rejects inappropriate authority metadata %j", extra => {
    const authority = { issuer: "fixture", audience: "fixture", product: "base", trustedKeys: [{ kid: "one", jwk: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43), ...extra } }] };
    expect(() => normalizePwaAuthority(authority)).toThrow();
  });
  it("reads actual previous bytes and derives the worker's exact normalized manifest anchor", async () => {
    const env = await previousFixture();
    const result = await env.read();
    const normalized = normalizePwaWorkerConfig(env.manifest);
    expect(result.reference).toEqual({ buildId: env.manifest.buildId, manifestSha256: sha(JSON.stringify(normalized)), routes: normalized.files.map(file => file.url).sort() });
    expect(result.manifest).toEqual(normalized);
  });
  it.each(["missing authority", "different authority", "release flag"])("does not offer incompatible %s metadata", async reason => {
    const env = await previousFixture();
    if (reason === "missing authority") delete env.metadata.authoritySha256;
    if (reason === "different authority") env.metadata.authoritySha256 = "f".repeat(64);
    if (reason === "release flag") env.metadata.releaseReady = true;
    await env.refresh();
    expect(await env.read()).toBeNull();
  });
  it("refuses corrupt prior core even if its inventory checksum is rewritten", async () => {
    const env = await previousFixture();
    const bytes = "export const version = 'corrupt';";
    await env.write("assets/app.js", bytes);
    const record = env.metadata.inventory.find(file => file.path === "assets/app.js");
    record.sha256 = sha(bytes); record.bytes = Buffer.byteLength(bytes);
    await env.refresh();
    await expect(env.read()).rejects.toThrow("core integrity");
  });
});

describe("controlled PWA artifact dependency selection", () => {
  it("captures actual Vite output after internal late preload rewrites and matches the written bytes", async () => {
    const env = await previousFixture();
    await env.write("index.html", '<!doctype html><html><head></head><body><script type="module" src="/src/main.js"></script></body></html>');
    await env.write("src/main.js", 'document.querySelector("body").onclick=()=>import("./optional.js").then(module=>module.open());');
    await env.write("src/optional.js", 'import "./optional.css"; export function open(){document.body.dataset.open="yes"}');
    await env.write("src/optional.css", 'body[data-open="yes"]{color:green}');
    const entries = ["index.html", "src/main.js", "src/optional.js"];
    const files = await Promise.all(entries.map(async name => ({ path: name, sha256: sha(await readFile(path.join(env.root, name))) })));
    const inputs = { sha256: sha(JSON.stringify(files)), files }; let early, final;
    const outputDirectory = path.join(env.root, "vite-output");
    await viteBuild({ root: env.root, configFile: false, base: "/planet/", publicDir: false, logLevel: "silent", plugins: [
      { name: "fixture-early-ownership", enforce: "post", generateBundle(_options, output) { early = capturePwaModuleOwnership(env.root, output, inputs, entries); } },
      createPwaModuleOwnershipPlugin(env.root, inputs, entries, value => { final = value; }),
    ], build: { outDir: outputDirectory, emptyOutDir: false, manifest: true, minify: false } });
    const earlyEntry = early.entries.find(entry => entry.source === "src/main.js").files[0];
    const finalEntry = final.entries.find(entry => entry.source === "src/main.js").files[0];
    expect(earlyEntry.file).toBe(finalEntry.file); expect(earlyEntry.sha256).not.toBe(finalEntry.sha256);
    const code = await readFile(path.join(outputDirectory, finalEntry.file), "utf8");
    expect(code).not.toContain("__VITE_PRELOAD__"); expect(sha(code)).toBe(finalEntry.sha256);
    for (const entry of final.entries) for (const file of entry.files) expect(sha(await readFile(path.join(outputDirectory, file.file)))).toBe(file.sha256);
    const manifest = JSON.parse(await readFile(path.join(outputDirectory, ".vite/manifest.json"), "utf8"));
    expect(bootstrapClosure(manifest, entries, final)).toEqual(expect.arrayContaining(final.entries.flatMap(entry => entry.files.map(file => file.file))));
  });
  it("binds a real shared Rollup chunk without source metadata and both exact retry query modules", async () => {
    const env = await previousFixture();
    const archive = "src/components/BookArchiveSection.tsx", scene = "src/components/BookShelfSceneCanvas.tsx";
    const entries = ["src/main.js", archive, scene + "?stage5Load=primary", scene + "?stage5Load=retry"];
    await env.write(archive, 'export function book(){ return "canonical book"; }');
    await env.write(scene, 'import {book} from "./BookArchiveSection.tsx"; export const scene=()=>book();');
    await env.write("src/main.js", 'import {book} from "./components/BookArchiveSection.tsx"; export const current=book(); export const primary=()=>import("./components/BookShelfSceneCanvas.tsx?stage5Load=primary"); export const retry=()=>import("./components/BookShelfSceneCanvas.tsx?stage5Load=retry");');
    const files = await Promise.all([...new Set(entries.map(bootstrapSourcePath))].sort().map(async name => ({ path: name, sha256: sha(await readFile(path.join(env.root, name))) })));
    const inputs = { sha256: sha(JSON.stringify(files)), files }; let ownership;
    const build = await rollup({ input: path.join(env.root, "src/main.js"), plugins: [{
      name: "fixture-query-modules",
      resolveId(source, importer) { if (source.includes("?stage5Load=")) return path.resolve(path.dirname(importer), source).replaceAll("\\", "/"); },
      load(id) { if (id.includes("?stage5Load=")) return readFile(id.split("?")[0], "utf8"); },
      generateBundle(_options, output) { ownership = capturePwaModuleOwnership(env.root, output, inputs, entries); },
    }] });
    try {
      const { output } = await build.generate({ format: "es", entryFileNames: "assets/[name]-[hash].js", chunkFileNames: "assets/[name]-[hash].js", manualChunks: { archive: [path.join(env.root, archive)] } });
      const chunks = output.filter(item => item.type === "chunk");
      const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk.facadeModuleId ? path.relative(env.root, chunk.facadeModuleId.split("?")[0]).replaceAll("\\", "/") + (chunk.facadeModuleId.includes("?") ? "?" + chunk.facadeModuleId.split("?")[1] : "") : "_" + chunk.fileName]));
      const manifest = Object.fromEntries(chunks.map(chunk => [byFile.get(chunk.fileName), { file: chunk.fileName, imports: chunk.imports.map(file => byFile.get(file)) }]));
      expect(manifest).not.toHaveProperty(archive);
      expect(ownership.entries.find(entry => entry.source === archive).files[0].file).toMatch(/^assets\/archive-/u);
      expect(bootstrapClosure(manifest, entries, ownership)).toEqual(chunks.map(chunk => chunk.fileName).sort());
      const missingRetry = { ...ownership, entries: ownership.entries.filter(entry => !entry.source.endsWith("=retry")) };
      expect(() => bootstrapClosure(manifest, entries, missingRetry)).toThrow("ownership");
    } finally { await build.close(); }
  });
  it("does not infer ownership from a matching name, different directory or different source query", () => {
    const root = path.resolve(".tmp"), source = "src/components/BookShelfSceneCanvas.tsx?stage5Load=primary";
    const inputs = { sha256: "a".repeat(64), files: [{ path: bootstrapSourcePath(source), sha256: "b".repeat(64) }] };
    for (const id of ["src/components/BookShelfSceneCanvas.tsx?stage5Load=retry", "other/BookShelfSceneCanvas.tsx?stage5Load=primary"]) {
      const output = { "BookShelfSceneCanvas.js": { type: "chunk", name: "BookShelfSceneCanvas", fileName: "assets/BookShelfSceneCanvas.js", code: "export{}", modules: { [path.resolve(root, id).replaceAll("\\", "/")]: {} }, facadeModuleId: null } };
      expect(() => capturePwaModuleOwnership(root, output, inputs, [source])).toThrow("Missing exact Rollup");
    }
  });
  it("preserves transitive shared metadata but leaves optional UI demand-loaded", () => {
    const manifest = {
      main: {file:"assets/main.js",imports:["vendor"],css:["assets/style.css"],dynamicImports:["shelf"]},
      country: {file:"assets/country.js",imports:["publicBookMetadata"]},
      publicBookMetadata: {file:"assets/book-catalog.js",imports:["vendor"]},
      vendor: {file:"assets/vendor.js",imports:["main"],assets:["assets/countries.geojson"]},
      shelf: {file:"assets/shelf.js"},
    };
    expect(bootstrapClosure(manifest,["main","country"])).toEqual([
      "assets/book-catalog.js","assets/countries.geojson","assets/country.js",
      "assets/main.js","assets/style.css","assets/vendor.js",
    ]);
  });
  it("refuses missing and inherited manifest entries rather than shipping partial bootstrap", () => {
    expect(()=>bootstrapClosure({main:{file:"assets/main.js",imports:["missing"]}},["main"])).toThrow("Missing bootstrap");
    expect(()=>bootstrapClosure(Object.create({main:{file:"assets/main.js"}}),["main"])).toThrow("Missing bootstrap");
    expect(()=>bootstrapClosure({main:{file:"assets/main.js",css:"style.css"}},["main"])).toThrow("Invalid css");
  });
  it.each(["../secret", "/absolute", "assets/../secret", "assets//empty", "C:/secret", "assets\\secret", "assets/%2e%2e", "asset.js?token=secret"])("rejects unsafe artifact path %s", value => {
    expect(()=>artifactPath(value)).toThrow("Invalid controlled artifact path");
  });
});

describe("canonical CSS asset scope", () => {
  it("scopes literal public assets before hashing without changing their source identities", () => {
    const source=`a{background:url('/brand/paper.webp')} @font-face{src:url("/fonts/font.woff2")} b{background:url(/planet/brand/paper.webp)}`;
    const result=scopeCanonicalCssUrls(source);
    expect(result.assets).toEqual(["brand/paper.webp","fonts/font.woff2"]);
    expect(result.css).toBe(`a{background:url('/planet/brand/paper.webp')} @font-face{src:url("/planet/fonts/font.woff2")} b{background:url(/planet/brand/paper.webp)}`);
    expect(scopeCanonicalCssUrls(result.css)).toEqual(result);
  });
  it("preserves embedded and module-relative resources", () => {
    const css=`a{mask:url(#mask);background:url("data:image/svg+xml,%3Csvg/%3E");cursor:url(../assets/cursor.png)}`;
    expect(scopeCanonicalCssUrls(css)).toEqual({css,assets:[]});
  });
  it("preserves Vite-scoped emitted asset URLs without rehashing built CSS", () => {
    const css = 'a{background:url(/planet/assets/paper-123.webp)}';
    expect(scopeCanonicalCssUrls(css)).toEqual({css,assets:["assets/paper-123.webp"]});
    expect(() => scopeCanonicalCssUrls('a{background:url(/assets/paper.webp)}')).toThrow();
  });
  it.each(["https://cdn.example/font.woff2","//cdn.example/image.png","/private/catalog.json","/brand/../secret","\\2f brand/paper.webp"])("fails on unsupported CSS asset %s", url => {
    expect(()=>scopeCanonicalCssUrls(`a{background:url("${url}")}`)).toThrow();
  });
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, realpath, lstat, readdir, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { build } from "esbuild";
import { load } from "cheerio";
import { containedFile, artifactPath } from "./pwa-artifact.mjs";
import { PUBLIC_SECURITY_HEADERS } from "../cloudflare/configure-edge-security.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = "https://probpera.ru";
const KIND = "probpera-public-locales-edge-preparation";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const utf8 = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const isNested = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
};

async function safeDirectory(directory, create = false) {
  const base = await realpath(ROOT), target = path.resolve(directory);
  const relative = path.relative(base, target);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Public error output must stay inside the checkout");
  let current = base;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (create) await mkdir(current).catch(error => { if (error.code !== "EEXIST") throw error; });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(current) !== current) throw new Error("Linked public error directory");
  }
  return target;
}

function resourcePath(value, base = ORIGIN + "/") {
  if (typeof value !== "string" || /[\\\u0000-\u0020]/u.test(value)) throw new Error("Unsafe error document resource");
  const url = new URL(value, base);
  if (url.origin !== ORIGIN || url.username || url.password || url.hash || url.pathname.startsWith("/planet/")) throw new Error("Noncanonical error document resource");
  return artifactPath(url.pathname.slice(1));
}

export async function preparePublicNotFoundArtifact({ publicDirectory = path.join(ROOT, "dist"), outputDirectory = path.join(ROOT, "dist-public-locales") } = {}) {
  const source = await safeDirectory(publicDirectory);
  const output = path.resolve(outputDirectory);
  if (isNested(source, output) || isNested(output, source)) throw new Error("Worker artifact must not overlap the public upload");
  const routesInput = await containedFile(source, "locale-routes.json");
  if (routesInput.size > 262_144) throw new Error("Locale route manifest exceeds bound");
  const routes = JSON.parse(utf8(routesInput.bytes));
  if (routes.schemaVersion !== 1 || routes.generatedBy !== "public-locale-pages" || routes.releaseReady !== false || !Array.isArray(routes.artifacts)) throw new Error("Expected generated draft locale routes");
  const documents = {}, inputs = [{ path: "locale-routes.json", sha256: routesInput.sha256, bytes: routesInput.size }];
  const assets = new Set();
  for (const locale of ["ru", "en"]) {
    const relative = `${locale}/404.html`, file = await containedFile(source, relative);
    if (file.size > 2_000_000 || routes.notFound?.[locale] !== "/" + relative) throw new Error("Invalid locale error binding");
    const records = routes.artifacts.filter(record => record.path === relative);
    if (records.length !== 1 || records[0].sha256 !== file.sha256 || records[0].indexable !== false) throw new Error("Stale locale error artifact");
    const html = utf8(file.bytes), $ = load(html);
    if ($("html").attr("lang") !== locale || $("body").attr("lang") !== locale || $("html[data-public-locale-not-found]").length !== 1
        || $("script,base,iframe,object,embed").length || $("*").get().some(element => Object.keys(element.attribs ?? {}).some(name => /^on/iu.test(name)))
        || $('link[rel="canonical"]').attr("href") !== `${ORIGIN}/${relative}` || !$('meta[name="robots"]').attr("content")?.split(",").includes("noindex")) throw new Error("Invalid localized inert error HTML");
    for (const element of $("[src],link[href]").get()) {
      const value = $(element).attr("src") ?? $(element).attr("href");
      if ($(element).is('link[rel="canonical"],link[rel="alternate"]')) continue;
      assets.add(resourcePath(value));
    }
    documents[locale] = html;
    inputs.push({ path: relative, sha256: file.sha256, bytes: file.size });
  }
  let dependencyBytes = 0;
  for (const asset of assets) {
    if (assets.size > 512) throw new Error("Too many error document resources");
    const file = await containedFile(source, asset);
    dependencyBytes += file.size;
    if (file.size > 16 * 1024 * 1024 || dependencyBytes > 64 * 1024 * 1024) throw new Error("Error document resource exceeds bound");
    if (asset.endsWith(".css")) {
      const css = utf8(file.bytes);
      if (/@import\b/iu.test(css)) throw new Error("Unbundled error stylesheet import");
      for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gsu)) {
        const value = (match[2] ?? match[3]).trim();
        if (/^data:/iu.test(value) || value.startsWith("#")) continue;
        assets.add(resourcePath(value, ORIGIN + "/" + asset));
      }
    }
    inputs.push({ path: asset, sha256: file.sha256, bytes: file.size });
  }
  inputs.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const securityHeaders = Object.fromEntries(Object.entries(PUBLIC_SECURITY_HEADERS).map(([name, record]) => [name, record.value]));
  const runtimePath = path.join(ROOT, "server/public-locales/handler.mjs"), runtime = await readFile(runtimePath);
  const builderPath = "scripts/mobile/build-public-not-found.mjs", draftConfigPath = "server/public-locales/wrangler.draft.jsonc";
  const draftConfigBytes = await readFile(path.join(ROOT, draftConfigPath));
  const draftConfig = JSON.parse(utf8(draftConfigBytes));
  if (draftConfig.workers_dev !== false || draftConfig.preview_urls !== false || !Array.isArray(draftConfig.routes) || draftConfig.routes.length) throw new Error("Expected inactive draft error routing config");
  const bundle = await build({ stdin: { contents: `import { createLocalizedNotFoundHandler } from ${JSON.stringify(runtimePath.replaceAll("\\", "/"))};\nexport default { fetch: createLocalizedNotFoundHandler(${JSON.stringify({ documents, securityHeaders }).replace(/</gu, "\\u003c")}) };\n`, resolveDir: ROOT, sourcefile: "public-locales-bound-worker.mjs", loader: "js" }, bundle: true, platform: "browser", format: "esm", target: "es2022", write: false, sourcemap: false, logLevel: "silent" });
  if (bundle.outputFiles.length !== 1 || bundle.outputFiles[0].contents.byteLength > 5 * 1024 * 1024) throw new Error("Unexpected public error worker output");
  const worker = bundle.outputFiles[0].contents;
  const manifest = { schemaVersion: 1, kind: KIND, releaseReady: false, deployed: false, originStack: "github-pages", origin: ORIGIN,
    preparedRoutePatterns: ["probpera.ru/ru/*", "probpera.ru/en/*"], activeRoutes: [],
    requiredPublicationBinding: "The Pages artifact and this edge artifact must be reviewed and activated together; no hosting configuration was applied.",
    inputs, runtime: { path: "server/public-locales/handler.mjs", sha256: sha(runtime) },
    builder: { path: builderPath, sha256: sha(await readFile(path.join(ROOT, builderPath))) },
    worker: { path: "worker.mjs", sha256: sha(worker), bytes: worker.byteLength },
    securityHeadersSha256: sha(JSON.stringify(securityHeaders)),
    draftConfig: { path: draftConfigPath, sha256: sha(draftConfigBytes) } };
  await safeDirectory(output, true);
  const existing = await readdir(output);
  if (existing.some(name => !["worker.mjs", "artifact.json"].includes(name))) throw new Error("Refuse unrelated public error output");
  if (existing.length) {
    const prior = JSON.parse((await containedFile(output, "artifact.json")).bytes.toString("utf8"));
    if (prior.kind !== KIND || prior.deployed !== false || prior.worker?.sha256 !== (await containedFile(output, "worker.mjs")).sha256) throw new Error("Refuse changed or unowned public error output");
  }
  // Per-file atomic replacement; artifact.json is the final integrity marker.
  // A interrupted pair is rejected by the same ownership/hash check above.
  for (const [name, bytes] of [["worker.mjs", worker], ["artifact.json", JSON.stringify(manifest, null, 2) + "\n"]]) {
    const temporary = path.join(output, name + ".tmp-" + randomUUID());
    try { await writeFile(temporary, bytes, { flag: "wx" }); await rename(temporary, path.join(output, name)); }
    finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await preparePublicNotFoundArtifact();
  console.log(JSON.stringify({ kind: result.kind, worker: result.worker, deployed: result.deployed, activeRoutes: result.activeRoutes }));
}

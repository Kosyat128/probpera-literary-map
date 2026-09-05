import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { afterAll, describe, expect, it } from "vitest";
import { generatePublicLocalePages } from "./public-locale-pages.mjs";
import { preparePublicNotFoundArtifact } from "./build-public-not-found.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = path.join(root, ".tmp");
const fixtures = [];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const builtHtml = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="robots" content="index,follow"><title>Проба Пера</title>
<link rel="canonical" href="https://probpera.ru/"><link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/brand/probpera-logo.png"><link rel="stylesheet" href="/assets/main.css">
<script type="module" src="/assets/main.js"></script></head><body lang="ru"><div id="root"></div></body></html>`;

async function fixture() {
  await mkdir(scratch, { recursive: true });
  const directory = await realpath(await mkdtemp(path.join(scratch, "public-not-found-test-")));
  fixtures.push(directory);
  const publicDirectory = path.join(directory, "public"), outputDirectory = path.join(directory, "edge");
  const generated = generatePublicLocalePages({ builtHtml });
  const resources = { "assets/main.css": '@font-face{font-family:local;src:url("../fonts/local.woff2")}body{font-family:local}',
    "fonts/local.woff2": "local fixture font bytes", "site.webmanifest": '{"id":"/"}', "brand/probpera-logo.png": "canonical fixture bytes" };
  const files = { ...resources, ...Object.fromEntries(["ru", "en"].map(locale => [`${locale}/404.html`, generated.files[`${locale}/404.html`]])) };
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(publicDirectory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const routes = { schemaVersion: 1, generatedBy: "public-locale-pages", releaseReady: false, notFound: generated.notFound,
    artifacts: ["ru", "en"].map(locale => ({ path: `${locale}/404.html`, sha256: sha(files[`${locale}/404.html`]), indexable: false })) };
  await writeFile(path.join(publicDirectory, "locale-routes.json"), JSON.stringify(routes));
  return { directory, publicDirectory, outputDirectory, routes, files };
}

async function mutateHtml(f, transform, locale = "en") {
  const relative = `${locale}/404.html`;
  const html = transform(await readFile(path.join(f.publicDirectory, relative), "utf8"));
  await writeFile(path.join(f.publicDirectory, relative), html);
  f.routes.artifacts.find(record => record.path === relative).sha256 = sha(html);
  await writeFile(path.join(f.publicDirectory, "locale-routes.json"), JSON.stringify(f.routes));
}

afterAll(async () => {
  const base = await realpath(scratch);
  for (const directory of fixtures) {
    const resolved = await realpath(directory);
    const relative = path.relative(base, resolved);
    if (path.isAbsolute(relative) || relative.startsWith("..") || !relative.startsWith("public-not-found-test-")) throw new Error("Unsafe fixture cleanup");
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("bound public locale HTTP error artifact", () => {
  it("binds exact localized HTML, stylesheet/font closure and inactive configuration reproducibly", async () => {
    const f = await fixture();
    const first = await preparePublicNotFoundArtifact(f);
    expect(first).toMatchObject({ releaseReady: false, deployed: false, originStack: "github-pages", activeRoutes: [] });
    expect(first.inputs.map(input => input.path)).toEqual(["assets/main.css", "brand/probpera-logo.png", "en/404.html", "fonts/local.woff2", "locale-routes.json", "ru/404.html", "site.webmanifest"]);
    for (const input of first.inputs) expect(sha(await readFile(path.join(f.publicDirectory, input.path)))).toBe(input.sha256);
    const worker = await readFile(path.join(f.outputDirectory, "worker.mjs"));
    expect(sha(worker)).toBe(first.worker.sha256);
    expect(worker.byteLength).toBe(first.worker.bytes);
    expect(sha(await readFile(path.join(root, first.runtime.path)))).toBe(first.runtime.sha256);
    expect(sha(await readFile(path.join(root, first.builder.path)))).toBe(first.builder.sha256);
    const config = JSON.parse(await readFile(path.join(root, first.draftConfig.path), "utf8"));
    expect(config).toMatchObject({ routes: [], workers_dev: false, preview_urls: false });
    expect(await preparePublicNotFoundArtifact(f)).toEqual(first);
    expect(await readFile(path.join(f.outputDirectory, "worker.mjs"))).toEqual(worker);
    expect(JSON.parse(await readFile(path.join(f.publicDirectory, "locale-routes.json"), "utf8")).notFound.hostStatusRoutingConfigured).toBe(false);
  });

  it("rejects stale HTML bytes instead of rebinding an unchecked page", async () => {
    const f = await fixture();
    await writeFile(path.join(f.publicDirectory, "en/404.html"), f.files["en/404.html"] + "changed");
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow("Stale locale error artifact");
  });

  it.each([
    html => html.replace('lang="en"', 'lang="ru"'),
    html => html.replace("</head>", '<script src="/assets/main.js"></script></head>'),
    html => html.replace("</head>", '<base href="https://external.invalid/"></head>'),
    html => html.replace("<body", '<body onload="alert(1)"'),
    html => html.replace('content="noindex,follow"', 'content="index,follow"'),
    html => html.replace('rel="canonical" href="https://probpera.ru/en/404.html"', 'rel="canonical" href="https://probpera.ru/"'),
  ])("rejects invalid inert HTML even when its manifest hash was updated (%#)", async transform => {
    const f = await fixture();
    await mutateHtml(f, transform);
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow("Invalid localized inert error HTML");
  });

  it.each(['body{background:url("https://external.invalid/image.png")}', '@import "/other.css";', 'body{background:url("/planet/private.png")}'])
    ("rejects remote, unbundled or controlled-edition stylesheet dependency: %s", async css => {
      const f = await fixture();
      await writeFile(path.join(f.publicDirectory, "assets/main.css"), css);
      await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow(/Noncanonical|Unbundled/u);
    });

  it("fails if a transitive local stylesheet asset is absent", async () => {
    const f = await fixture();
    await unlink(path.join(f.publicDirectory, "fonts/local.woff2"));
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow();
  });

  it("rejects a symlinked asset directory without reading outside the source", async () => {
    const f = await fixture(), external = path.join(f.directory, "external");
    await mkdir(external);
    await writeFile(path.join(external, "local.woff2"), "external");
    await unlink(path.join(f.publicDirectory, "fonts/local.woff2"));
    await rmdir(path.join(f.publicDirectory, "fonts"));
    await symlink(external, path.join(f.publicDirectory, "fonts"), "junction");
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow(/symbolic|linked|symlink|junction|escapes its source root/iu);
  });

  it("refuses worker outputs inside or enclosing the public upload", async () => {
    const f = await fixture();
    await expect(preparePublicNotFoundArtifact({ ...f, outputDirectory: path.join(f.publicDirectory, "edge") })).rejects.toThrow("must not overlap");
    await expect(preparePublicNotFoundArtifact({ ...f, outputDirectory: f.directory })).rejects.toThrow("must not overlap");
  });

  it("preserves unrelated output and rejects tampered previous worker ownership", async () => {
    const f = await fixture();
    await mkdir(f.outputDirectory);
    await writeFile(path.join(f.outputDirectory, "personal.txt"), "preserve");
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow("unrelated");
    expect(await readFile(path.join(f.outputDirectory, "personal.txt"), "utf8")).toBe("preserve");
    await unlink(path.join(f.outputDirectory, "personal.txt"));
    await preparePublicNotFoundArtifact(f);
    await writeFile(path.join(f.outputDirectory, "worker.mjs"), "tampered");
    await expect(preparePublicNotFoundArtifact(f)).rejects.toThrow("changed or unowned");
    expect(await readFile(path.join(f.outputDirectory, "worker.mjs"), "utf8")).toBe("tampered");
  });

  it("runs the generated Worker in workerd against a real local HTTP origin", async () => {
    const f = await fixture();
    await preparePublicNotFoundArtifact(f);
    const requests = [];
    const origin = createServer((request, response) => {
      requests.push({ method: request.method, url: request.url });
      response.setHeader("content-security-policy", "default-src 'self'");
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.setHeader("cache-control", "public, max-age=600");
      if (request.url === "/en/existing") return response.end("existing canonical page");
      if (request.url === "/ru/redirect") { response.writeHead(302, { location: "/ru/existing/" }); return response.end(); }
      response.statusCode = 404;
      if (request.url === "/en/missing.json") response.setHeader("content-type", "application/json");
      response.end("original missing body");
    });
    origin.listen(0, "127.0.0.1");
    await once(origin, "listening");
    const localOrigin = `http://127.0.0.1:${origin.address().port}`;
    const config = JSON.parse(await readFile(path.join(root, "server/public-locales/wrangler.draft.jsonc"), "utf8"));
    let runtime;
    try {
      runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, scriptPath: path.join(f.outputDirectory, "worker.mjs"), compatibilityDate: config.compatibility_date, cf: false,
      outboundService: async request => {
        const url = new URL(request.url);
        if (url.origin !== "https://probpera.ru") throw new Error("Unexpected outbound target");
        const result = await fetch(localOrigin + url.pathname + url.search, { method: request.method, headers: request.headers, redirect: "manual" });
        return new Response(result.body, { status: result.status, headers: result.headers });
      } }));
      for (const locale of ["ru", "en"]) {
        const response = await runtime.dispatchFetch(`https://probpera.ru/${locale}/unknown?selection=preserved`, { headers: { accept: "text/html" } });
        expect(response.status).toBe(404);
        expect(response.headers.get("content-language")).toBe(locale);
        expect(response.headers.get("content-security-policy")).toBe("default-src 'self'");
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe(f.files[`${locale}/404.html`]);
      }
      const head = await runtime.dispatchFetch("https://probpera.ru/en/unknown", { method: "HEAD" });
      expect(head.status).toBe(404);
      expect(head.headers.get("content-language")).toBe("en");
      expect(await head.text()).toBe("");
      const existing = await runtime.dispatchFetch("https://probpera.ru/en/existing");
      expect(existing.status).toBe(200);
      expect(await existing.text()).toBe("existing canonical page");
      const redirect = await runtime.dispatchFetch("https://probpera.ru/ru/redirect", { redirect: "manual" });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get("location")).toBe("/ru/existing/");
      const asset = await runtime.dispatchFetch("https://probpera.ru/en/missing.json");
      expect(asset.status).toBe(404);
      expect(asset.headers.get("content-type")).toBe("application/json");
      expect(await asset.text()).toBe("original missing body");
      expect(requests).toEqual([
        { method: "GET", url: "/ru/unknown?selection=preserved" }, { method: "GET", url: "/en/unknown?selection=preserved" },
        { method: "HEAD", url: "/en/unknown" }, { method: "GET", url: "/en/existing" }, { method: "GET", url: "/ru/redirect" }, { method: "GET", url: "/en/missing.json" },
      ]);
    } finally {
      await runtime?.dispose();
      await new Promise((resolve, reject) => origin.close(error => error ? reject(error) : resolve()));
    }
  }, 60_000);
});

import { describe, expect, it, vi } from "vitest";
import { createLocalizedNotFoundHandler } from "./handler.mjs";

const origin = "https://probpera.ru";
const documents = Object.fromEntries(["ru", "en"].map(locale => [locale, `<html lang="${locale}"><body>bound ${locale} error</body></html>`]));
const securityHeaders = { "x-content-type-options": "nosniff", "content-security-policy": "default-src 'self'" };
const request = (path, init = {}) => new Request(origin + path, init);
const notFound = (headers = {}) => new Response("original error", { status: 404, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

describe("public locale error routing over the existing origin", () => {
  it.each(["ru", "en"])("returns actual 404 with the exact bound %s body and no request reflection", async locale => {
    const upstream = notFound({ "etag": "old", "content-length": "14", "content-encoding": "gzip", "last-modified": "old", "age": "123", "content-digest": "old", "cache-control": "public, max-age=600", "content-language": "other", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'" });
    const fetchOrigin = vi.fn().mockResolvedValue(upstream);
    const input = request(`/${locale}/missing?private=not-reflected`, { headers: { accept: "text/html", "accept-language": locale === "ru" ? "en" : "ru" } });
    const response = await createLocalizedNotFoundHandler({ documents, securityHeaders }, fetchOrigin)(input);
    expect(fetchOrigin).toHaveBeenCalledExactlyOnceWith(input);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(documents[locale]);
    expect(response.headers.get("content-language")).toBe(locale);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    for (const header of ["etag", "content-length", "content-encoding", "last-modified", "age", "content-digest"]) expect(response.headers.has(header)).toBe(false);
  });

  it("serves HEAD without a body and with the localized GET representation headers", async () => {
    const response = await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => notFound())(request("/en/missing", { method: "HEAD" }));
    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
    expect(response.headers.get("content-language")).toBe("en");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("supports UTF-8 document names but excludes percent-encoded reserved paths", async () => {
    const handler = createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => notFound());
    expect((await handler(request("/ru/несуществующая-страница"))).headers.get("content-language")).toBe("ru");
    for (const pathname of ["/en/%61pi/private", "/en/%61ssets/private", "/en/%FFinvalid"]) {
      expect((await handler(request(pathname))).headers.has("content-language")).toBe(false);
    }
  });

  it("never substitutes a document on a different origin", async () => {
    const original = notFound();
    const handler = createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original);
    expect(await handler(new Request("https://other.invalid/en/missing"))).toBe(original);
  });

  it.each([200, 204, 301, 302, 304, 307, 308, 401, 403, 410, 429, 500, 503])("passes status %s through by reference without consuming its stream", async status => {
    const original = new Response([204, 304].includes(status) ? null : "original", { status, headers: { "content-type": "text/html", "location": "/canonical/", "cache-control": "public, max-age=60" } });
    const response = await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original)(request("/en/existing"));
    expect(response).toBe(original);
    expect(response.bodyUsed).toBe(false);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it.each(["/", "/stati/missing/", "/planet/en/missing", "/english/missing", "/EN/missing", "/en/api/missing", "/ru/assets/no.js", "/en/cms/private", "/en/admin/private", "/en/.well-known/missing", "/en/picture.webp", "/en/file.json", "/en/a%2fb", "/en/a%5cb", "/en/%252e%252e/private", "/en/%2e%2e/private"])("does not replace excluded path %s", async pathname => {
    const original = notFound();
    expect(await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original)(request(pathname))).toBe(original);
  });

  it.each([
    { method: "POST" }, { method: "OPTIONS" },
    { headers: { accept: "application/json" } }, { headers: { accept: "text/html;q=0, */*;q=0.0" } },
    { headers: { accept: "text/html;q=0, */*;q=1" } }, { headers: { range: "bytes=0-5" } },
    { headers: { accept: "text/html;q=invalid" } },
    { headers: { "sec-fetch-dest": "script" } }, { headers: { "sec-fetch-dest": "style" } },
  ])("does not replace non-navigation request %j", async init => {
    const original = notFound();
    expect(await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original)(request("/en/missing", init))).toBe(original);
  });

  it.each([{ "content-type": "application/json" }, { "content-type": "text/plain" }, { "content-type": "" }, { "content-disposition": "attachment" }, { "content-range": "bytes 0-5/10" }])("preserves a404 with unexpected representation %j", async headers => {
    const original = notFound(headers);
    expect(await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original)(request("/ru/missing"))).toBe(original);
  });

  it("cancels the old error stream without buffering it", async () => {
    const cancel = vi.fn();
    const original = new Response(new ReadableStream({ cancel }), { status: 404, headers: { "content-type": "text/html" } });
    await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => original)(request("/en/missing"));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("returns a plain empty502 on origin failure without reflecting diagnostic secrets", async () => {
    const response = await createLocalizedNotFoundHandler({ documents, securityHeaders }, async () => { throw new Error("secret token and origin diagnostics"); })(request("/en/missing"));
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

const ORIGIN = "https://probpera.ru";
const MIME_HTML = /^text\/html(?:\s*;|$)/iu;
const UNSAFE_PATH = /[\\\u0000-\u0020]|%(?:2e|2f|5c|25|00)/iu;
const RESERVED = /^(?:api|assets|brand|fonts|textures|cms|admin|\.well-known)(?:\/|$)/iu;
const NON_HTML_EXTENSION = /\.[^/.]+$/u;

function acceptsHtml(value) {
  if (!value) return true;
  const ranges = value.split(",").map(part => {
    const [type, ...parameters] = part.trim().toLowerCase().split(";");
    const quality = parameters.find(parameter => /^\s*q\s*=/u.test(parameter));
    const number = quality ? Number(quality.split("=")[1].trim()) : 1;
    return { type: type.trim(), accepted: Number.isFinite(number) && number > 0 && number <= 1 };
  });
  // A specific text/html rejection takes precedence over a wildcard.
  for (const type of ["text/html", "text/*", "*/*"]) {
    const matches = ranges.filter(range => range.type === type);
    if (matches.length) return matches.every(range => range.accepted);
  }
  return false;
}

/** Select only document requests inside the two explicit public locale routes. */
export function publicNotFoundLocale(request) {
  const url = new URL(request.url);
  if (url.origin !== ORIGIN || !["GET", "HEAD"].includes(request.method) || UNSAFE_PATH.test(url.pathname)
      || UNSAFE_PATH.test(request.url.split("?")[0])) return null;
  const match = /^\/(ru|en)\/(.*)$/u.exec(url.pathname);
  if (!match) return null;
  let relative;
  try { relative = decodeURIComponent(match[2]); } catch { return null; }
  if (UNSAFE_PATH.test(relative) || RESERVED.test(relative) || relative.split("/").some(part => part === "." || part === "..")) return null;
  if (NON_HTML_EXTENSION.test(relative) && !/\.html?$/iu.test(relative)) return null;
  const destination = request.headers.get("sec-fetch-dest");
  if (destination && !["document", "iframe", "empty"].includes(destination)) return null;
  if (!acceptsHtml(request.headers.get("accept")) || request.headers.has("range")) return null;
  return match[1];
}

/** The build supplies exact generated HTML. Requests never select an origin or template. */
export function createLocalizedNotFoundHandler({ documents, securityHeaders }, originFetch = fetch) {
  if (!documents || Object.keys(documents).sort().join(",") !== "en,ru") throw new Error("Expected two bound error documents");
  const pages = Object.freeze(Object.fromEntries(["ru", "en"].map(locale => {
    const html = documents[locale];
    if (typeof html !== "string" || html.length > 2_000_000 || !html.includes(`lang="${locale}"`)) throw new Error("Invalid bound error document");
    return [locale, html];
  })));
  const defaults = new Headers(securityHeaders);
  return async function localizedNotFound(request) {
    // One origin request, including non-navigation traffic. Its redirects,
    // successful content, streams and errors remain untouched.
    let upstream;
    try { upstream = await originFetch(request); }
    catch { return new Response(null, { status: 502, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }); }
    const locale = publicNotFoundLocale(request);
    if (!locale || upstream.status !== 404 || !MIME_HTML.test(upstream.headers.get("content-type") ?? "")
        || upstream.headers.has("content-disposition") || upstream.headers.has("content-range")) return upstream;
    const headers = new Headers(upstream.headers);
    for (const [name, value] of defaults) if (!headers.has(name)) headers.set(name, value);
    for (const name of ["content-length", "content-encoding", "etag", "last-modified", "content-md5", "digest", "content-digest", "repr-digest", "accept-ranges", "age", "expires"]) headers.delete(name);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("content-language", locale);
    headers.set("cache-control", "no-store");
    headers.set("cdn-cache-control", "no-store");
    headers.set("cloudflare-cdn-cache-control", "no-store");
    headers.set("x-robots-tag", "noindex, follow");
    // Never buffer the origin body; cancellation releases its stream/socket.
    if (upstream.body) await upstream.body.cancel().catch(() => undefined);
    return new Response(request.method === "HEAD" ? null : pages[locale], { status: 404, statusText: "Not Found", headers });
  };
}

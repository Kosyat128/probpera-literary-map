import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { Readable, Transform, pipeline } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const failure = (code) => Object.assign(new Error(code), { newsError: code });

/** Conservative global-unicast policy; special-purpose and transition ranges fail closed.
 * References: https://www.iana.org/assignments/iana-ipv4-special-registry/
 * and https://www.iana.org/assignments/iana-ipv6-special-registry/ .
 */
export function isPublicNewsAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6 || address.includes("%")) return false;
  const [first, second = "0"] = address.toLowerCase().split(":");
  const a = parseInt(first, 16), b = parseInt(second || "0", 16);
  return a >= 0x2000 && a <= 0x3fff
    && !(a === 0x2001 && (b < 0x200 || b === 0xdb8))
    && a !== 0x2002 && a !== 0x3fff;
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(failure("request_aborted"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

function byteLimiter(limit) {
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > limit ? failure("response_too_large") : null, chunk);
    },
  });
}

/** Node collector transport. The code-owned source registry remains the caller's allowlist.
 * DNS is resolved once, all answers are checked, and the connection can use only
 * those exact answers. No global fetch, shared socket, proxy or redirect can resolve again.
 */
export function createPinnedNewsFetch({ lookupImpl = lookup, requestImpl = request, timeoutMs = 10_000 } = {}) {
  return async function pinnedNewsFetch(input, options = {}) {
    const url = new URL(input);
    const maxBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
    const requestTimeout = options.timeoutMs ?? timeoutMs;
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")
      || isIP(url.hostname.replace(/^\[|\]$/g, "")) || (options.method && options.method !== "GET")
      || !Number.isSafeInteger(maxBytes) || maxBytes <= 0
      || !Number.isFinite(requestTimeout) || requestTimeout <= 0 || requestTimeout > 4_294_967_295) throw failure("fetch_failed");
    const deadline = AbortSignal.timeout(Math.ceil(requestTimeout));
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    if (signal.aborted) throw failure("request_aborted");
    const answers = await abortable(lookupImpl(url.hostname, { all: true }), signal);
    if (signal.aborted) throw failure("request_aborted");
    if (!Array.isArray(answers) || !answers.length || answers.some((row) => !row
      || !isPublicNewsAddress(row.address) || isIP(row.address) !== row.family)) throw failure("fetch_failed");
    const pinned = answers.map(({ address, family }) => ({ address, family }));
    const pinnedLookup = (hostname, lookupOptions, callback) => {
      if (hostname !== url.hostname) return callback(failure("fetch_failed"));
      const family = typeof lookupOptions === "number" ? lookupOptions : lookupOptions?.family;
      const matches = pinned.filter((row) => !family || row.family === family);
      if (!matches.length) return callback(failure("fetch_failed"));
      if (lookupOptions?.all) callback(null, matches.map((row) => ({ ...row })));
      else callback(null, matches[0].address, matches[0].family);
    };
    const headers = new Headers(options.headers);
    headers.set("Host", url.host);
    headers.set("Accept-Encoding", "gzip, deflate, br");
    return new Promise((resolve, reject) => {
      const req = requestImpl(url, {
        method: "GET", agent: false, lookup: pinnedLookup, signal,
        servername: url.hostname, rejectUnauthorized: true, maxHeaderSize: 16_384,
        headers: Object.fromEntries(headers),
      }, (incoming) => {
        try {
          const status = incoming.statusCode;
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          if (status >= 300 && status < 400 && status !== 304) throw failure("redirect_not_allowed");
          // Error/validator responses need only headers. Do not leave unread sockets alive.
          if (status === 204 || status === 304 || status < 200 || status >= 300) {
            incoming.destroy();
            resolve(new Response(null, { status, headers: responseHeaders }));
            return;
          }
          if (Number(responseHeaders.get("content-length")) > maxBytes) throw failure("response_too_large");
          const encoding = (responseHeaders.get("content-encoding") || "identity").toLowerCase().trim();
          const decompress = { gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress }[encoding];
          if (encoding !== "identity" && !decompress) throw failure("unsupported_content_type");
          const stages = [incoming, byteLimiter(maxBytes)];
          if (decompress) {
            stages.push(decompress(), byteLimiter(maxBytes));
            responseHeaders.delete("content-encoding");
            responseHeaders.delete("content-length");
          }
          const body = stages.at(-1);
          // pipeline propagates decompressor, abort and consumer-cancel errors in both directions.
          pipeline(...stages, () => {});
          const response = new Response(Readable.toWeb(body), { status, headers: responseHeaders });
          Object.defineProperty(response, "url", { value: url.href });
          resolve(response);
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      });
      req.once("error", reject);
      req.end();
    });
  };
}

export const fetchPinnedNewsSource = createPinnedNewsFetch();

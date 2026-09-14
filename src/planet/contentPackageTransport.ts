import { contentPackageHash, type ContentPackageFile } from "./contentPackageProtocol.mjs";

export type ContentPackageFetch = (url: string, init: RequestInit) => Promise<Response>;
export interface ContentFileDownloadOptions {
  readonly fetch: ContentPackageFetch;
  readonly baseUrl: string;
  readonly file: ContentPackageFile;
  readonly signal?: AbortSignal;
  readonly idleTimeoutMs?: number;
  readonly onBytes?: (loaded: number) => void;
}
function fail(reason: string): never { throw new Error(reason); }
export function normalizeContentPackageBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return fail("invalid-content-package-url"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.href !== value || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")
    || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) fail("invalid-content-package-url");
  return url.href;
}

/** One bounded data file; the caller authenticates its manifest first. URLs are
 * built below an independently selected base, never read from content fields. */
export async function downloadContentPackageFile(options: ContentFileDownloadOptions): Promise<Uint8Array<ArrayBuffer>> {
  const base = normalizeContentPackageBaseUrl(options.baseUrl), file = { ...options.file };
  const timeout = options.idleTimeoutMs ?? 30_000, signal = options.signal, fetch = options.fetch, onBytes = options.onBytes;
  if (!Number.isSafeInteger(timeout) || timeout < 10 || timeout > 60_000) fail("invalid-content-download-timeout");
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 16 * 1024 * 1024
    || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(file.sha256)
    || typeof file.path !== "string" || !/^[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*\.json$/u.test(file.path)
    || file.path.split("/").some(part => part === "." || part === "..")) fail("invalid-content-download-file");
  const url = new URL(file.path.split("/").map(encodeURIComponent).join("/"), base).href;
  if (!url.startsWith(base)) fail("invalid-content-package-url");
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  let reason: string | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const stop = (nextReason: string) => { if (!controller.signal.aborted) { reason = nextReason; controller.abort(); } };
  const abort = () => stop("cancelled");
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => stop("content-download-timeout"), timeout); };
  const check = () => { if (controller.signal.aborted) fail(reason ?? "cancelled"); };
  const pending = async <T>(operation: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true; controller.signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve(value as T);
    };
    const aborted = () => finish(new Error(reason ?? "cancelled"));
    operation.then(value => finish(null, value), error => finish(error));
    controller.signal.addEventListener("abort", aborted, { once: true });
    if (controller.signal.aborted) aborted();
  });
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    check(); arm();
    const response = await pending(fetch(url, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error",
      referrerPolicy: "no-referrer", mode: "cors", signal: controller.signal, headers: { Accept: "application/json" } }));
    check(); arm();
    if (response.status !== 200 || response.redirected || response.type === "opaque" || (response.url && response.url !== url)) fail("invalid-content-download-response");
    const mime = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
    if (mime !== "application/json" && !/^application\/[a-z0-9.+-]+\+json$/u.test(mime ?? "")) fail("invalid-content-download-type");
    if (!response.body) fail("incomplete-content-download");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      check(); const { done, value } = await pending(reader.read());
      check(); arm();
      if (done) break;
      length += value.byteLength;
      if (length > file.bytes) fail("content-download-byte-limit");
      // Copy a stream chunk before exposing progress to external callbacks.
      chunks.push(new Uint8Array(value));
      try { onBytes?.(length); } catch { /* An observer cannot corrupt a transfer. */ }
    }
    if (length !== file.bytes) fail("incomplete-content-download");
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (contentPackageHash(bytes) !== file.sha256) fail("content-download-integrity-mismatch");
    check(); return bytes;
  } catch (error) {
    if (!controller.signal.aborted) { reason = error instanceof Error ? error.message : "content-download-unavailable"; controller.abort(); }
    return fail(reason ?? "content-download-unavailable");
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", abort);
    if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}

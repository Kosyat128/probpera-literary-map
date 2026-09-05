export interface PlanetAccountConfiguration {
  v: 1;
  audience: string;
  product: string;
  deletionDisclosure: { version: string; ru: string; en: string } | null;
}
export interface PlanetAccountDeletionStatus {
  requestId: string;
  status: "requested" | "processing" | "blocked" | "completed";
}
export class PlanetAccountError extends Error {
  constructor(readonly reason: "unavailable" | "authentication" | "reauthentication" | "denied" | "invalid-response" | "status-unknown") { super(reason); }
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, fields: string[]) {
  return Object.keys(value).sort().join(",") === [...fields].sort().join(",");
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function safePwaReturnPath(candidate: string | null, language: "ru" | "en"): string {
  const fallback = "/planet/" + language + "/";
  if (!candidate || candidate.length > 4096 || /[\u0000-\u0020\u007f\\]/u.test(candidate)) return fallback;
  try {
    const value = new URL(candidate, "https://probpera.ru");
    if (value.origin !== "https://probpera.ru" || !candidate.startsWith("/planet/")
      || !/^\/planet\/(?:ru\/|en\/)?$/u.test(value.pathname)) return fallback;
    // Return to the selected locale while retaining canonical semantic query/hash.
    return fallback + value.search + value.hash;
  } catch { return fallback; }
}

/** Same-origin account bridge. Supabase remains the sole account owner. Tokens
 * are sent to the authenticated server and are never decoded or stored here. */
export function createPlanetAccountClient(options: { origin: string; fetch?: typeof fetch; allowLocalQa?: boolean }) {
  const origin = new URL(options.origin);
  if (origin.origin !== options.origin || origin.username || origin.password || !(origin.protocol === "https:"
    || (options.allowLocalQa && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) throw new Error("Invalid account origin");
  const fetcher = options.fetch ?? globalThis.fetch;
  async function post(route: string, body: object, token?: string, signal?: AbortSignal, expectedStatus?: number): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 10_000);
    try {
      const endpoint = options.origin + "/planet/api/" + route;
      const response = await fetcher(endpoint, { method: "POST", credentials: "include", mode: "same-origin", redirect: "error", cache: "no-store",
        signal: controller.signal, headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
      if (response.redirected || (response.url && response.url !== endpoint) || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "") || !response.body) throw new PlanetAccountError("invalid-response");
      const reader = response.body.getReader();
      const cancel = () => { void reader.cancel().catch(() => undefined); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 65_536) throw new PlanetAccountError("invalid-response");
          chunks.push(next.value);
        }
      } finally { controller.signal.removeEventListener("abort", cancel); cancel(); reader.releaseLock(); }
      if (controller.signal.aborted) throw new PlanetAccountError("unavailable");
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (response.status === 401) throw new PlanetAccountError("authentication");
      if (response.status === 403) throw new PlanetAccountError(object(value) && value.error === "reauthentication-required" ? "reauthentication" : "denied");
      if (![200, 202].includes(response.status)) throw new PlanetAccountError("unavailable");
      if (expectedStatus !== undefined && response.status !== expectedStatus) throw new PlanetAccountError("invalid-response");
      return value;
    } catch (error) { throw error instanceof PlanetAccountError ? error : new PlanetAccountError("unavailable"); }
    finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
  }
  const context = (config: PlanetAccountConfiguration) => ({ v: 1, audience: config.audience, product: config.product });
  return Object.freeze({
    async configuration(signal?: AbortSignal): Promise<PlanetAccountConfiguration> {
      const value = await post("configuration", { v: 1 }, undefined, signal);
      if (!object(value) || !exact(value, ["v", "audience", "product", "deletionDisclosure"]) || value.v !== 1
        || typeof value.audience !== "string" || !/^[A-Za-z0-9:._/-]{1,128}$/u.test(value.audience)
        || typeof value.product !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value.product)) throw new PlanetAccountError("invalid-response");
      const disclosure = value.deletionDisclosure;
      if (disclosure !== null && (!object(disclosure) || !exact(disclosure, ["version", "ru", "en"])
        || typeof disclosure.version !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(disclosure.version)
        || ![disclosure.ru, disclosure.en].every(text => typeof text === "string" && text.trim().length > 0 && text.length <= 8000))) throw new PlanetAccountError("invalid-response");
      return value as unknown as PlanetAccountConfiguration;
    },
    async bridge(config: PlanetAccountConfiguration, token: string, signal?: AbortSignal): Promise<string> {
      if (!/^[A-Za-z0-9_.-]{1,2500}$/u.test(token)) throw new PlanetAccountError("authentication");
      const value = await post("license/bridge", context(config), token, signal);
      if (!object(value) || !exact(value, ["subject"]) || typeof value.subject !== "string" || !UUID.test(value.subject)) throw new PlanetAccountError("invalid-response");
      return value.subject;
    },
    async requestDeletion(config: PlanetAccountConfiguration, token: string, requestId: string, signal?: AbortSignal): Promise<{ requestId: string; status: "requested" }> {
      if (!config.deletionDisclosure) throw new PlanetAccountError("unavailable");
      if (!UUID.test(requestId) || !/^[A-Za-z0-9_.-]{1,2500}$/u.test(token)) throw new PlanetAccountError("authentication");
      const value = await post("account/deletion-request", { ...context(config), requestId, reauthToken: token }, undefined, signal);
      if (!object(value) || !exact(value, ["requestId", "status"]) || value.requestId !== requestId || value.status !== "requested") throw new PlanetAccountError("invalid-response");
      return { requestId, status: "requested" };
    },
    async deletionStatus(config: PlanetAccountConfiguration, token: string, signal?: AbortSignal): Promise<PlanetAccountDeletionStatus | null> {
      if (!/^[A-Za-z0-9_.-]{1,2500}$/u.test(token)) throw new PlanetAccountError("authentication");
      const value = await post("account/deletion-status", context(config), token, signal, 200);
      if (!object(value) || !exact(value, ["request"])) throw new PlanetAccountError("invalid-response");
      if (value.request === null) return null;
      const status = value.request;
      if (!object(status) || !exact(status, ["requestId", "status"]) || typeof status.requestId !== "string" || !UUID.test(status.requestId)
        || typeof status.status !== "string" || !["requested", "processing", "blocked", "completed"].includes(status.status)) throw new PlanetAccountError("invalid-response");
      return { requestId: status.requestId, status: status.status as PlanetAccountDeletionStatus["status"] };
    },
  });
}

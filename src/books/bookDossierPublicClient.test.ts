import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublishedBookDossier } from "./bookDossierPublicClient";
import { buildBookEditorialDocument } from "./bookEditorialPages";
import { buildBookDossierFromEditorial } from "./bookDossierLegacyAdapter";

const environment = vi.hoisted(() => ({ controlled: false, url: "https://fixture.supabase.invalid", key: "public-fixture-key" }));
vi.mock("../platform/distribution", () => ({ get isControlledWebEdition() { return environment.controlled; } }));
vi.mock("../lib/supabaseConfig", () => ({ supabaseConnection: { get url() { return environment.url; }, get publishableKey() { return environment.key; } } }));
const request = { bookKey: "fixture:writer:work", locale: "ru" as const };
function document() {
  const legacy = buildBookEditorialDocument({ bookKey: request.bookKey, locale: request.locale, themeVersion: "fixture", title: "Synthetic work", writer: "Synthetic writer" });
  return { ...buildBookDossierFromEditorial(legacy), validUntil: new Date(Date.now() + 60_000).toISOString() };
}
beforeEach(() => { environment.controlled = false; environment.url = "https://fixture.supabase.invalid"; environment.key = "public-fixture-key"; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("published dossier distribution boundary", () => {
  it("makes zero requests in the controlled PWA even when public Supabase values are present", async () => {
    environment.controlled = true;
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await fetchPublishedBookDossier(request)).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps the existing local catalogue fallback intact without claiming a reviewed tier", () => {
    const fallback = document();
    expect(fallback.bookKey).toBe(request.bookKey); expect(fallback.locale).toBe("ru");
    expect(fallback.tier).toBeNull(); expect(fallback.readingMode).toBe("BEFORE_READING");
    expect(fallback.pages[0].title).toBe("Synthetic work");
  });
  it("preserves configured public-site POST delivery, cancellation signal and exact identity checks", async () => {
    const result = document(), controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })); vi.stubGlobal("fetch", fetcher);
    expect(await fetchPublishedBookDossier({ ...request, signal: controller.signal })).toEqual(result);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0][0])).toBe("https://fixture.supabase.invalid/rest/v1/rpc/get_published_book_dossier");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", signal: controller.signal });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ p_request: { ...request, mode: "BEFORE_READING", revealSpoilers: "NONE", reachedItemIds: [] } });
  });
  it.each(["missing URL", "missing key", "HTTP", "credentials"])("does not request an unsafe/unconfigured site (%s)", async reason => {
    if (reason === "missing URL") environment.url = "";
    if (reason === "missing key") environment.key = "";
    if (reason === "HTTP") environment.url = "http://fixture.supabase.invalid";
    if (reason === "credentials") environment.url = "https://user:password@fixture.supabase.invalid";
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await fetchPublishedBookDossier(request)).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["book", "locale", "expired"])("rejects an unrelated or stale %s response", async reason => {
    const result = document();
    if (reason === "book") result.bookKey = "fixture:writer:other";
    if (reason === "locale") result.locale = "en";
    if (reason === "expired") result.validUntil = new Date(Date.now() - 1).toISOString();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result))));
    expect(await fetchPublishedBookDossier(request)).toBeNull();
  });
});

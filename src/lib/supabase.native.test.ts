import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ createClient: vi.fn(), client: { auth: {} } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: sdk.createClient }));
vi.mock("./supabaseConfig", () => ({
  isCommunityConfigured: true, isAuthTurnstileConfigured: false,
  supabaseConnection: { url: "https://account-fixture.invalid", publishableKey: "test-public-key" },
}));
beforeEach(() => { vi.resetModules(); sdk.createClient.mockReset().mockReturnValue(sdk.client); });
afterEach(() => vi.unstubAllGlobals());

describe("static account backend boundary", () => {
  it("keeps direct canonical book-hook imports accountless in the native reader", async () => {
    vi.stubGlobal("__LITERARY_PLANET_EDITION__", "native");
    expect((await import("./supabase")).supabase).toBeNull();
    expect(sdk.createClient).not.toHaveBeenCalled();
  });
  it.each(["site", "pwa"])("retains the configured %s account client", async edition => {
    vi.stubGlobal("__LITERARY_PLANET_EDITION__", edition);
    expect((await import("./supabase")).supabase).toBe(sdk.client);
    expect(sdk.createClient).toHaveBeenCalledExactlyOnceWith(
      "https://account-fixture.invalid", "test-public-key",
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  });
});

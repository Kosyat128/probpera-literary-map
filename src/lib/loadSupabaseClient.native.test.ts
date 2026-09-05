import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ client: { marker: "existing-account-client" }, imported: vi.fn() }));
vi.mock("./supabaseConfig", () => ({ isCommunityConfigured: true }));
vi.mock("./supabase", () => { sdk.imported(); return { supabase: sdk.client }; });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("bundled native reader backend boundary", () => {
  it("never initializes or loads the account SDK even if backend configuration is present", async () => {
    vi.stubGlobal("__LITERARY_PLANET_EDITION__", "native");
    const { loadSupabaseClient } = await import("./loadSupabaseClient");
    expect(await loadSupabaseClient()).toBeNull();
    expect(await loadSupabaseClient()).toBeNull();
    expect(sdk.imported).not.toHaveBeenCalled();
  });
  it.each(["site", "pwa"])("retains the existing lazy client for %s", async edition => {
    vi.stubGlobal("__LITERARY_PLANET_EDITION__", edition);
    const { loadSupabaseClient } = await import("./loadSupabaseClient");
    const first = loadSupabaseClient();
    expect(loadSupabaseClient()).toBe(first);
    expect(await first).toBe(sdk.client);
  });
});

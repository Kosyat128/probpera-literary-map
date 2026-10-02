import { describe, expect, it, vi } from "vitest";
import { createNativePreferenceDiagnostics } from "./nativePreferenceDiagnostics";
import { createHostPlatformServices, type HostPreferenceBridge } from "./HostPlatformServices";

// Synthetic ports verify fixture boundaries and host timeouts. OS persistence
// is independently recorded only by installed instrumentation/XCTest runs.
const runId = "a".repeat(32), prefix = "literary-native-runtime-" + runId + ":";
function fixture() {
  const values = new Map<string, string>();
  const bridge: HostPreferenceBridge = {
    get: vi.fn(async ({ key }) => ({ value: values.get(key) ?? null })),
    set: vi.fn(async ({ key, value }) => { values.set(key, value); }),
    remove: vi.fn(async ({ key }) => { values.delete(key); }),
  };
  return { values, bridge, qa: createNativePreferenceDiagnostics("android", bridge) };
}
describe("owned native preference fixture and bounded host bridge", () => {
  it("uses only isolated exact keys and preserves canonical UI preferences", async () => {
    const f = fixture(); f.values.set("probpera-interface-language", "ru");
    expect((await f.qa.run(runId, "write")).status).toBe("PASS");
    expect((await f.qa.run(runId, "read")).status).toBe("PASS");
    expect(f.values.get(prefix + "probpera-booky-size-v1")).toBe("large");
    expect(f.values.get("probpera-interface-language")).toBe("ru");
    expect((await f.qa.run(runId, "remove")).status).toBe("PASS");
    expect((await f.qa.run(runId, "absent")).status).toBe("PASS");
    expect([...f.values]).toEqual([["probpera-interface-language", "ru"]]);
  });
  it.each(["unsupported-language", "unsupported-theme"])("denies %s before any native write", async phase => {
    const f = fixture(); expect((await f.qa.run(runId, phase)).status).toBe("PASS"); expect(f.bridge.set).not.toHaveBeenCalled();
  });
  it("reads native corruption but does not publish unsupported language", async () => {
    const f = fixture(); expect((await f.qa.run(runId, "corrupt")).status).toBe("PASS");
    expect(f.values.get(prefix + "probpera-interface-language")).toBe("synthetic-invalid-language");
  });
  it("orders parallel writes through the existing host policy", async () => {
    const f = fixture(); expect((await f.qa.run(runId, "parallel")).status).toBe("PASS");
    expect(f.values.get(prefix + "probpera-interface-language")).toBe("ru");
  });
  it("labels deliberately injected plugin faults as synthetic", async () => {
    const f = fixture(); expect(await f.qa.run(runId, "plugin-failure")).toMatchObject({ status: "PASS", backend: "synthetic-boundary" });
    expect(f.bridge.get).not.toHaveBeenCalled(); expect(f.bridge.set).not.toHaveBeenCalled();
  });
  it("bounds a synthetic hung installed boundary without dispatching later same-key work", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(), probe = f.qa.run(runId, "timeout");
      await vi.advanceTimersByTimeAsync(100);
      expect(await probe).toMatchObject({ status: "PASS", backend: "synthetic-boundary" }); expect(f.bridge.get).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("keeps a late timed-out native write ahead of removal and denies late publication", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(); let finish!: () => void;
      vi.mocked(f.bridge.set).mockImplementationOnce(async ({ key, value }) => {
        await new Promise<void>(resolve => { finish = resolve; }); f.values.set(key, value);
      });
      const host = createHostPlatformServices({ kind: "android", channel: "dev", languages: [], preferences: f.bridge, preferenceTimeoutMs: 50 });
      const writing = host.preferences.set("probpera-interface-language", "en"); await vi.advanceTimersByTimeAsync(50);
      expect(await writing).toBe(false);
      const removing = host.preferences.remove("probpera-interface-language"); await vi.advanceTimersByTimeAsync(50);
      expect(await removing).toBe(false); expect(f.bridge.remove).not.toHaveBeenCalled();
      finish(); await vi.advanceTimersByTimeAsync(0);
      expect(f.bridge.remove).toHaveBeenCalledTimes(1); expect(f.values.has("probpera-interface-language")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it.each([0, 10001, 1.5, NaN])("rejects invalid host preference deadline %s", timeout => {
    expect(() => createHostPlatformServices({ kind: "android", channel: "dev", languages: [], preferenceTimeoutMs: timeout })).toThrow(RangeError);
  });
  it.each([["../personal", "write"], [runId, "arbitrary-script"], [runId.toUpperCase(), "clear"]])("rejects an unowned probe %j", async (id, phase) => {
    const f = fixture(); await expect(f.qa.run(id, phase)).rejects.toThrow("native-preference-diagnostic-unavailable");
    expect(f.bridge.get).not.toHaveBeenCalled(); expect(f.bridge.set).not.toHaveBeenCalled(); expect(f.bridge.remove).not.toHaveBeenCalled();
  });
});

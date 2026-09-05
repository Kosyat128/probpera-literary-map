import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformServicesProvider, usePlatformServices, usePlatformSnapshot } from "./PlatformServices";
import type { PlatformServices } from "./ports";

function services(): PlatformServices {
  return {
    kind: "web", channel: "web",
    preferences: { persistence: "best-effort", get: async () => null, set: async () => false, remove: async () => false },
    getSnapshot: vi.fn<PlatformServices["getSnapshot"]>(() => ({ connectivity: "online", visibility: "active" })),
    subscribe: vi.fn(() => () => undefined),
    getSystemLanguages: vi.fn(() => ["en"]),
    openExternalLink: vi.fn<PlatformServices["openExternalLink"]>(() => "unavailable"),
  };
}
describe("platform capability injection", () => {
  it("keeps server rendering browser-independent and injects the exact services instance", () => {
    const adapter = services();
    function Consumer() {
      expect(usePlatformServices()).toBe(adapter);
      const snapshot = usePlatformSnapshot();
      return <span>{snapshot.connectivity}/{snapshot.visibility}</span>;
    }
    const output = renderToString(<PlatformServicesProvider services={adapter}><Consumer /></PlatformServicesProvider>);
    expect(output).toContain("unknown");
    expect(output).toContain("active");
    expect(adapter.getSnapshot).not.toHaveBeenCalled();
    expect(adapter.subscribe).not.toHaveBeenCalled();
    expect(adapter.getSystemLanguages).not.toHaveBeenCalled();
  });
  it("fails clearly when a client was not given platform services", () => {
    function Consumer() { usePlatformServices(); return null; }
    expect(() => renderToString(<Consumer />)).toThrow("PlatformServicesProvider is required");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadDiagnosticPreview } from "./SupportDiagnosticsPanel";
import type { SupportDiagnosticSession } from "./supportDiagnosticSession";

afterEach(() => { vi.unstubAllGlobals(); });
const session = (bytes: string | null) => ({
  exportPreview: vi.fn(() => bytes),
}) as unknown as SupportDiagnosticSession;
function downloadEnvironment(options: { clickThrows?: boolean; urlThrows?: boolean } = {}) {
  const events: string[] = [];
  let capturedBlob: Blob | null = null;
  const anchor = {
    href: "", download: "",
    click: vi.fn(() => { events.push("click"); if (options.clickThrows) throw Error("private browser error"); }),
    remove: vi.fn(() => { events.push("remove"); }),
  };
  const createObjectURL = vi.fn((blob: Blob) => {
    if (options.urlThrows) throw Error("private URL error");
    capturedBlob = blob; events.push("url"); return "blob:local-diagnostic";
  });
  const revokeObjectURL = vi.fn(() => { events.push("revoke"); });
  const append = vi.fn(() => { events.push("append"); });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { append } });
  return { anchor, append, events, createObjectURL, revokeObjectURL, getBlob: () => capturedBlob };
}
describe("explicit support preview download", () => {
  it("does not create a URL or anchor when controller admission denies export", () => {
    const env = downloadEnvironment(), controller = session(null);
    expect(downloadDiagnosticPreview(controller)).toBe(false);
    expect(controller.exportPreview).toHaveBeenCalledTimes(1);
    expect(env.events).toEqual([]);
  });
  it("downloads exactly the approved bytes as JSON and releases all temporary DOM/URL state", async () => {
    const env = downloadEnvironment(), bytes = '{ "status": "unknown" }\n', controller = session(bytes);
    expect(downloadDiagnosticPreview(controller)).toBe(true);
    expect(controller.exportPreview).toHaveBeenCalledTimes(1);
    expect(await env.getBlob()?.text()).toBe(bytes);
    expect(env.getBlob()?.type).toBe("application/json");
    expect(env.anchor.download).toBe("literary-planet-diagnostics.json");
    expect(env.events).toEqual(["url", "append", "click", "remove", "revoke"]);
    expect(env.revokeObjectURL).toHaveBeenCalledWith("blob:local-diagnostic");
  });
  it("still removes the anchor and revokes the URL when the browser click fails", () => {
    const env = downloadEnvironment({ clickThrows: true });
    expect(downloadDiagnosticPreview(session("{}\n"))).toBe(false);
    expect(env.events).toEqual(["url", "append", "click", "remove", "revoke"]);
  });
  it("does not retain an anchor or URL when URL creation fails", () => {
    const env = downloadEnvironment({ urlThrows: true });
    expect(downloadDiagnosticPreview(session("{}\n"))).toBe(false);
    expect(env.append).not.toHaveBeenCalled();
    expect(env.revokeObjectURL).not.toHaveBeenCalled();
  });
});

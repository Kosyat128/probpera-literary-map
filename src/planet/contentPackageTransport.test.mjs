import { describe, expect, it, vi } from "vitest";
import { downloadContentPackageFile } from "./contentPackageTransport";
import { contentPackageHash } from "./contentPackageProtocol.mjs";

const original = new TextEncoder().encode('{"text":"Тест / Test"}');
const make = () => ({ baseUrl: "https://content.test/packages/v1/", file: { path: "en/catalog.json", bytes: original.length, sha256: contentPackageHash(original) },
  fetch: vi.fn(async () => new Response(original, { headers: { "Content-Type": "application/json; charset=utf-8" } })) });

describe("bounded content data transport", () => {
  it("fetches only the selected JSON path without cookies, redirects, cache or referrer and verifies exact bytes", async () => {
    const input = make();
    expect(await downloadContentPackageFile(input)).toEqual(original);
    expect(input.fetch).toHaveBeenCalledOnce();
    expect(input.fetch.mock.calls[0]).toEqual(["https://content.test/packages/v1/en/catalog.json", expect.objectContaining({
      credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", method: "GET", mode: "cors", headers: { Accept: "application/json" },
    })]);
  });
  it.each(["http://content.test/packages/", "https://user:password@content.test/packages/", "https://content.test/packages/?key=x",
    "https://content.test/packages/#fragment", "https://content.test/packages", "https://content.test/packages/../private/", "file:///packages/"])
  ("rejects invalid base %s before requesting data", async baseUrl => {
    const input = make();
    await expect(downloadContentPackageFile({ ...input, baseUrl })).rejects.toThrow("invalid-content-package-url");
    expect(input.fetch).not.toHaveBeenCalled();
  });
  it.each(["../catalog.json", "/catalog.json", "en/../../catalog.json", "en/catalog.json?token=x", "https://other.test/data.json", "en/%2e%2e/data.json"])
  ("refuses transport traversal %s", async path => {
    const input = make(); input.file.path = path;
    await expect(downloadContentPackageFile(input)).rejects.toThrow("invalid-content-download-file");
    expect(input.fetch).not.toHaveBeenCalled();
  });
  it.each(["status", "html", "redirect", "different URL", "opaque", "empty body", "truncated", "overflow", "same-size corruption"])
  ("refuses %s replies before returning a verified file", async failure => {
    const input = make();
    input.fetch = vi.fn(async () => {
      let bytes = new Uint8Array(original);
      if (failure === "truncated") bytes = bytes.slice(0, -1);
      if (failure === "overflow") bytes = new Uint8Array([...bytes, 0]);
      if (failure === "same-size corruption") bytes[5] ^= 1;
      const response = new Response(failure === "empty body" ? null : bytes, { status: failure === "status" ? 206 : 200,
        headers: { "Content-Type": failure === "html" ? "text/html" : "application/json", "Content-Length": String(original.length) } });
      if (failure === "redirect") Object.defineProperty(response, "redirected", { value: true });
      if (failure === "different URL") Object.defineProperty(response, "url", { value: "https://other.test/catalog.json" });
      if (failure === "opaque") Object.defineProperty(response, "type", { value: "opaque" });
      return response;
    });
    await expect(downloadContentPackageFile(input)).rejects.toThrow();
  });
  it("does not issue a request after cancellation and cancels a hanging request promptly", async () => {
    const input = make(), early = new AbortController(); early.abort();
    await expect(downloadContentPackageFile({ ...input, signal: early.signal })).rejects.toThrow("cancelled");
    expect(input.fetch).not.toHaveBeenCalled();
    const controller = new AbortController(); input.fetch = vi.fn(() => new Promise(() => {}));
    const pending = downloadContentPackageFile({ ...input, signal: controller.signal }); controller.abort();
    await expect(pending).rejects.toThrow("cancelled");
    expect(input.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it.each(["headers", "body"])("bounds a stalled %s operation and cancels its transport", async phase => {
    const input = make();
    input.fetch = vi.fn(() => phase === "headers" ? new Promise(() => {})
      : Promise.resolve(new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "application/json" } })));
    await expect(downloadContentPackageFile({ ...input, idleTimeoutMs: 20 })).rejects.toThrow("content-download-timeout");
    expect(input.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("snapshots stream chunks before notifying observers and isolates their exceptions", async () => {
    const input = make(), chunk = new Uint8Array(original);
    input.fetch = vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.close(); } }), { headers: { "Content-Type": "application/json" } }));
    const onBytes = vi.fn(() => { chunk.fill(0); throw new Error("observer fixture"); });
    expect(await downloadContentPackageFile({ ...input, onBytes })).toEqual(original);
    expect(onBytes).toHaveBeenCalledWith(original.length);
  });
});

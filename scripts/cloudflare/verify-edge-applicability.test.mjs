import { describe, expect, it, vi } from "vitest";

import {
  inspectCloudflareEdgeApplicability,
  responseTraversedCloudflare,
} from "./verify-edge-applicability.mjs";

function response({ status = 200, cfRay = null } = {}) {
  return new Response("Contact: mailto:probperasite@yandex.ru\n", {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(cfRay ? { "cf-ray": cfRay } : {}),
    },
  });
}

describe("Cloudflare edge applicability preflight", () => {
  it("recognizes a live Cloudflare edge response only when CF-Ray is present", () => {
    expect(responseTraversedCloudflare(new Headers({ "cf-ray": "abc123-IAD" }))).toBe(true);
    expect(responseTraversedCloudflare(new Headers())).toBe(false);
  });

  it("reports the public apex as proxied when the live response traverses Cloudflare", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ cfRay: "abc123-AMS" }));

    await expect(
      inspectCloudflareEdgeApplicability({ fetchImpl })
    ).resolves.toEqual({
      origin: "https://probpera.ru",
      status: 200,
      edgeTrafficProxied: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0].href).toContain(
      "https://probpera.ru/.well-known/security.txt?edge-applicability=1"
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "follow",
    });
  });

  it("reports DNS-only or bypass traffic without treating it as a successful edge path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response());

    await expect(
      inspectCloudflareEdgeApplicability({ fetchImpl })
    ).resolves.toEqual({
      origin: "https://probpera.ru",
      status: 200,
      edgeTrafficProxied: false,
    });
  });

  it.each([500, 503, 599])(
    "fails closed for an unexpected live probe status %s",
    async (status) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(response({ status, cfRay: "abc123-AMS" }));

      await expect(
        inspectCloudflareEdgeApplicability({ fetchImpl })
      ).rejects.toThrow(`unexpected HTTP ${status}`);
    }
  );

  it("fails closed when the live probe cannot obtain a response", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(
      inspectCloudflareEdgeApplicability({ fetchImpl })
    ).rejects.toThrow("probe failed before a response: network unavailable");
  });

  it("rejects non-HTTPS or non-origin probe targets", async () => {
    await expect(
      inspectCloudflareEdgeApplicability({
        origin: "http://probpera.ru",
        fetchImpl: vi.fn(),
      })
    ).rejects.toThrow("must be a bare HTTPS origin");

    await expect(
      inspectCloudflareEdgeApplicability({
        origin: "https://probpera.ru/path",
        fetchImpl: vi.fn(),
      })
    ).rejects.toThrow("must be a bare HTTPS origin");
  });
});

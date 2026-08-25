import { describe, expect, it, vi } from "vitest";

import { auditDirectPublicOrigin } from "./audit-public-direct-origin.mjs";

const now = Date.parse("2026-08-25T00:00:00.000Z");
const securityDocument = [
  "Contact: mailto:probperasite@yandex.ru",
  "Expires: 2027-02-10T00:00:00.000Z",
  "Preferred-Languages: ru, en",
  "Canonical: https://probpera.ru/.well-known/security.txt",
  "",
].join("\n");

function directFetch({ proxied = false, badRedirect = false, badContentType = false } = {}) {
  return vi.fn(async (urlValue) => {
    const url = new URL(urlValue);

    if (url.searchParams.has("edge-applicability")) {
      return new Response(securityDocument, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...(proxied ? { "CF-Ray": "abc123-AMS" } : {}),
        },
      });
    }

    if (url.protocol === "http:") {
      const location = new URL(url);
      location.protocol = "https:";
      if (badRedirect) location.search = "";
      return new Response(null, {
        status: 308,
        headers: { Location: location.href },
      });
    }

    if (url.pathname === "/.well-known/security.txt") {
      return new Response(securityDocument, {
        status: 200,
        headers: {
          "Content-Type": badContentType
            ? "text/html; charset=utf-8"
            : "text/plain; charset=utf-8",
        },
      });
    }

    return new Response("ok", { status: 200 });
  });
}

describe("direct public production audit", () => {
  it("accepts HTTPS direct delivery with Cloudflare proxy intentionally off", async () => {
    const fetchImpl = directFetch();

    await expect(
      auditDirectPublicOrigin("https://probpera.ru", {
        fetchImpl,
        now,
        timeoutMs: 100,
      })
    ).resolves.toEqual({
      origin: "https://probpera.ru",
      checks: 4,
      errors: [],
      ok: true,
    });
  });

  it("fails if the public apex unexpectedly starts traversing Cloudflare", async () => {
    const result = await auditDirectPublicOrigin("https://probpera.ru", {
      fetchImpl: directFetch({ proxied: true }),
      now,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "unexpectedly traverses Cloudflare edge"
    );
  });

  it("still fails closed for broken HTTPS redirect semantics", async () => {
    const result = await auditDirectPublicOrigin("https://probpera.ru", {
      fetchImpl: directFetch({ badRedirect: true }),
      now,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("preserve host, path, and query");
  });

  it("still requires a valid text/plain security document", async () => {
    const result = await auditDirectPublicOrigin("https://probpera.ru", {
      fetchImpl: directFetch({ badContentType: true }),
      now,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "security.txt must use a text/plain Content-Type"
    );
  });
});

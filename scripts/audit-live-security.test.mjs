import { describe, expect, it } from "vitest";
import {
  auditOrigin,
  validateSecurityDocument,
  validateSecurityDocumentHeaders,
  validateSecurityHeaders,
} from "./audit-live-security.mjs";

const now = Date.parse("2026-08-14T00:00:00.000Z");
const requiredHeaders = {
  "content-security-policy": "default-src 'self'; frame-ancestors https://admin.probpera.ru",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
};
const securityDocument = [
  "Contact: mailto:probperasite@yandex.ru",
  "Expires: 2027-02-10T00:00:00.000Z",
  "Preferred-Languages: ru, en",
  "Canonical: https://probpera.ru/.well-known/security.txt",
  "",
].join("\n");

function successfulFetch(url) {
  const requestUrl = new URL(url);
  if (requestUrl.protocol === "http:") {
    requestUrl.protocol = "https:";
    return Promise.resolve(
      new Response(null, { status: 308, headers: { Location: requestUrl.href } })
    );
  }
  if (requestUrl.pathname === "/.well-known/security.txt") {
    return Promise.resolve(
      new Response(securityDocument, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      })
    );
  }
  return Promise.resolve(new Response("ok", { status: 200, headers: requiredHeaders }));
}

describe("live production security audit", () => {
  it("accepts a strict HTTPS redirect, baseline headers, and a valid security.txt", async () => {
    const result = await auditOrigin("https://probpera.ru", {
      fetchImpl: successfulFetch,
      now,
      timeoutMs: 100,
    });

    expect(result).toMatchObject({ ok: true, checks: 3, errors: [] });
  });

  it("rejects redirect query loss and incomplete HTTPS headers", async () => {
    const fetchImpl = async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.protocol === "http:") {
        return new Response(null, {
          status: 301,
          headers: { Location: "https://probpera.ru/robots.txt" },
        });
      }
      if (requestUrl.pathname === "/.well-known/security.txt") {
        return new Response(securityDocument, {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return new Response("ok", { status: 200 });
    };

    const result = await auditOrigin("https://probpera.ru", {
      fetchImpl,
      now,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("preserve host, path, and query");
    expect(result.errors.join("\n")).toContain("Strict-Transport-Security");
  });

  it("requires framing protection and a fresh canonical security document", () => {
    const headers = new Headers({
      ...requiredHeaders,
      "content-security-policy": "default-src 'self'",
    });
    expect(validateSecurityHeaders(headers)).toContain(
      "Responses need X-Frame-Options or a CSP frame-ancestors directive"
    );

    const expired = securityDocument.replace(
      "2027-02-10T00:00:00.000Z",
      "2026-08-13T00:00:00.000Z"
    );
    expect(validateSecurityDocument(expired, "https://probpera.ru", now)).toContain(
      "security.txt Expires must be a valid future timestamp"
    );
    expect(validateSecurityDocumentHeaders(new Headers({ "Content-Type": "text/html" }))).toEqual([
      "security.txt must use a text/plain Content-Type",
      "security.txt must use X-Content-Type-Options: nosniff",
    ]);
  });
});

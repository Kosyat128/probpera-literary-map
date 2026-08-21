import { describe, expect, it } from "vitest";

import {
  buildAdminContentSecurityPolicy,
  createAdminCspNonce,
} from "./content-security-policy";

describe("admin content security policy", () => {
  it("creates a request-scoped nonce without CSP metacharacters", () => {
    const nonce = createAdminCspNonce(
      () => "123e4567-e89b-12d3-a456-426614174000"
    );
    expect(nonce).toBe("123e4567e89b12d3a456426614174000");
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it("builds a strict production script policy and narrow network allowlist", () => {
    const nonce = "123e4567e89b12d3a456426614174000";
    const policy = buildAdminContentSecurityPolicy({
      nonce,
      supabaseUrl: "https://project.supabase.co/path",
      publicSiteUrl: "https://probpera.ru/articles",
    });

    expect(policy).toContain(
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    );
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://project.supabase.co wss://project.supabase.co"
    );
    expect(policy).toContain("frame-src 'self' https://probpera.ru");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows only the development capabilities required by Next.js tooling", () => {
    const policy = buildAdminContentSecurityPolicy({
      nonce: "123e4567e89b12d3a456426614174000",
      isDevelopment: true,
      supabaseUrl: "http://127.0.0.1:54321",
      publicSiteUrl: "http://127.0.0.1:5173",
    });

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321 http: ws:"
    );
    expect(policy).toContain("frame-src 'self' http://127.0.0.1:5173");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("rejects malformed nonces instead of emitting an injectable header", () => {
    expect(() =>
      buildAdminContentSecurityPolicy({ nonce: "'><script>alert(1)</script>" })
    ).toThrow("valid per-request nonce");
    expect(() => createAdminCspNonce(() => "short")).toThrow(
      "generated admin CSP nonce is invalid"
    );
  });
});

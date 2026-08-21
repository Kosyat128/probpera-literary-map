import { describe, expect, it } from "vitest";

import {
  diagnosticPath,
  redactDiagnosticText,
  sanitizeDiagnosticContext,
} from "./diagnosticsReporter";

describe("client diagnostic privacy", () => {
  it("drops query strings and keeps only simple in-page hashes", () => {
    expect(
      diagnosticPath({
        pathname: "/auth/callback",
        hash: "#access_token=private-token",
      } as Pick<Location, "pathname" | "hash">)
    ).toBe("/auth/callback");
    expect(
      diagnosticPath({
        pathname: "/",
        hash: "#atlas",
      } as Pick<Location, "pathname" | "hash">)
    ).toBe("/#atlas");
    expect(
      diagnosticPath({
        pathname: "/stati/",
        hash: "#section-2",
      } as Pick<Location, "pathname" | "hash">)
    ).toBe("/stati/#section-2");
  });

  it("redacts credentials, callback values, JWTs, secret keys, and email addresses", () => {
    const source = [
      "https://probpera.ru/auth/callback?code=oauth-code&email=reader@example.com",
      "Authorization: Bearer bearer-secret",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature123",
      "sb_secret_server-only-value",
    ].join(" ");
    const redacted = redactDiagnosticText(source);

    expect(redacted).toContain("code=[redacted]");
    expect(redacted).toContain("email=[redacted]");
    expect(redacted).toContain("Bearer [redacted]");
    expect(redacted).toContain("[redacted-jwt]");
    expect(redacted).toContain("[redacted-key]");
    expect(redacted).not.toContain("oauth-code");
    expect(redacted).not.toContain("reader@example.com");
    expect(redacted).not.toContain("bearer-secret");
    expect(redacted).not.toContain("server-only-value");
  });

  it("redacts sensitive context keys and safely bounds recursive data", () => {
    const circular: Record<string, unknown> = { label: "safe" };
    circular.self = circular;
    const sanitized = sanitizeDiagnosticContext({
      token: "private-token",
      authorization: "Bearer private-bearer",
      email: "reader@example.com",
      nested: {
        note: "Contact reader@example.com",
        values: Array.from({ length: 30 }, (_, index) => index),
      },
      circular,
    }) as Record<string, unknown>;

    expect(sanitized.token).toBe("[redacted]");
    expect(sanitized.authorization).toBe("[redacted]");
    expect(sanitized.email).toBe("[redacted]");
    expect(sanitized.nested).toMatchObject({
      note: "Contact [redacted-email]",
    });
    expect(
      (sanitized.nested as { values: unknown[] }).values
    ).toHaveLength(20);
    expect(sanitized.circular).toMatchObject({ self: "[circular]" });
  });

  it("truncates diagnostic text to the requested bound", () => {
    expect(redactDiagnosticText("x".repeat(150), 100)).toHaveLength(100);
  });
});

import { describe, expect, it } from "vitest";
import { trustedAdminOutboundUrl } from "./trusted-server-url";

describe("admin outbound URL boundary", () => {
  it.each([
    "https://api.github.com/repos/owner/repository",
    "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/id",
    "https://probpera.ru/articles/index.json",
  ])("accepts an exact administrative host: %s", (value) => {
    expect(trustedAdminOutboundUrl(value, "test")).toBeInstanceOf(URL);
  });

  it.each([
    "http://api.github.com/repos",
    "https://api.github.com.evil.test/repos",
    "https://user:pass@probpera.ru/articles/index.json",
    "https://127.0.0.1/internal",
  ])("rejects an SSRF-shaped admin URL: %s", (value) => {
    expect(() => trustedAdminOutboundUrl(value, "test")).toThrow();
  });
});

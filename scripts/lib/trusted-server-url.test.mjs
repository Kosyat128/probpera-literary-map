import { describe, expect, it } from "vitest";
import {
  trustedHttpsUrl,
  trustedLoopbackOrigin,
  trustedProbperaOrigin,
  trustedSupabaseOrigin,
} from "./trusted-server-url.mjs";

describe("trusted server URL boundary", () => {
  it("accepts only canonical production origins", () => {
    expect(trustedSupabaseOrigin("https://project-1.supabase.co/path")).toBe("https://project-1.supabase.co");
    expect(trustedProbperaOrigin("https://probpera.ru/path")).toBe("https://probpera.ru");
    expect(trustedLoopbackOrigin("http://127.0.0.1:8787/api")).toBe("http://127.0.0.1:8787");
  });

  it.each([
    "http://project.supabase.co",
    "https://project.supabase.co.evil.test",
    "https://user:pass@project.supabase.co",
    "https://127.0.0.1",
  ])("rejects an SSRF-shaped Supabase origin: %s", (value) => {
    expect(() => trustedSupabaseOrigin(value)).toThrow();
  });

  it("requires exact allowlisted hosts", () => {
    expect(trustedHttpsUrl("https://api.github.com/repos", ["api.github.com"]).hostname).toBe("api.github.com");
    expect(() => trustedHttpsUrl("https://api.github.com.evil.test", ["api.github.com"])).toThrow();
  });
});

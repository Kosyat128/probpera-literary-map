import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps", "admin", "app", "layout.tsx"),
  "utf8"
);

describe("admin root layout security contract", () => {
  it("forces request-time rendering for the nonce-based CSP", () => {
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("A nonce-based CSP is generated for every request");
  });

  it("retains the safe storage bootstrap before dashboard children", () => {
    expect(source).toContain(
      'import SafeBrowserStorageBootstrap from "@/components/SafeBrowserStorageBootstrap"'
    );
    expect(source.indexOf("<SafeBrowserStorageBootstrap />")).toBeLessThan(
      source.indexOf("{children}")
    );
  });
});

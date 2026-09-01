import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  forbiddenClientEnvironmentIdentifiers,
  secretClientAssetFindings,
} from "../check-admin-client-secrets.mjs";

const root = path.resolve(process.cwd());

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [absolute] : [];
  });
}

describe("admin client secret boundary", () => {
  it("keeps the browser Supabase client on the publishable-only module", () => {
    const browser = readFileSync(
      path.join(root, "apps/admin/lib/supabase/browser.ts"), "utf8"
    );
    const publicEnv = readFileSync(
      path.join(root, "apps/admin/lib/public-env.ts"), "utf8"
    );
    expect(browser).toContain('from "@/lib/public-env"');
    expect(browser).not.toContain('from "@/lib/env"');
    for (const identifier of forbiddenClientEnvironmentIdentifiers) {
      expect(publicEnv, identifier).not.toContain(identifier);
    }
    for (const filename of sourceFiles(path.join(root, "apps/admin"))) {
      const source = readFileSync(filename, "utf8");
      if (!/^"use client";/u.test(source)) continue;
      expect(source, filename).not.toMatch(/from ["']@\/lib\/env["']/u);
    }
  });

  it("rejects both secret identifiers and configured secret values in static assets", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "admin-static-secret-"));
    mkdirSync(path.join(directory, "chunks"));
    writeFileSync(
      path.join(directory, "chunks", "bad.js"),
      'const key = process.env.OPENAI_API_KEY; const value = "real-secret-value";',
      "utf8"
    );
    const findings = secretClientAssetFindings({
      directory,
      environment: { OPENAI_API_KEY: "real-secret-value" },
    });
    expect(findings.map(({ token }) => token)).toEqual(
      expect.arrayContaining(["OPENAI_API_KEY", "real-secret-value"])
    );
  });

  it("permits publishable identifiers and ignores server bundles by scan scope", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "admin-static-safe-"));
    writeFileSync(
      path.join(directory, "safe.js"),
      'const url = process.env.NEXT_PUBLIC_SUPABASE_URL;',
      "utf8"
    );
    expect(secretClientAssetFindings({ directory, environment: {} })).toEqual([]);
    const packageSource = readFileSync(
      path.join(root, "apps/admin/package.json"), "utf8"
    );
    expect(packageSource.match(/check-admin-client-secrets\.mjs/gu)).toHaveLength(2);
  });
});

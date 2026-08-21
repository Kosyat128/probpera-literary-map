import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const entrypoint = readFileSync(path.join(root, "src/main.tsx"), "utf8");
const boundary = readFileSync(
  path.join(root, "src/components/BootstrapErrorBoundary.tsx"),
  "utf8"
);

describe("public bootstrap error boundary", () => {
  it("wraps language and authentication providers", () => {
    const bootstrapStart = entrypoint.indexOf("<BootstrapErrorBoundary>");
    const languageStart = entrypoint.indexOf("<InterfaceLanguageProvider>");
    const authStart = entrypoint.indexOf("<AuthProvider>");
    const bootstrapEnd = entrypoint.indexOf("</BootstrapErrorBoundary>");

    expect(bootstrapStart).toBeGreaterThan(-1);
    expect(languageStart).toBeGreaterThan(bootstrapStart);
    expect(authStart).toBeGreaterThan(languageStart);
    expect(bootstrapEnd).toBeGreaterThan(authStart);
  });

  it("reports bootstrap failures and offers a usable static exit", () => {
    expect(boundary).toContain('boundary: "bootstrap"');
    expect(boundary).toContain("reportClientError(error, \"react\"");
    expect(boundary).toContain("globalThis.location.reload()");
    expect(boundary).toContain('href="/stati/"');
    expect(boundary).toContain('role="alert"');
  });
});

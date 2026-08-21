import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const proxyPath = path.join(root, "apps/admin/proxy.ts");
const middlewarePath = path.join(root, "apps/admin/middleware.ts");
const source = readFileSync(middlewarePath, "utf8");

describe("Cloudflare-compatible Next.js 16 admin middleware", () => {
  it("keeps the deprecated middleware convention intentionally on the Edge runtime", () => {
    expect(existsSync(middlewarePath)).toBe(true);
    expect(existsSync(proxyPath)).toBe(false);
    expect(source).toContain('export const runtime = "experimental-edge"');
    expect(source).toContain("export async function middleware(request: NextRequest)");
    expect(source).not.toContain("export async function proxy");
  });

  it("preserves routing normalization, authentication refresh, and matcher coverage", () => {
    expect(source).toContain("NextResponse.redirect(normalizedUrl, 308)");
    expect(source).toContain("await supabase.auth.getUser()");
    expect(source).toContain(
      'source: "/((?!_next/static|_next/image|favicon.ico).*)"'
    );
    expect(source).toContain('key: "next-router-prefetch"');
    expect(source).toContain('key: "purpose", value: "prefetch"');
  });

  it("injects a fresh nonce into the request and returns the same CSP", () => {
    expect(source).toContain("const nonce = createAdminCspNonce()");
    expect(source).toContain('headers.set("x-nonce", nonce)');
    expect(source).toContain(
      'headers.set("Content-Security-Policy", contentSecurityPolicy)'
    );
    expect(source).toContain(
      'response.headers.set("Content-Security-Policy", contentSecurityPolicy)'
    );
    expect(source).toContain(
      'response.headers.set("Cache-Control", "private, no-store, max-age=0")'
    );
    expect(source).toContain("response = createNextResponse()");
  });
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const proxyPath = path.join(root, "apps/admin/proxy.ts");
const middlewarePath = path.join(root, "apps/admin/middleware.ts");
const source = readFileSync(proxyPath, "utf8");

describe("Next.js 16 admin proxy convention", () => {
  it("uses proxy.ts and the named proxy export", () => {
    expect(existsSync(proxyPath)).toBe(true);
    expect(existsSync(middlewarePath)).toBe(false);
    expect(source).toContain("export async function proxy(request: NextRequest)");
    expect(source).not.toContain("export async function middleware");
  });

  it("preserves routing normalization, authentication refresh, and matcher coverage", () => {
    expect(source).toContain("return NextResponse.redirect(normalizedUrl, 308)");
    expect(source).toContain("await supabase.auth.getUser()");
    expect(source).toContain(
      'matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]'
    );
  });
});

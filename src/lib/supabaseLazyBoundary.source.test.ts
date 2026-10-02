import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("Supabase lazy boundary", () => {
  it("keeps the SDK outside the initial React entry graph", () => {
    const authContext = readSource("../community/AuthContext.tsx");
    const activityTracker = readSource("../community/ActivityTracker.tsx");
    const articleEngagement = readSource(
      "../community/ArticleEngagement.tsx"
    );
    const diagnosticsReporter = readSource(
      "../community/diagnosticsReporter.ts"
    );
    const loader = readSource("./loadSupabaseClient.ts");

    expect(authContext).not.toContain('from "../lib/supabase"');
    expect(activityTracker).not.toContain('from "../lib/supabase"');
    expect(articleEngagement).not.toContain('from "../lib/supabase"');
    expect(diagnosticsReporter).not.toContain('from "../lib/supabase"');
    expect(loader).toContain('import("./supabase")');
    expect(loader).toContain("clientPromise ??=");
  });

  it("connects the canonical bounded session observer and keeps native reading accountless", () => {
    const authContext = readSource("../community/AuthContext.tsx");
    const observer = readSource("../community/authSession.ts");
    expect(authContext).toContain("observeCanonicalAuthSession({ loadClient: loadSupabaseClient");
    expect(authContext).toContain("return observer.dispose");
    expect(observer).toContain("auth.getUser(token)");
    expect(observer).not.toMatch(/^import\s+(?!type\b).*@supabase\/supabase-js/mu);
    const accountless = authContext.slice(authContext.indexOf("export function AccountlessReaderProvider"));
    expect(accountless).not.toMatch(/loadSupabaseClient|observeCanonicalAuthSession/u);
  });
});

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

  it("always settles authentication loading after session lookup", () => {
    const authContext = readSource("../community/AuthContext.tsx");

    expect(authContext).toContain(
      "const sessionPromise = client.auth.getSession()"
    );
    expect(authContext).toMatch(
      /const \{ data \} = await sessionPromise;[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/u
    );
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const component = readFileSync(
  path.join(root, "src/community/ArticleEngagement.tsx"),
  "utf8"
);
const schema = readFileSync(path.join(root, "supabase/schema.sql"), "utf8");

describe("public comment submission security", () => {
  it("submits comments only through the protected RPC", () => {
    expect(component).toContain('client.rpc("submit_article_comment"');
    expect(component).not.toContain('.from("article_comments").insert');
    expect(component).not.toContain('error?.code === "42883"');
  });

  it("rejects stale engagement reads after selection changes or unmount", () => {
    expect(component).toContain("engagementLoadSequenceRef");
    expect(component).toContain("activeEngagementIdentityRef");
    expect(component).toContain("if (!client || !isCurrentRequest()) return");
    expect(component).toMatch(
      /await Promise\.all\([\s\S]*?if \(!isCurrentRequest\(\)\) return;/u
    );
    expect(component).toContain("engagementLoadSequenceRef.current += 1");
  });

  it("keeps the server-side validation and rate limit in the schema", () => {
    expect(schema).toContain(
      "create or replace function public.submit_article_comment("
    );
    expect(schema).toContain("security definer set search_path = ''");
    expect(schema).toContain("if recent_comments >= 4 then");
    expect(schema).toContain("if link_count > 3 then");
    expect(schema).toContain(
      "grant execute on function public.submit_article_comment"
    );
  });
});

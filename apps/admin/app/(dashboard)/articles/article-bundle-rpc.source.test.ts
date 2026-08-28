import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/article-bundle-rpc.ts"
  ),
  "utf8"
);

describe("article bundle RPC client", () => {
  it("calls only the canonical transactional article RPC", () => {
    expect(source).toContain('supabase.rpc("save_article_bundle"');
    expect(source).toContain("p_expected_article_updated_at");
    expect(source).toContain("p_expected_english_updated_at");
    expect(source).toContain("p_english_mode");
    expect(source).toContain("p_redirect_source_path");
    expect(source).toContain("p_replace_homepage");
    expect(source).toContain("p_social_publish_requested");
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("fails closed through the canonical RPC without a runtime legacy probe", () => {
    expect(source).not.toContain('supabase.rpc("get_editorial_schema_health")');
    expect(source).not.toContain("isArticleBundleRpcAvailable");
    expect(source).not.toContain("return false");
  });

  it("keeps optimistic-lock failures understandable in the editor", () => {
    expect(source).toContain('message.includes("ARTICLE_CONFLICT")');
    expect(source).toContain('message.includes("ENGLISH_CONFLICT")');
    expect(source).toContain("Статья уже изменена в другой вкладке");
    expect(source).toContain("Английская версия уже изменена в другой вкладке");
  });

  it("requires the RPC to return the canonical saved article identity", () => {
    expect(source).toContain('"article_id" in row');
    expect(source).toContain("article_updated_at");
    expect(source).toContain("homepage_replaced");
  });
});

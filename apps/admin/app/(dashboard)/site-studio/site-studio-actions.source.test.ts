import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokens = readFileSync(
  path.join(root, "apps/admin/app/(dashboard)/site-studio/tokens/actions.ts"),
  "utf8"
);
const releases = readFileSync(
  path.join(root, "apps/admin/app/(dashboard)/site-studio/releases/actions.ts"),
  "utf8"
);

describe("Site Studio action boundaries", () => {
  it("uses owner/admin RPC mutations and stable error codes", () => {
    for (const source of [tokens, releases]) {
      expect(source).toContain('requireStaff(["owner", "admin"])');
      expect(source).toContain("siteStudioRpcErrorCode");
      expect(source).not.toMatch(/error\.message/u);
    }
    expect(tokens).toContain('supabase.rpc("save_site_design_token"');
    expect(tokens).toContain('supabase.rpc("set_site_design_change_set_item"');
    expect(releases).toContain('supabase.rpc("publish_site_design_change_set"');
    expect(releases).toContain('supabase.rpc("rollback_site_design_release"');
  });
});

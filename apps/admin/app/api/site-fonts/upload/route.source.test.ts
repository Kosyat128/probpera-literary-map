import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("site font upload route source contract", () => {
  it("uses staff authentication and the immutable site-fonts storage contract", () => {
    expect(source).toContain('requireStaff(["owner", "admin"])');
    expect(source).toContain("hasForbiddenRemoteFontInput(formData)");
    expect(source.indexOf("file.size > MAX_FONT_UPLOAD_BYTES")).toBeLessThan(
      source.indexOf("file.arrayBuffer()")
    );
    expect(source).toContain("validateFontFile({");
    expect(source).toContain("supabase.storage.from(SITE_FONT_BUCKET)");
    expect(source).toContain("upsert: false");
    expect(source).toContain('.from("font_assets")');
    expect(source).toContain('source_type: "uploaded"');
    expect(source).toContain("storage_bucket: SITE_FONT_BUCKET");
    expect(source).toContain("font_style: metadata.style");
    expect(source).toContain("uploaded_by: session.user.id");
  });

  it("does not delete a pre-existing content hash after a database conflict", () => {
    const insertFailure = source.indexOf("if (insertError)");
    const conflict = source.indexOf("isDatabaseUniqueConflict(insertError)", insertFailure);

    expect(insertFailure).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(insertFailure);
    expect(source).not.toContain("storage.remove(");
    expect(source).not.toMatch(/fetch\s*\(\s*(?:font|remote|import)/u);
  });
});

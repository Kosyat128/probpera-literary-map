import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actions = ["./actions.ts", "./article-actions.ts", "./country-actions.ts"]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");
const schemas = [
  "../../../lib/auto-translate-article-premium.ts",
  "../../../lib/auto-translate-literary-work.ts",
  "../../../lib/auto-translate-writer-biography.ts",
  "../../../lib/auto-translate-country-profile.ts",
  "../../../lib/auto-translate-site-copy.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const generators = [
  "../../../lib/auto-translate-published-article-premium.ts",
  "../../../lib/auto-translate-literary-work.ts",
  "../../../lib/auto-translate-writer-biography.ts",
  "../../../lib/auto-translate-country-profile.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const siteCopyAction = readFileSync(
  new URL("../site-copy/actions.ts", import.meta.url),
  "utf8"
);
const selfTestAction = readFileSync(new URL("./self-test-action.ts", import.meta.url), "utf8");
const resumeAction = readFileSync(new URL("./resume-action.ts", import.meta.url), "utf8");

describe("translation operations admin boundary", () => {
  it("posts the exact per-domain cursor names consumed by the actions", () => {
    expect(page).toContain('name="articleCursor"');
    expect(page).toContain('name="libraryCursor"');
    expect(page).toContain('name="writerCursor"');
    expect(page).toContain('name="countryCursor"');
    expect(page).not.toContain('name="backfill_cursor"');
  });

  it("uses actual provider readiness and allow-listed error codes", () => {
    expect(page).toContain("premiumTranslationRuntimeReadiness()");
    expect(page).toContain("translationErrorMessage(query.errorCode)");
    expect(actions).not.toMatch(/error:\s*[^\n]*\.error\.message/u);
    expect(actions).not.toContain("batchFailureMessage");
    for (const generator of generators) {
      expect(generator).toContain("premiumTranslationRuntimeGate(input.supabase)");
      expect(generator).not.toContain("adminEnv.premiumTranslationConfigured");
    }
    expect(siteCopyAction).toContain("premiumTranslationRuntimeGate(supabase)");
    expect(siteCopyAction).not.toMatch(/error\.message|error\?\.message/u);
  });

  it("reports the durable queue honestly without claiming a runner", () => {
    expect(page).toContain('supabase.rpc("translation_operations_ready")');
    expect(page).toContain("staff-runner");
    expect(page).toContain("Service-role lease API");
    expect(page).toContain("resumeTranslationJobAction");
    expect(resumeAction).toContain('supabase.rpc("get_translation_job_resume"');
  });

  it("runs a real persisted provider self-test behind a cooldown", () => {
    for (const label of [
      "CONFIGURED",
      "BINDING FOUND",
      "TEST PASSED",
      "LAST TEST",
      "LAST ERROR",
    ]) expect(page).toContain(label);
    expect(selfTestAction).toContain("premiumTranslationSelfTest()");
    expect(selfTestAction).toContain("begin_translation_provider_self_test");
    expect(selfTestAction).toContain("finish_translation_provider_self_test");
    expect(selfTestAction).not.toMatch(/\.message|error=/u);
  });

  it("constrains provider JSON schemas to the editorial string bounds", () => {
    const [article, work, biography, country, siteCopy] = schemas;
    expect(article).toContain('minLength: 80, maxLength: 700');
    expect(article).toContain('minLength: 20, maxLength: 2_000_000');
    expect(work).toContain('minLength: 140, maxLength: 900');
    expect(biography).toContain('minLength: 120, maxLength: 1_600');
    expect(country).toContain('minLength: 1, maxLength: 160');
    expect(siteCopy).toContain('minLength: 1, maxLength: 4_000');
  });
});

import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (url: URL) =>
  readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");

const facade = read(new URL("./actions.ts", import.meta.url));
const listPage = read(new URL("./page.tsx", import.meta.url));
const detailPage = read(new URL("./[id]/page.tsx", import.meta.url));
const articleCopyPicker = read(
  new URL("../../../components/ArticleCopyPicker.tsx", import.meta.url)
);
const atomicStandardSave = read(
  new URL("./atomic-standard-save-action.ts", import.meta.url)
);
const legacySaveUrl = new URL("./actions-legacy.ts", import.meta.url);
const atomicAutoPublishUrl = new URL(
  "./atomic-auto-publish-action.ts",
  import.meta.url
);

describe("article actions facade", () => {
  it("exports each public action from its owning module without a wildcard", () => {
    expect(facade).not.toContain("export *");
    for (const action of [
      "changeArticleStatusAction",
      "duplicateArticleAction",
      "restoreArticleRevisionAction",
      "softDeleteArticleAction",
      "importLegacyArticlesAction",
      "saveArticleAction",
      "requestSocialPublicationAction",
    ]) {
      expect(facade).toContain(action);
    }
    expect(facade).toContain('from "./article-management-actions"');
    expect(facade).toContain('from "./legacy-import-action"');
    expect(facade).toContain('from "./save-article-action"');
    expect(facade).toContain('from "./social-publication-action"');
  });

  it("keeps existing list, detail and copy-picker imports on the public facade", () => {
    expect(listPage).toContain('from "./actions"');
    expect(detailPage).toContain('from "../actions"');
    expect(articleCopyPicker).toContain(
      'from "@/app/(dashboard)/articles/actions"'
    );
  });

  it("removes the reconciled compatibility actions and keeps one atomic save", () => {
    expect(existsSync(legacySaveUrl)).toBe(false);
    expect(existsSync(atomicAutoPublishUrl)).toBe(false);
    expect(atomicStandardSave).toContain("saveArticleBundleRpc(supabase");
    expect(atomicStandardSave).not.toContain("legacySaveArticleAction");
    expect(atomicStandardSave).not.toContain("isArticleBundleRpcAvailable");
  });
});

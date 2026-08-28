import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (url: URL) =>
  readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");

const facade = read(new URL("./actions.ts", import.meta.url));
const legacySave = read(new URL("./actions-legacy.ts", import.meta.url));
const listPage = read(new URL("./page.tsx", import.meta.url));
const detailPage = read(new URL("./[id]/page.tsx", import.meta.url));
const articleCopyPicker = read(
  new URL("../../../components/ArticleCopyPicker.tsx", import.meta.url)
);
const atomicStandardSave = read(
  new URL("./atomic-standard-save-action.ts", import.meta.url)
);
const atomicAutoPublish = read(
  new URL("./atomic-auto-publish-action.ts", import.meta.url)
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

  it("keeps only the production-guarded save fallback in the legacy module", () => {
    expect(legacySave).toContain(
      "export async function saveArticleAction(formData: FormData)"
    );
    for (const movedAction of [
      "importLegacyArticlesAction",
      "requestSocialPublicationAction",
      "duplicateArticleAction",
      "changeArticleStatusAction",
      "softDeleteArticleAction",
      "restoreArticleRevisionAction",
    ]) {
      expect(legacySave).not.toContain(`function ${movedAction}`);
    }
    for (const guardedSave of [atomicStandardSave, atomicAutoPublish]) {
      expect(guardedSave).toContain(
        'saveArticleAction as legacySaveArticleAction } from "./actions-legacy"'
      );
    }
  });
});

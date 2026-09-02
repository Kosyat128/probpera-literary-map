import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (url: URL) =>
  readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");

const action = read(new URL("./atomic-standard-save-action.ts", import.meta.url));
const wrapper = read(new URL("./save-article-action.ts", import.meta.url));
const editPage = read(new URL("./[id]/page.tsx", import.meta.url));
const previewPage = read(new URL("./[id]/preview/page.tsx", import.meta.url));
const newPage = read(new URL("./new/page.tsx", import.meta.url));
const actions = read(new URL("./actions.ts", import.meta.url));

describe("published article working-draft flow", () => {
  it("keeps ordinary save of a published article away from live persistence and build", () => {
    const start = action.indexOf("if (saveToPublishedWorkingDraft) {");
    const end = action.indexOf("const redirectSourcePath", start);
    const branch = action.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(branch).toContain("saveArticleWorkingDraftRpc(supabase");
    expect(action).toContain('formData.get("working_draft_version")');
    expect(branch).toContain("expectedVersion: expectedWorkingDraftVersion");
    expect(branch).not.toContain("saveArticleBundleRpc");
    expect(branch).not.toContain("requestPublicBuild");
    expect(action).toContain(
      'submittedStatus === "review"\n        ? "review"\n        : "draft"'
    );
  });

  it("persists a blocked release as a CAS working draft instead of relying on local storage", () => {
    expect(action).toContain(
      'publicationSavePolicy?.kind === "preserve-published"'
    );
    expect(action).toContain(
      "isPublishedWorkingDraftSave || publicationWasBlockedForPublished"
    );
    expect(action).toContain("saveArticleWorkingDraftRpc(supabase");
    expect(action).toContain("error: publicationBlockMessage");
    expect(action).not.toContain("Новые правки находятся в локальной автокопии");
  });

  it("enforces publication RBAC and an explicit schedule date", () => {
    expect(action).toContain('session.role === "editor"');
    expect(action).toContain('["draft", "review"].includes(parsed.data.status)');
    expect(action).toContain('session.role !== "owner"');
    expect(action).toContain("Для запланированной публикации укажите дату и время.");
    expect(action).not.toContain(
      'requestedStatus === "scheduled" && !scheduledAt ? "draft"'
    );
    expect(wrapper.indexOf("await requireStaff()"))
      .toBeLessThan(wrapper.indexOf("translateArticleSourceToEnglish({"));
    expect(wrapper).toContain('intent === "publish" && session.role === "editor"');
    expect(wrapper).toContain(
      'const releaseNeedsTranslation = !["hidden", "archived"].includes('
    );
    expect(wrapper.indexOf('releaseStatus === "scheduled"'))
      .toBeLessThan(wrapper.indexOf("translateArticleSourceToEnglish({"));
    expect(action).toContain(
      '["scheduled", "hidden", "archived"].includes(submittedStatus)'
    );
    expect(action).toContain('reason: `article.status.${savedStatus}`');
  });

  it("promotes every existing privileged release with working-draft CAS", () => {
    expect(action).toContain("promoteArticleWorkingDraftRpc(supabase");
    expect(action).toContain("expectedWorkingDraftVersion");
    expect(action).toContain(
      'articleId && intent === "publish" && isPrivilegedRelease'
    );
  });

  it("saves before an allowlisted internal preview redirect", () => {
    expect(action).toContain('["publish", "preview"].includes(submittedIntent)');
    expect(action).toContain(
      'formData.get("preview_locale") === "en" ? "en" : "ru"'
    );
    expect(action).toContain(
      'redirect(`/articles/${saved.articleId}/preview?locale=${previewLocale}`)'
    );
    expect(action).not.toMatch(/https?:\/\/.*preview\?locale/iu);
  });

  it("preserves exact editor media order on ordinary save", () => {
    expect(action).not.toContain("positionLeadingIllustrationHtml");
    expect(action).not.toContain("positionLeadingIllustrationJson");
    expect(action).toContain("const contentJson = submittedContentJson");
  });

  it("loads the private overlay in edit and preview and passes role capabilities", () => {
    for (const source of [editPage, previewPage]) {
      expect(source).toContain('.from("article_working_drafts")');
      expect(source).toContain("parseArticleWorkingDraft");
    }
    expect(editPage).toContain("articleWithWorkingDraft");
    expect(editPage).toContain('canPublish={staff.role === "owner" || staff.role === "admin"}');
    expect(editPage).toContain(
      'canOverridePublicationChecklist={staff.role === "owner"}'
    );
    expect(newPage).toContain('canPublish={staff.role === "owner" || staff.role === "admin"}');
    expect(previewPage).toContain(
      "Сохранённый рабочий черновик · публичная версия не изменена"
    );
    expect(actions).toContain("discardArticleWorkingDraftAction");
    expect(editPage).toContain("Отменить правки");
  });

  it("does not return translation provider details through the query string", () => {
    expect(wrapper).toContain("Automatic article translation failed before publication");
    expect(wrapper).not.toContain("${detail}");
  });
});

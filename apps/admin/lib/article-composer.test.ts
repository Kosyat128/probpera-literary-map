import { describe, expect, it } from "vitest";
import {
  buildArticleMetadataDraft,
  completeArticleMetadataDraft,
  createArticleMetadataAutomationState,
  markArticleMetadataFieldManual,
  synchronizeArticleMetadataDraft,
  type ArticleMetadataDraft,
} from "./article-composer";

function emptyMetadata(): ArticleMetadataDraft {
  return {
    excerpt: "",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    ogTitle: "",
    ogDescription: "",
  };
}

function generatedMetadata() {
  return buildArticleMetadataDraft({
    title: "Автоматический заголовок",
    contentHtml: "<p>Автоматическое описание литературного материала.</p>",
    locale: "ru",
  });
}

describe("article metadata composer", () => {
  it("completes empty fields without replacing deliberate editor wording", () => {
    const generated = generatedMetadata();
    const completed = completeArticleMetadataDraft(
      {
        ...emptyMetadata(),
        excerpt: "Ручной анонс",
        seoDescription: "Ручное описание для поиска",
      },
      generated
    );

    expect(completed.excerpt).toBe("Ручной анонс");
    expect(completed.seoDescription).toBe("Ручное описание для поиска");
    expect(completed.seoTitle).toBe(generated.seoTitle);
    expect(completed.seoKeywords).toBe(generated.seoKeywords);
    expect(completed.ogTitle).toBe(generated.ogTitle);
  });

  it("builds bounded Russian metadata from real rich HTML", () => {
    const draft = buildArticleMetadataDraft({
      title: "Роман и память: как литература сохраняет время",
      contentHtml: `<article><p>Большой роман превращает частную память героя в разговор о времени, выборе и ответственности читателя.</p><p>Вторая мысль.</p><script>alert("never")</script></article>`,
      locale: "ru",
    });
    expect(draft.seoTitle).toBe("Роман и память: как литература сохраняет время");
    expect(draft.excerpt).toContain("Большой роман превращает частную память");
    expect(draft.excerpt).not.toContain("alert");
    expect(draft.excerpt.length).toBeLessThanOrEqual(260);
    expect(draft.seoDescription.length).toBeLessThanOrEqual(180);
    expect(draft.seoKeywords).toContain("роман");
  });

  it("decodes common named, decimal and hexadecimal entities", () => {
    const draft = buildArticleMetadataDraft({
      title: "Books &amp; memory",
      subtitle: "Austen&nbsp;&amp;&nbsp;Woolf - two voices &#x2026; one dialogue",
      contentHtml: "",
      locale: "en",
    });
    expect(draft.seoTitle).toBe("Books & memory");
    expect(draft.excerpt).toBe("Austen & Woolf - two voices … one dialogue");
  });

  it("removes editorial placeholders without discarding useful prose", () => {
    const draft = buildArticleMetadataDraft({
      title: "Читательский маршрут",
      contentHtml: "<p>Замените этот текст описанием статьи.</p><p>Книга помогает увидеть привычный город иначе.</p>",
      locale: "ru",
    });
    expect(draft.excerpt).toBe("Книга помогает увидеть привычный город иначе.");
    expect(draft.excerpt).not.toMatch(/замените/iu);
  });

  it("returns stable RU and EN fallbacks for empty input", () => {
    expect(buildArticleMetadataDraft({ title: "", contentHtml: "", locale: "ru" })).toEqual({
      excerpt: "",
      seoTitle: "Литературная статья",
      seoDescription: "",
      seoKeywords: "",
      ogTitle: "Литературная статья",
      ogDescription: "",
    });
    expect(buildArticleMetadataDraft({ title: "", contentHtml: "", locale: "en" }).seoTitle).toBe("Literary article");
  });

  it("combines a short subtitle with prose and derives stable keywords", () => {
    const draft = buildArticleMetadataDraft({
      title: "Архивная память города",
      subtitle: "Новые документы",
      contentHtml:
        "<p>Архивная коллекция возвращает забытые литературные маршруты и биографии.</p>",
      locale: "ru",
    });
    expect(draft.seoDescription).toContain("Новые документы. Архивная коллекция");
    expect(draft.seoKeywords.split(", ")).toEqual(
      expect.arrayContaining(["архивная", "память", "города"])
    );
  });

  it("joins punctuation without producing broken subtitle sequences", () => {
    expect(
      buildArticleMetadataDraft({
        title: "Контекст",
        subtitle: "Главный вопрос:",
        contentHtml: "<p>Почему книги сохраняют память?</p>",
        locale: "ru",
      }).excerpt
    ).toBe("Главный вопрос: Почему книги сохраняют память?");
    expect(
      buildArticleMetadataDraft({
        title: "Контекст",
        subtitle: "Главный вопрос,",
        contentHtml: "<p>который задаёт автор.</p>",
        locale: "ru",
      }).excerpt
    ).toBe("Главный вопрос. который задаёт автор.");
  });

  it("updates only automatically managed metadata fields", () => {
    const initial = emptyMetadata();
    initial.seoTitle = "Ручной SEO-заголовок";
    let state = createArticleMetadataAutomationState(initial);
    const firstGenerated = buildArticleMetadataDraft({
      title: "Первый заголовок",
      contentHtml: "<p>Первое описание материала.</p>",
      locale: "ru",
    });
    const first = synchronizeArticleMetadataDraft(
      initial,
      firstGenerated,
      state
    );
    state = first.state;

    expect(first.draft.excerpt).toBe("Первое описание материала.");
    expect(first.draft.seoTitle).toBe("Ручной SEO-заголовок");

    const manuallyEdited = {
      ...first.draft,
      excerpt: "Ручное описание карточки",
    };
    const secondGenerated = buildArticleMetadataDraft({
      title: "Второй заголовок",
      contentHtml: "<p>Второе описание материала.</p>",
      locale: "ru",
    });
    const second = synchronizeArticleMetadataDraft(
      manuallyEdited,
      secondGenerated,
      state
    );

    expect(second.draft.excerpt).toBe("Ручное описание карточки");
    expect(second.draft.ogDescription).toBe("Второе описание материала.");
    expect(second.state.managed.excerpt).toBe(false);
  });

  it("never treats a populated persisted value as generated by coincidence", () => {
    const generated = buildArticleMetadataDraft({
      title: "Одинаковый заголовок",
      contentHtml: "<p>Описание.</p>",
      locale: "ru",
    });
    const persisted = { ...emptyMetadata(), seoTitle: generated.seoTitle };
    const state = createArticleMetadataAutomationState(persisted);
    const next = buildArticleMetadataDraft({
      title: "Новый заголовок",
      contentHtml: "<p>Новое описание.</p>",
      locale: "ru",
    });

    expect(
      synchronizeArticleMetadataDraft(persisted, next, state).draft.seoTitle
    ).toBe("Одинаковый заголовок");
  });

  it("keeps an explicitly cleared automatic field manual", () => {
    const generated = buildArticleMetadataDraft({
      title: "Заголовок",
      contentHtml: "<p>Описание.</p>",
      locale: "ru",
    });
    const managed = createArticleMetadataAutomationState(generated, true);
    const state = markArticleMetadataFieldManual(managed, "excerpt");
    const next = buildArticleMetadataDraft({
      title: "Новый заголовок",
      contentHtml: "<p>Новое описание.</p>",
      locale: "ru",
    });

    expect(
      synchronizeArticleMetadataDraft(
        { ...generated, excerpt: "" },
        next,
        state
      ).draft.excerpt
    ).toBe("");
  });

  it("truncates at a word boundary within every metadata limit", () => {
    const draft = buildArticleMetadataDraft({
      title: "Очень ".repeat(50),
      contentHtml: `<p>${"meaningful phrase ".repeat(40)}</p>`,
      locale: "en",
    });
    expect(draft.seoTitle.length).toBeLessThanOrEqual(180);
    expect(draft.ogTitle.length).toBeLessThanOrEqual(180);
    expect(draft.seoDescription.length).toBeLessThanOrEqual(180);
    expect(draft.excerpt.length).toBeLessThanOrEqual(260);
    expect(draft.excerpt).toMatch(/…$/u);
  });
});

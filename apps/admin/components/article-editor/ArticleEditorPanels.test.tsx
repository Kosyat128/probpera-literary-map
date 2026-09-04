import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import CoverEditor from "./CoverEditor";
import PublishPanel from "./PublishPanel";
import SeoPanel from "./SeoPanel";
import SourceBibliographyEditor from "./SourceBibliographyEditor";
import ValidationChecklist from "./ValidationChecklist";

const noop = vi.fn();

describe("article editor panels", () => {
  it("renders the established save field contracts", () => {
    const cover = renderToStaticMarkup(
      <CoverEditor
        locale="ru"
        fileInputRef={createRef<HTMLInputElement>()}
        coverUrl="https://cdn.example/cover.webp"
        coverAlt="Описание обложки"
        isUploading={false}
        uploadDisabled={false}
        onOpenPicker={noop}
        onUploadFile={noop}
        onCoverUrlChange={noop}
        onCoverAltChange={noop}
        markRussianSourceChanged={noop}
        markDirty={noop}
      />
    );
    const seo = renderToStaticMarkup(
      <SeoPanel
        locale="ru"
        title="Заголовок"
        slug="zagolovok"
        slugEdited={false}
        generatedCanonical="https://probapera.org/read/articles/zagolovok"
        legacyPath="/read/page-article/legacy/1"
        seoTitle="SEO"
        seoDescription="Описание"
        seoKeywords="слово"
        canonicalUrl="https://probapera.org/read/articles/zagolovok"
        ogTitle="OG"
        ogDescription="OG описание"
        allowIndexing
        onSlugChange={noop}
        onSlugEditedChange={noop}
        onCanonicalEditedChange={noop}
        onLegacyPathChange={noop}
        onSeoTitleChange={noop}
        onSeoDescriptionChange={noop}
        onSeoKeywordsChange={noop}
        onOgTitleChange={noop}
        onOgDescriptionChange={noop}
        onAllowIndexingChange={noop}
        markRussianSourceChanged={noop}
        markDirty={noop}
      />
    );
    const checklist = renderToStaticMarkup(
      <ValidationChecklist
        englishEnabled={false}
        checks={[{ label: "Готово", ok: true }]}
        ready
      />
    );

    expect(cover).toContain('name="cover_external_url"');
    expect(seo).toContain('name="legacy_path"');
    expect(seo).toContain('value="/read/page-article/legacy/1"');
    expect(seo).toContain('name="allow_indexing"');
    expect(seo).toContain("checked");
    expect(checklist).toContain('name="publication_ready"');
    expect(checklist).toContain('value="yes"');
  });

  it("renders Russian and English panel variants without editor dependencies", () => {
    const publication = renderToStaticMarkup(
      <PublishPanel
        locale="en"
        status="draft"
        onStatusChange={noop}
        scheduledAt=""
        onScheduledAtChange={noop}
        featured={false}
        onFeaturedChange={noop}
        showOnHomepage={false}
        onShowOnHomepageChange={noop}
        pinned={false}
        onPinnedChange={noop}
        englishEnabled
        onEnglishEnabledChange={noop}
        englishStatus="approved"
        onEnglishStatusChange={noop}
        englishConfirmedCurrentSource
        onEnglishConfirmedCurrentSourceChange={noop}
        englishApprovedAt="2026-08-28T12:00:00Z"
        canPublish
        canOverridePublicationChecklist={false}
      />
    );
    const sources = renderToStaticMarkup(
      <SourceBibliographyEditor
        locale="ru"
        sourceText="Источник"
        bibliographyText="Книга"
        onSourceTextChange={noop}
        onBibliographyTextChange={noop}
        markRussianSourceChanged={noop}
        markDirty={noop}
      />
    );

    expect(publication).toContain("Публикация перевода");
    expect(publication).toContain("Готов к проверке");
    expect(publication).not.toContain("English publication");
    expect(sources).toContain("Источники и библиография");
  });

  it("keeps scheduling explicit and publication capability-bound", () => {
    const scheduled = renderToStaticMarkup(
      <PublishPanel
        locale="ru"
        status="scheduled"
        onStatusChange={noop}
        scheduledAt=""
        onScheduledAtChange={noop}
        featured={false}
        onFeaturedChange={noop}
        showOnHomepage={false}
        onShowOnHomepageChange={noop}
        pinned={false}
        onPinnedChange={noop}
        englishEnabled={false}
        onEnglishEnabledChange={noop}
        englishStatus="draft"
        onEnglishStatusChange={noop}
        englishConfirmedCurrentSource={false}
        onEnglishConfirmedCurrentSourceChange={noop}
        canPublish
        canOverridePublicationChecklist
      />
    );
    const editorOnly = renderToStaticMarkup(
      <PublishPanel
        locale="ru"
        status="draft"
        onStatusChange={noop}
        scheduledAt=""
        onScheduledAtChange={noop}
        featured={false}
        onFeaturedChange={noop}
        showOnHomepage={false}
        onShowOnHomepageChange={noop}
        pinned={false}
        onPinnedChange={noop}
        englishEnabled={false}
        onEnglishEnabledChange={noop}
        englishStatus="draft"
        onEnglishStatusChange={noop}
        englishConfirmedCurrentSource={false}
        onEnglishConfirmedCurrentSourceChange={noop}
        canPublish={false}
        canOverridePublicationChecklist={false}
      />
    );

    expect(scheduled).toContain('type="datetime-local"');
    expect(scheduled).not.toMatch(/\srequired(?:=|\s|>)/u);
    expect(scheduled).toContain("Укажите дату и время");
    expect(scheduled).toContain("Публикация на русском доступна без английского перевода");
    expect(scheduled).toContain("Работать также с английской версией");
    expect(scheduled).toContain("ручное подтверждение редакционного чек-листа");
    expect(editorOnly).not.toContain('value="published"');
    expect(editorOnly).toContain("Выпуск выполнит администратор");
  });
});


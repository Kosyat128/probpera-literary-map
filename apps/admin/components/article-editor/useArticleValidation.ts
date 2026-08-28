import { useMemo } from "react";

import type { ArticleTranslationStatus, ArticleValidationCheck } from "./ArticleEditorTypes";

export type ArticleValidationInput = {
  title: string;
  slug: string;
  categoryId: string;
  contentHtml: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  seoDescription: string;
  sourceText: string;
  englishEnabled: boolean;
  englishStatus: ArticleTranslationStatus;
  englishTitle: string;
  englishSlug: string;
  englishContentHtml: string;
  englishExcerpt: string;
  englishCoverAlt: string;
  englishSeoDescription: string;
  englishSourceText: string;
  englishConfirmedCurrentSource: boolean;
  englishSourceContentHash?: string | null;
  russianSourceChanged: boolean;
};

export type ArticleValidationResult = {
  checks: ArticleValidationCheck[];
  ready: boolean;
  russianWordCount: number;
  englishWordCount: number;
};

export function countArticleHtmlWords(html: string) {
  const text = html
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return text ? text.split(/\s+/u).length : 0;
}

export function buildArticleValidation(
  input: ArticleValidationInput
): ArticleValidationResult {
  const russianWordCount = countArticleHtmlWords(input.contentHtml);
  const englishWordCount = countArticleHtmlWords(input.englishContentHtml);
  const russianChecks: ArticleValidationCheck[] = [
    {
      label: "Заголовок и постоянный адрес",
      ok: input.title.trim().length >= 3 && input.slug.length >= 2,
    },
    { label: "Рубрика выбрана", ok: Boolean(input.categoryId) },
    { label: "Не менее 250 слов", ok: russianWordCount >= 250 },
    {
      label: "Есть смысловые подзаголовки H2",
      ok: /<h2(?:\s|>)/iu.test(input.contentHtml),
    },
    {
      label: "Описание карточки - от 80 знаков",
      ok: input.excerpt.trim().length >= 80,
    },
    {
      label: "Обложка и её описание",
      ok:
        /^https:\/\//iu.test(input.coverUrl) &&
        input.coverAlt.trim().length >= 10,
    },
    {
      label: "SEO-описание - от 80 знаков",
      ok: input.seoDescription.trim().length >= 80,
    },
    {
      label: "Указан хотя бы один источник",
      ok: input.sourceText
        .split(/\r?\n/u)
        .some((item) => item.trim().length >= 5),
    },
    {
      label: "Все места для изображений заменены",
      ok: !/data-editorial-block=["']media["']/iu.test(input.contentHtml),
    },
  ];

  const checks = input.englishEnabled
    ? [
        ...russianChecks,
        {
          label: "English: статус approved/published",
          ok:
            input.englishStatus === "approved" ||
            input.englishStatus === "published",
        },
        {
          label: "English: заголовок и адрес",
          ok:
            input.englishTitle.trim().length >= 3 &&
            input.englishSlug.length >= 2,
        },
        {
          label: "English: не менее 250 слов",
          ok: englishWordCount >= 250,
        },
        {
          label: "English: есть подзаголовки H2",
          ok: /<h2(?:\s|>)/iu.test(input.englishContentHtml),
        },
        {
          label: "English: описание карточки - от 80 знаков",
          ok: input.englishExcerpt.trim().length >= 80,
        },
        {
          label: "English: alt обложки",
          ok: input.englishCoverAlt.trim().length >= 10,
        },
        {
          label: "English: SEO-описание - от 80 знаков",
          ok: input.englishSeoDescription.trim().length >= 80,
        },
        {
          label: "English: указан источник",
          ok: input.englishSourceText
            .split(/\r?\n/u)
            .some((item) => item.trim().length >= 5),
        },
        {
          label: "English: перевод сверен с текущим оригиналом",
          ok:
            input.englishConfirmedCurrentSource ||
            (!input.russianSourceChanged &&
              Boolean(input.englishSourceContentHash)),
        },
      ]
    : russianChecks;

  return {
    checks,
    ready: checks.every((item) => item.ok),
    russianWordCount,
    englishWordCount,
  };
}

export function useArticleValidation(input: ArticleValidationInput) {
  return useMemo(
    () => buildArticleValidation(input),
    [
      input.categoryId,
      input.contentHtml,
      input.coverAlt,
      input.coverUrl,
      input.englishConfirmedCurrentSource,
      input.englishContentHtml,
      input.englishCoverAlt,
      input.englishEnabled,
      input.englishExcerpt,
      input.englishSeoDescription,
      input.englishSlug,
      input.englishSourceContentHash,
      input.englishSourceText,
      input.englishStatus,
      input.englishTitle,
      input.excerpt,
      input.russianSourceChanged,
      input.seoDescription,
      input.slug,
      input.sourceText,
      input.title,
    ]
  );
}


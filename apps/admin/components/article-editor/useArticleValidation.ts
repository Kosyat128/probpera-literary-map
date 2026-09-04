import { useMemo } from "react";

import { articleComposerPlainText } from "../../lib/article-composer";
import { editorialMediaAccessibilityIssues } from "../../lib/editorial-media-content";

import type { ArticleTranslationStatus, ArticleValidationCheck } from "./ArticleEditorTypes";

export type ArticleValidationInput = {
  title: string;
  slug: string;
  categoryId: string;
  contentHtml: string;
  contentJson: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  seoDescription: string;
  sourceText: string;
  status: string;
  scheduledAt: string;
  englishEnabled: boolean;
  englishStatus: ArticleTranslationStatus;
  englishTitle: string;
  englishSubtitle: string;
  englishSlug: string;
  englishContentHtml: string;
  englishContentJson: string;
  englishExcerpt: string;
  englishCoverAlt: string;
  englishSeoTitle: string;
  englishSeoDescription: string;
  englishSeoKeywords: string;
  englishOgTitle: string;
  englishOgDescription: string;
  englishSourceText: string;
  englishBibliographyText: string;
  englishConfirmedCurrentSource: boolean;
  englishSourceContentHash?: string | null;
  russianSourceChanged: boolean;
};

export type ArticleValidationResult = {
  checks: ArticleValidationCheck[];
  russianChecks: ArticleValidationCheck[];
  ready: boolean;
  russianReady: boolean;
  russianWordCount: number;
  englishWordCount: number;
};

export function countArticleHtmlWords(html: string) {
  return (
    articleComposerPlainText(html).match(
      /\p{L}[\p{L}\p{M}'’ʼ-]*|\p{N}+/gu
    ) || []
  ).length;
}

function accessibleEditorialMedia(serialized: string) {
  try {
    return editorialMediaAccessibilityIssues(JSON.parse(serialized)).length === 0;
  } catch {
    return false;
  }
}

export function buildArticleValidation(
  input: ArticleValidationInput
): ArticleValidationResult {
  const russianWordCount = countArticleHtmlWords(input.contentHtml);
  const englishWordCount = countArticleHtmlWords(input.englishContentHtml);
  const englishEditorialText = [
    input.englishTitle,
    input.englishSubtitle,
    input.englishExcerpt,
    input.englishContentHtml,
    input.englishCoverAlt,
    input.englishSeoTitle,
    input.englishSeoDescription,
    input.englishSeoKeywords,
    input.englishOgTitle,
    input.englishOgDescription,
    input.englishSourceText,
    input.englishBibliographyText,
  ].join(" ");
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
    {
      label: "Все изображения имеют описание",
      ok: accessibleEditorialMedia(input.contentJson),
    },
    {
      label: "Для публикации по расписанию выбраны дата и время",
      ok: input.status !== "scheduled" || Boolean(input.scheduledAt.trim()),
    },
  ];

  const checks = input.englishEnabled
    ? [
        ...russianChecks,
        {
          label: "Английская версия: статус «проверен» или «опубликован»",
          ok:
            input.englishStatus === "approved" ||
            input.englishStatus === "published",
        },
        {
          label: "Английская версия: заголовок и адрес",
          ok:
            input.englishTitle.trim().length >= 3 &&
            input.englishSlug.length >= 2,
        },
        {
          label: "Английская версия: не менее 250 слов",
          ok: englishWordCount >= 250,
        },
        {
          label: "Английская версия: есть подзаголовки H2",
          ok: /<h2(?:\s|>)/iu.test(input.englishContentHtml),
        },
        {
          label: "Английская версия: описание карточки - от 80 знаков",
          ok: input.englishExcerpt.trim().length >= 80,
        },
        {
          label: "Английская версия: описание обложки",
          ok: input.englishCoverAlt.trim().length >= 10,
        },
        {
          label: "Английская версия: SEO-описание - от 80 знаков",
          ok: input.englishSeoDescription.trim().length >= 80,
        },
        {
          label: "Английская версия: указан источник",
          ok: input.englishSourceText
            .split(/\r?\n/u)
            .some((item) => item.trim().length >= 5),
        },
        {
          label: "Английская версия: все изображения имеют описание",
          ok: accessibleEditorialMedia(input.englishContentJson),
        },
        {
          label: "Английская версия: все места для изображений заменены",
          ok: !/data-editorial-block=["']media["']/iu.test(
            input.englishContentHtml
          ),
        },
        {
          label: "Английская версия: текст и метаданные не содержат кириллицу",
          ok: !/\p{Script=Cyrillic}/u.test(englishEditorialText),
        },
        {
          label: "Английская версия: перевод сверен с текущим оригиналом",
          ok:
            input.englishConfirmedCurrentSource ||
            (!input.russianSourceChanged &&
              Boolean(input.englishSourceContentHash)),
        },
      ]
    : russianChecks;

  return {
    checks,
    russianChecks,
    ready: checks.every((item) => item.ok),
    russianReady: russianChecks.every((item) => item.ok),
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
      input.contentJson,
      input.coverAlt,
      input.coverUrl,
      input.englishConfirmedCurrentSource,
      input.englishContentHtml,
      input.englishContentJson,
      input.englishCoverAlt,
      input.englishEnabled,
      input.englishExcerpt,
      input.englishBibliographyText,
      input.englishOgDescription,
      input.englishOgTitle,
      input.englishSeoDescription,
      input.englishSeoKeywords,
      input.englishSeoTitle,
      input.englishSlug,
      input.englishSourceContentHash,
      input.englishSourceText,
      input.englishStatus,
      input.englishSubtitle,
      input.englishTitle,
      input.excerpt,
      input.russianSourceChanged,
      input.scheduledAt,
      input.seoDescription,
      input.slug,
      input.sourceText,
      input.status,
      input.title,
    ]
  );
}


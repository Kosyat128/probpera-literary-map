"use client";

import type { JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import NextLink from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { FormEvent as ReactFormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { createSlug } from "@/lib/slug";
import {
  ARTICLE_METADATA_DRAFT_FIELDS,
  buildArticleMetadataDraft,
  createArticleMetadataAutomationState,
  markArticleMetadataFieldManual,
  synchronizeArticleMetadataDraft,
  type ArticleMetadataAutomationState,
  type ArticleMetadataDraft,
  type ArticleMetadataDraftField,
} from "@/lib/article-composer";
import { checkArticleOperationAction, saveArticleAction } from "@/app/(dashboard)/articles/actions";
import { articleEditPath } from "@/lib/admin-routes";
import { compareArticleSaveRevisions, parseArticleSaveResult, type ArticleSaveContext, type ArticleWorkingDraftReceipt } from "@/lib/article-save-result";
import {
  articlePendingOperationFormData,
  articlePendingOperationReference,
  articlePendingOperationStorageKey,
  createArticlePendingOperation,
  parseArticlePendingOperation,
  parseArticlePendingOperationReference,
  updateArticlePendingOperationSnapshot,
  type ArticlePendingOperation,
  ARTICLE_PENDING_OPERATION_RETENTION_MS,
} from "@/lib/article-pending-operation";
import {
  deleteEditorTemplateAction,
  saveEditorTemplateAction,
} from "@/app/(dashboard)/articles/template-actions";
import {
  articleCanonicalUrl,
  initialEnglishCanonicalState,
} from "@/lib/article-route";
import {
  articleDraftRecoveryKeyPrefix,
  pendingArticleSaveValue,
  PENDING_ARTICLE_SAVE_KEY,
  persistArticleRecoverySnapshot,
  recoveryContentFingerprint,
  resolveArticleDraftRecoverySource,
  safeArticleDraftScope,
} from "@/lib/article-recovery";
import {
  prepareArticleEditorDocumentContent,
  prepareArticleRecoverySnapshot,
  type ArticleRecoverySnapshot,
} from "@/lib/article-recovery-snapshot";
import { uploadEditorImage } from "@/lib/editor-image-upload";
import { formatImagePreparation } from "@/lib/client-image-upload";
import {
  resolveEditorImageCaption,
  resolveEditorImageAltText,
  suggestEditorImageCaption,
  suggestEditorImageAltText,
} from "@/lib/editor-image-naming";
import type { EditorLinkAttributes } from "@/lib/editor-link";
import {
  defaultEditorialGallerySettings,
  mergeEditorialGalleryItems,
  parseEditorialGalleryUrls,
  reorderEditorialGalleryItems,
  type EditorialGalleryItemInput,
  type EditorialGallerySettings,
} from "@/lib/editorial-gallery";
import {
  EditorialBlock,
  insertEditorialGallery,
  insertEditorialSlider,
  replaceSelectedMediaSlot,
} from "@/components/EditorialBlock";
import {
  updateEditorialImageAt,
  type EditorialImageLayout,
} from "@/components/EditorialImage";
import { ArticleTextTone } from "@/components/ArticleTextTone";
import { ArticleTypographyScope } from "@/components/ArticleTypographyScope";
import EditorLinkDialog from "@/components/EditorLinkDialog";
import EditorMediaDialog from "@/components/EditorMediaDialog";
import { useEditorMediaWorkflow } from "@/components/useEditorMediaWorkflow";
import EditorImageDialog, {
  type EditorImageDialogValue,
} from "@/components/rich-editor/EditorImageDialog";
import { createRichEditorExtensions } from "@/components/rich-editor/RichEditorClientExtensions";
import RecoveryController from "@/components/editor/RecoveryController";
import { canUseRecoveryCopy, readRecoveryCopy, recoveryCopyOwnerState,
  withRecoveryCopyOwner } from "@/lib/editor-recovery-owner";
import EditorCore from "@/components/article-editor/EditorCore";
import ArticleEditorShell from "@/components/article-editor/ArticleEditorShell";
import { canPreserveArticleEditorSourceList } from "@/components/article-editor/article-source-preservation";
import TranslationPanel from "@/components/article-editor/TranslationPanel";
import CoverEditor from "@/components/article-editor/CoverEditor";
import GalleryEditor, {
  type GalleryEditorKind,
} from "@/components/article-editor/GalleryEditor";
import PublishPanel from "@/components/article-editor/PublishPanel";
import SeoPanel from "@/components/article-editor/SeoPanel";
import SourceBibliographyEditor from "@/components/article-editor/SourceBibliographyEditor";
import ValidationChecklist from "@/components/article-editor/ValidationChecklist";
import { useArticleValidation } from "@/components/article-editor/useArticleValidation";
import {
  articleEnglishHumanConfirmationKey,
  isPreviouslyHumanConfirmedArticleEnglish,
  matchesArticleEnglishHumanConfirmation,
  type ArticleEnglishHumanConfirmation,
} from "@/lib/article-english-human-confirmation";
import {
  useRegisterArticleEditorWorkspace,
  type ArticleEditorWorkspace,
  type ArticleWorkspaceGuidanceItem,
} from "@/components/ArticleEditorContext";
import {
  articleWorkspaceAnchor,
  articleWorkspaceCheckLocale,
  articleWorkspaceCheckSection,
  articleWorkspaceDocumentMetrics,
  type ArticleWorkspaceSection,
} from "@/lib/article-workspace-utils";

type Category = { id: string; name: string; slug: string };
type ImageUploadTarget = "article" | "cover";
type ImageSelectionContext = {
  selectedImage: boolean;
  attributes: Record<string, unknown>;
  locale?: "ru" | "en";
  expectedSrc?: string;
  insertionPos?: number;
  nodePos?: number;
  mediaSlotPos?: number;
};
type Article = {
  id?: string;
  updated_at?: string;
  working_draft_version?: number;
  working_draft_scope?: "bundle" | "english-only";
  working_draft_updated_at?: string;
  working_draft_english_enabled?: boolean;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  category_id?: string | null;
  status?: string;
  scheduled_at?: string | null;
  cover_external_url?: string | null;
  cover_alt?: string;
  legacy_path?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  featured?: boolean;
  show_on_homepage?: boolean;
  pinned?: boolean;
  sources?: unknown;
  bibliography?: unknown;
  seo_keywords?: string[];
  og_title?: string | null;
  og_description?: string | null;
  allow_indexing?: boolean;
};

export type ArticleTranslation = {
  id?: string;
  updated_at?: string;
  article_id?: string;
  locale?: "en";
  title?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  cover_alt?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[];
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  sources?: unknown;
  bibliography?: unknown;
  status?:
    | "draft"
    | "review"
    | "approved"
    | "published"
    | "stale"
    | "archived";
  source_content_hash?: string | null;
  source_article_updated_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  published_at?: string | null;
};


function mediaSlot(label: string, hint: string) {
  return `<section class="article-design-block is-media" data-editorial-block="media" data-reveal="fade-up"><h3>${label}</h3><p>${hint}</p></section>`;
}

const articleTemplates = [
  {
    label: "Мнение о книге",
    description: "Готовые разделы обзора и 2 места для изображений",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Замените этот текст своим вступлением: почему книга заслуживает внимательного разговора.</p></aside>${mediaSlot("Обложка или главное изображение", "Нажмите на квадрат и выберите файл с компьютера.")}<h2>История создания и публикации</h2><p>Вставьте подготовленный текст раздела.</p><h2>О чём произведение</h2><p>Расскажите о завязке без лишних спойлеров.</p>${mediaSlot("Иллюстрация к сюжету", "Нажмите на квадрат, выберите изображение и добавьте точное описание.")}<h2>Темы, герои и художественный мир</h2><p>Вставьте основной разбор произведения.</p><section class="article-design-block is-accent" data-editorial-block="accent" data-reveal="fade-up"><h3>Ключевая мысль</h3><p>Замените этот текст главным редакционным выводом.</p></section><h2>Заключительное мнение о книге</h2><p>Сформулируйте итоговую оценку.</p><h2>Источники</h2><p>Источники также указываются в отдельном поле справа.</p>`,
  },
  {
    label: "Биография писателя",
    description: "Биографическая структура, хронология и 2 места для изображений",
    html: `<aside class="article-lead"><p><strong>Редакционное введение</strong></p><p>Замените текст: место писателя в литературе и причина обратиться к его судьбе.</p></aside>${mediaSlot("Портрет писателя", "Используйте проверенный портрет с понятным источником и лицензией.")}<h2>Детство и образование</h2><p>Вставьте текст раздела.</p><h2>Начало литературного пути</h2><p>Вставьте текст раздела.</p><section class="article-design-block is-timeline" data-editorial-block="timeline" data-reveal="fade-up"><h3>Хронология</h3><p>Год - важное событие.</p><p>Год - важное событие.</p></section><h2>Главные произведения</h2><p>Вставьте текст раздела.</p>${mediaSlot("Архивное изображение или рукопись", "Замените место изображением и добавьте содержательную подпись в медиатеке.")}<h2>Личная судьба и время</h2><p>Вставьте текст раздела.</p><h2>Наследие</h2><p>Сформулируйте взвешенный редакционный вывод.</p><h2>Источники и библиография</h2><p>Укажите проверяемые источники.</p>`,
  },
  {
    label: "Книга и экранизация",
    description: "Сравнение по готовым заголовкам и 2 места для изображений",
    html: `<aside class="article-lead"><p><strong>Книга и её экранная версия</strong></p><p>Замените текст: что именно сравнивается и почему.</p></aside>${mediaSlot("Обложка литературного первоисточника", "Нажмите на квадрат и выберите файл с компьютера.")}<h2>Литературный первоисточник</h2><p>Вставьте текст о книге.</p>${mediaSlot("Кадр или официальный постер экранизации", "Нажмите на квадрат; добавляйте только изображение с проверенным основанием использования.")}<h2>Экранная версия</h2><p>Вставьте текст об экранизации.</p><h2>Сюжет и композиция</h2><p>Сопоставьте решения книги и фильма.</p><section class="article-design-block is-columns" data-editorial-block="columns" data-reveal="fade-up"><h3>Книга и экран</h3><p>Книга: замените этот текст.</p><p>Экранизация: замените этот текст.</p></section><h2>Герои и актёрские работы</h2><p>Вставьте текст раздела.</p><h2>Что изменилось и что сохранилось</h2><p>Вставьте выводы сравнения.</p><h2>Итог</h2><p>Сформулируйте редакционную оценку.</p>`,
  },
  {
    label: "Большое эссе",
    description: "Свободное эссе с устойчивым ритмом и 2 местами для изображений",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Замените текст главным вопросом и редакционной позицией.</p></aside>${mediaSlot("Главное изображение эссе", "Нажмите на квадрат и выберите файл с компьютера.")}<h2>Контекст</h2><p>Вставьте текст раздела.</p><h2>Основная идея</h2><p>Разверните центральный тезис.</p><h2>Примеры и аргументы</h2><p>Вставьте основную часть эссе.</p><blockquote><p>Замените цитату и обязательно укажите источник.</p></blockquote>${mediaSlot("Вторая иллюстрация", "Нажмите на квадрат; используйте изображение как смысловую паузу, а не как украшение.")}<h2>Вывод</h2><p>Сформулируйте итог.</p><h2>Источники</h2><p>Укажите проверяемые источники.</p>`,
  },
  {
    label: "Интервью",
    description: "Вступление, карточка собеседника и готовый ритм вопросов",
    html: `<aside class="article-lead"><p><strong>О собеседнике</strong></p><p>Коротко представьте героя беседы и объясните, почему этот разговор важен читателю.</p></aside>${mediaSlot("Портрет собеседника", "Добавьте портрет, автора снимка и основание использования.")}<h2>Начало разговора</h2><p><strong>Вопрос.</strong> Сформулируйте первый вопрос.</p><p><em>Ответ.</em> Вставьте ответ без изменения авторского смысла.</p><h2>Книги, работа и идеи</h2><p><strong>Вопрос.</strong> Продолжите разговор.</p><p><em>Ответ.</em> Вставьте ответ.</p><section class="article-design-block is-accent" data-editorial-block="accent" data-reveal="fade-up"><h3>Ключевая мысль беседы</h3><p>Выделите точную цитату, согласованную с собеседником.</p></section><h2>Блиц</h2><p><strong>Вопрос.</strong> Короткий ответ.</p><h2>После разговора</h2><p>Подведите редакционный итог и добавьте необходимые ссылки.</p>`,
  },
  {
    label: "Подборка книг",
    description: "Тематическое введение и повторяемые карточки произведений",
    html: `<aside class="article-lead"><p><strong>Тема подборки</strong></p><p>Объясните принцип отбора и кому пригодится этот список.</p></aside>${mediaSlot("Главная иллюстрация подборки", "Выберите изображение, которое объединяет тему, а не дублирует одну книгу.")}<h2>1. Название первой книги</h2><p>Автор, контекст и причина включения в подборку.</p><section class="article-design-block is-fact" data-editorial-block="fact" data-reveal="fade-up"><h3>Кому подойдёт</h3><p>Короткая практическая рекомендация читателю.</p></section><h2>2. Название второй книги</h2><p>Автор, контекст и причина включения.</p><h2>3. Название третьей книги</h2><p>Автор, контекст и причина включения.</p><h2>Как выбрать, с чего начать</h2><p>Сопоставьте книги и помогите читателю принять решение.</p><h2>Источники</h2><p>Укажите издательские страницы и проверяемые библиографические данные.</p>`,
  },
  {
    label: "Архивное расследование",
    description: "Источники, хронология, версии и проверяемый вывод",
    html: `<aside class="article-lead"><p><strong>Что мы выясняем</strong></p><p>Сформулируйте вопрос, границы исследования и доступные свидетельства.</p></aside>${mediaSlot("Архивный документ", "Добавьте изображение документа с подписью, датой, фондом и лицензией.")}<h2>Исходная версия</h2><p>Опишите распространённое утверждение и откуда оно появилось.</p><h2>Что говорят документы</h2><p>Разберите первичные и авторитетные вторичные источники.</p><section class="article-design-block is-timeline" data-editorial-block="timeline" data-reveal="fade-up"><h3>Хронология</h3><p>Год - подтверждённое событие.</p><p>Год - подтверждённое событие.</p></section>${mediaSlot("Второй источник", "Покажите фрагмент, который помогает проверить вывод.")}<h2>Разночтения и ограничения</h2><p>Честно обозначьте, какие данные остаются спорными.</p><h2>Вывод редакции</h2><p>Отделите установленный факт от обоснованной интерпретации.</p><h2>Источники и библиография</h2><p>Перечислите архивные шифры, каталоги и публикации.</p>`,
  },
] as const;

const LEGACY_TEMPLATES_KEY = "probpera-editor-custom-templates";
export type CustomTemplate = {
  id: string;
  label: string;
  html: string;
  visibility?: "personal" | "shared";
  canDelete?: boolean;
  localOnly?: boolean;
};

function listValue(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "text" in item
          ? String(item.text || "")
          : ""
    )
    .filter(Boolean)
    .join("\n");
}

function hasStructuredContent(value: unknown): value is JSONContent {
  if (!value || typeof value !== "object" || !("content" in value)) return false;
  return Array.isArray(value.content) && value.content.length > 0;
}

function canonicalEnglishRecoveryBaseline(
  translation: ArticleTranslation | null,
  publicSiteUrl: string,
  categorySlug: string | undefined,
  russianCanonical: string
): ArticleRecoverySnapshot["english"] {
  const canonical = initialEnglishCanonicalState({
    persistedCanonical: translation?.canonical_url,
    russianCanonical,
    generatedEnglishCanonical: articleCanonicalUrl(
      publicSiteUrl, translation?.slug || createSlug(translation?.title || "") || "english-article", categorySlug
    ),
  });
  return {
    enabled: Boolean(translation?.id || translation?.title),
    title: translation?.title || "", subtitle: translation?.subtitle || "",
    excerpt: translation?.excerpt || "", slug: translation?.slug || "",
    slugEdited: Boolean(translation?.id), contentHtml: translation?.content_html || "",
    contentJson: JSON.stringify(translation?.content_json || { type: "doc", content: [] }),
    coverAlt: translation?.cover_alt || "", seoTitle: translation?.seo_title || "",
    seoDescription: translation?.seo_description || "", seoKeywords: (translation?.seo_keywords || []).join(", "),
    canonicalUrl: canonical.canonicalUrl, canonicalEdited: canonical.isEdited,
    ogTitle: translation?.og_title || "", ogDescription: translation?.og_description || "",
    sourceText: listValue(translation?.sources), bibliographyText: listValue(translation?.bibliography),
    status: translation?.status || "draft", confirmedCurrentSource: false,
  };
}

export type ArticleEditorProps = {
  article: Article;
  englishTranslation?: ArticleTranslation;
  /** Canonical read stays separate from an editable private English draft. */
  canonicalEnglishTranslation?: ArticleTranslation | null;
  categories: Category[];
  publicSiteUrl: string;
  templates?: CustomTemplate[];
  draftKey?: string;
  /** Server-verified account scope for per-tab operation recovery. */
  actorId?: string;
  /** Legacy navigation hint; it is not a canonical save receipt. */
  saveConfirmed?: boolean;
  canPublish?: boolean;
  canOverridePublicationChecklist?: boolean;
  readUnavailable?: boolean;
};

export default function ArticleEditor({
  article: loadedArticle,
  englishTranslation: loadedEnglishTranslation,
  canonicalEnglishTranslation: loadedCanonicalEnglishTranslation,
  categories: loadedCategories,
  publicSiteUrl,
  templates = [],
  draftKey: loadedDraftKey,
  actorId,
  canPublish = false,
  canOverridePublicationChecklist = false,
  readUnavailable = false,
}: ArticleEditorProps) {
  // The mounted form and its CAS/recovery base belong to the same loaded revision.
  // A refreshed bundle does not acknowledge this draft or rebase it onto other edits.
  const [article] = useState(loadedArticle);
  const [englishTranslation] = useState(loadedEnglishTranslation);
  const [canonicalEnglishTranslation] = useState(loadedCanonicalEnglishTranslation);
  const [draftKey] = useState(loadedDraftKey);
  // Keep selected options and their canonical-path context with the open draft.
  const [categories] = useState(loadedCategories);
  // A successful action may advance our own write context. A reread never does.
  const [savedIdentity, setSavedIdentity] = useState(() => ({
    articleId: article.id || null,
    articleUpdatedAt: article.updated_at || null,
    englishUpdatedAt: englishTranslation?.updated_at || null,
    workingDraftVersion: article.working_draft_version || 0,
    canonicalStatus: article.status || "draft",
  }));
  const readUnavailableRef = useRef(readUnavailable);
  readUnavailableRef.current = readUnavailable;
  const contentPreservationBlockedRef = useRef(true);
  const editorMediaBusyRef = useRef(false);
  const [activeLocale, setActiveLocale] = useState<"ru" | "en">("ru");
  const activeLocaleRef = useRef<"ru" | "en">("ru");
  const switchingLocaleRef = useRef(false);
  const [title, setTitle] = useState(article.title || "");
  const [subtitle, setSubtitle] = useState(article.subtitle || "");
  const [slug, setSlug] = useState(article.slug || "");
  const [categoryId, setCategoryId] = useState(article.category_id || "");
  const initialCategorySlug = categories.find(
    (category) => category.id === (article.category_id || "")
  )?.slug;
  const initialCanonical = articleCanonicalUrl(
    publicSiteUrl,
    article.slug || "adres-stati",
    initialCategorySlug
  );
  const generatedInitialEnglishCanonical = articleCanonicalUrl(
    publicSiteUrl,
    englishTranslation?.slug ||
      createSlug(englishTranslation?.title || "") ||
      "english-article",
    initialCategorySlug
  );
  const initialEnglishCanonical = initialEnglishCanonicalState({
    persistedCanonical: englishTranslation?.canonical_url,
    russianCanonical: initialCanonical,
    generatedEnglishCanonical: generatedInitialEnglishCanonical,
  });
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(article.id));
  const [contentHtml, setContentHtml] = useState(article.content_html || "");
  const [contentJson, setContentJson] = useState(
    JSON.stringify(article.content_json || { type: "doc", content: [] })
  );
  const [englishEnabled, setEnglishEnabled] = useState(
    article.working_draft_english_enabled ?? Boolean(englishTranslation?.id || englishTranslation?.title)
  );
  const [englishTitle, setEnglishTitle] = useState(
    englishTranslation?.title || ""
  );
  const [englishSubtitle, setEnglishSubtitle] = useState(
    englishTranslation?.subtitle || ""
  );
  const [englishExcerpt, setEnglishExcerpt] = useState(
    englishTranslation?.excerpt || ""
  );
  const [englishSlug, setEnglishSlug] = useState(
    englishTranslation?.slug || ""
  );
  const [englishSlugEdited, setEnglishSlugEdited] = useState(
    Boolean(englishTranslation?.id)
  );
  const [englishContentHtml, setEnglishContentHtml] = useState(
    englishTranslation?.content_html || ""
  );
  const [englishContentJson, setEnglishContentJson] = useState(
    JSON.stringify(
      englishTranslation?.content_json || { type: "doc", content: [] }
    )
  );
  const [savedLocallyAt, setSavedLocallyAt] = useState<string | null>(null);
  const [draftStorageError, setDraftStorageError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const recoveryDirtyRef = useRef(isDirty);
  recoveryDirtyRef.current = isDirty;
  const hasAuthoredRecoveryEditsRef = useRef(false);
  const authorInteractionRef = useRef(false);
  function markAuthoredRecoveryDirty() {
    hasAuthoredRecoveryEditsRef.current = true;
    recoveryDirtyRef.current = true;
    setIsDirty(true);
  }
  const persistRecoveryOnUnmountRef = useRef<(() => void) | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(Boolean(actorId));
  const [hasPendingSaveOperation, setHasPendingSaveOperation] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [savedDestination, setSavedDestination] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(
    article.id ? `probpera-editor-${article.id}` : ""
  );
  const [recoverySourceKey, setRecoverySourceKey] = useState(
    article.id ? `probpera-editor-${article.id}` : ""
  );
  const [recoveryDraftScope, setRecoveryDraftScope] = useState<string | null>(
    null
  );
  const initialRecoveryFingerprintRef = useRef<string | null>(null);
  const initialRecoverySnapshotRef = useRef<ArticleRecoverySnapshot | null>(null);
  const latestRecoverySnapshotRef = useRef<ArticleRecoverySnapshot | null>(null);
  const submittedRecoverySnapshotRef = useRef<ArticleRecoverySnapshot | null>(null);
  const canonicalEnglishSnapshotRef = useRef<ArticleRecoverySnapshot["english"] | null>(null);
  const privateEnglishSnapshotRef = useRef<{
    english: ArticleRecoverySnapshot["english"];
    version: number;
    updatedAt: string;
  } | null>(null);
  const initiallyAbsentEnglishRef = useRef(false);
  const pendingSaveOperationRef = useRef<{
    formData: FormData;
    snapshot: ArticleRecoverySnapshot | null;
    context: ArticleSaveContext;
  } | null>(null);
  const pendingRecoveryJournalRef = useRef<ArticlePendingOperation | null>(null);
  const operationRecoveryReadyRef = useRef(!actorId);
  const recoveryOriginRef = useRef<{ key: string; scope: string | null } | null>(null);
  const hydratedOperationRef = useRef(false);
  const pendingRecoveryNeedsApplyRef = useRef(false);
  const [operationRecoveryAttempt, setOperationRecoveryAttempt] = useState(0);
  const [operationRecoveryError, setOperationRecoveryError] = useState(false);
  const operationRecoveryErrorRef = useRef(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(templates);
  const [templateMessage, setTemplateMessage] = useState("");
  const [metadataMessage, setMetadataMessage] = useState("");
  const [mediaComposerKind, setMediaComposerKind] =
    useState<GalleryEditorKind | null>(null);
  const [mediaComposerValue, setMediaComposerValue] = useState("");
  const [mediaComposerItems, setMediaComposerItems] = useState<
    EditorialGalleryItemInput[]
  >([]);
  const [mediaComposerError, setMediaComposerError] = useState("");
  const [mediaComposerSettings, setMediaComposerSettings] =
    useState<EditorialGallerySettings>(() =>
      defaultEditorialGallerySettings("gallery")
    );
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogInitialValue, setLinkDialogInitialValue] = useState<
    Record<string, unknown>
  >({});
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageDialogInitialValue, setImageDialogInitialValue] =
    useState<EditorImageDialogValue>({ src: "", alt: "", caption: "" });
  const [templatePending, startTemplateTransition] = useTransition();
  const [excerpt, setExcerpt] = useState(article.excerpt || "");
  const [status, setStatus] = useState(article.status || "draft");
  const [scheduledAt, setScheduledAt] = useState(
    article.scheduled_at?.slice(0, 16) || ""
  );
  const [featured, setFeatured] = useState(Boolean(article.featured));
  const [showOnHomepage, setShowOnHomepage] = useState(
    Boolean(article.show_on_homepage)
  );
  const [pinned, setPinned] = useState(Boolean(article.pinned));
  const [coverUrl, setCoverUrl] = useState(article.cover_external_url || "");
  const [coverAlt, setCoverAlt] = useState(article.cover_alt || "");
  const [englishCoverAlt, setEnglishCoverAlt] = useState(
    englishTranslation?.cover_alt || ""
  );
  const [imageUploadTarget, setImageUploadTarget] = useState<ImageUploadTarget | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [isImageDraggingOverEditor, setIsImageDraggingOverEditor] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveSubmitButtonRef = useRef<HTMLButtonElement>(null);
  const previewSubmitButtonRef = useRef<HTMLButtonElement>(null);
  const publishSubmitButtonRef = useRef<HTMLButtonElement>(null);
  const submissionInFlightRef = useRef(false);
  const actionRunningRef = useRef(false);
  const saveBlockedRef = useRef(Boolean(actorId));
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const workspaceSectionRefs = useRef<
    Record<ArticleWorkspaceSection, HTMLElement | null>
  >({
    basics: null,
    text: null,
    media: null,
    publish: null,
    cover: null,
    seo: null,
    sources: null,
    quality: null,
  });
  const imageUploadInFlightRef = useRef(false);
  const imageSelectionRef = useRef<ImageSelectionContext>({
    selectedImage: false,
    attributes: {},
    locale: activeLocaleRef.current,
  });
  const [seoDescription, setSeoDescription] = useState(article.seo_description || "");
  const [sourceText, setSourceText] = useState(listValue(article.sources));
  const [bibliographyText, setBibliographyText] = useState(
    listValue(article.bibliography)
  );
  const [legacyPath, setLegacyPath] = useState(article.legacy_path || "");
  const [allowIndexing, setAllowIndexing] = useState(
    article.allow_indexing !== false
  );
  const [seoTitle, setSeoTitle] = useState(article.seo_title || "");
  const [seoKeywords, setSeoKeywords] = useState(
    (article.seo_keywords || []).join(", ")
  );
  const [ogTitle, setOgTitle] = useState(article.og_title || "");
  const [ogDescription, setOgDescription] = useState(
    article.og_description || ""
  );
  const [englishSeoTitle, setEnglishSeoTitle] = useState(
    englishTranslation?.seo_title || ""
  );
  const [englishSeoDescription, setEnglishSeoDescription] = useState(
    englishTranslation?.seo_description || ""
  );
  const [englishSeoKeywords, setEnglishSeoKeywords] = useState(
    (englishTranslation?.seo_keywords || []).join(", ")
  );
  const [englishCanonicalUrl, setEnglishCanonicalUrl] = useState(
    initialEnglishCanonical.canonicalUrl
  );
  const [englishCanonicalEdited, setEnglishCanonicalEdited] = useState(
    initialEnglishCanonical.isEdited
  );
  const [englishOgTitle, setEnglishOgTitle] = useState(
    englishTranslation?.og_title || ""
  );
  const [englishOgDescription, setEnglishOgDescription] = useState(
    englishTranslation?.og_description || ""
  );
  const [englishSourceText, setEnglishSourceText] = useState(
    listValue(englishTranslation?.sources)
  );
  const [englishBibliographyText, setEnglishBibliographyText] = useState(
    listValue(englishTranslation?.bibliography)
  );
  const [englishStatus, setEnglishStatus] = useState(
    englishTranslation?.status || "draft"
  );
  const [englishConfirmedCurrentSource, setEnglishConfirmedCurrentSource] =
    useState(false);
  const [russianSourceChanged, setRussianSourceChanged] = useState(false);
  const automaticMetadataRef = useRef<{
    ru: ArticleMetadataAutomationState;
    en: ArticleMetadataAutomationState;
  } | null>(null);
  if (!automaticMetadataRef.current) {
    automaticMetadataRef.current = {
      ru: createArticleMetadataAutomationState({
        excerpt: article.excerpt || "",
        seoTitle: article.seo_title || "",
        seoDescription: article.seo_description || "",
        seoKeywords: (article.seo_keywords || []).join(", "),
        ogTitle: article.og_title || "",
        ogDescription: article.og_description || "",
      }),
      en: createArticleMetadataAutomationState({
        excerpt: englishTranslation?.excerpt || "",
        seoTitle: englishTranslation?.seo_title || "",
        seoDescription: englishTranslation?.seo_description || "",
        seoKeywords: (englishTranslation?.seo_keywords || []).join(", "),
        ogTitle: englishTranslation?.og_title || "",
        ogDescription: englishTranslation?.og_description || "",
      }),
    };
  }
  const automaticMetadata = automaticMetadataRef.current;
  const markMetadataFieldManual = (
    locale: "ru" | "en",
    field: ArticleMetadataDraftField
  ) => {
    automaticMetadata[locale] = markArticleMetadataFieldManual(
      automaticMetadata[locale],
      field
    );
  };
  const registerWorkspaceSection = useCallback(
    (section: ArticleWorkspaceSection, element: HTMLElement | null) => {
      workspaceSectionRefs.current[section] = element;
    },
    []
  );
  const scrollToWorkspaceSection = useCallback(
    (section: ArticleWorkspaceSection) => {
      const target = workspaceSectionRefs.current[section];
      if (!target) return;
      const disclosure =
        target instanceof HTMLDetailsElement
          ? target
          : target.closest("details");
      if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    []
  );
  const initialEditorContent = hasStructuredContent(article.content_json)
    ? article.content_json
    : article.content_html || "";

  const markRussianSourceChanged = () => {
    setRussianSourceChanged(true);
    setEnglishConfirmedCurrentSource(false);
    setEnglishStatus((current) =>
      current === "approved" || current === "published" ? "stale" : current
    );
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichEditorExtensions({
      placeholder:
        "Начните писать. Для большого материала используйте подзаголовки - из них автоматически соберётся оглавление.",
      afterStarterKit: [EditorialBlock],
      afterImage: [ArticleTextTone, ArticleTypographyScope],
    }),
    content: initialEditorContent,
    onUpdate({ editor: currentEditor, transaction }) {
      if (switchingLocaleRef.current || contentPreservationBlockedRef.current) return;
      // Mounting/schema projections are not authored changes to the stored body.
      // Async media attachment remains an explicit author operation after its DOM event.
      if (!authorInteractionRef.current && !hasAuthoredRecoveryEditsRef.current && !editorMediaBusyRef.current) return;
      if (authorInteractionRef.current && transaction.docChanged) hasAuthoredRecoveryEditsRef.current = true;
      if (activeLocaleRef.current === "en") {
        setEnglishContentHtml(currentEditor.getHTML());
        setEnglishContentJson(JSON.stringify(currentEditor.getJSON()));
        if (currentEditor.getText().trim()) setEnglishEnabled(true);
      } else {
        setContentHtml(currentEditor.getHTML());
        setContentJson(JSON.stringify(currentEditor.getJSON()));
        markRussianSourceChanged();
      }
      setIsDirty(true);
    },
  });

  const contentPreservationBlocked = useMemo(() => {
    if (!editor) return true;
    try {
      if ([
        article.sources, article.bibliography,
        englishTranslation?.sources, englishTranslation?.bibliography,
        canonicalEnglishTranslation?.sources, canonicalEnglishTranslation?.bibliography,
      ].some(list => !canPreserveArticleEditorSourceList(list))) return true;
      return [
        prepareArticleEditorDocumentContent(article.content_html || "", JSON.stringify(article.content_json || { type: "doc", content: [] }), editor.schema, "ru"),
        prepareArticleEditorDocumentContent(englishTranslation?.content_html || "", JSON.stringify(englishTranslation?.content_json || { type: "doc", content: [] }), editor.schema, "en"),
        prepareArticleEditorDocumentContent(contentHtml, contentJson, editor.schema, "ru"),
        prepareArticleEditorDocumentContent(englishContentHtml, englishContentJson, editor.schema, "en"),
      ].some(content => content === null);
    } catch { return true; }
  }, [article, canonicalEnglishTranslation, contentHtml, contentJson, editor, englishContentHtml, englishContentJson, englishTranslation]);
  contentPreservationBlockedRef.current = contentPreservationBlocked;

  const suggestedArticleImageAlt = useCallback(
    (fileName: string, context: { position: number }) =>
      suggestEditorImageAltText({
        document: editor?.state.doc,
        position: context.position,
        title: activeLocale === "en" ? englishTitle : title,
        fileName,
        kind: "article",
        locale: activeLocale,
      }),
    [activeLocale, editor, englishTitle, title]
  );
  const suggestedArticleImageCaption = useCallback(
    (fileName: string, context: { position: number }) =>
      suggestEditorImageCaption({
        document: editor?.state.doc,
        position: context.position,
        title: activeLocale === "en" ? englishTitle : title,
        fileName,
        kind: "article",
        locale: activeLocale,
      }),
    [activeLocale, editor, englishTitle, title]
  );

  const editorMedia = useEditorMediaWorkflow({
    editor,
    collectionName: "Статьи",
    contextKey: activeLocale,
    metadataLocale: activeLocale,
    suggestedAltText: suggestedArticleImageAlt,
    suggestedCaptionText: suggestedArticleImageCaption,
    onChanged: () => {
      hasAuthoredRecoveryEditsRef.current = true;
      setTemplateMessage(
        "Изображение готово. При необходимости выберите его и измените расположение."
      );
      markAuthoredRecoveryDirty();
    },
    onMessage: (message) => {
      setImageUploadError("");
      setImageUploadMessage(message);
    },
    onError: (message) => {
      setImageUploadMessage("");
      setImageUploadError(message);
    },
  });
  editorMediaBusyRef.current = editorMedia.busy;

  const appendMediaComposerItems = useCallback(
    (items: EditorialGalleryItemInput[]) => {
      setMediaComposerItems((current) =>
        mergeEditorialGalleryItems(current, items)
      );
      setMediaComposerError("");
    },
    []
  );

  useEffect(() => {
    editor?.setEditable(!contentPreservationBlocked && imageUploadTarget === null && !editorMedia.busy);
  }, [contentPreservationBlocked, editor, editorMedia.busy, imageUploadTarget]);

  const isImageUploadActive =
    imageUploadTarget !== null ||
    imageUploadInFlightRef.current ||
    editorMedia.busy;

  useEffect(() => {
    if (!slugEdited) setSlug(createSlug(title));
  }, [slugEdited, title]);

  useEffect(() => {
    if (!englishSlugEdited) setEnglishSlug(createSlug(englishTitle));
  }, [englishSlugEdited, englishTitle]);

  const selectedCategorySlug = categories.find(
    (category) => category.id === categoryId
  )?.slug;
  const generatedCanonical = articleCanonicalUrl(
    publicSiteUrl,
    slug || "adres-stati",
    selectedCategorySlug
  );

  useEffect(() => {
    if (!canonicalEdited) setCanonicalUrl(generatedCanonical);
  }, [canonicalEdited, generatedCanonical]);

  const generatedEnglishCanonical = articleCanonicalUrl(
    publicSiteUrl,
    englishSlug || "english-article",
    selectedCategorySlug
  );

  useEffect(() => {
    if (!englishCanonicalEdited) {
      setEnglishCanonicalUrl(generatedEnglishCanonical);
    }
  }, [englishCanonicalEdited, generatedEnglishCanonical]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (contentPreservationBlockedRef.current) return;
      if (!title.trim() && !subtitle.trim() && !contentHtml.trim()) return;
      const next = buildArticleMetadataDraft({
        title,
        subtitle,
        contentHtml,
        locale: "ru",
      });
      const synchronized = synchronizeArticleMetadataDraft(
        { excerpt, seoTitle, seoDescription, seoKeywords, ogTitle, ogDescription },
        next,
        automaticMetadata.ru
      );
      automaticMetadata.ru = synchronized.state;
      setExcerpt(synchronized.draft.excerpt);
      setSeoTitle(synchronized.draft.seoTitle);
      setSeoDescription(synchronized.draft.seoDescription);
      setSeoKeywords(synchronized.draft.seoKeywords);
      setOgTitle(synchronized.draft.ogTitle);
      setOgDescription(synchronized.draft.ogDescription);
      if (synchronized.changed) {
        markRussianSourceChanged();
        setIsDirty(true);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    automaticMetadata,
    contentHtml,
    excerpt,
    ogDescription,
    ogTitle,
    seoDescription,
    seoKeywords,
    seoTitle,
    subtitle,
    title,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (contentPreservationBlockedRef.current) return;
      if (
        !englishTitle.trim() &&
        !englishSubtitle.trim() &&
        !englishContentHtml.trim()
      ) {
        return;
      }
      const next = buildArticleMetadataDraft({
        title: englishTitle,
        subtitle: englishSubtitle,
        contentHtml: englishContentHtml,
        locale: "en",
      });
      const synchronized = synchronizeArticleMetadataDraft(
        {
          excerpt: englishExcerpt,
          seoTitle: englishSeoTitle,
          seoDescription: englishSeoDescription,
          seoKeywords: englishSeoKeywords,
          ogTitle: englishOgTitle,
          ogDescription: englishOgDescription,
        },
        next,
        automaticMetadata.en
      );
      automaticMetadata.en = synchronized.state;
      setEnglishExcerpt(synchronized.draft.excerpt);
      setEnglishSeoTitle(synchronized.draft.seoTitle);
      setEnglishSeoDescription(synchronized.draft.seoDescription);
      setEnglishSeoKeywords(synchronized.draft.seoKeywords);
      setEnglishOgTitle(synchronized.draft.ogTitle);
      setEnglishOgDescription(synchronized.draft.ogDescription);
      if (synchronized.changed) setIsDirty(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    automaticMetadata,
    englishContentHtml,
    englishExcerpt,
    englishOgDescription,
    englishOgTitle,
    englishSeoDescription,
    englishSeoKeywords,
    englishSeoTitle,
    englishSubtitle,
    englishTitle,
  ]);

  const switchEditorLocale = useCallback((nextLocale: "ru" | "en") => {
    if (!editor) {
      setImageUploadError("Редактор ещё загружается. Повторите переключение через секунду.");
      return;
    }
    if (isImageUploadActive) {
      setImageUploadError(
        "Дождитесь завершения загрузки изображения, затем переключите язык."
      );
      return;
    }
    if (nextLocale === activeLocale) return;
    activeLocaleRef.current = nextLocale;
    setActiveLocale(nextLocale);

    const nextJson = nextLocale === "en" ? englishContentJson : contentJson;
    const nextHtml = nextLocale === "en" ? englishContentHtml : contentHtml;
    let nextContent: JSONContent | string = nextHtml;
    try {
      const parsedContent = JSON.parse(nextJson) as JSONContent;
      if (hasStructuredContent(parsedContent)) nextContent = parsedContent;
    } catch {
      nextContent = nextHtml;
    }

    switchingLocaleRef.current = true;
    editor.commands.setContent(nextContent);
    switchingLocaleRef.current = false;
    editor.commands.focus("start");
  }, [
    activeLocale,
    contentHtml,
    contentJson,
    editor,
    englishContentHtml,
    englishContentJson,
    isImageUploadActive,
  ]);

  const activeTitle = activeLocale === "en" ? englishTitle : title;
  const activeSubtitle = activeLocale === "en" ? englishSubtitle : subtitle;
  const activeExcerpt = activeLocale === "en" ? englishExcerpt : excerpt;
  const activeSlug = activeLocale === "en" ? englishSlug : slug;
  const activeCoverAlt = activeLocale === "en" ? englishCoverAlt : coverAlt;
  const activeSeoTitle = activeLocale === "en" ? englishSeoTitle : seoTitle;
  const activeSeoDescription =
    activeLocale === "en" ? englishSeoDescription : seoDescription;
  const activeSeoKeywords =
    activeLocale === "en" ? englishSeoKeywords : seoKeywords;
  const activeCanonicalUrl =
    activeLocale === "en" ? englishCanonicalUrl : canonicalUrl;
  const activeOgTitle = activeLocale === "en" ? englishOgTitle : ogTitle;
  const activeOgDescription =
    activeLocale === "en" ? englishOgDescription : ogDescription;
  const activeSourceText =
    activeLocale === "en" ? englishSourceText : sourceText;
  const activeBibliographyText =
    activeLocale === "en" ? englishBibliographyText : bibliographyText;
  const activeContentHtml =
    activeLocale === "en" ? englishContentHtml : contentHtml;

  const prepareArticleMetadata = () => {
    const draft = buildArticleMetadataDraft({
      title: activeTitle,
      subtitle: activeSubtitle,
      contentHtml: activeContentHtml,
      locale: activeLocale,
    });
    if (!draft.excerpt) {
      setMetadataMessage(
        activeLocale === "en"
          ? "Сначала добавьте несколько предложений английского текста."
          : "Сначала добавьте несколько предложений основного текста."
      );
      scrollToWorkspaceSection("text");
      return;
    }
    const currentMetadata: ArticleMetadataDraft = {
      excerpt: activeExcerpt,
      seoTitle: activeSeoTitle,
      seoDescription: activeSeoDescription,
      seoKeywords: activeSeoKeywords,
      ogTitle: activeOgTitle,
      ogDescription: activeOgDescription,
    };
    const metadataAutomation = automaticMetadata[activeLocale];
    const hasExistingMetadata = ARTICLE_METADATA_DRAFT_FIELDS.some(
      (field) =>
        currentMetadata[field].trim() && !metadataAutomation.managed[field]
    );
    if (
      hasExistingMetadata &&
      !window.confirm(
        "Обновить краткое описание и SEO на основе текущего текста? Введённые значения будут заменены."
      )
    ) {
      return;
    }

    hasAuthoredRecoveryEditsRef.current = true;
    if (activeLocale === "en") {
      setEnglishExcerpt(draft.excerpt);
      setEnglishSeoTitle(draft.seoTitle);
      setEnglishSeoDescription(draft.seoDescription);
      setEnglishSeoKeywords(draft.seoKeywords);
      setEnglishOgTitle(draft.ogTitle);
      setEnglishOgDescription(draft.ogDescription);
      if (draft.excerpt) setEnglishEnabled(true);
      automaticMetadata.en = createArticleMetadataAutomationState(draft, true);
    } else {
      setExcerpt(draft.excerpt);
      setSeoTitle(draft.seoTitle);
      setSeoDescription(draft.seoDescription);
      setSeoKeywords(draft.seoKeywords);
      setOgTitle(draft.ogTitle);
      setOgDescription(draft.ogDescription);
      markRussianSourceChanged();
      automaticMetadata.ru = createArticleMetadataAutomationState(draft, true);
    }
    markAuthoredRecoveryDirty();
    setMetadataMessage(
      "Описание карточки и SEO подготовлены. Проверьте формулировку перед публикацией."
    );
  };

  useEffect(() => {
    if (savedIdentity.articleId) {
      const articleRecoveryKey = `probpera-editor-${savedIdentity.articleId}`;
      setRecoveryKey(articleRecoveryKey);
      setRecoverySourceKey(articleRecoveryKey);
      setRecoveryDraftScope(null);
      return;
    }

    const copySource = new URLSearchParams(window.location.search).get("copyFrom");
    const scope =
      draftKey?.trim() || (copySource ? `copy-${copySource}` : "new");
    const rawHistoryState = window.history.state;
    const historyState =
      rawHistoryState && typeof rawHistoryState === "object"
        ? (rawHistoryState as Record<string, unknown>)
        : {};
    const storedTokens = historyState.__probperaArticleRecoveryTokens;
    const recoveryTokens =
      storedTokens && typeof storedTokens === "object"
        ? { ...(storedTokens as Record<string, string>) }
        : {};
    let token = recoveryTokens[scope];
    if (!token) {
      token =
        typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      recoveryTokens[scope] = token;
      window.history.replaceState(
        {
          ...historyState,
          __probperaArticleRecoveryTokens: recoveryTokens,
        },
        ""
      );
    }
    const nextRecoveryKey = `${articleDraftRecoveryKeyPrefix(scope)}${token}`;
    let nextRecoverySourceKey = nextRecoveryKey;
    try {
      const legacyNewDraft = window.localStorage.getItem("probpera-editor-new");
      if (!window.localStorage.getItem(nextRecoveryKey) && legacyNewDraft) {
        persistArticleRecoverySnapshot(
          window.localStorage,
          nextRecoveryKey,
          legacyNewDraft,
          scope
        );
        window.localStorage.removeItem("probpera-editor-new");
      }
      nextRecoverySourceKey = resolveArticleDraftRecoverySource(
        window.localStorage,
        scope,
        nextRecoveryKey,
        actorId
      );
    } catch {
      setDraftStorageError(
        "Браузер запретил доступ к локальным черновикам. Сохраняйте статью кнопкой чаще."
      );
    }
    setRecoveryKey(nextRecoveryKey);
    setRecoverySourceKey(nextRecoverySourceKey);
    setRecoveryDraftScope(scope);
  }, [actorId, savedIdentity.articleId, draftKey]);

  useEffect(() => {
    if (!recoveryKey || !recoverySourceKey) return;
    // A query flag and a client-side fingerprint do not prove a canonical save.
    // Retain recovery copies until an actual save receipt can authorize cleanup.
    try {
      const stored = readRecoveryCopy(window.localStorage, recoverySourceKey, actorId);
      setHasRecoveryCopy(Boolean(stored && canUseRecoveryCopy(JSON.parse(stored), actorId)));
    } catch {
      setDraftStorageError(
        "Браузер запретил доступ к локальным черновикам. Сохраняйте статью кнопкой чаще."
      );
    }
  }, [actorId, recoveryKey, recoverySourceKey]);

  const recoverySnapshot = useMemo<ArticleRecoverySnapshot>(
    () => ({
      version: 2,
      activeLocale,
      title,
      subtitle,
      excerpt,
      slug,
      slugEdited,
      categoryId,
      contentHtml,
      contentJson,
      status,
      scheduledAt,
      featured,
      showOnHomepage,
      pinned,
      coverUrl,
      coverAlt,
      seoTitle,
      seoDescription,
      seoKeywords,
      canonicalUrl,
      canonicalEdited,
      ogTitle,
      ogDescription,
      sourceText,
      bibliographyText,
      legacyPath,
      allowIndexing,
      russianSourceChanged,
      english: {
        enabled: englishEnabled,
        title: englishTitle,
        subtitle: englishSubtitle,
        excerpt: englishExcerpt,
        slug: englishSlug,
        slugEdited: englishSlugEdited,
        contentHtml: englishContentHtml,
        contentJson: englishContentJson,
        coverAlt: englishCoverAlt,
        seoTitle: englishSeoTitle,
        seoDescription: englishSeoDescription,
        seoKeywords: englishSeoKeywords,
        canonicalUrl: englishCanonicalUrl,
        canonicalEdited: englishCanonicalEdited,
        ogTitle: englishOgTitle,
        ogDescription: englishOgDescription,
        sourceText: englishSourceText,
        bibliographyText: englishBibliographyText,
        status: englishStatus,
        confirmedCurrentSource: englishConfirmedCurrentSource,
      },
    }),
    [
      activeLocale,
      allowIndexing,
      bibliographyText,
      canonicalEdited,
      canonicalUrl,
      categoryId,
      contentHtml,
      contentJson,
      coverAlt,
      coverUrl,
      englishBibliographyText,
      englishCanonicalEdited,
      englishCanonicalUrl,
      englishConfirmedCurrentSource,
      englishContentHtml,
      englishContentJson,
      englishCoverAlt,
      englishEnabled,
      englishExcerpt,
      englishOgDescription,
      englishOgTitle,
      englishSeoDescription,
      englishSeoKeywords,
      englishSeoTitle,
      englishSlug,
      englishSlugEdited,
      englishSourceText,
      englishStatus,
      englishSubtitle,
      englishTitle,
      excerpt,
      featured,
      ogDescription,
      ogTitle,
      pinned,
      legacyPath,
      russianSourceChanged,
      scheduledAt,
      seoDescription,
      seoKeywords,
      seoTitle,
      showOnHomepage,
      slug,
      slugEdited,
      sourceText,
      status,
      subtitle,
      title,
    ]
  );

  useEffect(() => {
    latestRecoverySnapshotRef.current = recoverySnapshot;
    const fingerprint = recoveryContentFingerprint(recoverySnapshot);
    if (initialRecoveryFingerprintRef.current === null) {
      initialRecoveryFingerprintRef.current = fingerprint;
      initialRecoverySnapshotRef.current = recoverySnapshot;
      // A missing EN on an ordinary initial form proves the empty baseline.
      // Copies and working-draft overlays cannot provide that proof.
      const ownCanonicalEnglish = article.id && englishTranslation?.updated_at;
      const initiallyAbsentEnglish = !englishTranslation && !draftKey;
      if (article.id && canonicalEnglishTranslation !== undefined) {
        canonicalEnglishSnapshotRef.current = article.working_draft_version || !canonicalEnglishTranslation
          ? canonicalEnglishRecoveryBaseline(canonicalEnglishTranslation, publicSiteUrl, initialCategorySlug, initialCanonical)
          : recoverySnapshot.english;
        initiallyAbsentEnglishRef.current = initiallyAbsentEnglish && !article.working_draft_version;
      } else if (!article.working_draft_version && (ownCanonicalEnglish || initiallyAbsentEnglish)) {
        canonicalEnglishSnapshotRef.current = recoverySnapshot.english;
        initiallyAbsentEnglishRef.current = initiallyAbsentEnglish;
      }
      if (article.working_draft_version && article.working_draft_updated_at && englishTranslation?.title) {
        privateEnglishSnapshotRef.current = {
          english: recoverySnapshot.english,
          version: article.working_draft_version,
          updatedAt: article.working_draft_updated_at,
        };
      }
      return;
    }
    if (fingerprint !== initialRecoveryFingerprintRef.current) {
      setIsDirty(true);
    }
  }, [article, canonicalEnglishTranslation, draftKey, englishTranslation, initialCanonical, initialCategorySlug, publicSiteUrl, recoverySnapshot]);

  useEffect(() => {
    if (!actorId || operationRecoveryReadyRef.current || !editor || !recoveryKey || !recoverySourceKey) return;
    const scope = recoveryDraftScope === null ? null : safeArticleDraftScope(recoveryDraftScope);
    // A latest-copy pointer may offer legacy text from another history entry.
    // Only this entry's own key can automatically resume a new/copy operation.
    const operationRecoveryKey = article.id ? recoverySourceKey : recoveryKey;
    let originKey = operationRecoveryKey;
    let originScope = scope;
    try {
      let localCopy: Record<string, unknown> | null = null;
      let localReadable = true;
      let localValue: string | null = null;
      try { localValue = readRecoveryCopy(window.localStorage, operationRecoveryKey, actorId); }
      catch { localReadable = false; }
      if (localValue) {
        try {
          const value: unknown = JSON.parse(localValue);
          if (value && typeof value === "object" && !Array.isArray(value)) localCopy = value as Record<string, unknown>;
        } catch {
          // A plain damaged legacy copy is still available for explicit recovery.
        }
      }
      if (localCopy && !canUseRecoveryCopy(localCopy, actorId)) {
        if (recoveryCopyOwnerState(localCopy, actorId) === "invalid") throw new Error("Invalid recovery owner");
        localCopy = null;
      }
      const rawReference = localCopy?.pendingArticleOperation;
      const reference = parseArticlePendingOperationReference(rawReference);
      const foreignReference = rawReference && typeof rawReference === "object"
        && "actorId" in rawReference && rawReference.actorId !== actorId;
      if (localCopy && Object.hasOwn(localCopy, "pendingArticleOperation")
        && !foreignReference && !reference) throw new Error("Invalid operation reference");
      if (reference && reference.actorId === actorId) {
        if (article.id ? reference.context.articleId !== null && reference.context.articleId !== article.id
          : reference.draftScope !== scope || reference.originRecoveryKey !== operationRecoveryKey) {
          throw new Error("Unbound operation reference");
        }
        originKey = reference.originRecoveryKey;
        originScope = reference.draftScope;
      }
      let storageKey = articlePendingOperationStorageKey(actorId, originKey);
      if (!storageKey) throw new Error("Unavailable operation scope");
      let rawJournal = window.sessionStorage.getItem(storageKey);
      let sessionAlias: ReturnType<typeof parseArticlePendingOperationReference> = null;
      if (rawJournal) {
        const alias = parseArticlePendingOperationReference(JSON.parse(rawJournal));
        if (alias) {
          sessionAlias = alias;
          if (alias.actorId !== actorId || (article.id
            ? alias.context.articleId !== null && alias.context.articleId !== article.id
            : alias.draftScope !== scope || alias.originRecoveryKey !== operationRecoveryKey)) {
            throw new Error("Unbound tab operation alias");
          }
          originKey = alias.originRecoveryKey;
          originScope = alias.draftScope;
          storageKey = articlePendingOperationStorageKey(actorId, originKey);
          if (!storageKey) throw new Error("Unavailable original operation scope");
          rawJournal = window.sessionStorage.getItem(storageKey);
        }
      }
      recoveryOriginRef.current = { key: originKey, scope: originScope };
      if (!rawJournal) {
        if (!localReadable || reference?.actorId === actorId || sessionAlias) throw new Error("Missing original operation");
        operationRecoveryReadyRef.current = true;
        setOperationRecoveryError(false);
        saveBlockedRef.current = false;
        setSaveBlocked(false);
        return;
      }
      let journal = parseArticlePendingOperation(JSON.parse(rawJournal), {
        actorId, originRecoveryKey: originKey, draftScope: originScope,
      }, recoverySnapshotWithoutOperation(recoverySnapshot), editor.schema);
      if (!journal || reference?.actorId === actorId && !articleOperationReferenceMatches(reference, journal)
        || sessionAlias && !articleOperationReferenceMatches(sessionAlias, journal)) {
        throw new Error("Invalid original operation");
      }
      if (article.id && journal.context.articleId !== null && journal.context.articleId !== article.id) {
        throw new Error("Different article operation");
      }
      if (reference?.actorId === actorId && localCopy) {
        // Either storage can reject a later mirror. Validate local B against
        // the same original operation before selecting the newer full copy.
        // Backup time selects author input only; it never proves a DB revision.
        const localJournal = updateArticlePendingOperationSnapshot(journal,
          recoverySnapshotWithoutOperation(localCopy as ArticleRecoverySnapshot), editor.schema);
        if (!localJournal) throw new Error("Invalid local operation document");
        if (recoveryContentFingerprint(localJournal.latestSnapshotB)
          !== recoveryContentFingerprint(journal.latestSnapshotB)) {
          const localTime = localJournal.latestSnapshotB.savedAt;
          const tabTime = journal.latestSnapshotB.savedAt;
          if (typeof localTime !== "number" || typeof tabTime !== "number" || localTime === tabTime) {
            throw new Error("Unresolved operation recovery copies");
          }
          if (localTime > tabTime) journal = localJournal;
        }
      }
      pendingRecoveryJournalRef.current = journal;
      pendingSaveOperationRef.current = {
        formData: articlePendingOperationFormData(journal), snapshot: journal.snapshotA, context: journal.context,
      };
      hydratedOperationRef.current = true;
      // A new/copy operation on an existing article alias needs its own server
      // identity proof before its body can replace the freshly loaded article.
      pendingRecoveryNeedsApplyRef.current = Boolean(article.id && journal.context.articleId === null);
      if (!pendingRecoveryNeedsApplyRef.current
        && isUnchangedInitialRecoverySnapshot(recoverySnapshot)) {
        if (!applyRecoverySnapshot(journal.latestSnapshotB)) throw new Error("Unavailable recovery document");
        latestRecoverySnapshotRef.current = journal.latestSnapshotB;
      }
      operationRecoveryReadyRef.current = true;
      setOperationRecoveryError(false);
      markUnknownSaveOutcome();
    } catch {
      operationRecoveryReadyRef.current = true;
      operationRecoveryErrorRef.current = true;
      saveBlockedRef.current = true;
      setSaveBlocked(true);
      setOperationRecoveryError(true);
      setDraftStorageError("Не удалось проверить исходное сохранение. Новая запись заблокирована; текст и резервные копии сохранены. Повторите проверку хранилища или откройте сохранённую версию в новой вкладке.");
    }
  }, [actorId, article.id, editor, operationRecoveryAttempt, recoveryDraftScope, recoveryKey, recoverySnapshot, recoverySourceKey]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(LEGACY_TEMPLATES_KEY) || "[]"
      );
      if (Array.isArray(stored) && stored.length) {
        const candidates = stored.slice(0, 12);
        if (candidates.some((item: unknown) => !item || typeof item !== "object"
          || !("id" in item) || typeof item.id !== "string"
          || !("label" in item) || typeof item.label !== "string"
          || !("html" in item) || typeof item.html !== "string")) {
          throw new Error("Invalid local template shape");
        }
        const legacy = candidates.map((template: CustomTemplate) => ({
          ...template,
          id: `local-${template.id}`,
          localOnly: true,
          canDelete: true,
        }));
        setCustomTemplates((current) => [
          ...current,
          ...legacy.filter((item: CustomTemplate) =>
            !current.some((saved) => saved.label.toLocaleLowerCase("ru") === item.label.toLocaleLowerCase("ru"))
          ),
        ]);
      }
    } catch {
      // Do not delete unreadable templates, or access a denied storage getter again.
      setTemplateMessage("Не удалось прочитать локальные шаблоны. Существующие данные сохранены без изменений.");
    }
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const authorEvents = ["input", "change", "click", "keydown", "paste", "drop", "cut", "beforeinput"] as const;
    const trackAuthorEvent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const selectsGallery = event.type === "click"
        && target?.closest(".article-design-block.is-gallery, .article-design-block.is-slider")
        && !target.closest("button, input, select, textarea");
      const navigatesSelection = event instanceof KeyboardEvent
        && (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Escape", "Shift", "Control", "Alt", "Meta"].includes(event.key)
          || (event.ctrlKey || event.metaKey) && ["a", "c"].includes(event.key.toLowerCase()));
      if (selectsGallery || navigatesSelection) {
        authorInteractionRef.current = false;
        return;
      }
      authorInteractionRef.current = true;
      // Trusted DOM events can run a microtask checkpoint before TipTap handles
      // the same event. Keep its origin through dispatch and DOM observation.
      window.setTimeout(() => { authorInteractionRef.current = false; }, 0);
    };
    for (const name of authorEvents) form.addEventListener(name, trackAuthorEvent, true);
    return () => {
      for (const name of authorEvents) form.removeEventListener(name, trackAuthorEvent, true);
    };
  }, []);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty && !submissionInFlightRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    if (!recoveryKey || !isDirty
      || !hasAuthoredRecoveryEditsRef.current && !pendingRecoveryJournalRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        persistCurrentArticleRecovery(
          recoveryKey,
          {
            ...recoverySnapshot,
            savedAt: Date.now(),
            reason: "autosave",
          },
          recoveryDraftScope
        );
        setRecoverySourceKey(recoveryKey);
        setSavedLocallyAt(
          new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date())
        );
        setHasRecoveryCopy(true);
        setDraftStorageError("");
      } catch {
        setDraftStorageError(
          "Автосохранение в браузере не сработало. Нажмите «Сохранить» - текст и загруженные изображения останутся в черновике."
        );
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isDirty, recoveryDraftScope, recoveryKey, recoverySnapshot]);

  useEffect(() => {
    if (!recoveryKey) return;
    const flushRecoveryCopy = () => {
      const snapshot = latestRecoverySnapshotRef.current;
      if (!snapshot || !recoveryDirtyRef.current
        || !hasAuthoredRecoveryEditsRef.current && !pendingRecoveryJournalRef.current) return;
      try {
        persistCurrentArticleRecovery(
          recoveryKey,
          {
            ...snapshot,
            savedAt: Date.now(),
            reason: "page-hidden",
          },
          recoveryDraftScope
        );
        setRecoverySourceKey(recoveryKey);
      } catch {
        // The regular autosave reports storage failures while the page is visible.
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushRecoveryCopy();
    };

    window.addEventListener("pagehide", flushRecoveryCopy);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushRecoveryCopy);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [actorId, editor, isDirty, recoveryDraftScope, recoveryKey]);

  persistRecoveryOnUnmountRef.current = () => {
    const snapshot = latestRecoverySnapshotRef.current;
    if (!recoveryDirtyRef.current || !recoveryKey || !snapshot
      || !hasAuthoredRecoveryEditsRef.current && !pendingRecoveryJournalRef.current) return;
    try {
      persistCurrentArticleRecovery(recoveryKey,
        { ...snapshot, savedAt: Date.now(), reason: "editor-unmounted" }, recoveryDraftScope);
    } catch {
      // Keep the same fail-closed storage and original-operation guards on exit.
    }
  };
  useEffect(() => () => persistRecoveryOnUnmountRef.current?.(), []);

  const humanConfirmationInput = useMemo(() => ({
    article,
    englishTranslation,
    canonicalEnglishTranslation: canonicalEnglishTranslation === undefined && !article.working_draft_version
      ? englishTranslation : canonicalEnglishTranslation,
    current: recoverySnapshot,
  }), [article, canonicalEnglishTranslation, englishTranslation, recoverySnapshot]);
  const humanConfirmationKey = articleEnglishHumanConfirmationKey(humanConfirmationInput);
  const [previousHumanConfirmation, setPreviousHumanConfirmation] = useState<ArticleEnglishHumanConfirmation>({ key: null, confirmed: false });
  useEffect(() => {
    let current = true;
    void isPreviouslyHumanConfirmedArticleEnglish(humanConfirmationInput).then(confirmed => {
      if (current) setPreviousHumanConfirmation({ key: humanConfirmationKey, confirmed });
    });
    return () => { current = false; };
  }, [humanConfirmationInput, humanConfirmationKey]);
  const englishPreviouslyHumanConfirmed = matchesArticleEnglishHumanConfirmation(previousHumanConfirmation, humanConfirmationKey);

  const {
    checks: bilingualPublicationChecks,
    russianChecks,
    ready: publicationReady,
    russianReady: russianPublicationReady,
    russianWordCount,
    englishWordCount,
  } = useArticleValidation({
    title,
    slug,
    categoryId,
    contentHtml,
    contentJson,
    excerpt,
    coverUrl,
    coverAlt,
    seoDescription,
    sourceText,
    status,
    scheduledAt,
    englishEnabled,
    englishStatus,
    englishTitle,
    englishSubtitle,
    englishSlug,
    englishContentHtml,
    englishContentJson,
    englishExcerpt,
    englishCoverAlt,
    englishSeoTitle,
    englishSeoDescription,
    englishSeoKeywords,
    englishOgTitle,
    englishOgDescription,
    englishSourceText,
    englishBibliographyText,
    englishConfirmedCurrentSource,
    englishSourceContentHash: englishTranslation?.source_content_hash,
    englishPreviouslyHumanConfirmed,
    russianSourceChanged,
  });
  const wordCount =
    activeLocale === "en" ? englishWordCount : russianWordCount;
  const russianOnlyPublication =
    activeLocale === "ru" &&
    englishEnabled &&
    status !== "hidden" &&
    status !== "archived";
  const publicationChecks = russianOnlyPublication
    ? russianChecks
    : bilingualPublicationChecks;
  const publicationActionReady =
    status === "hidden" ||
    status === "archived" ||
    (russianOnlyPublication ? russianPublicationReady : publicationReady);
  const publicationActionLabel =
    status === "scheduled"
      ? russianOnlyPublication
        ? "Запланировать русскую публикацию"
        : "Запланировать публикацию"
      : status === "hidden"
        ? "Скрыть статью с сайта"
        : status === "archived"
          ? "Перенести статью в архив"
          : status === "published"
            ? russianOnlyPublication
              ? "Обновить русскую публикацию"
              : "Проверить и обновить публикацию"
            : russianOnlyPublication
              ? "Опубликовать на русском"
              : "Проверить и опубликовать";

  const workspaceDocument = useMemo(() => {
    const outline: Array<{
      id: string;
      label: string;
      level: 2 | 3;
      position: number;
    }> = [];
    let imageCount = 0;
    const documentNode = editor?.state.doc;

    documentNode?.descendants((node, position) => {
      if (node.type.name === "image") imageCount += 1;
      if (node.type.name !== "heading") return;
      const level = Number(node.attrs.level);
      if (level !== 2 && level !== 3) return;
      const label = node.textContent.replace(/\s+/gu, " ").trim();
      if (!label) return;
      outline.push({
        id: articleWorkspaceAnchor(label, outline.length),
        label,
        level,
        position: position + 1,
      });
    });

    const text = documentNode
      ? documentNode.textBetween(0, documentNode.content.size, " ", " ")
      : "";
    return {
      outline,
      metrics: articleWorkspaceDocumentMetrics(
        text,
        outline.length,
        imageCount
      ),
    };
  }, [activeLocale, contentJson, editor, englishContentJson]);
  const workspaceSaveState = `${wordCount.toLocaleString(
    activeLocale === "en" ? "en-US" : "ru-RU"
  )} ${activeLocale === "en" ? "английских слов" : "слов"}${
    savedLocallyAt ? ` · автокопия ${savedLocallyAt}` : ""
  }${isDirty ? " · изменения в форме ещё не подтверждены" : ""}`;
  const workspaceSnapshot = useMemo<ArticleEditorWorkspace["snapshot"]>(() => {
    const ready = publicationChecks.filter((item) => item.ok).length;
    return {
      locale: activeLocale,
      outline: workspaceDocument.outline.map(({ position: _position, ...item }) => item),
      missing: publicationChecks
        .filter((item) => !item.ok)
        .map((item) => ({
          label: item.label,
          locale: articleWorkspaceCheckLocale(item.label),
          section: articleWorkspaceCheckSection(item.label),
        })),
      metrics: workspaceDocument.metrics,
      ready,
      total: publicationChecks.length,
      saveState: workspaceSaveState,
      canSave: !isImageUploadActive && !savePending && !saveBlocked && !readUnavailable && !contentPreservationBlocked,
      canPreview: !isImageUploadActive && !savePending && !saveBlocked && !readUnavailable && !contentPreservationBlocked,
      canPublish: canPublish && publicationActionReady && !isImageUploadActive && !savePending && !saveBlocked && !readUnavailable && !contentPreservationBlocked,
    };
  }, [
    activeLocale,
    canPublish,
    contentPreservationBlocked,
    isImageUploadActive,
    publicationChecks,
    publicationActionReady,
    publicationReady,
    workspaceDocument,
    workspaceSaveState,
    savePending,
    saveBlocked,
    readUnavailable,
  ]);
  const submitWorkspaceSave = useCallback(() => {
    const submitter = saveSubmitButtonRef.current;
    if (!submitter || submitter.disabled) return;
    formRef.current?.requestSubmit(submitter);
  }, []);
  const submitWorkspacePublish = useCallback(() => {
    const submitter = publishSubmitButtonRef.current;
    if (!submitter || submitter.disabled) return;
    formRef.current?.requestSubmit(submitter);
  }, []);
  const previewWorkspaceArticle = useCallback(() => {
    const submitter = previewSubmitButtonRef.current;
    if (!submitter || submitter.disabled) return;
    formRef.current?.requestSubmit(submitter);
  }, []);
  const toggleWorkspaceFullscreen = useCallback(() => {
    setIsFullscreen((value) => !value);
  }, []);
  const goToWorkspaceHeading = useCallback(
    (id: string) => {
      const heading = workspaceDocument.outline.find((item) => item.id === id);
      if (!editor || !heading) return;
      editor
        .chain()
        .setTextSelection(heading.position)
        .scrollIntoView()
        .run();
    },
    [editor, workspaceDocument.outline]
  );
  const goToWorkspaceIssue = useCallback(
    (issue: ArticleWorkspaceGuidanceItem) => {
      if (issue.locale !== activeLocale) switchEditorLocale(issue.locale);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() =>
          scrollToWorkspaceSection(issue.section)
        );
      });
    },
    [activeLocale, scrollToWorkspaceSection, switchEditorLocale]
  );
  const workspaceActions = useMemo<ArticleEditorWorkspace["actions"]>(
    () => ({
      save: submitWorkspaceSave,
      preview: previewWorkspaceArticle,
      toggleFullscreen: toggleWorkspaceFullscreen,
      publish: submitWorkspacePublish,
      goToSection: scrollToWorkspaceSection,
      goToIssue: goToWorkspaceIssue,
      goToHeading: goToWorkspaceHeading,
    }),
    [
      goToWorkspaceHeading,
      goToWorkspaceIssue,
      previewWorkspaceArticle,
      scrollToWorkspaceSection,
      submitWorkspacePublish,
      submitWorkspaceSave,
      toggleWorkspaceFullscreen,
    ]
  );
  const articleEditorWorkspace = useMemo<ArticleEditorWorkspace>(
    () => ({ snapshot: workspaceSnapshot, actions: workspaceActions }),
    [workspaceActions, workspaceSnapshot]
  );
  useRegisterArticleEditorWorkspace(articleEditorWorkspace);

  const setLink = () => {
    setLinkDialogInitialValue(editor?.getAttributes("link") || {});
    setLinkDialogOpen(true);
  };

  const addImage = () => {
    if (!editor) return;
    rememberImageSelection();
    const selectedImage = imageSelectionRef.current.attributes;
    const imagePosition =
      imageSelectionRef.current.nodePos ??
      imageSelectionRef.current.insertionPos;
    const selectedAlt =
      typeof selectedImage.alt === "string" ? selectedImage.alt.trim() : "";
    setImageDialogInitialValue({
      src: typeof selectedImage.src === "string" ? selectedImage.src : "",
      alt: resolveEditorImageAltText({
        currentAlt: selectedAlt,
        suggestedAlt: suggestEditorImageAltText({
          document: editor.state.doc,
          position: imagePosition,
          title: activeLocale === "en" ? englishTitle : title,
          kind: "article",
          locale: activeLocale,
        }),
        decorative: selectedImage.decorative === true,
      }),
      caption: resolveEditorImageCaption({
        currentCaption: selectedImage.caption,
        suggestedCaption: suggestEditorImageCaption({
          document: editor.state.doc,
          position: imagePosition,
          title: activeLocale === "en" ? englishTitle : title,
          kind: "article",
          locale: activeLocale,
        }),
        decorative: selectedImage.decorative === true,
      }),
    });
    setImageDialogOpen(true);
  };

  const applyImageUrl = (value: EditorImageDialogValue) => {
    if (!editor) return;
    const selection = imageSelectionRef.current;
    const sourceChanged = Boolean(
      selection.selectedImage && value.src !== selection.expectedSrc
    );
    const attributes = {
      src: value.src,
      // Editing metadata keeps the media identity. A genuinely different URL
      // is detached from the previous library record and provenance.
      mediaId: sourceChanged
        ? null
        : typeof selection.attributes.mediaId === "string"
          ? selection.attributes.mediaId
          : null,
      alt: value.alt,
      caption: value.caption,
      ...(sourceChanged
        ? { credit: "", source: "", license: "", licenseUrl: "" }
        : {}),
      layout:
        typeof selection.attributes.layout === "string"
          ? (selection.attributes.layout as EditorialImageLayout)
          : "wide",
    };
    setImageDialogOpen(false);
    if (selection.selectedImage && typeof selection.nodePos === "number") {
      if (
        !updateEditorialImageAt(
          editor,
          selection.nodePos,
          attributes,
          selection.expectedSrc
        )
      ) {
        setTemplateMessage(
          "Выбранное изображение уже изменилось. Откройте его и повторите действие."
        );
        return;
      }
      setTemplateMessage("Выбранное изображение заменено.");
      return;
    }
    if (replaceSelectedMediaSlot(editor, attributes)) {
      setTemplateMessage("Место для изображения заполнено.");
      return;
    }
    if (insertImageAtRememberedPosition(attributes)) {
      setTemplateMessage(
        "Изображение вставлено точно в сохранённое место курсора."
      );
    }
  };

  const insertImageAtRememberedPosition = (attributes: {
    src: string;
    mediaId: string | null;
    alt: string;
    caption: string;
    layout: EditorialImageLayout;
  }) => {
    if (!editor) return false;
    const rememberedPosition = imageSelectionRef.current.insertionPos;
    const insertionPosition = Math.max(
      0,
      Math.min(
        typeof rememberedPosition === "number"
          ? rememberedPosition
          : editor.state.selection.from,
        editor.state.doc.content.size
      )
    );
    const inserted = editor
      .chain()
      .focus()
      .insertContentAt(insertionPosition, { type: "image", attrs: attributes })
      .run();
    if (!inserted) {
      setTemplateMessage(
        "Место курсора изменилось. Установите курсор и повторите вставку."
      );
    }
    return inserted;
  };

  const rememberImageSelection = () => {
    const selectedImage = Boolean(editor?.isActive("image"));
    const attributes = selectedImage ? editor?.getAttributes("image") || {} : {};
    imageSelectionRef.current = {
      selectedImage,
      attributes,
      locale: activeLocaleRef.current,
      expectedSrc:
        selectedImage && typeof attributes.src === "string"
          ? attributes.src
          : undefined,
      nodePos: selectedImage ? editor?.state.selection.from : undefined,
      insertionPos: selectedImage ? undefined : editor?.state.selection.from,
      mediaSlotPos: undefined,
    };
  };

  const openImagePicker = (target: ImageUploadTarget) => {
    setImageUploadError("");
    setImageUploadMessage("");
    if (target === "article") {
      editorMedia.openPicker();
      return;
    }
    coverFileInputRef.current?.click();
  };

  const uploadCoverImage = async (file: File) => {
    if (imageUploadInFlightRef.current) {
      setImageUploadError(
        "Одно изображение уже загружается. Дождитесь завершения и повторите действие."
      );
      return;
    }
    imageUploadInFlightRef.current = true;
    const uploadLocale = activeLocaleRef.current;
    const currentAlt = activeCoverAlt.trim();
    const altText = resolveEditorImageAltText({
      currentAlt,
      suggestedAlt: suggestEditorImageAltText({
        title: uploadLocale === "en" ? englishTitle : title,
        fileName: file.name,
        kind: "article",
        locale: uploadLocale,
      }),
    });

    setImageUploadTarget("cover");
    setImageUploadError("");
    setImageUploadMessage("Подготавливаем изображение без обрезки…");
    try {
      setImageUploadMessage("Загружаем подготовленное изображение…");
      const result = await uploadEditorImage(file, {
        usage: "cover",
        altText,
        collectionName: "Обложки статей",
      });

      setCoverUrl(result.url);
      markRussianSourceChanged();
      if (!activeCoverAlt.trim()) {
        if (uploadLocale === "en") setEnglishCoverAlt(altText);
        else setCoverAlt(altText);
      }
      setImageUploadMessage(
        `Обложка загружена и установлена.${result.preparation ? ` ${formatImagePreparation(result.preparation)}` : ""}`
      );
      markAuthoredRecoveryDirty();
    } catch (error) {
      setImageUploadMessage("");
      setImageUploadError(
        error instanceof Error ? error.message : "Не удалось загрузить изображение."
      );
    } finally {
      imageUploadInFlightRef.current = false;
      setImageUploadTarget(null);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  const addMediaCollection = (kind: "gallery" | "slider") => {
    setMediaComposerKind(kind);
    setMediaComposerValue("");
    setMediaComposerItems([]);
    setMediaComposerError("");
    setMediaComposerSettings(defaultEditorialGallerySettings(kind));
  };

  const closeMediaCollection = () => {
    setMediaComposerKind(null);
    setMediaComposerValue("");
    setMediaComposerItems([]);
    setMediaComposerError("");
  };

  const confirmMediaCollection = (settings: EditorialGallerySettings) => {
    if (!mediaComposerKind) return;
    const insertionPosition = editor?.state.selection.from ?? 0;
    const linkedItems = parseEditorialGalleryUrls(mediaComposerValue).map(
      (src) => {
        const fileName = src.split("/").pop() || "изображение";
        return {
          src,
          alt: suggestedArticleImageAlt(fileName, {
            position: insertionPosition,
          }),
          caption: suggestedArticleImageCaption(fileName, {
            position: insertionPosition,
          }),
        };
      }
    );
    const items = mergeEditorialGalleryItems(
      mediaComposerItems,
      linkedItems
    );
    if (!items.length) {
      setMediaComposerError("Загрузите или выберите хотя бы одно изображение.");
      return;
    }
    if (mediaComposerKind === "slider") {
      insertEditorialSlider(editor, items, "статье", settings);
    } else {
      insertEditorialGallery(editor, items, "статье", settings);
    }
    setTemplateMessage(
      mediaComposerKind === "slider"
        ? "Слайдер вставлен: на сайте появятся стрелки, точки и свайп."
        : "Галерея вставлена в материал."
    );
    closeMediaCollection();
  };

  const applyTemplate = (html: string, label: string) => {
    if (!editor) return;
    if (
      editor.getText().trim() &&
      !window.confirm(
        `Заменить текущий текст шаблоном «${label}»? Локальная резервная копия сохранится.`
      )
    ) {
      return;
    }
    if (recoveryKey) {
      const editorContent = {
        contentHtml: editor.getHTML(),
        contentJson: JSON.stringify(editor.getJSON()),
      };
      const snapshotBeforeTemplate: ArticleRecoverySnapshot =
        activeLocale === "en"
          ? {
              ...recoverySnapshot,
              english: {
                ...recoverySnapshot.english,
                ...editorContent,
              },
            }
          : {
              ...recoverySnapshot,
              ...editorContent,
            };
      try {
        persistCurrentArticleRecovery(
          recoveryKey,
          {
            ...snapshotBeforeTemplate,
            savedAt: Date.now(),
            reason: `before-template:${label}`,
          },
          recoveryDraftScope
        );
      } catch {
        setTemplateMessage("Не удалось сохранить резервную копию перед вставкой шаблона. Текущий текст оставлен без изменений.");
        return;
      }
      setRecoverySourceKey(recoveryKey);
      setHasRecoveryCopy(true);
    } else {
      setTemplateMessage("Резервная копия ещё не готова. Повторите вставку шаблона после загрузки редактора.");
      return;
    }
    editor.commands.setContent(html);
    editor.chain().focus("start").run();
    markAuthoredRecoveryDirty();
    setTemplateMessage(
      `Шаблон «${label}» вставлен. Замените редакционные подсказки своим текстом и изображениями.`
    );
  };

  const saveCustomTemplate = () => {
    if (!editor || !editor.getText().trim()) {
      window.alert("Сначала подготовьте структуру материала в редакторе.");
      return;
    }
    const label = window.prompt("Название собственного шаблона")?.trim();
    if (!label) return;
    const visibility = window.confirm("Сделать шаблон общим для всей редакции?") ? "shared" : "personal";
    setTemplateMessage("");
    startTemplateTransition(async () => {
      let result: Awaited<ReturnType<typeof saveEditorTemplateAction>>;
      try {
        result = await saveEditorTemplateAction({
          label: label.slice(0, 80),
          html: editor.getHTML(),
          json: editor.getJSON(),
          visibility,
        });
      } catch (error: unknown) {
        unstable_rethrow(error);
        setTemplateMessage("Не удалось подтвердить сохранение шаблона. Текст статьи оставлен в форме; перед повтором проверьте список шаблонов.");
        return;
      }
      if (!result) {
        setTemplateMessage("Не удалось подтвердить сохранение шаблона. Текст статьи оставлен в форме.");
        return;
      }
      if (result.error || !result.template) {
        setTemplateMessage(result.error || "Шаблон не сохранён.");
        return;
      }
      setCustomTemplates((current) => [
        ...current.filter((template) => template.label.toLocaleLowerCase("ru") !== result.template!.label.toLocaleLowerCase("ru")),
        result.template as CustomTemplate,
      ]);
      const legacy = customTemplates.filter((item) => item.localOnly && item.label !== result.template!.label);
      try {
        window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(legacy));
        setTemplateMessage("Шаблон сохранён в редакционной базе.");
      } catch {
        setTemplateMessage("Шаблон сохранён в редакционной базе. Браузер не дал обновить список локальных шаблонов.");
      }
    });
  };

  const clearCustomTemplates = () => {
    if (!customTemplates.length || !window.confirm("Удалить доступные собственные шаблоны? Общие шаблоны других редакторов сохранятся.")) return;
    startTemplateTransition(async () => {
      const deletable = customTemplates.filter((template) => template.canDelete && !template.localOnly);
      const results = await Promise.allSettled(deletable.map((template) => deleteEditorTemplateAction(template.id)));
      for (const result of results) {
        if (result.status === "rejected") unstable_rethrow(result.reason);
      }
      const failedIds = new Set(deletable.filter((_, index) => {
        const result = results[index];
        return result.status === "rejected" || result.value?.ok !== true;
      }).map((item) => item.id));
      let localDeleted = false;
      try {
        window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
        localDeleted = true;
      } catch {
        // Keep visible local templates when durable removal was not confirmed.
      }
      setCustomTemplates((current) => current.filter((template) => template.localOnly
        ? !localDeleted
        : !template.canDelete || failedIds.has(template.id)));
      setTemplateMessage(failedIds.size || !localDeleted
        ? "Удаление части шаблонов не подтверждено. Они оставлены в списке для проверки."
        : "Собственные шаблоны удалены.");
    });
  };

  function recoverySnapshotWithoutOperation(snapshot: ArticleRecoverySnapshot): ArticleRecoverySnapshot {
    const { pendingArticleOperation: _reference, recoveryActorId: _owner, ...content } = snapshot;
    return content;
  }

  function isUnchangedInitialRecoverySnapshot(snapshot: ArticleRecoverySnapshot) {
    const initial = initialRecoverySnapshotRef.current;
    if (!initial) return false;
    // Initial slug/canonical effects may finish before tab recovery. Ignore only
    // these derived values while their manual-edit flags still prove automation.
    const comparable = (value: ArticleRecoverySnapshot) => ({
      ...value,
      slug: !initial.slugEdited && !snapshot.slugEdited ? undefined : value.slug,
      canonicalUrl: !initial.canonicalEdited && !snapshot.canonicalEdited ? undefined : value.canonicalUrl,
      english: {
        ...value.english,
        slug: !initial.english.slugEdited && !snapshot.english.slugEdited ? undefined : value.english.slug,
        canonicalUrl: !initial.english.canonicalEdited && !snapshot.english.canonicalEdited
          ? undefined : value.english.canonicalUrl,
      },
    });
    return recoveryContentFingerprint(comparable(snapshot)) === recoveryContentFingerprint(comparable(initial));
  }

  function articleOperationReferenceMatches(
    reference: NonNullable<ReturnType<typeof parseArticlePendingOperationReference>>,
    journal: ArticlePendingOperation,
  ) {
    return reference.actorId === journal.actorId && reference.originRecoveryKey === journal.originRecoveryKey
      && reference.draftScope === journal.draftScope && reference.expiresAt === journal.expiresAt
      && reference.operationId === journal.context.operationId
      && reference.context.operationId === journal.context.operationId
      && reference.context.articleId === journal.context.articleId
      && reference.context.articleUpdatedAt === journal.context.articleUpdatedAt
      && reference.context.englishUpdatedAt === journal.context.englishUpdatedAt
      && reference.context.workingDraftVersion === journal.context.workingDraftVersion;
  }

  function persistSessionArticleOperation(journal: ArticlePendingOperation, targetKey = recoveryKey) {
    const key = articlePendingOperationStorageKey(journal.actorId, journal.originRecoveryKey);
    if (!key) throw new Error("Unavailable operation journal scope");
    const value = JSON.stringify(journal);
    window.sessionStorage.setItem(key, value);
    if (window.sessionStorage.getItem(key) !== value) throw new Error("Unconfirmed operation journal");
    if (targetKey !== journal.originRecoveryKey) {
      const aliasKey = articlePendingOperationStorageKey(journal.actorId, targetKey);
      if (!aliasKey) throw new Error("Unavailable operation alias scope");
      window.sessionStorage.setItem(aliasKey, JSON.stringify(articlePendingOperationReference(journal)));
    }
  }

  function persistCurrentArticleRecovery(key: string, snapshot: ArticleRecoverySnapshot, scope: string | null) {
    // An unreadable original operation is not permission to overwrite its B or
    // locator with a newly loaded canonical form during autosave/pagehide.
    if (actorId && (!operationRecoveryReadyRef.current || operationRecoveryErrorRef.current)) {
      throw new Error("Unverified original operation recovery");
    }
    const currentCopy = { ...snapshot, savedAt: Date.now() };
    const journal = pendingRecoveryJournalRef.current;
    let recovery = currentCopy;
    let sessionError: unknown;
    if (journal) {
      if (!editor) throw new Error("Unavailable recovery schema");
      const updated = updateArticlePendingOperationSnapshot(journal, recoverySnapshotWithoutOperation(currentCopy), editor.schema);
      if (!updated) throw new Error("Invalid operation recovery document");
      pendingRecoveryJournalRef.current = updated;
      recovery = { ...currentCopy, pendingArticleOperation: articlePendingOperationReference(updated) };
      try { persistSessionArticleOperation(updated, key); }
      catch (error) { sessionError = error; }
    }
    const serialized = JSON.stringify(recovery);
    persistArticleRecoverySnapshot(window.localStorage, key, serialized, scope, actorId);
    if (journal && key !== journal.originRecoveryKey) {
      persistArticleRecoverySnapshot(window.localStorage, journal.originRecoveryKey, serialized, journal.draftScope, actorId);
    }
    if (sessionError) throw sessionError;
  }

  const applyRecoverySnapshot = (value: unknown, fromOperationReconciliation = false) => {
    if (!editor || isImageUploadActive || submissionInFlightRef.current && !fromOperationReconciliation) return false;
    if (value && typeof value === "object" && Object.hasOwn(value, "recoveryActorId")
      && !canUseRecoveryCopy(value, actorId)) {
      setDraftStorageError("Эта локальная копия недоступна текущему пользователю. Текст в форме и копия сохранены без изменений.");
      return false;
    }
    if (value && typeof value === "object" && "pendingArticleOperation" in value) {
      const reference = parseArticlePendingOperationReference(value.pendingArticleOperation);
      const journal = pendingRecoveryJournalRef.current;
      if (!reference || reference.actorId !== actorId || !journal
        || !articleOperationReferenceMatches(reference, journal)) {
        setDraftStorageError("Исходное сохранение этой копии не проверено. Текущие данные и копия оставлены без изменений.");
        return false;
      }
    }
    const prepared = prepareArticleRecoverySnapshot(value, recoverySnapshot, editor.schema);
    if (!prepared) {
      setDraftStorageError("Резервная копия неполная или повреждена. Текущий текст и связанные данные оставлены в форме; копия сохранена для проверки.");
      return false;
    }
    const recovery = prepared.snapshot;
    switchingLocaleRef.current = true;
    try {
      if (!editor.commands.setContent(prepared.content, { emitUpdate: false })) return false;
    } catch {
      setDraftStorageError("Не удалось восстановить резервную копию. Текущие данные и копия сохранены для проверки.");
      return false;
    } finally {
      switchingLocaleRef.current = false;
    }
    const english = recovery.english;
    hasAuthoredRecoveryEditsRef.current = true;
    automaticMetadata.ru = createArticleMetadataAutomationState({
      excerpt: recovery.excerpt,
      seoTitle: recovery.seoTitle,
      seoDescription: recovery.seoDescription,
      seoKeywords: recovery.seoKeywords,
      ogTitle: recovery.ogTitle,
      ogDescription: recovery.ogDescription,
    });
    automaticMetadata.en = createArticleMetadataAutomationState({
      excerpt: english.excerpt,
      seoTitle: english.seoTitle,
      seoDescription: english.seoDescription,
      seoKeywords: english.seoKeywords,
      ogTitle: english.ogTitle,
      ogDescription: english.ogDescription,
    });
    setTitle(recovery.title);
    setSubtitle(recovery.subtitle);
    setExcerpt(recovery.excerpt);
    setSlug(recovery.slug);
    setSlugEdited(recovery.slugEdited);
    setCategoryId(recovery.categoryId);
    setContentHtml(recovery.contentHtml);
    setContentJson(
      recovery.contentJson || '{"type":"doc","content":[]}'
    );
    setStatus(recovery.status);
    setScheduledAt(recovery.scheduledAt);
    setFeatured(recovery.featured);
    setShowOnHomepage(recovery.showOnHomepage);
    setPinned(recovery.pinned);
    setCoverUrl(recovery.coverUrl);
    setCoverAlt(recovery.coverAlt);
    setSeoTitle(recovery.seoTitle);
    setSeoDescription(recovery.seoDescription);
    setSeoKeywords(recovery.seoKeywords);
    setCanonicalUrl(recovery.canonicalUrl);
    setCanonicalEdited(
      recovery.canonicalEdited
    );
    setOgTitle(recovery.ogTitle);
    setOgDescription(recovery.ogDescription);
    setSourceText(recovery.sourceText);
    setBibliographyText(recovery.bibliographyText);
    setLegacyPath(recovery.legacyPath);
    setAllowIndexing(recovery.allowIndexing);
    setRussianSourceChanged(recovery.russianSourceChanged);

    setEnglishEnabled(english.enabled);
    setEnglishTitle(english.title);
    setEnglishSubtitle(english.subtitle);
    setEnglishExcerpt(english.excerpt);
    setEnglishSlug(english.slug);
    setEnglishSlugEdited(english.slugEdited);
    setEnglishContentHtml(english.contentHtml);
    setEnglishContentJson(
      english.contentJson || '{"type":"doc","content":[]}'
    );
    setEnglishCoverAlt(english.coverAlt);
    setEnglishSeoTitle(english.seoTitle);
    setEnglishSeoDescription(english.seoDescription);
    setEnglishSeoKeywords(english.seoKeywords);
    setEnglishCanonicalUrl(english.canonicalUrl);
    setEnglishCanonicalEdited(
      english.canonicalEdited
    );
    setEnglishOgTitle(english.ogTitle);
    setEnglishOgDescription(english.ogDescription);
    setEnglishSourceText(english.sourceText);
    setEnglishBibliographyText(english.bibliographyText);
    setEnglishStatus(english.status);
    setEnglishConfirmedCurrentSource(
      english.confirmedCurrentSource
    );
    activeLocaleRef.current = recovery.activeLocale;
    setActiveLocale(recovery.activeLocale);
    setDraftStorageError("");
    markAuthoredRecoveryDirty();
    return true;
  };

  const restoreLocalCopy = () => {
    if (!recoverySourceKey) return;
    let stored: string | null;
    try {
      stored = readRecoveryCopy(window.localStorage, recoverySourceKey, actorId);
    } catch {
      setDraftStorageError("Браузер не дал прочитать резервную копию. Текущий текст оставлен в форме.");
      return;
    }
    if (!stored || !editor) return;
    try {
      const recovery: unknown = JSON.parse(stored);
      if (
        !window.confirm(
          "Восстановить локальную резервную копию? Текущий текст в редакторе будет заменён."
        )
      ) {
        return;
      }
      applyRecoverySnapshot(recovery);
    } catch {
      setDraftStorageError("Локальная копия повреждена. Текущие данные и копия сохранены для проверки.");
    }
  };

  function markUnknownSaveOutcome() {
    saveBlockedRef.current = true;
    setSaveBlocked(true);
    setHasPendingSaveOperation(pendingSaveOperationRef.current !== null);
    recoveryDirtyRef.current = true;
    markAuthoredRecoveryDirty();
    setSaveNotice("Не удалось подтвердить результат сохранения. Введённый текст оставлен в форме. Нажмите «Проверить результат сохранения»; новая отправка заблокирована до подтверждения.");
  }

  function acceptArticleSaveResponse(response: unknown, fromLookup = false) {
    const pending = pendingSaveOperationRef.current;
    if (!pending) { markUnknownSaveOutcome(); return; }
    const submittedSnapshot = pending.snapshot;
    const submittedContext = pending.context;
    const result = parseArticleSaveResult(response, submittedContext);
    // A failed lookup cannot prove that the original write was refused.
    if (!result || result.outcome === "unknown-outcome" || fromLookup && result.outcome !== "saved") {
      markUnknownSaveOutcome();
      return;
    }
    if (hydratedOperationRef.current) {
      const latest = latestRecoverySnapshotRef.current;
      if (!editor || !latest || !prepareArticleRecoverySnapshot(
        recoverySnapshotWithoutOperation(latest), recoverySnapshotWithoutOperation(latest), editor.schema,
      ) || result.outcome === "saved" && article.id && result.receipt.articleId !== article.id) {
        markUnknownSaveOutcome();
        return;
      }
      if (result.outcome === "saved" && pendingRecoveryNeedsApplyRef.current) {
        const journal = pendingRecoveryJournalRef.current;
        if (!journal) { markUnknownSaveOutcome(); return; }
        if (isUnchangedInitialRecoverySnapshot(latest)) {
          if (!applyRecoverySnapshot(journal.latestSnapshotB, true)) { markUnknownSaveOutcome(); return; }
          latestRecoverySnapshotRef.current = journal.latestSnapshotB;
        }
        pendingRecoveryNeedsApplyRef.current = false;
      }
    }
    pendingSaveOperationRef.current = null;
    setHasPendingSaveOperation(false);
    if (result.outcome === "saved") {
      const latestSnapshot = latestRecoverySnapshotRef.current;
      const hasNewerEdits = !submittedSnapshot || !latestSnapshot
        || recoveryContentFingerprint(latestSnapshot) !== recoveryContentFingerprint(submittedSnapshot);
      const englishSubmitted = pending.formData.get("english_enabled") === "on"
        && pending.formData.get("intent") !== "publish-ru";
      // A new EN revision may acknowledge only its status. Only the server's
      // explicit text acknowledgement can clear manually authored EN fields.
      const englishSaved = englishSubmitted && result.englishState === "saved";
      const privateDraft: ArticleWorkingDraftReceipt | undefined = result.receipt.workingDraft;
      const previousPrivateEnglish = privateEnglishSnapshotRef.current;
      let acknowledgedPrivateEnglish: ArticleRecoverySnapshot["english"] | null = null;
      if (privateDraft) {
        if (privateDraft.englishWrite === "saved" && englishSubmitted && submittedSnapshot) {
          acknowledgedPrivateEnglish = submittedSnapshot.english;
        } else if (privateDraft.englishWrite === "preserved"
          && previousPrivateEnglish?.version === submittedContext.workingDraftVersion) {
          // Retaining the prior body and its separate EN choice does not write
          // a changed submitted English body.
          acknowledgedPrivateEnglish = {
            ...previousPrivateEnglish.english, enabled: privateDraft.englishEnabled,
          };
        } else if (privateDraft.englishWrite === "preserved" && hydratedOperationRef.current
          && previousPrivateEnglish?.version === privateDraft.version
          && article.working_draft_scope === privateDraft.scope
          && compareArticleSaveRevisions(previousPrivateEnglish.updatedAt, privateDraft.updatedAt) === 0
          && article.updated_at && compareArticleSaveRevisions(article.updated_at, privateDraft.baseArticleUpdatedAt) === 0
          && (englishTranslation?.updated_at === privateDraft.englishExpectedUpdatedAt
            || englishTranslation?.updated_at && privateDraft.englishExpectedUpdatedAt
              && compareArticleSaveRevisions(englishTranslation.updated_at, privateDraft.englishExpectedUpdatedAt) === 0)) {
          // A fresh server-read private row may corroborate this original
          // receipt. Local journal baselines never supply that proof.
          acknowledgedPrivateEnglish = {
            ...previousPrivateEnglish.english, enabled: privateDraft.englishEnabled,
          };
        }
        privateEnglishSnapshotRef.current = acknowledgedPrivateEnglish ? {
          english: acknowledgedPrivateEnglish, version: privateDraft.version, updatedAt: privateDraft.updatedAt,
        } : null;
      } else if (result.persistence === "working-draft" && englishSaved && submittedSnapshot
        && result.receipt.workingDraftUpdatedAt) {
        // Full pre-metadata working-draft receipts keep their prior contract.
        privateEnglishSnapshotRef.current = {
          english: submittedSnapshot.english, version: result.receipt.workingDraftVersion,
          updatedAt: result.receipt.workingDraftUpdatedAt,
        };
      } else {
        privateEnglishSnapshotRef.current = null;
      }
      const canonicalEnglish = canonicalEnglishSnapshotRef.current;
      // The generated route of a proven initially absent EN can follow RU
      // category changes. An explicit URL and every authored field still count.
      const partialCanonicalEnglishBaseline = canonicalEnglish && initiallyAbsentEnglishRef.current
        && submittedSnapshot && !submittedSnapshot.english.canonicalEdited
        ? { ...canonicalEnglish, canonicalUrl: submittedSnapshot.english.canonicalUrl }
        : canonicalEnglish;
      const partialEnglishBaseline = acknowledgedPrivateEnglish ?? partialCanonicalEnglishBaseline;
      const acknowledgedSnapshot = submittedSnapshot && (englishSaved ? submittedSnapshot
        : partialEnglishBaseline ? {
            ...submittedSnapshot, english: partialEnglishBaseline,
          } : null);
      const hasUnconfirmedEnglish = !englishSaved && (!submittedSnapshot || !acknowledgedSnapshot
        || recoveryContentFingerprint(submittedSnapshot) !== recoveryContentFingerprint(acknowledgedSnapshot));
      setSavedIdentity({
        articleId: result.receipt.articleId,
        articleUpdatedAt: result.persistence === "working-draft"
          ? submittedContext.articleUpdatedAt : result.receipt.articleUpdatedAt,
        englishUpdatedAt: privateDraft ? privateDraft.englishExpectedUpdatedAt
          : result.receipt.englishUpdatedAt ?? submittedContext.englishUpdatedAt,
        workingDraftVersion: result.receipt.workingDraftVersion,
        canonicalStatus: result.receipt.canonicalStatus,
      });
      saveBlockedRef.current = false;
      setSaveBlocked(false);
      // The action acknowledges submitted A. Current B stays in this mounted
      // form; navigating automatically would race subsequent edits too.
      setSavedDestination(result.destination);
      if (acknowledgedSnapshot) {
        initialRecoveryFingerprintRef.current = recoveryContentFingerprint(acknowledgedSnapshot);
        initialRecoverySnapshotRef.current = acknowledgedSnapshot;
      }
      // A private ACK never replaces the separately proven canonical English.
      if (englishSaved && submittedSnapshot && result.persistence !== "working-draft") {
        canonicalEnglishSnapshotRef.current = submittedSnapshot.english;
        initiallyAbsentEnglishRef.current = false;
      }
      recoveryDirtyRef.current = hasNewerEdits || hasUnconfirmedEnglish;
      setIsDirty(hasNewerEdits || hasUnconfirmedEnglish);
      const publicationNotice = result.publicationState === "unknown" || result.publicationState === "queue-error"
        ? " Запись подтверждена, но выпуск на сайт не подтверждён."
        : result.publicationState === "started" || result.publicationState === "queued"
          ? " Запрос на выпуск передан; публичный результат проверяется отдельно." : "";
      const revalidationNotice = result.revalidationState === "unknown"
        ? " Обновление списка статей не подтверждено." : "";
      const privateEnglishNotice = privateDraft
        ? privateDraft.englishWrite === "saved"
          ? " Английский текст сохранён в рабочем черновике; он не выпущен."
          : " Предыдущий английский текст сохранён в рабочем черновике; он не выпущен."
        : "";
      setSaveNotice((hasNewerEdits
        ? "Отправленная версия сохранена. Более новые правки оставлены в форме и ещё не сохранены."
        : hasUnconfirmedEnglish
          ? "Русская версия сохранена. Ручные английские правки остаются в форме и ещё не подтверждены."
          : "Статья сохранена.") + privateEnglishNotice + publicationNotice + revalidationNotice);
      if (latestSnapshot) {
        const confirmedRecoveryKey = `probpera-editor-${result.receipt.articleId}`;
        try {
          persistCurrentArticleRecovery(confirmedRecoveryKey,
            { ...latestSnapshot, savedAt: Date.now(), reason: "after-save-response" }, null);
          setRecoveryKey(confirmedRecoveryKey);
          setRecoverySourceKey(confirmedRecoveryKey);
          setRecoveryDraftScope(null);
          setHasRecoveryCopy(true);
          setDraftStorageError("");
        } catch {
          setDraftStorageError("Статья сохранена, но резервная копия в браузере не записана. Более новые правки остаются в открытой форме.");
        }
      }
      return;
    }
    const refusedJournal = pendingRecoveryJournalRef.current;
    if (refusedJournal) {
      try {
        const key = articlePendingOperationStorageKey(refusedJournal.actorId, refusedJournal.originRecoveryKey);
        const latest = latestRecoverySnapshotRef.current;
        if (!key || !latest) throw new Error("Unavailable refused operation recovery");
        if (latest) {
          const serialized = JSON.stringify(withRecoveryCopyOwner(recoverySnapshotWithoutOperation(latest), actorId));
          persistArticleRecoverySnapshot(window.localStorage, recoveryKey, serialized, recoveryDraftScope, actorId);
          if (readRecoveryCopy(window.localStorage, recoveryKey, actorId) !== serialized) throw new Error("Unconfirmed recovery copy");
          if (recoveryKey !== refusedJournal.originRecoveryKey) {
            persistArticleRecoverySnapshot(window.localStorage, refusedJournal.originRecoveryKey, serialized, refusedJournal.draftScope, actorId);
            if (readRecoveryCopy(window.localStorage, refusedJournal.originRecoveryKey, actorId) !== serialized) {
              throw new Error("Unconfirmed original recovery copy");
            }
          }
        }
        // Every local locator is removed durably before its full tab journal.
        // On denied writes keep original A/B so reload cannot create an orphan.
        if (recoveryKey !== refusedJournal.originRecoveryKey) {
          const aliasKey = articlePendingOperationStorageKey(refusedJournal.actorId, recoveryKey);
          if (aliasKey) window.sessionStorage.removeItem(aliasKey);
        }
        window.sessionStorage.removeItem(key);
        pendingRecoveryJournalRef.current = null;
      } catch {
        setDraftStorageError("Сервер подтвердил отказ до записи, но состояние резервной копии в браузере не обновлено. Введённый текст сохранён в форме.");
      }
    }
    markAuthoredRecoveryDirty();
    if (result.outcome === "conflict") {
      saveBlockedRef.current = true;
      setSaveBlocked(true);
      setSaveNotice("Версия статьи или перевода изменилась. Запись не начиналась, введённый текст оставлен в форме. Откройте сохранённую версию в новой вкладке для сравнения.");
    } else if (result.outcome === "dependency-unavailable") {
      setSaveNotice("Не удалось проверить данные перед сохранением. Запись не начиналась, введённый текст оставлен в форме. Можно повторить сохранение.");
    } else {
      const reasons = {
        validation: "Проверьте обязательные поля статьи и длину текста.",
        "english-validation": "Проверьте обязательные поля английской версии.",
        content: "Проверьте содержимое русского оригинала.",
        "english-content": "Проверьте содержимое английской версии.",
        media: "Проверьте изображения, галереи и обязательные сведения о них.",
        permission: "Для этого действия недостаточно прав.",
        schedule: "Укажите дату и время запланированной публикации.",
      };
      setSaveNotice(`Сохранение не выполнено. ${reasons[result.reason]} Введённый текст оставлен в форме.`);
    }
  }

  function cloneArticleFormData(source: FormData) {
    const copy = new FormData();
    source.forEach((value, key) => copy.append(key, value));
    return copy;
  }

  async function saveArticle(formData: FormData) {
    if (actionRunningRef.current || saveBlockedRef.current || !operationRecoveryReadyRef.current) return;
    if (readUnavailableRef.current || contentPreservationBlockedRef.current) {
      submissionInFlightRef.current = false;
      return;
    }
    // Retain this request independently of the live form and later author edits.
    let operationId: string;
    try { operationId = window.crypto.randomUUID(); }
    catch {
      submissionInFlightRef.current = false;
      submittedRecoverySnapshotRef.current = null;
      setSaveNotice("Не удалось подготовить сохранение. Введённый текст оставлен в форме; запись не начиналась.");
      return;
    }
    const frozenFormData = cloneArticleFormData(formData);
    frozenFormData.set("article_operation_id", operationId);
    frozenFormData.set("article_result_mode", "receipt");
    if (actorId) {
      const origin = recoveryOriginRef.current;
      const submitted = submittedRecoverySnapshotRef.current;
      const latest = latestRecoverySnapshotRef.current;
      const journal = editor && origin && submitted && latest ? createArticlePendingOperation(
        frozenFormData, recoverySnapshotWithoutOperation(submitted),
        { ...recoverySnapshotWithoutOperation(latest), savedAt: Date.now(), reason: "before-operation" }, {
          actorId, originRecoveryKey: origin.key, draftScope: origin.scope,
          expiresAt: Date.now() + ARTICLE_PENDING_OPERATION_RETENTION_MS,
        }, editor.schema,
      ) : null;
      if (!journal || !latest) {
        submissionInFlightRef.current = false;
        submittedRecoverySnapshotRef.current = null;
        setSaveNotice("Не удалось подготовить полную копию исходного запроса. Введённый текст оставлен в форме; запись не начиналась.");
        return;
      }
      try { persistSessionArticleOperation(journal); }
      catch {
        submissionInFlightRef.current = false;
        submittedRecoverySnapshotRef.current = null;
        setDraftStorageError("Браузер не подтвердил сохранение исходного запроса. Запись статьи не начиналась; текст оставлен в форме. Разрешите хранилище вкладки и повторите сохранение.");
        return;
      }
      pendingRecoveryJournalRef.current = journal;
      hydratedOperationRef.current = false;
      pendingRecoveryNeedsApplyRef.current = false;
      try { persistCurrentArticleRecovery(recoveryKey, latest, recoveryDraftScope); }
      catch {
        setDraftStorageError("Локальная копия недоступна. Полный исходный запрос и текущий текст сохранены в хранилище этой вкладки; результат записи проверяется отдельно.");
      }
    }
    pendingSaveOperationRef.current = {
      formData: frozenFormData,
      snapshot: submittedRecoverySnapshotRef.current,
      context: {
        operationId,
        articleId: String(formData.get("id") || "") || null,
        articleUpdatedAt: String(formData.get("expected_updated_at") || "") || null,
        englishUpdatedAt: String(formData.get("english_expected_updated_at") || "") || null,
        workingDraftVersion: Number(formData.get("working_draft_version") || 0),
      },
    };
    actionRunningRef.current = true;
    submissionInFlightRef.current = true;
    setSavePending(true);
    setSaveNotice("Сохранение статьи...");
    try {
      const response: unknown = await saveArticleAction(cloneArticleFormData(frozenFormData));
      acceptArticleSaveResponse(response);
    } catch (error: unknown) {
      unstable_rethrow(error);
      markUnknownSaveOutcome();
    } finally {
      actionRunningRef.current = false;
      submissionInFlightRef.current = false;
      submittedRecoverySnapshotRef.current = null;
      setSavePending(false);
    }
  }

  async function checkPendingArticleSave() {
    const pending = pendingSaveOperationRef.current;
    if (!pending || actionRunningRef.current) return;
    actionRunningRef.current = true;
    submissionInFlightRef.current = true;
    setSavePending(true);
    setSaveNotice("Проверка результата сохранения...");
    try {
      const response: unknown = await checkArticleOperationAction(cloneArticleFormData(pending.formData));
      acceptArticleSaveResponse(response, true);
    } catch (error: unknown) {
      unstable_rethrow(error);
      markUnknownSaveOutcome();
    } finally {
      actionRunningRef.current = false;
      submissionInFlightRef.current = false;
      setSavePending(false);
    }
  }

  return (
    <ArticleEditorShell
      formRef={formRef}
      action={saveArticle}
      onReset={(event) => event.preventDefault()}
      fullscreen={isFullscreen}
      hidden={{
        identity: {
          id: savedIdentity.articleId || undefined,
          expectedUpdatedAt: savedIdentity.articleUpdatedAt || "",
          englishExpectedUpdatedAt: savedIdentity.englishUpdatedAt || "",
          workingDraftVersion: savedIdentity.workingDraftVersion,
          previewLocale: activeLocale,
        },
        publication: {
          previousStatus: savedIdentity.canonicalStatus,
          status,
          scheduledAt,
          featured,
          showOnHomepage,
          pinned,
          override: "0",
        },
        russian: {
          title,
          subtitle,
          excerpt,
          slug,
          contentHtml,
          contentJson,
          coverAlt,
          seoTitle,
          seoDescription,
          seoKeywords,
          canonicalUrl,
          ogTitle,
          ogDescription,
          sources: sourceText,
          bibliography: bibliographyText,
        },
        english: {
          enabled: englishEnabled,
          title: englishTitle,
          subtitle: englishSubtitle,
          excerpt: englishExcerpt,
          slug: englishSlug,
          contentHtml: englishContentHtml,
          contentJson: englishContentJson,
          coverAlt: englishCoverAlt,
          seoTitle: englishSeoTitle,
          seoDescription: englishSeoDescription,
          seoKeywords: englishSeoKeywords,
          canonicalUrl: englishCanonicalUrl,
          ogTitle: englishOgTitle,
          ogDescription: englishOgDescription,
          sources: englishSourceText,
          bibliography: englishBibliographyText,
          status: englishStatus,
          confirmedCurrentSource: englishConfirmedCurrentSource,
        },
      }}
      onSubmit={(event: ReactFormEvent<HTMLFormElement>) => {
        if (submissionInFlightRef.current || saveBlockedRef.current || readUnavailableRef.current || contentPreservationBlockedRef.current || !operationRecoveryReadyRef.current) {
          event.preventDefault();
          return;
        }
        if (isImageUploadActive) {
          event.preventDefault();
          setImageUploadError(
            "Дождитесь завершения загрузки изображения перед сохранением статьи."
          );
          return;
        }
        submittedRecoverySnapshotRef.current = latestRecoverySnapshotRef.current;
        if (recoveryKey) {
          const snapshot = latestRecoverySnapshotRef.current;
          try {
            if (snapshot) {
              persistCurrentArticleRecovery(
                recoveryKey,
                {
                  ...snapshot,
                  savedAt: Date.now(),
                  reason: "before-submit",
                },
                recoveryDraftScope
              );
              setRecoverySourceKey(recoveryKey);
            }
          } catch {
            setDraftStorageError("Локальная резервная копия не сохранена: браузер запретил запись. Результат отправки статьи проверяется отдельно.");
          }
          if (snapshot) {
            try {
              window.sessionStorage.setItem(
                PENDING_ARTICLE_SAVE_KEY,
                pendingArticleSaveValue(
                  recoveryKey,
                  snapshot,
                  recoveryDraftScope
                )
              );
            } catch {
              // This marker is not a receipt and never authorizes automatic cleanup.
            }
          }
        }
        submissionInFlightRef.current = true;
      }}
    >
      <input
        type="hidden"
        name="article_result_mode"
        value="receipt"
      />
      <input
        type="hidden"
        name="russian_publication_ready"
        value={russianPublicationReady ? "yes" : "no"}
      />
      <RecoveryController
        locator={{
          entityType: "article",
          entityId: savedIdentity.articleId,
          draftScope:
            savedIdentity.articleId || recoveryDraftScope || draftKey?.trim() || "new",
          localeScope: "bilingual",
          baseUpdatedAt: savedIdentity.articleUpdatedAt,
        }}
        snapshot={{ ...recoverySnapshot }}
        isDirty={isDirty && (hasAuthoredRecoveryEditsRef.current || pendingRecoveryJournalRef.current !== null)}
        savedAfterSubmit={false}
        onRestore={applyRecoverySnapshot}
      />

      {editor && contentPreservationBlocked && (
        <aside className="editor-save-error" role="alert">
          <p>Эта версия содержит данные, которые редактор не может сохранить без потерь. Исходные RU/EN оставлены без изменений; редактирование, сохранение, предпросмотр и публикация недоступны.</p>
          <details>
            <summary>Исходная копия статьи RU/EN</summary>
            <textarea aria-label="Исходная копия статьи RU/EN" readOnly rows={12}
              value={JSON.stringify({ article, englishTranslation: englishTranslation || null, canonicalEnglishTranslation: canonicalEnglishTranslation || null }, null, 2)} />
          </details>
        </aside>
      )}

      <TranslationPanel
        model={{
          activeLocale,
          switchingDisabled: !editor || isImageUploadActive,
          englishEnabled,
          englishStatus,
          englishLinkedToOriginal: Boolean(
            englishTranslation?.source_article_updated_at
          ),
          russianSourceChanged,
        }}
        actions={{ switchLocale: switchEditorLocale }}
      />

      <fieldset disabled={contentPreservationBlocked} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
      <div className="article-editor">
        <div className="editor-main">
          {activeLocale === "ru" && (
            <aside className="editor-copy-workflow" aria-labelledby="editor-copy-workflow-title">
              <div>
                <span className="eyebrow">Быстрый сценарий</span>
                <h2 id="editor-copy-workflow-title">
                  Структура и старые изображения остаются на своих местах
                </h2>
                <p>
                  Возьмите готовую статью за основу, перепишите текст, затем
                  щёлкните по каждой старой картинке и выберите «Заменить
                  изображение». Размер и положение сохранятся автоматически.
                </p>
              </div>
              {article.id && (
                <NextLink
                  className="button editor-copy-workflow-action"
                  href={`/articles/new?copyFrom=${encodeURIComponent(article.id)}`}
                >
                  Создать новую статью по этому образцу
                </NextLink>
              )}
              <ol aria-label="Три шага подготовки статьи">
                <li><strong>1</strong><span>Замените заголовок и текст</span></li>
                <li><strong>2</strong><span>Кликните по старым изображениям и замените файлы</span></li>
                <li><strong>3</strong><span>Проверьте и сохраните черновик</span></li>
              </ol>
            </aside>
          )}
          <section
            ref={(element) => registerWorkspaceSection("basics", element)}
            className="panel"
          >
            <label className="field">
              <span>
                {activeLocale === "en"
                  ? "Заголовок английской версии"
                  : "Заголовок"}
              </span>
              <input
                className="editor-title"
                value={activeTitle}
                maxLength={240}
                onChange={(event) => {
                  if (activeLocale === "en") {
                    setEnglishTitle(event.target.value);
                    if (event.target.value.trim()) setEnglishEnabled(true);
                  }
                  else {
                    setTitle(event.target.value);
                    markRussianSourceChanged();
                  }
                  markAuthoredRecoveryDirty();
                }}
                placeholder={
                  activeLocale === "en"
                    ? "Заголовок на английском языке"
                    : "Заголовок материала"
                }
                required={activeLocale === "ru"}
              />
            </label>
            <label className="field">
              <span>
                {activeLocale === "en"
                  ? "Подзаголовок английской версии"
                  : "Подзаголовок"}
              </span>
              <input
                value={activeSubtitle}
                onChange={(event) => {
                  if (activeLocale === "en") setEnglishSubtitle(event.target.value);
                  else {
                    setSubtitle(event.target.value);
                    markRussianSourceChanged();
                  }
                  markAuthoredRecoveryDirty();
                }}
                maxLength={360}
                placeholder={
                  activeLocale === "en"
                    ? "Необязательная строка на английском языке"
                    : "Необязательная строка под заголовком"
                }
              />
            </label>
            <label className="field">
              <span>
                {activeLocale === "en"
                  ? "Краткое описание английской версии"
                  : "Краткое описание"}
              </span>
              <textarea
                value={activeExcerpt}
                onChange={(event) => {
                  markMetadataFieldManual(activeLocale, "excerpt");
                  if (activeLocale === "en") setEnglishExcerpt(event.target.value);
                  else {
                    setExcerpt(event.target.value);
                    markRussianSourceChanged();
                  }
                  markAuthoredRecoveryDirty();
                }}
                maxLength={700}
                placeholder={
                  activeLocale === "en"
                    ? "Английский текст для карточек, поиска и социальных сетей"
                    : "Для карточек, поиска и социальных сетей"
                }
              />
            </label>
            <div className="article-metadata-assistant">
              <div>
                <strong>Описание и SEO</strong>
                <small>
                  Заполняются автоматически из заголовка и текста. Ручные
                  правки сохраняются; кнопка ниже пересобирает все поля по
                  вашему запросу. Внешние сервисы не используются.
                </small>
              </div>
              <button
                className="button-secondary"
                type="button"
                onClick={prepareArticleMetadata}
              >
                Пересобрать из текста
              </button>
              {metadataMessage && <small role="status">{metadataMessage}</small>}
            </div>
          </section>

          <EditorCore
            model={{
              activeLocale,
              editor,
              templates: articleTemplates,
              customTemplates,
              templatePending,
              templateMessage,
              imageUploadActive: isImageUploadActive,
              imageUploadBusy: editorMedia.busy,
              imageUploadMessage,
              imageUploadError,
              fullscreen: isFullscreen,
              imageDraggingOverEditor: isImageDraggingOverEditor,
            }}
            actions={{
              applyTemplate,
              saveCustomTemplate,
              clearCustomTemplates,
              openLink: setLink,
              uploadImage: () => openImagePicker("article"),
              openMediaLibrary: editorMedia.openLibrary,
              addImageByUrl: addImage,
              addGallery: () => addMediaCollection("gallery"),
              addSlider: () => addMediaCollection("slider"),
              toggleFullscreen: () => setIsFullscreen((value) => !value),
              handleFileInput: editorMedia.handleFileInput,
              rememberMediaSelection: editorMedia.rememberSelection,
              enqueueFiles: editorMedia.enqueueFiles,
              handleEditorDrop: editorMedia.handleDrop,
              handleEditorPaste: editorMedia.handlePaste,
              setImageDraggingOverEditor: setIsImageDraggingOverEditor,
            }}
            refs={{
              fileInputRef: editorMedia.fileInputRef,
              mediaSectionRef: (element) =>
                registerWorkspaceSection("media", element),
              textSectionRef: (element) =>
                registerWorkspaceSection("text", element),
            }}
          />
        </div>

        <aside className="editor-side">
          <PublishPanel
            locale={activeLocale}
            sectionRef={(element) =>
              registerWorkspaceSection("publish", element)
            }
            status={status}
            onStatusChange={(value) => {
              setStatus(value);
              markAuthoredRecoveryDirty();
            }}
            scheduledAt={scheduledAt}
            onScheduledAtChange={(value) => {
              setScheduledAt(value);
              markAuthoredRecoveryDirty();
            }}
            featured={featured}
            onFeaturedChange={(value) => {
              setFeatured(value);
              markAuthoredRecoveryDirty();
            }}
            showOnHomepage={showOnHomepage}
            onShowOnHomepageChange={(value) => {
              setShowOnHomepage(value);
              markAuthoredRecoveryDirty();
            }}
            pinned={pinned}
            onPinnedChange={(value) => {
              setPinned(value);
              markAuthoredRecoveryDirty();
            }}
            englishEnabled={englishEnabled}
            onEnglishEnabledChange={(value) => {
              setEnglishEnabled(value);
              markAuthoredRecoveryDirty();
            }}
            englishStatus={englishStatus}
            onEnglishStatusChange={(value) => {
              setEnglishStatus(value);
              markAuthoredRecoveryDirty();
            }}
            englishConfirmedCurrentSource={englishConfirmedCurrentSource}
            onEnglishConfirmedCurrentSourceChange={(value) => {
              setEnglishConfirmedCurrentSource(value);
              markAuthoredRecoveryDirty();
            }}
            englishApprovedAt={englishTranslation?.approved_at}
            canPublish={canPublish}
            canOverridePublicationChecklist={canOverridePublicationChecklist}
          />

          <section className="panel settings-stack">
            <h2>Рубрика</h2>
            <label className="field">
              <span>Основная рубрика</span>
              <select
                name="category_id"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  markAuthoredRecoveryDirty();
                }}
              >
                <option value="">Без рубрики</option>
                {categoryId && !categories.some((category) => category.id === categoryId) && (
                  <option value={categoryId}>Выбранная рубрика недоступна в списке</option>
                )}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          </section>

          <CoverEditor
            locale={activeLocale}
            sectionRef={(element) =>
              registerWorkspaceSection("cover", element)
            }
            fileInputRef={coverFileInputRef}
            coverUrl={coverUrl}
            coverAlt={activeCoverAlt}
            isUploading={imageUploadTarget === "cover"}
            uploadDisabled={isImageUploadActive}
            onOpenPicker={() => openImagePicker("cover")}
            onUploadFile={uploadCoverImage}
            onCoverUrlChange={setCoverUrl}
            onCoverAltChange={
              activeLocale === "en" ? setEnglishCoverAlt : setCoverAlt
            }
            markRussianSourceChanged={markRussianSourceChanged}
            markDirty={() => markAuthoredRecoveryDirty()}
          />

          <SeoPanel
            locale={activeLocale}
            sectionRef={(element) =>
              registerWorkspaceSection("seo", element)
            }
            title={activeLocale === "en" ? englishTitle : title}
            slug={activeSlug}
            slugEdited={
              activeLocale === "en" ? englishSlugEdited : slugEdited
            }
            generatedCanonical={
              activeLocale === "en"
                ? generatedEnglishCanonical
                : generatedCanonical
            }
            legacyPath={legacyPath}
            seoTitle={activeSeoTitle}
            seoDescription={activeSeoDescription}
            seoKeywords={activeSeoKeywords}
            canonicalUrl={activeCanonicalUrl}
            ogTitle={activeOgTitle}
            ogDescription={activeOgDescription}
            allowIndexing={allowIndexing}
            onLegacyPathChange={setLegacyPath}
            onAllowIndexingChange={setAllowIndexing}
            onSlugChange={
              activeLocale === "en" ? setEnglishSlug : setSlug
            }
            onSlugEditedChange={
              activeLocale === "en" ? setEnglishSlugEdited : setSlugEdited
            }
            onCanonicalEditedChange={
              activeLocale === "en"
                ? setEnglishCanonicalEdited
                : setCanonicalEdited
            }
            onSeoTitleChange={(value) => {
              markMetadataFieldManual(activeLocale, "seoTitle");
              if (activeLocale === "en") setEnglishSeoTitle(value);
              else setSeoTitle(value);
            }}
            onSeoDescriptionChange={(value) => {
              markMetadataFieldManual(activeLocale, "seoDescription");
              if (activeLocale === "en") setEnglishSeoDescription(value);
              else setSeoDescription(value);
            }}
            onSeoKeywordsChange={(value) => {
              markMetadataFieldManual(activeLocale, "seoKeywords");
              if (activeLocale === "en") setEnglishSeoKeywords(value);
              else setSeoKeywords(value);
            }}
            onOgTitleChange={(value) => {
              markMetadataFieldManual(activeLocale, "ogTitle");
              if (activeLocale === "en") setEnglishOgTitle(value);
              else setOgTitle(value);
            }}
            onOgDescriptionChange={(value) => {
              markMetadataFieldManual(activeLocale, "ogDescription");
              if (activeLocale === "en") setEnglishOgDescription(value);
              else setOgDescription(value);
            }}
            markRussianSourceChanged={markRussianSourceChanged}
            markDirty={() => markAuthoredRecoveryDirty()}
          />

          <ValidationChecklist
            sectionRef={(element) =>
              registerWorkspaceSection("quality", element)
            }
            englishEnabled={englishEnabled && !russianOnlyPublication}
            checks={publicationChecks}
            ready={
              russianOnlyPublication ? russianPublicationReady : publicationReady
            }
          />

          <SourceBibliographyEditor
            locale={activeLocale}
            sectionRef={(element) =>
              registerWorkspaceSection("sources", element)
            }
            sourceText={activeSourceText}
            bibliographyText={activeBibliographyText}
            onSourceTextChange={
              activeLocale === "en" ? setEnglishSourceText : setSourceText
            }
            onBibliographyTextChange={
              activeLocale === "en"
                ? setEnglishBibliographyText
                : setBibliographyText
            }
            markRussianSourceChanged={markRussianSourceChanged}
            markDirty={() => markAuthoredRecoveryDirty()}
          />
        </aside>
      </div>

      <GalleryEditor
        kind={editorMedia.dialogOpen ? null : mediaComposerKind}
        value={mediaComposerValue}
        error={mediaComposerError}
        settings={mediaComposerSettings}
        items={mediaComposerItems}
        onValueChange={(value) => {
          setMediaComposerValue(value);
          setMediaComposerError("");
        }}
        onSettingsChange={setMediaComposerSettings}
        onOpenMediaLibrary={() =>
          editorMedia.openCollectionLibrary(appendMediaComposerItems)
        }
        onUploadFiles={() =>
          editorMedia.openCollectionPicker(appendMediaComposerItems)
        }
        onMoveItem={(fromIndex, toIndex) =>
          setMediaComposerItems((current) =>
            reorderEditorialGalleryItems(current, fromIndex, toIndex)
          )
        }
        onRemoveItem={(index) =>
          setMediaComposerItems((current) =>
            current.filter((_, itemIndex) => itemIndex !== index)
          )
        }
        onCancel={closeMediaCollection}
        onConfirm={confirmMediaCollection}
      />

      <EditorLinkDialog
        open={linkDialogOpen}
        initialValue={linkDialogInitialValue}
        onCancel={() => setLinkDialogOpen(false)}
        onApply={(attributes: EditorLinkAttributes) => {
          setLinkDialogOpen(false);
          if (!editor) return;
          if (!attributes.href) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          } else {
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink(attributes)
              .run();
          }
          markAuthoredRecoveryDirty();
        }}
      />

      <EditorImageDialog
        open={imageDialogOpen}
        initialValue={imageDialogInitialValue}
        onCancel={() => setImageDialogOpen(false)}
        onApply={applyImageUrl}
      />

      <EditorMediaDialog
        open={editorMedia.dialogOpen}
        queue={editorMedia.queue}
        collectionMode={editorMedia.collectionMode}
        onClose={editorMedia.closeDialog}
        onPickFiles={editorMedia.pickForCurrentTarget}
        onSelectAsset={editorMedia.selectLibraryAsset}
        onCancelItem={editorMedia.cancelItem}
        onRetryItem={editorMedia.retryItem}
      />
      </fieldset>

      <footer className="editor-footer">
        <div className="editor-save-state" aria-live="polite">
          <small>{workspaceSaveState}</small>
          {readUnavailable && <small className="editor-save-error" role="alert">
            Данные статьи временно недоступны. Текст оставлен в форме; перед сохранением повторите проверку данных.
          </small>}
          {saveNotice && <small role="status">{saveNotice}</small>}
          {savedDestination && <NextLink href={savedDestination} target="_blank" rel="noopener noreferrer" prefetch={false}>
            {savedDestination.includes("/preview?") ? "Открыть сохранённый предпросмотр в новой вкладке" : "Открыть сохранённую версию в новой вкладке"}
          </NextLink>}
          {saveBlocked && (
            <NextLink
              href={article.id ? articleEditPath(article.id) : "/articles"}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
            >
              {article.id ? "Открыть сохранённую версию в новой вкладке" : "Проверить список статей в новой вкладке"}
            </NextLink>
          )}
          {draftStorageError && (
            <small className="editor-save-error" role="alert">
              {draftStorageError}
            </small>
          )}
        </div>
        <div className="editor-actions">
          {operationRecoveryError && (
            <button className="button-secondary" type="button" disabled={savePending}
              onClick={() => {
                operationRecoveryErrorRef.current = false;
                operationRecoveryReadyRef.current = false;
                setOperationRecoveryAttempt(attempt => attempt + 1);
              }}>
              Повторить проверку хранилища
            </button>
          )}
          {hasPendingSaveOperation && (
            <button
              className="button-secondary"
              type="button"
              onClick={checkPendingArticleSave}
              disabled={savePending}
            >
              Проверить результат сохранения
            </button>
          )}
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Восстановить локальную копию
            </button>
          )}
          <button
            ref={saveSubmitButtonRef}
            className="button-secondary"
            type="submit"
            name="intent"
            value="save"
            disabled={isImageUploadActive || savePending || saveBlocked || readUnavailable || contentPreservationBlocked}
          >
            Сохранить черновик
          </button>
          <button
            ref={previewSubmitButtonRef}
            className="button-secondary"
            type="submit"
            name="intent"
            value="preview"
            disabled={isImageUploadActive || savePending || saveBlocked || readUnavailable || contentPreservationBlocked}
          >
            Сохранить и открыть предпросмотр
          </button>
          {canPublish ? (
            <>
              <button
                ref={publishSubmitButtonRef}
                className="button"
                type="submit"
                name="intent"
                value={russianOnlyPublication ? "publish-ru" : "publish"}
                disabled={!publicationActionReady || isImageUploadActive || savePending || saveBlocked || readUnavailable || contentPreservationBlocked}
                title={
                  publicationActionReady
                    ? publicationActionLabel
                    : "Сначала заполните требования чек-листа"
                }
              >
                {publicationActionLabel}
              </button>
              {russianOnlyPublication && (
                <button
                  className="button-secondary"
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={!publicationReady || isImageUploadActive || savePending || saveBlocked || readUnavailable || contentPreservationBlocked}
                  title="Обе версии должны пройти редакционный контроль"
                >
                  {status === "scheduled"
                    ? "Запланировать обе версии"
                    : "Опубликовать обе версии"}
                </button>
              )}
              {canOverridePublicationChecklist && (
                <details className="publication-override-disclosure">
                  <summary>Дополнительные действия</summary>
                  <button
                    className="button-secondary"
                    type="submit"
                    name="intent"
                    value={russianOnlyPublication ? "publish-ru" : "publish"}
                    disabled={isImageUploadActive || savePending || saveBlocked || readUnavailable || contentPreservationBlocked}
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      const overrideInput = form?.querySelector(
                        'input[name="publication_override"]'
                      ) as HTMLInputElement | null;
                      if (overrideInput) overrideInput.value = "1";
                      if (
                        !window.confirm(
                          "Выпустить материал с ручным подтверждением редакционного чек-листа? Серверные проверки безопасности всё равно останутся обязательными."
                        )
                      ) {
                        event.preventDefault();
                        if (overrideInput) overrideInput.value = "0";
                      }
                    }}
                  >
                    Выпустить с ручным подтверждением
                  </button>
                </details>
              )}
            </>
          ) : (
            <small>
              После сохранения выберите статус «На проверке» - выпуск выполнит
              администратор.
            </small>
          )}
        </div>
      </footer>
    </ArticleEditorShell>
  );
}

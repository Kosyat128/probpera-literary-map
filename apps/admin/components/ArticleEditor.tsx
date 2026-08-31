"use client";

import type { JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import NextLink from "next/link";
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
import { saveArticleAction } from "@/app/(dashboard)/articles/actions";
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
  clearConfirmedArticleRecovery,
  pendingArticleSaveValue,
  PENDING_ARTICLE_SAVE_KEY,
  persistArticleRecoverySnapshot,
  recoveryContentFingerprint,
  resolveArticleDraftRecoverySource,
} from "@/lib/article-recovery";
import { withClientAdminPath } from "@/lib/admin-path";
import { uploadEditorImage } from "@/lib/editor-image-upload";
import type { EditorLinkAttributes } from "@/lib/editor-link";
import {
  defaultEditorialGallerySettings,
  mergeEditorialGalleryItems,
  parseEditorialGalleryUrls,
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
import { createRichEditorExtensions } from "@/components/rich-editor/RichEditorExtensions";
import RecoveryController from "@/components/editor/RecoveryController";
import EditorCore from "@/components/article-editor/EditorCore";
import ArticleEditorShell from "@/components/article-editor/ArticleEditorShell";
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
  approved_at?: string | null;
  published_at?: string | null;
};

type ArticleRecoverySnapshot = {
  version?: 2;
  activeLocale?: "ru" | "en";
  title?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  slugEdited?: boolean;
  categoryId?: string;
  contentHtml?: string;
  contentJson?: string;
  status?: string;
  scheduledAt?: string;
  featured?: boolean;
  showOnHomepage?: boolean;
  pinned?: boolean;
  coverUrl?: string;
  coverAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  canonicalEdited?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  sourceText?: string;
  bibliographyText?: string;
  russianSourceChanged?: boolean;
  english?: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    excerpt?: string;
    slug?: string;
    slugEdited?: boolean;
    contentHtml?: string;
    contentJson?: string;
    coverAlt?: string;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    canonicalUrl?: string;
    canonicalEdited?: boolean;
    ogTitle?: string;
    ogDescription?: string;
    sourceText?: string;
    bibliographyText?: string;
    status?: ArticleTranslation["status"];
    confirmedCurrentSource?: boolean;
  };
  savedAt?: number;
  reason?: string;
};

function mediaSlot(label: string, hint: string) {
  return `<section class="article-design-block is-media" data-editorial-block="media" data-reveal="fade-up"><h3>${label}</h3><p>${hint}</p></section>`;
}

function suggestedAltText(file: File) {
  const label = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return label.length >= 3 ? label.slice(0, 500) : "Иллюстрация к статье";
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

export default function ArticleEditor({
  article,
  englishTranslation,
  categories,
  publicSiteUrl,
  templates = [],
  draftKey,
  saveConfirmed = false,
}: {
  article: Article;
  englishTranslation?: ArticleTranslation;
  categories: Category[];
  publicSiteUrl: string;
  templates?: CustomTemplate[];
  draftKey?: string;
  saveConfirmed?: boolean;
}) {
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
    Boolean(englishTranslation?.id || englishTranslation?.title)
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
  const latestRecoverySnapshotRef = useRef<ArticleRecoverySnapshot | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(templates);
  const [templateMessage, setTemplateMessage] = useState("");
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
  const publishSubmitButtonRef = useRef<HTMLButtonElement>(null);
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
  const registerWorkspaceSection = useCallback(
    (section: ArticleWorkspaceSection, element: HTMLElement | null) => {
      workspaceSectionRefs.current[section] = element;
    },
    []
  );
  const scrollToWorkspaceSection = useCallback(
    (section: ArticleWorkspaceSection) => {
      workspaceSectionRefs.current[section]?.scrollIntoView({
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
    onUpdate({ editor: currentEditor }) {
      if (switchingLocaleRef.current) return;
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

  const editorMedia = useEditorMediaWorkflow({
    editor,
    collectionName: "Статьи",
    contextKey: activeLocale,
    suggestedAltText,
    onChanged: () => {
      setTemplateMessage(
        "Изображение готово. При необходимости выберите его и измените расположение."
      );
      setIsDirty(true);
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
    editor?.setEditable(imageUploadTarget === null && !editorMedia.busy);
  }, [editor, editorMedia.busy, imageUploadTarget]);

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

  useEffect(() => {
    if (article.id) {
      const articleRecoveryKey = `probpera-editor-${article.id}`;
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
        nextRecoveryKey
      );
    } catch {
      setDraftStorageError(
        "Браузер запретил доступ к локальным черновикам. Сохраняйте статью кнопкой чаще."
      );
    }
    setRecoveryKey(nextRecoveryKey);
    setRecoverySourceKey(nextRecoverySourceKey);
    setRecoveryDraftScope(scope);
  }, [article.id, draftKey]);

  useEffect(() => {
    if (!recoveryKey || !recoverySourceKey) return;
    if (saveConfirmed) {
      try {
        const { clearedCurrent } = clearConfirmedArticleRecovery(
          window.localStorage,
          window.sessionStorage,
          recoveryKey
        );
        if (clearedCurrent) {
          setHasRecoveryCopy(false);
          setSavedLocallyAt(null);
        }
        setDraftStorageError("");
      } catch {
        setDraftStorageError(
          "Статья сохранена, но браузер не дал удалить старую локальную копию."
        );
      }
    }

    try {
      setHasRecoveryCopy(
        Boolean(window.localStorage.getItem(recoverySourceKey))
      );
    } catch {
      setDraftStorageError(
        "Браузер запретил доступ к локальным черновикам. Сохраняйте статью кнопкой чаще."
      );
    }
  }, [recoveryKey, recoverySourceKey, saveConfirmed]);

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
      return;
    }
    if (fingerprint !== initialRecoveryFingerprintRef.current) {
      setIsDirty(true);
    }
  }, [recoverySnapshot]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(LEGACY_TEMPLATES_KEY) || "[]"
      );
      if (Array.isArray(stored) && stored.length) {
        const legacy = stored.slice(0, 12).map((template: CustomTemplate) => ({
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
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
    }
  }, []);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    if (!recoveryKey || !isDirty) return;
    const timer = window.setTimeout(() => {
      try {
        persistArticleRecoverySnapshot(
          window.localStorage,
          recoveryKey,
          JSON.stringify({
            ...recoverySnapshot,
            savedAt: Date.now(),
            reason: "autosave",
          }),
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
    if (!recoveryKey || !isDirty) return;
    const flushRecoveryCopy = () => {
      const snapshot = latestRecoverySnapshotRef.current;
      if (!snapshot) return;
      try {
        persistArticleRecoverySnapshot(
          window.localStorage,
          recoveryKey,
          JSON.stringify({
            ...snapshot,
            savedAt: Date.now(),
            reason: "page-hidden",
          }),
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
  }, [isDirty, recoveryDraftScope, recoveryKey]);

  const {
    checks: publicationChecks,
    ready: publicationReady,
    russianWordCount,
    englishWordCount,
  } = useArticleValidation({
    title,
    slug,
    categoryId,
    contentHtml,
    excerpt,
    coverUrl,
    coverAlt,
    seoDescription,
    sourceText,
    englishEnabled,
    englishStatus,
    englishTitle,
    englishSlug,
    englishContentHtml,
    englishExcerpt,
    englishCoverAlt,
    englishSeoDescription,
    englishSourceText,
    englishConfirmedCurrentSource,
    englishSourceContentHash: englishTranslation?.source_content_hash,
    russianSourceChanged,
  });
  const wordCount =
    activeLocale === "en" ? englishWordCount : russianWordCount;

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
  )} ${activeLocale === "en" ? "words" : "слов"}${
    savedLocallyAt ? ` · автокопия ${savedLocallyAt}` : ""
  }${isDirty ? " · изменения ещё не отправлены в редакционную базу" : ""}`;
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
      canSave: !isImageUploadActive,
      canPreview: Boolean(article.id),
      canPublish: publicationReady && !isImageUploadActive,
    };
  }, [
    activeLocale,
    article.id,
    isImageUploadActive,
    publicationChecks,
    publicationReady,
    workspaceDocument,
    workspaceSaveState,
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
    if (!article.id) return;
    window.open(
      withClientAdminPath(`/articles/${article.id}/preview?locale=${activeLocale}`),
      "_blank",
      "noopener,noreferrer"
    );
  }, [activeLocale, article.id]);
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
    setImageDialogInitialValue({
      src: typeof selectedImage.src === "string" ? selectedImage.src : "",
      alt: typeof selectedImage.alt === "string" ? selectedImage.alt : "",
      caption:
        typeof selectedImage.caption === "string" ? selectedImage.caption : "",
    });
    setImageDialogOpen(true);
  };

  const applyImageUrl = (value: EditorImageDialogValue) => {
    if (!editor) return;
    const selection = imageSelectionRef.current;
    const attributes = {
      src: value.src,
      // A manually supplied URL is no longer tied to the previously selected
      // media-library record.
      mediaId: null,
      alt: value.alt,
      caption: value.caption,
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
    const insertedAsLead = insertImageAtLogicalPosition(attributes);
    setTemplateMessage(
      insertedAsLead
        ? "Первая иллюстрация размещена после вступления и перед первым смысловым разделом."
        : "Изображение вставлено в материал."
    );
  };

  const insertImageAtLogicalPosition = (attributes: {
    src: string;
    mediaId: string | null;
    alt: string;
    caption: string;
    layout: EditorialImageLayout;
  }) => {
    if (!editor) return false;
    let hasImage = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "image") {
        hasImage = true;
        return false;
      }
      return !hasImage;
    });
    if (hasImage) {
      editor.chain().focus().setImage(attributes).run();
      return false;
    }

    let firstHeadingPosition: number | null = null;
    let firstBlockEnd: number | null = null;
    editor.state.doc.forEach((node, offset) => {
      if (firstBlockEnd === null) firstBlockEnd = offset + node.nodeSize;
      if (
        firstHeadingPosition === null &&
        node.type.name === "heading" &&
        Number(node.attrs.level || 0) === 2
      ) {
        firstHeadingPosition = offset;
      }
    });
    const insertionPosition =
      firstHeadingPosition ?? firstBlockEnd ?? editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .insertContentAt(insertionPosition, { type: "image", attrs: attributes })
      .run();
    return true;
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
      insertionPos: undefined,
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
    const altText = currentAlt.length >= 3 ? currentAlt : suggestedAltText(file);

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
      if (!activeCoverAlt.trim()) {
        if (uploadLocale === "en") setEnglishCoverAlt(altText);
        else setCoverAlt(altText);
      }
      setImageUploadMessage(
        "Обложка загружена, оптимизирована в WebP и установлена."
      );
      setIsDirty(true);
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
    const items = mergeEditorialGalleryItems(
      mediaComposerItems,
      parseEditorialGalleryUrls(mediaComposerValue)
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
      persistArticleRecoverySnapshot(
        window.localStorage,
        recoveryKey,
        JSON.stringify({
          ...snapshotBeforeTemplate,
          savedAt: Date.now(),
          reason: `before-template:${label}`,
        }),
        recoveryDraftScope
      );
      setRecoverySourceKey(recoveryKey);
      setHasRecoveryCopy(true);
    }
    editor.commands.setContent(html);
    editor.chain().focus("start").run();
    setIsDirty(true);
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
      const result = await saveEditorTemplateAction({
        label: label.slice(0, 80),
        html: editor.getHTML(),
        json: editor.getJSON(),
        visibility,
      });
      if (result.error || !result.template) {
        setTemplateMessage(result.error || "Шаблон не сохранён.");
        return;
      }
      setCustomTemplates((current) => [
        ...current.filter((template) => template.label.toLocaleLowerCase("ru") !== result.template!.label.toLocaleLowerCase("ru")),
        result.template as CustomTemplate,
      ]);
      const legacy = customTemplates.filter((item) => item.localOnly && item.label !== result.template!.label);
      window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(legacy));
      setTemplateMessage("Шаблон сохранён в редакционной базе.");
    });
  };

  const clearCustomTemplates = () => {
    if (!customTemplates.length || !window.confirm("Удалить доступные собственные шаблоны? Общие шаблоны других редакторов сохранятся.")) return;
    startTemplateTransition(async () => {
      const deletable = customTemplates.filter((template) => template.canDelete && !template.localOnly);
      const results = await Promise.all(deletable.map((template) => deleteEditorTemplateAction(template.id)));
      const failedIds = new Set(deletable.filter((_, index) => results[index]?.error).map((item) => item.id));
      setCustomTemplates((current) => current.filter((template) => !template.localOnly && (!template.canDelete || failedIds.has(template.id))));
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
      setTemplateMessage(failedIds.size ? "Часть шаблонов не удалось удалить." : "Собственные шаблоны удалены.");
    });
  };

  const applyRecoverySnapshot = (recovery: ArticleRecoverySnapshot) => {
    if (!editor) return;
      if (recovery.version === 2) {
        const english = recovery.english || {};
        setTitle(recovery.title ?? "");
        setSubtitle(recovery.subtitle ?? "");
        setExcerpt(recovery.excerpt ?? "");
        setSlug(recovery.slug ?? "");
        setSlugEdited(recovery.slugEdited ?? Boolean(recovery.slug));
        setCategoryId(recovery.categoryId ?? "");
        setContentHtml(recovery.contentHtml ?? "");
        setContentJson(
          recovery.contentJson || '{"type":"doc","content":[]}'
        );
        setStatus(recovery.status ?? "draft");
        setScheduledAt(recovery.scheduledAt ?? "");
        setFeatured(Boolean(recovery.featured));
        setShowOnHomepage(Boolean(recovery.showOnHomepage));
        setPinned(Boolean(recovery.pinned));
        setCoverUrl(recovery.coverUrl ?? "");
        setCoverAlt(recovery.coverAlt ?? "");
        setSeoTitle(recovery.seoTitle ?? "");
        setSeoDescription(recovery.seoDescription ?? "");
        setSeoKeywords(recovery.seoKeywords ?? "");
        setCanonicalUrl(recovery.canonicalUrl ?? "");
        setCanonicalEdited(
          recovery.canonicalEdited ?? Boolean(recovery.canonicalUrl)
        );
        setOgTitle(recovery.ogTitle ?? "");
        setOgDescription(recovery.ogDescription ?? "");
        setSourceText(recovery.sourceText ?? "");
        setBibliographyText(recovery.bibliographyText ?? "");
        setRussianSourceChanged(Boolean(recovery.russianSourceChanged));

        setEnglishEnabled(Boolean(english.enabled));
        setEnglishTitle(english.title ?? "");
        setEnglishSubtitle(english.subtitle ?? "");
        setEnglishExcerpt(english.excerpt ?? "");
        setEnglishSlug(english.slug ?? "");
        setEnglishSlugEdited(english.slugEdited ?? Boolean(english.slug));
        setEnglishContentHtml(english.contentHtml ?? "");
        setEnglishContentJson(
          english.contentJson || '{"type":"doc","content":[]}'
        );
        setEnglishCoverAlt(english.coverAlt ?? "");
        setEnglishSeoTitle(english.seoTitle ?? "");
        setEnglishSeoDescription(english.seoDescription ?? "");
        setEnglishSeoKeywords(english.seoKeywords ?? "");
        setEnglishCanonicalUrl(english.canonicalUrl ?? "");
        setEnglishCanonicalEdited(
          english.canonicalEdited ?? Boolean(english.canonicalUrl)
        );
        setEnglishOgTitle(english.ogTitle ?? "");
        setEnglishOgDescription(english.ogDescription ?? "");
        setEnglishSourceText(english.sourceText ?? "");
        setEnglishBibliographyText(english.bibliographyText ?? "");
        setEnglishStatus(english.status ?? "draft");
        setEnglishConfirmedCurrentSource(
          Boolean(english.confirmedCurrentSource)
        );
      } else {
        // Backward-compatible restore for the smaller recovery format that was
        // used before metadata snapshots were introduced.
        if (recovery.title !== undefined) setTitle(recovery.title);
        if (recovery.slug !== undefined) {
          setSlugEdited(true);
          setSlug(recovery.slug);
        }
        if (recovery.contentHtml !== undefined) {
          setContentHtml(recovery.contentHtml);
          setContentJson(
            recovery.contentJson || '{"type":"doc","content":[]}'
          );
        }
        if (recovery.title || recovery.slug || recovery.contentHtml) {
          markRussianSourceChanged();
        }
        if (recovery.english) {
          setEnglishEnabled(Boolean(recovery.english.enabled));
          setEnglishTitle(recovery.english.title || "");
          setEnglishSubtitle(recovery.english.subtitle || "");
          setEnglishExcerpt(recovery.english.excerpt || "");
          setEnglishSlug(recovery.english.slug || "");
          setEnglishSlugEdited(Boolean(recovery.english.slug));
          setEnglishContentHtml(recovery.english.contentHtml || "");
          setEnglishContentJson(
            recovery.english.contentJson || '{"type":"doc","content":[]}'
          );
        }
      }

      const restoredLocale =
        recovery.version === 2 && recovery.activeLocale === "en"
          ? "en"
          : recovery.version === 2 && recovery.activeLocale === "ru"
            ? "ru"
            : activeLocale;
      const restoredHtml =
        restoredLocale === "en"
          ? recovery.english?.contentHtml || ""
          : recovery.contentHtml || "";
      const restoredJson =
        restoredLocale === "en"
          ? recovery.english?.contentJson
          : recovery.contentJson;
      let restoredContent: JSONContent | string = restoredHtml;
      if (restoredJson) {
        try {
          const parsedContent = JSON.parse(restoredJson) as JSONContent;
          if (hasStructuredContent(parsedContent)) restoredContent = parsedContent;
        } catch {
          restoredContent = restoredHtml;
        }
      }
      activeLocaleRef.current = restoredLocale;
      setActiveLocale(restoredLocale);
      switchingLocaleRef.current = true;
      try {
        editor.commands.setContent(restoredContent);
      } finally {
        switchingLocaleRef.current = false;
      }
      setIsDirty(true);
  };

  const restoreLocalCopy = () => {
    if (!recoverySourceKey) return;
    const stored = window.localStorage.getItem(recoverySourceKey);
    if (!stored || !editor) return;
    try {
      const recovery = JSON.parse(stored) as ArticleRecoverySnapshot;
      if (
        !window.confirm(
          "Восстановить локальную резервную копию? Текущий текст в редакторе будет заменён."
        )
      ) {
        return;
      }
      applyRecoverySnapshot(recovery);
    } catch {
      window.alert("Локальная копия повреждена и не может быть восстановлена.");
    }
  };

  return (
    <ArticleEditorShell
      formRef={formRef}
      action={saveArticleAction}
      fullscreen={isFullscreen}
      hidden={{
        identity: {
          id: article.id,
          expectedUpdatedAt: article.updated_at || "",
          englishExpectedUpdatedAt: englishTranslation?.updated_at || "",
        },
        publication: {
          previousStatus: article.status || "draft",
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
        if (isImageUploadActive) {
          event.preventDefault();
          setImageUploadError(
            "Дождитесь завершения загрузки изображения перед сохранением статьи."
          );
          return;
        }
        if (recoveryKey) {
          const snapshot = latestRecoverySnapshotRef.current;
          try {
            if (snapshot) {
              persistArticleRecoverySnapshot(
                window.localStorage,
                recoveryKey,
                JSON.stringify({
                  ...snapshot,
                  savedAt: Date.now(),
                  reason: "before-submit",
                }),
                recoveryDraftScope
              );
              setRecoverySourceKey(recoveryKey);
            }
          } catch {
            // Server-side saving still proceeds when browser storage is unavailable.
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
              // The local draft itself remains available when session storage is blocked.
            }
          }
        }
        setIsDirty(false);
      }}
    >
      <RecoveryController
        locator={{
          entityType: "article",
          entityId: article.id || null,
          draftScope:
            article.id || recoveryDraftScope || draftKey?.trim() || "new",
          localeScope: "bilingual",
          baseUpdatedAt: article.updated_at || null,
        }}
        snapshot={{ ...recoverySnapshot }}
        isDirty={isDirty}
        savedAfterSubmit={saveConfirmed}
        onRestore={(snapshot) =>
          applyRecoverySnapshot(snapshot as ArticleRecoverySnapshot)
        }
      />

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
              <span>{activeLocale === "en" ? "Title" : "Заголовок"}</span>
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
                  setIsDirty(true);
                }}
                placeholder={
                  activeLocale === "en" ? "Article title" : "Заголовок материала"
                }
                required={activeLocale === "ru"}
              />
            </label>
            <label className="field">
              <span>{activeLocale === "en" ? "Subtitle" : "Подзаголовок"}</span>
              <input
                value={activeSubtitle}
                onChange={(event) => {
                  if (activeLocale === "en") setEnglishSubtitle(event.target.value);
                  else {
                    setSubtitle(event.target.value);
                    markRussianSourceChanged();
                  }
                  setIsDirty(true);
                }}
                maxLength={360}
                placeholder={
                  activeLocale === "en"
                    ? "Optional line below the title"
                    : "Необязательная строка под заголовком"
                }
              />
            </label>
            <label className="field">
              <span>
                {activeLocale === "en" ? "Short description" : "Краткое описание"}
              </span>
              <textarea
                value={activeExcerpt}
                onChange={(event) => {
                  if (activeLocale === "en") setEnglishExcerpt(event.target.value);
                  else {
                    setExcerpt(event.target.value);
                    markRussianSourceChanged();
                  }
                  setIsDirty(true);
                }}
                maxLength={700}
                placeholder={
                  activeLocale === "en"
                    ? "For cards, search, and social media"
                    : "Для карточек, поиска и социальных сетей"
                }
              />
            </label>
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
            onStatusChange={setStatus}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
            featured={featured}
            onFeaturedChange={setFeatured}
            showOnHomepage={showOnHomepage}
            onShowOnHomepageChange={setShowOnHomepage}
            pinned={pinned}
            onPinnedChange={setPinned}
            englishEnabled={englishEnabled}
            onEnglishEnabledChange={setEnglishEnabled}
            englishStatus={englishStatus}
            onEnglishStatusChange={setEnglishStatus}
            englishConfirmedCurrentSource={englishConfirmedCurrentSource}
            onEnglishConfirmedCurrentSourceChange={
              setEnglishConfirmedCurrentSource
            }
            englishApprovedAt={englishTranslation?.approved_at}
          />

          <section className="panel settings-stack">
            <h2>Рубрика</h2>
            <label className="field">
              <span>Основная рубрика</span>
              <select
                name="category_id"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Без рубрики</option>
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
            markDirty={() => setIsDirty(true)}
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
            legacyPath={article.legacy_path || ""}
            seoTitle={activeSeoTitle}
            seoDescription={activeSeoDescription}
            seoKeywords={activeSeoKeywords}
            canonicalUrl={activeCanonicalUrl}
            ogTitle={activeOgTitle}
            ogDescription={activeOgDescription}
            allowIndexing={article.allow_indexing !== false}
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
            onSeoTitleChange={
              activeLocale === "en" ? setEnglishSeoTitle : setSeoTitle
            }
            onSeoDescriptionChange={
              activeLocale === "en"
                ? setEnglishSeoDescription
                : setSeoDescription
            }
            onSeoKeywordsChange={
              activeLocale === "en" ? setEnglishSeoKeywords : setSeoKeywords
            }
            onOgTitleChange={
              activeLocale === "en" ? setEnglishOgTitle : setOgTitle
            }
            onOgDescriptionChange={
              activeLocale === "en"
                ? setEnglishOgDescription
                : setOgDescription
            }
            markRussianSourceChanged={markRussianSourceChanged}
            markDirty={() => setIsDirty(true)}
          />

          <ValidationChecklist
            sectionRef={(element) =>
              registerWorkspaceSection("quality", element)
            }
            englishEnabled={englishEnabled}
            checks={publicationChecks}
            ready={publicationReady}
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
            markDirty={() => setIsDirty(true)}
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
          setIsDirty(true);
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

      <footer className="editor-footer">
        <div className="editor-save-state" aria-live="polite">
          <small>{workspaceSaveState}</small>
          {draftStorageError && (
            <small className="editor-save-error" role="alert">
              {draftStorageError}
            </small>
          )}
        </div>
        <div className="editor-actions">
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Восстановить локальную копию
            </button>
          )}
          {article.id && (
            <NextLink
              className="button-secondary"
              href={`/articles/${article.id}/preview?locale=${activeLocale}`}
              target="_blank"
              rel="noreferrer"
            >
              {activeLocale === "en" ? "Preview EN" : "Предпросмотр RU"}
            </NextLink>
          )}
          <button
            ref={saveSubmitButtonRef}
            className="button-secondary"
            type="submit"
            name="intent"
            value="save"
            disabled={isImageUploadActive}
          >
            Сохранить
          </button>
          <button
            ref={publishSubmitButtonRef}
            className="button"
            type="submit"
            name="intent"
            value="publish"
            disabled={!publicationReady || isImageUploadActive}
            title={publicationReady ? "Опубликовать материал" : "Заполните требования чеклиста"}
          >
            Опубликовать
          </button>
          <button
            className="button"
            type="submit"
            name="intent"
            value="publish"
            title="Опубликовать без проверки"
            disabled={isImageUploadActive}
            onClick={(event) => {
              const form = event.currentTarget.form;
              const overrideInput = form?.querySelector("input[name=\"publication_override\"]") as HTMLInputElement | null;
              if (overrideInput) overrideInput.value = "1";
              if (!window.confirm("Действительно опубликовать эту статью без проверки готовности?")) {
                event.preventDefault();
                if (overrideInput) overrideInput.value = "0";
              }
            }}
          >
            Опубликовать сейчас
          </button>
        </div>
      </footer>
    </ArticleEditorShell>
  );
}

"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import NextLink from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkPageOperationAction, savePageAction } from "@/app/(dashboard)/pages/actions";
import { createSlug } from "@/lib/slug";
import { parsePageSaveResult } from "@/lib/page-save-result";
import { compareArticleSaveRevisions } from "@/lib/article-save-result";
import { capturePageOperationIntent } from "@/lib/page-operation-intent";
import { pageOperationStatus } from "@/lib/page-operation-result";
import { preparePageRecoverySnapshot, type PageRecoverySnapshot } from "@/lib/page-recovery-snapshot";
import { canUseRecoveryCopy, discardRecoveryCopy, persistRecoveryCopy, readRecoveryCopy,
  recoveryCopyOwnerState } from "@/lib/editor-recovery-owner";
import {
  createPagePendingOperation, pagePendingOperationFormData, pagePendingOperationReference,
  pagePendingOperationStorageKey, parsePagePendingOperation, parsePagePendingOperationReference,
  updatePagePendingOperationSnapshot, PAGE_PENDING_OPERATION_RETENTION_MS,
  type PagePendingOperation, type PagePendingOperationReference,
} from "@/lib/page-pending-operation";
import { CLIENT_IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/client-image-upload";
import {
  EditorialBlock,
  insertEditorialBlock,
  insertEditorialGallery,
  insertEditorialSlider,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import { ArticleTextTone } from "@/components/ArticleTextTone";
import { ArticleTypographyScope } from "@/components/ArticleTypographyScope";
import GalleryEditor, {
  type GalleryEditorKind,
} from "@/components/article-editor/GalleryEditor";
import {
  updateEditorialImageAt,
  type EditorialImageLayout,
} from "@/components/EditorialImage";
import EditorLinkDialog from "@/components/EditorLinkDialog";
import EditorImageDialog, {
  type EditorImageDialogValue,
} from "@/components/rich-editor/EditorImageDialog";
import { createRichEditorExtensions } from "@/components/rich-editor/RichEditorClientExtensions";
import RichEditorToolbar from "@/components/rich-editor/RichEditorToolbar";
import RecoveryController from "@/components/editor/RecoveryController";
import EditorMediaDialog from "@/components/EditorMediaDialog";
import { useEditorMediaWorkflow } from "@/components/useEditorMediaWorkflow";
import {
  articleTextTones,
  articleTypographyScopes,
} from "@/lib/article-content-presentation";
import type { EditorLinkAttributes } from "@/lib/editor-link";
import {
  resolveEditorImageCaption,
  resolveEditorImageAltText,
  suggestEditorImageCaption,
  suggestEditorImageAltText,
} from "@/lib/editor-image-naming";
import {
  defaultEditorialGallerySettings,
  mergeEditorialGalleryItems,
  parseEditorialGalleryUrls,
  reorderEditorialGalleryItems,
  type EditorialGalleryItemInput,
  type EditorialGallerySettings,
} from "@/lib/editorial-gallery";

type PageRecord = {
  id: string;
  updated_at: string;
  title?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  status?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  allow_indexing?: boolean;
};

type PageImageSelection = {
  attributes: Record<string, unknown>;
  expectedSrc?: string;
  nodePos?: number;
  insertionPos?: number;
};

type PendingPageSave = {
  formData: FormData; snapshot: PageRecoverySnapshot;
  context: { operationId?: string; pageId: string; expectedUpdatedAt: string };
};

function pageAuthorSnapshot(snapshot: PageRecoverySnapshot): PageRecoverySnapshot {
  const { version, title, excerpt, slug, slugEdited, contentHtml, contentJson, status,
    seoTitle, seoDescription, canonicalUrl, canonicalEdited, allowIndexing } = snapshot;
  return { version, title, excerpt, slug, slugEdited, contentHtml, contentJson, status,
    seoTitle, seoDescription, canonicalUrl, canonicalEdited, allowIndexing };
}
function pageSnapshotFingerprint(snapshot: PageRecoverySnapshot) {
  return JSON.stringify(pageAuthorSnapshot(snapshot));
}
function pageBackupTime(snapshot: PageRecoverySnapshot) {
  return typeof snapshot.savedAt === "number" ? snapshot.savedAt
    : typeof snapshot.savedAt === "string" ? Date.parse(snapshot.savedAt) : NaN;
}
function clonePageFormData(source: FormData) {
  const copy = new FormData(); source.forEach((value, key) => copy.append(key, value)); return copy;
}

function ToolbarButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {label}
    </button>
  );
}

export type PageEditorProps = {
  page: PageRecord;
  publicSiteUrl: string;
  catalogContext: { q: string; status: string; page: number; revisionPage: number };
  savedAfterSubmit?: boolean;
  actorId?: string;
  readUnavailable?: boolean;
};

export default function PageEditor({
  page,
  publicSiteUrl,
  catalogContext,
  actorId,
  readUnavailable = false,
}: PageEditorProps) {
  const [title, setTitle] = useState(page.title || "");
  const [slug, setSlug] = useState(page.slug || "");
  const [slugEdited, setSlugEdited] = useState(true);
  const generatedCanonical = `${publicSiteUrl}/stranitsy/${slug || "adres"}/`;
  const [canonicalUrl, setCanonicalUrl] = useState(
    page.canonical_url || generatedCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(
    Boolean(page.canonical_url && page.canonical_url !== generatedCanonical)
  );
  const [contentHtml, setContentHtml] = useState(page.content_html || "");
  const [contentJson, setContentJson] = useState(
    JSON.stringify(page.content_json || { type: "doc", content: [] })
  );
  const [excerpt, setExcerpt] = useState(page.excerpt || "");
  const [status, setStatus] = useState(page.status || "draft");
  const [seoTitle, setSeoTitle] = useState(page.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(
    page.seo_description || ""
  );
  const [allowIndexing, setAllowIndexing] = useState(
    page.allow_indexing !== false
  );
  const [isDirty, setIsDirty] = useState(false);
  const recoveryDirtyRef = useRef(isDirty);
  recoveryDirtyRef.current = isDirty;
  const discardedRecoveryFingerprintRef = useRef<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(page.updated_at);
  const [savePending, setSavePending] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [localCopyError, setLocalCopyError] = useState("");
  const submitPendingRef = useRef(false);
  const actionRunningRef = useRef(false);
  const saveBlockedRef = useRef(false);
  const submittedSnapshotRef = useRef<string | null>(null);
  const editorIdentity = `${page.id}:${actorId ?? "legacy"}`;
  const currentEntityRef = useRef(editorIdentity);
  currentEntityRef.current = editorIdentity;
  const pendingSaveRef = useRef<PendingPageSave | null>(null);
  const pendingJournalRef = useRef<PagePendingOperation | null>(null);
  const operationRecoveryReadyRef = useRef(!actorId);
  const operationRecoveryErrorRef = useRef(false);
  const preserveLocalCopyRef = useRef(false);
  const recoveryHydratedRef = useRef(false);
  const [operationRecoveryReady, setOperationRecoveryReady] = useState(!actorId);
  const [hasPendingSaveOperation, setHasPendingSaveOperation] = useState(false);
  const readUnavailableRef = useRef(readUnavailable);
  readUnavailableRef.current = readUnavailable;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogInitialValue, setLinkDialogInitialValue] = useState<
    Record<string, unknown>
  >({});
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageDialogInitialValue, setImageDialogInitialValue] =
    useState<EditorImageDialogValue>({ src: "", alt: "", caption: "" });
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
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
  const imageSelectionRef = useRef<PageImageSelection>({ attributes: {} });
  const previewParams = new URLSearchParams();
  if (catalogContext.q) previewParams.set("q", catalogContext.q);
  if (catalogContext.status) previewParams.set("status", catalogContext.status);
  if (catalogContext.page > 1) previewParams.set("page", String(catalogContext.page));
  if (catalogContext.revisionPage > 1) {
    previewParams.set("revision_page", String(catalogContext.revisionPage));
  }
  const previewHref = `/pages/${page.id}/preview${previewParams.size ? `?${previewParams.toString()}` : ""}`;
  const savedVersionHref = `/pages/${page.id}${previewParams.size ? `?${previewParams.toString()}` : ""}`;

  const recoverySnapshot = useMemo<PageRecoverySnapshot>(
    () => ({
      version: 2,
      title,
      excerpt,
      slug,
      slugEdited,
      contentHtml,
      contentJson,
      status,
      seoTitle,
      seoDescription,
      canonicalUrl,
      canonicalEdited,
      allowIndexing,
    }),
    [
      allowIndexing,
      canonicalEdited,
      canonicalUrl,
      contentHtml,
      contentJson,
      excerpt,
      seoDescription,
      seoTitle,
      slug,
      slugEdited,
      status,
      title,
    ]
  );

  const currentSnapshotRef = useRef("");
  currentSnapshotRef.current = JSON.stringify(recoverySnapshot);
  const initialAuthorSnapshotRef = useRef(pageAuthorSnapshot(recoverySnapshot));
  const latestSnapshotRef = useRef<PageRecoverySnapshot>(recoverySnapshot);
  if (pageSnapshotFingerprint(latestSnapshotRef.current) !== pageSnapshotFingerprint(recoverySnapshot)) {
    latestSnapshotRef.current = { ...recoverySnapshot, savedAt: Date.now() };
  }
  if (discardedRecoveryFingerprintRef.current !== null
    && discardedRecoveryFingerprintRef.current !== pageSnapshotFingerprint(recoverySnapshot)) {
    discardedRecoveryFingerprintRef.current = null;
  }

  function markUnknownOutcome() {
    saveBlockedRef.current = true;
    setSaveBlocked(true);
    setHasPendingSaveOperation(pendingSaveRef.current !== null);
    recoveryDirtyRef.current = true;
    setIsDirty(true);
    setSaveNotice("Не удалось подтвердить результат сохранения. Введённый текст оставлен в форме. Нажмите «Проверить результат сохранения»; новая отправка заблокирована до подтверждения.");
  }

  function persistSessionOperation(journal: PagePendingOperation) {
    const key = pagePendingOperationStorageKey(journal.actorId, journal.pageId);
    if (!key) throw new Error("Invalid operation scope");
    const serialized = JSON.stringify(journal);
    window.sessionStorage.setItem(key, serialized);
    if (window.sessionStorage.getItem(key) !== serialized) throw new Error("Unconfirmed operation journal");
  }

  function referenceMatches(reference: PagePendingOperationReference, journal: PagePendingOperation) {
    return reference.actorId === journal.actorId && reference.pageId === journal.pageId
      && reference.operationId === journal.context.operationId && reference.expiresAt === journal.expiresAt
      && reference.context.operationId === journal.context.operationId && reference.context.pageId === journal.context.pageId
      && reference.context.expectedUpdatedAt === journal.context.expectedUpdatedAt;
  }

  function writeLocalCopy(snapshot: PageRecoverySnapshot) {
    if (preserveLocalCopyRef.current) throw new Error("Preserved original local copy");
    const key = `probpera-page-editor-${page.id}`;
    persistRecoveryCopy(window.localStorage, key, snapshot, actorId);
  }

  function acceptSaveResponse(response: unknown, fromLookup = false) {
    const pending = pendingSaveRef.current;
    if (!pending || operationRecoveryErrorRef.current) { markUnknownOutcome(); return; }
    const result = parsePageSaveResult(response, pending.context.pageId, pending.context.expectedUpdatedAt, pending.context.operationId);
    if (!result || result.outcome === "unknown-outcome" || fromLookup && result.outcome !== "saved") {
      markUnknownOutcome(); return;
    }
    if (result.outcome === "saved") {
      const intent = capturePageOperationIntent(pending.formData);
      if (pending.context.operationId && (!intent || result.receipt.canonicalStatus !== pageOperationStatus(intent)
        || compareArticleSaveRevisions(result.receipt.updatedAt, pending.context.expectedUpdatedAt) !== 1)) {
        markUnknownOutcome(); return;
      }
      const latest = latestSnapshotRef.current;
      if (!editor || !preparePageRecoverySnapshot(pageAuthorSnapshot(latest), editor.schema)) {
        markUnknownOutcome(); return;
      }
      const acknowledged = { ...pending.snapshot, status: result.receipt.canonicalStatus ?? pending.snapshot.status };
      const hasNewerEdits = pageSnapshotFingerprint(latest) !== pageSnapshotFingerprint(pending.snapshot)
        && pageSnapshotFingerprint(latest) !== pageSnapshotFingerprint(acknowledged);
      // Only this own receipt can replace the original expected database revision.
      setExpectedUpdatedAt(result.receipt.updatedAt);
      saveBlockedRef.current = false;
      setSaveBlocked(false);
      pendingSaveRef.current = null;
      setHasPendingSaveOperation(false);
      recoveryDirtyRef.current = hasNewerEdits;
      setIsDirty(hasNewerEdits);
      if (!hasNewerEdits && pending.formData.get("intent") === "publish") setStatus("published");
      const notices = [hasNewerEdits
        ? "Отправленная версия сохранена. В форме остались новые несохранённые изменения."
        : "Отправленная версия сохранена."];
      if (result.auditState !== "recorded") notices.push("Запись в журнале действий не подтверждена.");
      if (result.publicationState === "started") notices.push("Сборка сайта запущена.");
      else if (result.publicationState === "queued") notices.push("Обновление сайта поставлено в очередь.");
      else notices.push("Запуск обновления сайта не подтверждён.");
      if (result.revalidationState === "scheduled") notices.push("Обновление списка страниц запланировано.");
      else if (result.revalidationState !== "complete") notices.push("Обновление представлений админки не подтверждено.");
      setSaveNotice(notices.join(" "));
      // Retain A/B after ACK too: another reload must consult the server again.
      return;
    }
    const journal = pendingJournalRef.current;
    if (journal) {
      try {
        if (!editor || !preparePageRecoverySnapshot(pageAuthorSnapshot(latestSnapshotRef.current), editor.schema)) throw new Error("Invalid latest copy");
        // Keep full B durably before removing its locator and original tab journal.
        writeLocalCopy({ ...pageAuthorSnapshot(latestSnapshotRef.current), savedAt: Date.now() });
        const key = pagePendingOperationStorageKey(journal.actorId, journal.pageId);
        if (!key) throw new Error("Invalid operation scope");
        window.sessionStorage.removeItem(key);
        if (window.sessionStorage.getItem(key) !== null) throw new Error("Unconfirmed journal cleanup");
        pendingJournalRef.current = null;
      } catch {
        setLocalCopyError("Браузер не подтвердил сохранение полной копии перед завершением операции. Исходный запрос и текст оставлены для проверки.");
        markUnknownOutcome(); return;
      }
    }
    pendingSaveRef.current = null;
    setHasPendingSaveOperation(false);
    setIsDirty(true);
    if (result.outcome === "conflict") {
      saveBlockedRef.current = true;
      setSaveBlocked(true);
      setSaveNotice("Сохранение не выполнено: версия страницы изменилась или недоступна. Введённый текст оставлен в форме. Откройте сохранённую версию в новой вкладке для сравнения.");
    } else if (result.outcome === "dependency-unavailable") {
      setSaveNotice("Сервис сохранения временно недоступен. Запись не начиналась, введённый текст оставлен в форме. Можно повторить сохранение.");
    } else {
      const reasons = {
        validation: "Проверьте обязательные поля, адрес и длину текста.",
        content: "Проверьте содержимое страницы перед сохранением.",
        media: "Проверьте изображения и галереи страницы.",
        "publication-media": "Для публикации проверьте описание изображений и обязательные сведения о них.",
      };
      setSaveNotice(`Сохранение не выполнено. ${reasons[result.reason]} Введённый текст оставлен в форме.`);
    }
  }

  async function savePage(formData: FormData) {
    if (actionRunningRef.current || saveBlockedRef.current || !operationRecoveryReadyRef.current) return;
    if (readUnavailableRef.current) {
      submitPendingRef.current = false;
      submittedSnapshotRef.current = null;
      return;
    }
    const submittedIdentity = editorIdentity;
    const frozenFormData = clonePageFormData(formData);
    let submitted: PageRecoverySnapshot;
    try {
      submitted = JSON.parse(submittedSnapshotRef.current ?? currentSnapshotRef.current);
      if (actorId) {
        frozenFormData.set("page_operation_id", window.crypto.randomUUID());
        frozenFormData.set("page_result_mode", "receipt");
        const journal = editor && createPagePendingOperation(frozenFormData, pageAuthorSnapshot(submitted),
          { ...pageAuthorSnapshot(latestSnapshotRef.current), savedAt: Date.now(), reason: "before-operation" },
          { actorId, pageId: page.id, expiresAt: Date.now() + PAGE_PENDING_OPERATION_RETENTION_MS }, editor.schema);
        if (!journal) throw new Error("Invalid original operation copy");
        persistSessionOperation(journal);
        pendingJournalRef.current = journal;
        try { writeLocalCopy({ ...journal.latestSnapshotB, pendingPageOperation: pagePendingOperationReference(journal) }); }
        catch { setLocalCopyError("Локальная копия недоступна. Исходный запрос и текст сохранены в хранилище этой вкладки; результат записи проверяется отдельно."); }
      }
    } catch {
      submitPendingRef.current = false;
      submittedSnapshotRef.current = null;
      setLocalCopyError("Браузер не подтвердил сохранение полной копии исходного запроса. Запись страницы не начиналась; введённый текст оставлен в форме.");
      return;
    }
    pendingSaveRef.current = { formData: frozenFormData, snapshot: submitted, context: {
      pageId: page.id, expectedUpdatedAt: String(formData.get("expected_updated_at") ?? ""),
      ...(actorId ? { operationId: String(frozenFormData.get("page_operation_id")) } : {}),
    } };
    actionRunningRef.current = true;
    submitPendingRef.current = true;
    setSavePending(true);
    setSaveNotice("Сохранение страницы...");
    try {
      const response: unknown = await savePageAction(clonePageFormData(frozenFormData));
      if (currentEntityRef.current === submittedIdentity) acceptSaveResponse(response);
    } catch (error: unknown) {
      unstable_rethrow(error);
      if (currentEntityRef.current === submittedIdentity) markUnknownOutcome();
    } finally {
      actionRunningRef.current = false;
      submitPendingRef.current = false;
      submittedSnapshotRef.current = null;
      setSavePending(false);
    }
  }

  async function checkPendingSave() {
    const pending = pendingSaveRef.current;
    if (!pending || actionRunningRef.current || !operationRecoveryReadyRef.current || readUnavailableRef.current) return;
    const submittedIdentity = editorIdentity;
    actionRunningRef.current = true;
    submitPendingRef.current = true;
    setSavePending(true);
    setSaveNotice("Проверка результата сохранения...");
    try {
      const response: unknown = await checkPageOperationAction(clonePageFormData(pending.formData));
      if (currentEntityRef.current === submittedIdentity) acceptSaveResponse(response, true);
    } catch (error) {
      unstable_rethrow(error);
      if (currentEntityRef.current === submittedIdentity) markUnknownOutcome();
    } finally {
      actionRunningRef.current = false;
      submitPendingRef.current = false;
      setSavePending(false);
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichEditorExtensions({
      placeholder:
        "Напишите содержимое страницы. Подзаголовки, списки и ссылки помогут сделать материал удобным.",
      afterStarterKit: [EditorialBlock],
      afterImage: [ArticleTextTone, ArticleTypographyScope],
    }),
    content: page.content_json || page.content_html || "",
    onUpdate({ editor: currentEditor }) {
      setContentHtml(currentEditor.getHTML());
      setContentJson(JSON.stringify(currentEditor.getJSON()));
      setIsDirty(true);
    },
  });
  const persistLocalCopy = useCallback(() => {
    if (!operationRecoveryReadyRef.current || operationRecoveryErrorRef.current) return false;
    if (!pendingJournalRef.current && discardedRecoveryFingerprintRef.current
      === pageSnapshotFingerprint(latestSnapshotRef.current)) return false;
    try {
      const current = { ...pageAuthorSnapshot(latestSnapshotRef.current), savedAt: Date.now() };
      if (!editor || !preparePageRecoverySnapshot(current, editor.schema)) throw new Error("Invalid latest document");
      const journal = pendingJournalRef.current;
      let recovery = current as PageRecoverySnapshot;
      let sessionError: unknown;
      if (journal) {
        const updated = updatePagePendingOperationSnapshot(journal, current, editor.schema);
        if (!updated) throw new Error("Invalid operation copy");
        pendingJournalRef.current = updated;
        recovery = { ...current, pendingPageOperation: pagePendingOperationReference(updated) };
        try { persistSessionOperation(updated); } catch (error) { sessionError = error; }
      }
      // Preserve a foreign local copy while still updating this actor's tab journal.
      // If the tab mirror fails, a full later B and its locator still survive locally.
      writeLocalCopy(recovery);
      if (sessionError) throw sessionError;
      setHasRecoveryCopy(true);
      setLocalCopyError("");
      return true;
    } catch {
      setLocalCopyError("Браузер не подтвердил сохранение полной локальной копии. Не закрывайте вкладку до подтверждения сохранения страницы.");
      return false;
    }
  }, [actorId, editor, page.id]);
  const persistLocalCopyOnUnmountRef = useRef(persistLocalCopy);
  persistLocalCopyOnUnmountRef.current = persistLocalCopy;
  useEffect(() => () => {
    if (recoveryDirtyRef.current) persistLocalCopyOnUnmountRef.current();
  }, []);
  const suggestedPageImageAlt = useCallback(
    (fileName: string, context: { position: number }) =>
      suggestEditorImageAltText({
        document: editor?.state.doc,
        position: context.position,
        title,
        fileName,
        kind: "page",
      }),
    [editor, title]
  );
  const suggestedPageImageCaption = useCallback(
    (fileName: string, context: { position: number }) =>
      suggestEditorImageCaption({
        document: editor?.state.doc,
        position: context.position,
        title,
        fileName,
        kind: "page",
      }),
    [editor, title]
  );
  const editorMedia = useEditorMediaWorkflow({
    editor,
    collectionName: "Страницы сайта",
    metadataLocale: "ru",
    suggestedAltText: suggestedPageImageAlt,
    suggestedCaptionText: suggestedPageImageCaption,
    onChanged: () => setIsDirty(true),
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
  const imageUploadPending = editorMedia.busy;

  useEffect(() => {
    if (!slugEdited) setSlug(createSlug(title));
  }, [slugEdited, title]);

  useEffect(() => {
    if (!canonicalEdited) {
      setCanonicalUrl(`${publicSiteUrl}/stranitsy/${slug || "adres"}/`);
    }
  }, [canonicalEdited, publicSiteUrl, slug]);

  useEffect(() => {
    if (!editor || recoveryHydratedRef.current) return;
    recoveryHydratedRef.current = true;
    try {
      const rawLocal = readRecoveryCopy(window.localStorage, `probpera-page-editor-${page.id}`, actorId);
      let local: unknown = rawLocal ? JSON.parse(rawLocal) : null;
      if (local && !canUseRecoveryCopy(local, actorId)) {
        if (recoveryCopyOwnerState(local, actorId) === "invalid") throw new Error("Invalid recovery owner");
        local = null;
      }
      setHasRecoveryCopy(Boolean(local));
      const hasReference = local !== null && typeof local === "object" && Object.hasOwn(local, "pendingPageOperation");
      const reference = hasReference ? parsePagePendingOperationReference((local as PageRecoverySnapshot).pendingPageOperation) : null;
      if (hasReference && !reference) throw new Error("Invalid local operation locator");
      const key = actorId ? pagePendingOperationStorageKey(actorId, page.id) : null;
      if (actorId && !key) throw new Error("Invalid actor scope");
      const rawJournal = key ? window.sessionStorage.getItem(key) : null;
      if (reference && (reference.actorId !== actorId || reference.pageId !== page.id)) {
        if (rawJournal) throw new Error("Mismatched original operation locator");
        setHasRecoveryCopy(false);
        operationRecoveryReadyRef.current = true;
        setOperationRecoveryReady(true);
        return;
      }
      if (!actorId) return;
      if (!rawJournal) {
        if (reference) throw new Error("Missing original operation journal");
        if (local && !preparePageRecoverySnapshot(local, editor.schema)) preserveLocalCopyRef.current = true;
        operationRecoveryReadyRef.current = true;
        setOperationRecoveryReady(true);
        return;
      }
      let journal = parsePagePendingOperation(JSON.parse(rawJournal), { actorId, pageId: page.id }, editor.schema);
      if (!journal || reference && !referenceMatches(reference, journal)) throw new Error("Invalid original operation journal");
      if (local) {
        const prepared = preparePageRecoverySnapshot(local, editor.schema);
        if (!prepared) throw new Error("Invalid later document");
        const candidate = { ...pageAuthorSnapshot(prepared.snapshot), savedAt: prepared.snapshot.savedAt };
        const localJournal = updatePagePendingOperationSnapshot(journal, candidate, editor.schema);
        if (!localJournal) throw new Error("Invalid later operation copy");
        if (pageSnapshotFingerprint(candidate) !== pageSnapshotFingerprint(journal.latestSnapshotB)) {
          const localTime = pageBackupTime(candidate), tabTime = pageBackupTime(journal.latestSnapshotB);
          if (!reference || !Number.isFinite(localTime) || !Number.isFinite(tabTime) || localTime === tabTime) throw new Error("Ambiguous later author copy");
          if (localTime > tabTime) journal = localJournal;
        }
      }
      // Fields entered while the actual editor was loading take precedence over
      // B only where the author changed the initial form. Unchanged fields keep
      // the complete stored body, media and manually authored metadata of B.
      const initial = initialAuthorSnapshotRef.current;
      const current = pageAuthorSnapshot(latestSnapshotRef.current);
      if (pageSnapshotFingerprint(current) !== pageSnapshotFingerprint(initial)) {
        const merged: Record<string, unknown> = { ...journal.latestSnapshotB, savedAt: Date.now() };
        for (const key of Object.keys(current) as Array<keyof PageRecoverySnapshot>) {
          if (current[key] !== initial[key]) merged[key] = current[key];
        }
        const prepared = preparePageRecoverySnapshot(merged, editor.schema);
        const updated = prepared && updatePagePendingOperationSnapshot(journal, prepared.snapshot, editor.schema);
        if (!updated) throw new Error("Invalid early author changes");
        journal = updated;
      }
      // Every scalar, both documents and the original request are valid before mutation.
      pendingJournalRef.current = journal;
      pendingSaveRef.current = { formData: pagePendingOperationFormData(journal), snapshot: journal.snapshotA,
        context: journal.context };
      if (!applyRecoveryCopy(journal.latestSnapshotB, true)) throw new Error("Unavailable recovery document");
      latestSnapshotRef.current = journal.latestSnapshotB;
      setExpectedUpdatedAt(journal.context.expectedUpdatedAt);
      operationRecoveryReadyRef.current = true;
      setOperationRecoveryReady(true);
      markUnknownOutcome();
    } catch {
      operationRecoveryErrorRef.current = true;
      preserveLocalCopyRef.current = true;
      saveBlockedRef.current = true;
      setSaveBlocked(true);
      setLocalCopyError("Исходный запрос или резервная копия неполные, повреждены либо недоступны. Текущий текст и хранилище оставлены без изменений; сохранение остановлено.");
    }
  }, [actorId, editor, page.id]);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty && !submitPendingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setInterval(persistLocalCopy, 12_000);
    return () => window.clearInterval(timer);
  }, [isDirty, persistLocalCopy]);

  useEffect(() => {
    if (pendingJournalRef.current && !operationRecoveryErrorRef.current) persistLocalCopy();
  }, [persistLocalCopy, recoverySnapshot]);

  useEffect(() => {
    const flush = () => {
      if (isDirty || pendingJournalRef.current) persistLocalCopy();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [isDirty, persistLocalCopy]);

  function applyRecoveryCopy(value: unknown, fromOperation = false) {
    if (!editor || actionRunningRef.current && !fromOperation || operationRecoveryErrorRef.current) return false;
    if (value && typeof value === "object" && Object.hasOwn(value, "recoveryActorId")
      && !canUseRecoveryCopy(value, actorId)) {
      setLocalCopyError("Эта локальная копия недоступна текущему пользователю. Текст в форме и копия сохранены без изменений.");
      return false;
    }
    if (value && typeof value === "object" && Object.hasOwn(value, "pendingPageOperation")) {
      const reference = parsePagePendingOperationReference((value as PageRecoverySnapshot).pendingPageOperation);
      if (!reference || reference.actorId !== actorId || !pendingJournalRef.current || !referenceMatches(reference, pendingJournalRef.current)) {
        setLocalCopyError("Исходная операция этой копии не проверена. Текущий текст и копия сохранены без изменений.");
        return false;
      }
    }
    const prepared = preparePageRecoverySnapshot(value, editor.schema);
    if (!prepared) {
      preserveLocalCopyRef.current = true;
      setLocalCopyError("Резервная копия неполная или повреждена. Текущий текст и связанные данные оставлены в форме; копия сохранена для проверки.");
      return false;
    }
    try {
      if (!editor.commands.setContent(prepared.content, { emitUpdate: false })) return false;
    } catch {
      setLocalCopyError("Не удалось восстановить копию. Текущий текст и копия оставлены для проверки.");
      return false;
    }
    const recovery = prepared.snapshot;
    setTitle(recovery.title);
    setExcerpt(recovery.excerpt);
    setSlug(recovery.slug);
    setSlugEdited(recovery.slugEdited);
    setStatus(recovery.status);
    setSeoTitle(recovery.seoTitle);
    setSeoDescription(recovery.seoDescription);
    setCanonicalUrl(recovery.canonicalUrl);
    setCanonicalEdited(recovery.canonicalEdited);
    setAllowIndexing(recovery.allowIndexing);
    setContentHtml(recovery.contentHtml || editor.getHTML());
    setContentJson(recovery.contentJson || JSON.stringify(editor.getJSON()));
    latestSnapshotRef.current = recovery;
    setLocalCopyError("");
    setIsDirty(true);
    return true;
  }

  function restoreLocalCopy() {
    try {
      const raw = readRecoveryCopy(window.localStorage, `probpera-page-editor-${page.id}`, actorId);
      if (!raw || !editor) return;
      applyRecoveryCopy(JSON.parse(raw));
    } catch {
      setLocalCopyError("Не удалось восстановить локальную копию. Копия оставлена в хранилище браузера.");
    }
  }

  function setLink() {
    if (!editor) return;
    setLinkDialogInitialValue(editor.getAttributes("link") || {});
    setLinkDialogOpen(true);
  }

  function rememberImageSelection() {
    if (!editor) return;
    const selectedImage = editor.isActive("image");
    const attributes = selectedImage ? editor.getAttributes("image") || {} : {};
    imageSelectionRef.current = {
      attributes,
      expectedSrc:
        selectedImage && typeof attributes.src === "string"
          ? attributes.src
          : undefined,
      nodePos: selectedImage ? editor.state.selection.from : undefined,
      insertionPos: selectedImage ? undefined : editor.state.selection.from,
    };
  }

  function openImagePicker() {
    setImageUploadError("");
    setImageUploadMessage("");
    editorMedia.openPicker();
  }

  function openImageUrlDialog() {
    if (!editor || editorMedia.busy) return;
    setImageUploadError("");
    setImageUploadMessage("");
    rememberImageSelection();
    const attributes = imageSelectionRef.current.attributes;
    const imagePosition =
      imageSelectionRef.current.nodePos ??
      imageSelectionRef.current.insertionPos;
    const selectedAlt =
      typeof attributes.alt === "string" ? attributes.alt.trim() : "";
    setImageDialogInitialValue({
      src: typeof attributes.src === "string" ? attributes.src : "",
      alt: resolveEditorImageAltText({
        currentAlt: selectedAlt,
        suggestedAlt: suggestEditorImageAltText({
          document: editor.state.doc,
          position: imagePosition,
          title,
          kind: "page",
        }),
        decorative: attributes.decorative === true,
      }),
      caption: resolveEditorImageCaption({
        currentCaption: attributes.caption,
        suggestedCaption: suggestEditorImageCaption({
          document: editor.state.doc,
          position: imagePosition,
          title,
          kind: "page",
        }),
        decorative: attributes.decorative === true,
      }),
    });
    setImageDialogOpen(true);
  }

  function applyImageUrl(value: EditorImageDialogValue) {
    if (!editor) return;
    const selection = imageSelectionRef.current;
    const sourceChanged = Boolean(
      typeof selection.nodePos === "number" && value.src !== selection.expectedSrc
    );
    const attributes = {
      ...selection.attributes,
      src: value.src,
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
    if (typeof selection.nodePos === "number") {
      if (
        !updateEditorialImageAt(
          editor,
          selection.nodePos,
          attributes,
          selection.expectedSrc
        )
      ) {
        setImageUploadError(
          "Выбранное изображение уже изменилось. Откройте его и повторите действие."
        );
        return;
      }
      setImageUploadMessage("Выбранное изображение заменено HTTPS-ссылкой.");
    } else {
      const insertionPos = Math.max(
        0,
        Math.min(
          selection.insertionPos ?? editor.state.selection.from,
          editor.state.doc.content.size
        )
      );
      editor
        .chain()
        .focus()
        .insertContentAt(insertionPos, { type: "image", attrs: attributes })
        .run();
      setImageUploadMessage("Изображение по HTTPS-ссылке добавлено в текст.");
    }
    setIsDirty(true);
  }

  function openMediaCollection(kind: GalleryEditorKind) {
    setMediaComposerKind(kind);
    setMediaComposerValue("");
    setMediaComposerItems([]);
    setMediaComposerError("");
    setMediaComposerSettings(defaultEditorialGallerySettings(kind));
  }

  function closeMediaCollection() {
    setMediaComposerKind(null);
    setMediaComposerValue("");
    setMediaComposerItems([]);
    setMediaComposerError("");
  }

  function confirmMediaCollection(settings: EditorialGallerySettings) {
    if (!mediaComposerKind) return;
    const insertionPosition = editor?.state.selection.from ?? 0;
    const linkedItems = parseEditorialGalleryUrls(mediaComposerValue).map(
      (src) => {
        const fileName = src.split("/").pop() || "изображение";
        return {
          src,
          alt: suggestedPageImageAlt(fileName, { position: insertionPosition }),
          caption: suggestedPageImageCaption(fileName, {
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
      insertEditorialSlider(editor, items, "странице", settings);
    } else {
      insertEditorialGallery(editor, items, "странице", settings);
    }
    setImageUploadError("");
    setImageUploadMessage(
      mediaComposerKind === "slider"
        ? "Слайдер изображений вставлен в страницу."
        : "Галерея изображений вставлена в страницу."
    );
    closeMediaCollection();
  }

  return (
    <form
      action={savePage}
      onReset={(event) => event.preventDefault()}
      className={`article-editor${isFullscreen ? " is-fullscreen" : ""}`}
      onSubmit={(event) => {
        if (submitPendingRef.current || saveBlockedRef.current || readUnavailable || !operationRecoveryReadyRef.current) {
          event.preventDefault();
          return;
        }
        if (editorMedia.busy) {
          event.preventDefault();
          setImageUploadError(
            "Дождитесь завершения загрузки изображения перед сохранением страницы."
          );
          return;
        }
        persistLocalCopy();
        submittedSnapshotRef.current = currentSnapshotRef.current;
        submitPendingRef.current = true;
      }}
    >
      <input name="id" type="hidden" value={page.id} />
      <input name="expected_updated_at" type="hidden" value={expectedUpdatedAt} />
      <input name="catalog_q" type="hidden" value={catalogContext.q} />
      <input name="catalog_status" type="hidden" value={catalogContext.status} />
      <input name="catalog_page" type="hidden" value={catalogContext.page} />
      <input name="editor_revision_page" type="hidden" value={catalogContext.revisionPage} />
      <input name="content_html" type="hidden" value={contentHtml} />
      <input name="content_json" type="hidden" value={contentJson} />
      <RecoveryController
        locator={{
          entityType: "page",
          entityId: page.id,
          draftScope: page.id,
          localeScope: "default",
          baseUpdatedAt: expectedUpdatedAt,
        }}
        snapshot={{ ...recoverySnapshot }}
        isDirty={isDirty && !operationRecoveryErrorRef.current}
        savedAfterSubmit={false}
        onLocalFallback={persistLocalCopy}
        onRestore={applyRecoveryCopy}
      />
      <section className="editor-main panel">
        <div className="editor-kicker">
          <span>Страница сайта</span>
          {isDirty && <small>Есть несохранённые изменения</small>}
        </div>
        {saveNotice && <p role="status" aria-live="polite">{saveNotice}</p>}
        {saveBlocked && hasPendingSaveOperation && (
          <button type="button" className="button-secondary"
            disabled={savePending || readUnavailable || !operationRecoveryReady}
            onClick={() => void checkPendingSave()}>
            Проверить результат сохранения
          </button>
        )}
        {saveBlocked && (
          <NextLink href={savedVersionHref} target="_blank" rel="noreferrer">
            Открыть сохранённую версию в новой вкладке
          </NextLink>
        )}
        {localCopyError && <p role="alert">{localCopyError}</p>}
        <input
          aria-label="Название страницы"
          className="title-input"
          name="title"
          onChange={(event) => {
            setTitle(event.target.value);
            setIsDirty(true);
          }}
          placeholder="Название страницы"
          required
          value={title}
        />
        <textarea
          className="lead-input"
          name="excerpt"
          onChange={(event) => {
            setExcerpt(event.target.value);
            setIsDirty(true);
          }}
          placeholder="Краткое описание страницы"
          value={excerpt}
        />
        <div className="editor-toolbar" aria-label="Форматирование текста">
          <RichEditorToolbar editor={editor} onLink={setLink} />
          <ToolbarButton label="Факт" onClick={() => insertEditorialBlock(editor, "fact")} />
          <ToolbarButton label="Акцент" onClick={() => insertEditorialBlock(editor, "accent")} />
          <ToolbarButton label="2 колонки" onClick={() => insertEditorialBlock(editor, "columns")} />
          <ToolbarButton label="Хронология" onClick={() => insertEditorialBlock(editor, "timeline")} />
          <ToolbarButton label="Цифры" onClick={() => insertEditorialBlock(editor, "metrics")} />
          <ToolbarButton label="Фигура-разделитель" onClick={() => insertEditorialBlock(editor, "ornament")} />
          <ToolbarButton label="Место для изображения" onClick={() => insertEditorialBlock(editor, "media")} />
          <ToolbarButton label="Галерея" onClick={() => openMediaCollection("gallery")} />
          <ToolbarButton label="Слайдер" onClick={() => openMediaCollection("slider")} />
          <ToolbarButton label="Анимация ↑" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
          <ToolbarButton label="Анимация ←" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
          <ToolbarButton label="Масштаб" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
          <ToolbarButton
            label={imageUploadPending ? "Загрузка изображения…" : "Изображение с компьютера"}
            onClick={openImagePicker}
          />
          <ToolbarButton
            label="Изображение из медиатеки"
            onClick={editorMedia.openLibrary}
          />
          <ToolbarButton
            label="Изображение по HTTPS-адресу"
            onClick={openImageUrlDialog}
          />
          <details className="editor-tool-menu">
            <summary>Цвет текста</summary>
            <div className="editor-tool-menu-panel">
              <div
                className="editor-text-tone-palette"
                role="group"
                aria-label="Безопасная палитра цвета текста"
              >
                <button
                  type="button"
                  className={!editor?.isActive("textTone") ? "is-active" : undefined}
                  aria-pressed={!editor?.isActive("textTone")}
                  onClick={() => editor?.chain().focus().unsetTextTone().run()}
                >
                  <span className="editor-text-tone-reset" aria-hidden="true">A</span>
                  <span><strong>Основной</strong><small>Цвет темы</small></span>
                </button>
                {articleTextTones.map((tone) => (
                  <button
                    type="button"
                    key={tone.id}
                    className={
                      editor?.isActive("textTone", { tone: tone.id })
                        ? "is-active"
                        : undefined
                    }
                    data-text-tone={tone.id}
                    aria-pressed={editor?.isActive("textTone", { tone: tone.id })}
                    onClick={() => editor?.chain().focus().setTextTone(tone.id).run()}
                  >
                    <span className="editor-text-tone-swatch" aria-hidden="true" />
                    <span>
                      <strong>{tone.label}</strong>
                      <small>AAA · от {tone.contrastRatio}:1</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </details>
          <details className="editor-tool-menu">
            <summary>Роль текста</summary>
            <div className="editor-tool-menu-panel">
              <ToolbarButton
                label="Обычный текст"
                active={!editor?.isActive("typographyScope")}
                onClick={() => editor?.chain().focus().unsetTypographyScope().run()}
              />
              {articleTypographyScopes.map((scope) => (
                <ToolbarButton
                  key={scope.id}
                  label={scope.label}
                  active={editor?.isActive("typographyScope", { scope: scope.id })}
                  onClick={() => editor?.chain().focus().setTypographyScope(scope.id).run()}
                />
              ))}
            </div>
          </details>
          <ToolbarButton
            label="Текст слева"
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          />
          <ToolbarButton
            label="Текст по центру"
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          />
          <ToolbarButton
            label="Без форматирования"
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          />
        </div>
        <input
          ref={editorMedia.fileInputRef}
          className="visually-hidden-file"
          type="file"
          multiple
          accept={CLIENT_IMAGE_ACCEPT_ATTRIBUTE}
          onChange={(event) => editorMedia.handleFileInput(event.target.files)}
        />
        {imageUploadMessage && (
          <p className="upload-feedback is-success" role="status">
            {imageUploadMessage}
          </p>
        )}
        {imageUploadError && (
          <p className="upload-feedback is-error" role="alert">
            {imageUploadError}
          </p>
        )}
        <div
          className="editor-content-drop-target"
          onDragOverCapture={(event) => {
            if (Array.from(event.dataTransfer.items || []).some(
              (item) => item.kind === "file" && item.type.startsWith("image/")
            )) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDropCapture={editorMedia.handleDrop}
          onPasteCapture={editorMedia.handlePaste}
        >
          <EditorContent className="editor-canvas" editor={editor} />
        </div>
      </section>
      <aside className="editor-side">
        <section className="panel settings-stack">
          <h2>Публикация</h2>
          <label className="field">
            <span>Статус</span>
            <select
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setIsDirty(true);
              }}
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликована</option>
              <option value="hidden">Скрыта</option>
            </select>
          </label>
          <label className="field">
            <span>Адрес</span>
            <input
              name="slug"
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(createSlug(event.target.value));
                setIsDirty(true);
              }}
              onFocus={() => setSlugEdited(true)}
              value={slug}
            />
          </label>
          <div className="editor-actions">
            <button
              className="button-secondary"
              disabled={imageUploadPending || savePending || saveBlocked || readUnavailable || !operationRecoveryReady}
              name="intent"
              value="save"
            >
              Сохранить
            </button>
            <button
              className="button"
              disabled={imageUploadPending || savePending || saveBlocked || readUnavailable || !operationRecoveryReady}
              name="intent"
              value="publish"
            >
              Опубликовать
            </button>
          </div>
          {readUnavailable || saveBlocked || !operationRecoveryReady ? <span className="button-secondary" aria-disabled="true">
            Предпросмотр недоступен до проверки данных
          </span> : <NextLink
            className="button-secondary"
            href={previewHref}
            target="_blank"
            rel="noreferrer"
          >
            Предпросмотр ↗
          </NextLink>}
          <button
            className="button-secondary"
            type="button"
            onClick={() => setIsFullscreen((value) => !value)}
          >
            {isFullscreen ? "Закрыть полный экран" : "Развернуть редактор"}
          </button>
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Восстановить локальную копию
            </button>
          )}
          {hasRecoveryCopy && !saveBlocked && operationRecoveryReady && !pendingJournalRef.current && (
            <button type="button" className="button-secondary" onClick={() => {
              try {
                const key = `probpera-page-editor-${page.id}`;
                if (!discardRecoveryCopy(window.localStorage, key, actorId)) throw new Error("Unavailable own recovery copy");
                discardedRecoveryFingerprintRef.current = pageSnapshotFingerprint(latestSnapshotRef.current);
                preserveLocalCopyRef.current = false;
                setHasRecoveryCopy(false);
                setLocalCopyError("");
              } catch { setLocalCopyError("Удаление локальной копии не подтверждено. Текст в форме сохранён."); }
            }}>Удалить локальную копию</button>
          )}
        </section>
        <section className="panel settings-stack">
          <h2>Поисковые системы</h2>
          <label className="field">
            <span>SEO-заголовок</span>
            <input
              name="seo_title"
              value={seoTitle}
              onChange={(event) => {
                setSeoTitle(event.target.value);
                setIsDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>SEO-описание</span>
            <textarea
              name="seo_description"
              value={seoDescription}
              onChange={(event) => {
                setSeoDescription(event.target.value);
                setIsDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>Канонический адрес</span>
            <input
              name="canonical_url"
              onChange={(event) => {
                setCanonicalEdited(true);
                setCanonicalUrl(event.target.value);
                setIsDirty(true);
              }}
              value={canonicalUrl}
            />
          </label>
          <label className="check-field">
            <input
              checked={allowIndexing}
              name="allow_indexing"
              type="checkbox"
              onChange={(event) => {
                setAllowIndexing(event.target.checked);
                setIsDirty(true);
              }}
            />
            <span>Разрешить индексацию</span>
          </label>
        </section>
      </aside>
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
      <GalleryEditor
        kind={editorMedia.dialogOpen ? null : mediaComposerKind}
        value={mediaComposerValue}
        error={mediaComposerError}
        contextLabel="страницы"
        settings={mediaComposerSettings}
        items={mediaComposerItems}
        onValueChange={setMediaComposerValue}
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
    </form>
  );
}

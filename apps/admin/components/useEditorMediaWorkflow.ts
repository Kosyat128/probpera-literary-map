"use client";

import type { Editor } from "@tiptap/core";
import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { replaceMediaSlotAt } from "@/components/EditorialBlock";
import {
  updateEditorialImageAt,
  type EditorialImageLayout,
} from "@/components/EditorialImage";
import type {
  EditorMediaAsset,
  EditorMediaQueueItem,
} from "@/components/EditorMediaDialog";
import {
  EDITOR_IMAGE_REPLACE_EVENT,
  EDITOR_MEDIA_SLOT_EVENT,
  type EditorImageReplaceDetail,
  type EditorMediaSlotDetail,
} from "@/components/editorMediaEvents";
import { uploadEditorImage } from "@/lib/editor-image-upload";
import type { EditorialGalleryItemInput } from "@/lib/editorial-gallery";

type EditorMediaTarget =
  | {
      kind: "insert";
      position: number;
      contextKey: string;
    }
  | {
      kind: "replace";
      position: number;
      expectedSrc?: string;
      attributes: Record<string, unknown>;
      contextKey: string;
    }
  | {
      kind: "slot";
      position: number;
      contextKey: string;
    }
  | {
      kind: "collection";
      contextKey: string;
      onCollect: (items: EditorialGalleryItemInput[]) => void;
    };

type QueueJob = {
  file: File;
  target: EditorMediaTarget;
};

type UploadedItem = {
  id: string;
  attributes: {
    src: string;
    mediaId: string | null;
    alt: string;
    caption: string;
    layout: EditorialImageLayout;
  };
};

const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function queueId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function imageLayout(attributes: Record<string, unknown>): EditorialImageLayout {
  const value = attributes.layout;
  return value === "normal" || value === "full" || value === "left" || value === "right"
    ? value
    : "wide";
}

export function useEditorMediaWorkflow({
  editor,
  collectionName,
  contextKey = "default",
  suggestedAltText,
  onChanged,
  onMessage,
  onError,
}: {
  editor: Editor | null;
  collectionName: string;
  contextKey?: string;
  suggestedAltText: (file: File) => string;
  onChanged: () => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [queue, setQueue] = useState<EditorMediaQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<EditorMediaTarget | null>(null);
  const contextKeyRef = useRef(contextKey);
  const callbacksRef = useRef({ onChanged, onMessage, onError });
  const jobsRef = useRef(new Map<string, QueueJob>());
  const abortControllersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    contextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    callbacksRef.current = { onChanged, onMessage, onError };
  }, [onChanged, onError, onMessage]);

  const updateQueueItem = useCallback(
    (id: string, patch: Partial<EditorMediaQueueItem>) => {
      setQueue((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const captureTarget = useCallback((): EditorMediaTarget | null => {
    if (!editor) return null;
    if (editor.isActive("image")) {
      const attributes = editor.getAttributes("image") || {};
      return {
        kind: "replace",
        position: editor.state.selection.from,
        expectedSrc:
          typeof attributes.src === "string" ? attributes.src : undefined,
        attributes,
        contextKey: contextKeyRef.current,
      };
    }
    return {
      kind: "insert",
      position: editor.state.selection.from,
      contextKey: contextKeyRef.current,
    };
  }, [editor]);

  const attachUploaded = useCallback(
    (target: EditorMediaTarget, uploaded: UploadedItem[]) => {
      if (!editor || uploaded.length === 0) return;
      if (target.contextKey !== contextKeyRef.current) {
        throw new Error(
          "Контекст редактора изменился во время загрузки. Файлы сохранены в медиатеке, но не вставлены."
        );
      }

      if (target.kind === "collection") {
        target.onCollect(
          uploaded.map((item) => ({
            src: item.attributes.src,
            mediaId: item.attributes.mediaId,
            alt: item.attributes.alt,
            caption: item.attributes.caption,
          }))
        );
        return;
      }

      if (target.kind === "replace") {
        const first = uploaded[0];
        if (
          !updateEditorialImageAt(
            editor,
            target.position,
            first.attributes,
            target.expectedSrc
          )
        ) {
          throw new Error(
            "Выбранное изображение изменилось во время загрузки. Файл сохранён в медиатеке, но не заменил текущий узел."
          );
        }
        return;
      }

      if (target.kind === "slot") {
        const first = uploaded[0];
        if (!replaceMediaSlotAt(editor, target.position, first.attributes)) {
          throw new Error(
            "Место для изображения изменилось во время загрузки. Файл сохранён в медиатеке, но не вставлен."
          );
        }
        return;
      }

      const position = Math.max(
        0,
        Math.min(target.position, editor.state.doc.content.size)
      );
      const inserted = editor
        .chain()
        .focus()
        .insertContentAt(
          position,
          uploaded.map((item) => ({ type: "image", attrs: item.attributes }))
        )
        .run();
      if (!inserted) throw new Error("Редактор не смог вставить изображения.");
    },
    [editor]
  );

  const processFiles = useCallback(
    async (files: File[], target: EditorMediaTarget) => {
      if (!editor) {
        callbacksRef.current.onError?.(
          "Редактор ещё загружается. Повторите действие через секунду."
        );
        return;
      }
      const supported = files.filter((file) => acceptedImageTypes.has(file.type));
      if (supported.length !== files.length) {
        callbacksRef.current.onError?.(
          "Поддерживаются только изображения JPEG, PNG, WebP и AVIF."
        );
      }
      if (!supported.length) return;
      const orderedFiles =
        target.kind === "insert" || target.kind === "collection"
          ? supported
          : supported.slice(0, 1);
      if (
        target.kind !== "insert" &&
        target.kind !== "collection" &&
        supported.length > 1
      ) {
        callbacksRef.current.onError?.(
          "Для замены изображения или заполнения квадрата используется только первый файл."
        );
      }

      const entries = orderedFiles.map((file) => {
        const id = queueId();
        jobsRef.current.set(id, { file, target });
        return { id, file };
      });
      setQueue((current) => [
        ...current,
        ...entries.map(({ id, file }) => ({
          id,
          name: file.name,
          status: "prepare" as const,
          progress: 0,
        })),
      ]);
      setDialogOpen(true);

      const uploaded: UploadedItem[] = [];
      for (const { id, file } of entries) {
        const controller = new AbortController();
        abortControllersRef.current.set(id, controller);
        try {
          const previousAttributes =
            target.kind === "replace" ? target.attributes : {};
          const previousAlt =
            typeof previousAttributes.alt === "string"
              ? previousAttributes.alt.trim()
              : "";
          const altText =
            previousAlt.length >= 3 ? previousAlt : suggestedAltText(file);
          const caption =
            typeof previousAttributes.caption === "string"
              ? previousAttributes.caption.trim()
              : "";
          const result = await uploadEditorImage(file, {
            usage: "inline",
            altText,
            caption,
            collectionName,
            signal: controller.signal,
            onProgress(stage, progress) {
              updateQueueItem(id, {
                status: stage,
                progress:
                  stage === "prepare"
                    ? Math.round(progress * 0.35)
                    : 35 + Math.round(progress * 0.5),
              });
            },
          });
          if (controller.signal.aborted) {
            throw new DOMException("Загрузка отменена.", "AbortError");
          }
          updateQueueItem(id, { status: "attach", progress: 90 });
          uploaded.push({
            id,
            attributes: {
              src: result.url,
              mediaId: result.mediaId,
              alt: altText,
              caption,
              layout: imageLayout(previousAttributes),
            },
          });
        } catch (reason) {
          const cancelled =
            controller.signal.aborted ||
            (reason instanceof DOMException && reason.name === "AbortError");
          updateQueueItem(id, {
            status: cancelled ? "cancelled" : "error",
            progress: cancelled ? 0 : 100,
            error: cancelled
              ? "Загрузка отменена."
              : reason instanceof Error
                ? reason.message
                : "Не удалось загрузить изображение.",
          });
        }
      }

      const readyToAttach = uploaded.filter((item) => {
        const cancelled = abortControllersRef.current.get(item.id)?.signal.aborted;
        if (cancelled) {
          updateQueueItem(item.id, {
            status: "cancelled",
            progress: 0,
            error: "Вставка отменена.",
          });
        }
        return !cancelled;
      });
      if (readyToAttach.length > 0) {
        try {
          attachUploaded(target, readyToAttach);
          for (const item of readyToAttach) {
            updateQueueItem(item.id, {
              status: "done",
              progress: 100,
              error: undefined,
            });
            jobsRef.current.delete(item.id);
          }
          callbacksRef.current.onChanged();
          callbacksRef.current.onMessage?.(
            readyToAttach.length > 1
              ? target.kind === "collection"
                ? `${readyToAttach.length} изображения загружены и добавлены в подборку.`
                : `${readyToAttach.length} изображения загружены и вставлены рядом в исходном порядке.`
              : target.kind === "collection"
                ? "Изображение загружено и добавлено в подборку."
              : target.kind === "replace"
                ? "Выбранное изображение точно заменено."
                : target.kind === "slot"
                  ? "Место для изображения заполнено."
                  : "Изображение вставлено в место курсора."
          );
        } catch (reason) {
          const message =
            reason instanceof Error
              ? reason.message
              : "Не удалось вставить загруженное изображение.";
          for (const item of readyToAttach) {
            updateQueueItem(item.id, {
              status: "error",
              progress: 100,
              error: message,
            });
          }
          callbacksRef.current.onError?.(message);
        }
      }
      for (const { id } of entries) abortControllersRef.current.delete(id);
    },
    [attachUploaded, collectionName, editor, suggestedAltText, updateQueueItem]
  );

  const rememberSelection = useCallback(() => {
    targetRef.current = captureTarget();
  }, [captureTarget]);

  const openPicker = useCallback(
    (target?: EditorMediaTarget) => {
      const nextTarget = target ?? captureTarget();
      if (!nextTarget) return;
      targetRef.current = nextTarget;
      if (fileInputRef.current) {
        fileInputRef.current.multiple =
          nextTarget.kind === "insert" || nextTarget.kind === "collection";
        fileInputRef.current.click();
      }
    },
    [captureTarget]
  );

  const openLibrary = useCallback(() => {
    const nextTarget = captureTarget();
    if (!nextTarget) return;
    targetRef.current = nextTarget;
    setDialogOpen(true);
  }, [captureTarget]);

  const collectionTarget = useCallback(
    (onCollect: (items: EditorialGalleryItemInput[]) => void): EditorMediaTarget => ({
      kind: "collection",
      contextKey: contextKeyRef.current,
      onCollect,
    }),
    []
  );

  const openCollectionLibrary = useCallback(
    (onCollect: (items: EditorialGalleryItemInput[]) => void) => {
      targetRef.current = collectionTarget(onCollect);
      setDialogOpen(true);
    },
    [collectionTarget]
  );

  const openCollectionPicker = useCallback(
    (onCollect: (items: EditorialGalleryItemInput[]) => void) => {
      openPicker(collectionTarget(onCollect));
    },
    [collectionTarget, openPicker]
  );

  const pickForCurrentTarget = useCallback(() => {
    const target = targetRef.current ?? captureTarget();
    if (target) openPicker(target);
  }, [captureTarget, openPicker]);

  const enqueueFiles = useCallback(
    (files: File[], target?: EditorMediaTarget) => {
      const nextTarget = target ?? targetRef.current ?? captureTarget();
      if (!nextTarget) return;
      targetRef.current = nextTarget;
      void processFiles(files, nextTarget);
    },
    [captureTarget, processFiles]
  );

  const handleFileInput = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      enqueueFiles(Array.from(files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [enqueueFiles]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".editor-media-slot-control")
      ) {
        return;
      }
      const files = Array.from(event.dataTransfer.files || []);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      const position = editor?.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      })?.pos;
      if (!editor || typeof position !== "number") {
        callbacksRef.current.onError?.(
          "Не удалось определить место вставки. Установите курсор и повторите."
        );
        return;
      }
      enqueueFiles(files, {
        kind: "insert",
        position,
        contextKey: contextKeyRef.current,
      });
    },
    [editor, enqueueFiles]
  );

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLElement>) => {
      const files = Array.from(event.clipboardData.files || []).filter((file) =>
        file.type.startsWith("image/")
      );
      if (!files.length || !editor) return;
      event.preventDefault();
      enqueueFiles(files, {
        kind: "insert",
        position: editor.state.selection.from,
        contextKey: contextKeyRef.current,
      });
    },
    [editor, enqueueFiles]
  );

  const selectLibraryAsset = useCallback(
    (asset: EditorMediaAsset) => {
      const target = targetRef.current ?? captureTarget();
      if (!target) return;
      try {
        if (target.kind === "collection") {
          target.onCollect([
            {
              src: asset.src,
              mediaId: asset.id,
              alt: asset.alt,
              caption: asset.caption,
              credit: asset.creator,
              source: asset.sourceUrl,
              license: asset.licenseName,
              licenseUrl: asset.licenseUrl,
            },
          ]);
          callbacksRef.current.onChanged();
          callbacksRef.current.onMessage?.(
            "Изображение из медиатеки добавлено в подборку."
          );
          return;
        }
        attachUploaded(target, [
          {
            id: asset.id,
            attributes: {
              src: asset.src,
              mediaId: asset.id,
              alt: asset.alt,
              caption: asset.caption,
              layout:
                target.kind === "replace"
                  ? imageLayout(target.attributes)
                  : "wide",
            },
          },
        ]);
        callbacksRef.current.onChanged();
        callbacksRef.current.onMessage?.(
          "Изображение из медиатеки вставлено без повторной загрузки."
        );
        setDialogOpen(false);
      } catch (reason) {
        callbacksRef.current.onError?.(
          reason instanceof Error
            ? reason.message
            : "Не удалось вставить изображение из медиатеки."
        );
      }
    },
    [attachUploaded, captureTarget]
  );

  const cancelItem = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
  }, []);

  const retryItem = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job) return;
      void processFiles([job.file], job.target);
    },
    [processFiles]
  );

  useEffect(() => {
    const replaceImage = (event: Event) => {
      if (!editor) return;
      const detail = (event as CustomEvent<EditorImageReplaceDetail>).detail;
      if (!detail || typeof detail.position !== "number") return;
      const target: EditorMediaTarget = {
        kind: "replace",
        position: detail.position,
        expectedSrc:
          typeof detail.attributes?.src === "string"
            ? detail.attributes.src
            : undefined,
        attributes: detail.attributes || {},
        contextKey: contextKeyRef.current,
      };
      editor.commands.setNodeSelection(detail.position);
      openPicker(target);
    };
    const fillMediaSlot = (event: Event) => {
      if (!editor) return;
      const detail = (event as CustomEvent<EditorMediaSlotDetail>).detail;
      if (!detail || typeof detail.position !== "number") return;
      const target: EditorMediaTarget = {
        kind: "slot",
        position: detail.position,
        contextKey: contextKeyRef.current,
      };
      editor.commands.setNodeSelection(detail.position);
      const files = detail.files || (detail.file ? [detail.file] : []);
      if (files.length) enqueueFiles(files, target);
      else openPicker(target);
    };
    window.addEventListener(EDITOR_IMAGE_REPLACE_EVENT, replaceImage);
    window.addEventListener(EDITOR_MEDIA_SLOT_EVENT, fillMediaSlot);
    return () => {
      window.removeEventListener(EDITOR_IMAGE_REPLACE_EVENT, replaceImage);
      window.removeEventListener(EDITOR_MEDIA_SLOT_EVENT, fillMediaSlot);
    };
  }, [editor, enqueueFiles, openPicker]);

  const busy = useMemo(
    () =>
      queue.some(
        (item) =>
          item.status === "prepare" ||
          item.status === "upload" ||
          item.status === "attach"
      ),
    [queue]
  );

  return {
    busy,
    queue,
    dialogOpen,
    fileInputRef,
    rememberSelection,
    openPicker,
    pickForCurrentTarget,
    openLibrary,
    openCollectionLibrary,
    openCollectionPicker,
    enqueueFiles,
    handleFileInput,
    handleDrop,
    handlePaste,
    closeDialog: () => setDialogOpen(false),
    collectionMode: targetRef.current?.kind === "collection",
    selectLibraryAsset,
    cancelItem,
    retryItem,
  };
}

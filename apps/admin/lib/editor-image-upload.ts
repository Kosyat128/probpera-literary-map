"use client";

import { withClientAdminPath } from "./admin-path";
import {
  prepareClientImage,
  type ClientImageUsage,
} from "./client-image-upload";

type EditorImageUploadResponse = {
  ok?: boolean;
  id?: string;
  mediaId?: string;
  url?: string;
  width?: number;
  height?: number;
  publication?: "started" | "queued" | "queue-error";
  error?: string;
};

export type EditorImageUploadResult = {
  url: string;
  mediaId: string | null;
  width: number;
  height: number;
  publication: "started" | "queued" | "queue-error" | null;
};

export type EditorImageUploadStage = "prepare" | "upload";

export type EditorImageUploadOptions = {
  usage?: ClientImageUsage;
  altText: string;
  caption?: string;
  collectionName: string;
  creator?: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  signal?: AbortSignal;
  onProgress?: (stage: EditorImageUploadStage, progress: number) => void;
};

export function normalizeEditorImageUploadResult(
  value: EditorImageUploadResponse
): EditorImageUploadResult | null {
  if (!value.ok || typeof value.url !== "string" || !value.url.trim()) {
    return null;
  }
  const rawMediaId = value.mediaId ?? value.id;
  return {
    url: value.url,
    mediaId:
      typeof rawMediaId === "string" && rawMediaId.trim()
        ? rawMediaId.trim()
        : null,
    width: Number.isFinite(value.width) ? Number(value.width) : 0,
    height: Number.isFinite(value.height) ? Number(value.height) : 0,
    publication:
      value.publication === "started" ||
      value.publication === "queued" ||
      value.publication === "queue-error"
        ? value.publication
        : null,
  };
}

export async function uploadEditorImage(
  sourceFile: File,
  options: EditorImageUploadOptions
): Promise<EditorImageUploadResult> {
  const usage = options.usage ?? "inline";
  if (options.signal?.aborted) throw new DOMException("Загрузка отменена.", "AbortError");
  options.onProgress?.("prepare", 0);
  const prepared = await prepareClientImage(sourceFile, usage);
  if (options.signal?.aborted) throw new DOMException("Загрузка отменена.", "AbortError");
  options.onProgress?.("prepare", 100);
  const formData = new FormData();
  formData.set("file", prepared.file);
  formData.set("alt_text", options.altText);
  formData.set("caption", options.caption || "");
  formData.set("creator", options.creator || "");
  formData.set("source_url", options.sourceUrl || "");
  formData.set("license_name", options.licenseName || "");
  formData.set("license_url", options.licenseUrl || "");
  formData.set("collection_name", options.collectionName);
  formData.set("image_usage", usage);
  formData.set("client_width", String(prepared.width));
  formData.set("client_height", String(prepared.height));

  options.onProgress?.("upload", 0);
  const response = await fetch(withClientAdminPath("/api/media/upload"), {
    method: "POST",
    body: formData,
    signal: options.signal,
  });
  const body = (await response.json().catch(() => ({}))) as EditorImageUploadResponse;
  const result = normalizeEditorImageUploadResult(body);
  if (!response.ok || !result) {
    throw new Error(body.error || "Не удалось загрузить изображение.");
  }
  options.onProgress?.("upload", 100);
  return result;
}

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
  error?: string;
};

export type EditorImageUploadResult = {
  url: string;
  mediaId: string | null;
  width: number;
  height: number;
};

export type EditorImageUploadOptions = {
  usage?: ClientImageUsage;
  altText: string;
  caption?: string;
  collectionName: string;
  creator?: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
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
  };
}

export async function uploadEditorImage(
  sourceFile: File,
  options: EditorImageUploadOptions
): Promise<EditorImageUploadResult> {
  const usage = options.usage ?? "inline";
  const prepared = await prepareClientImage(sourceFile, usage);
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

  const response = await fetch(withClientAdminPath("/api/media/upload"), {
    method: "POST",
    body: formData,
  });
  const body = (await response.json().catch(() => ({}))) as EditorImageUploadResponse;
  const result = normalizeEditorImageUploadResult(body);
  if (!response.ok || !result) {
    throw new Error(body.error || "Не удалось загрузить изображение.");
  }
  return result;
}

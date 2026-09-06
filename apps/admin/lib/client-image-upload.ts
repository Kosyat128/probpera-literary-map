"use client";

import {
  IMAGE_UPLOAD_ACCEPT,
  MAX_IMAGE_SOURCE_BYTES,
  optimizeUploadImage,
  type OptimizedUploadImage,
} from "../../../src/utils/imageUploadOptimization";

export type ClientImageUsage = "cover" | "hero" | "gallery" | "inline";
export type PreparedClientImage = OptimizedUploadImage;
export type ClientImagePreparation = Omit<PreparedClientImage, "file">;
export function formatImagePreparation(value: ClientImagePreparation) {
  const size = (bytes: number) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} МБ`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ru-RU")} КБ`;
  const weight = value.outputBytes < value.originalBytes
    ? `${size(value.originalBytes)} → ${size(value.outputBytes)}`
    : `${size(value.outputBytes)}, исходный файл`;
  return `${weight} · ${value.width} × ${value.height}, разрешение сохранено.`;
}
export const MAX_CLIENT_IMAGE_SOURCE_BYTES = MAX_IMAGE_SOURCE_BYTES;
export const MAX_CLIENT_IMAGE_UPLOAD_BYTES = Math.floor(3.8 * 1024 * 1024);
export const CLIENT_IMAGE_ACCEPT_ATTRIBUTE = IMAGE_UPLOAD_ACCEPT;
const acceptedTypes = new Set(CLIENT_IMAGE_ACCEPT_ATTRIBUTE.split(","));

export function isAcceptedClientImageType(value: unknown) {
  return typeof value === "string" && acceptedTypes.has(value.toLowerCase());
}

export async function prepareClientImage(
  file: File,
  _usage: ClientImageUsage = "inline"
): Promise<PreparedClientImage> {
  return optimizeUploadImage(file, { maxOutputBytes: MAX_CLIENT_IMAGE_UPLOAD_BYTES });
}

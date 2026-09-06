import { inspectRasterImage, isGifImage, type RasterImageMime } from "./rasterImageMetadata";

export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 16_383;
export const MAX_IMAGE_PIXELS = 40_000_000;
const WEBP_QUALITY = 0.94;

const messages = {
  empty: ["Выбранный файл пуст.", "The selected file is empty."],
  sourceSize: ["Исходное изображение должно быть не больше 20 МБ.", "The source image must not exceed 20 MB."],
  format: ["Выберите изображение JPEG, PNG, WebP или AVIF с корректным содержимым файла.", "Choose a valid JPEG, PNG, WebP or AVIF image."],
  gif: ["GIF здесь не поддерживается. Для анимации используйте анимированный WebP или AVIF: кадры не будут удалены.", "GIF is not supported here. Use animated WebP or AVIF to keep every frame."],
  dimensions: ["Изображение превышает 40 млн пикселей или 16 383 пикселя по стороне. Подготовьте меньший исходник.", "The image exceeds 40 megapixels or 16,383 pixels per side. Prepare a smaller source."],
  decode: ["Браузер не смог прочитать изображение. Попробуйте другой файл или браузер.", "The browser could not decode the image. Try another file or browser."],
  outputSize: ["Файл превышает лимит загрузки даже после обработки с высоким качеством. Выберите более компактный исходник; разрешение автоматически не уменьшается.", "The image exceeds the upload limit after high-quality processing. Choose a smaller source; resolution is not reduced automatically."],
  targetFormat: ["Этот формат не поддерживается для выбранного места загрузки.", "This format is not supported for this upload destination."],
} as const;
type Failure = keyof typeof messages;
export class ImageUploadError extends Error {
  constructor(public readonly code: Failure) {
    super(messages[code][0]);
    this.name = "ImageUploadError";
  }
}
export function imageUploadErrorMessage(error: unknown, language: "ru" | "en") {
  return messages[error instanceof ImageUploadError ? error.code : "decode"][language === "en" ? 1 : 0];
}
export type OptimizedUploadImage = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
};
type Options = {
  maxOutputBytes: number;
  /** Only avatars opt into resizing. Editorial images retain their source dimensions. */
  maxDimension?: number;
  allowedOriginalTypes?: readonly RasterImageMime[];
};
type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width && bitmap.height) return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      bitmap.close();
    } catch {
      // Image elements cover browsers that reject the bitmap orientation option.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ImageUploadError("decode"));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new ImageUploadError("decode");
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function renamedFile(source: File, blob: Blob, extension: string, mime: RasterImageMime) {
  const stem = source.name.replace(/\.[^.]+$/u, "").trim() || "image";
  return new File([blob], `${stem}.${extension}`, { type: mime, lastModified: source.lastModified });
}

export async function optimizeUploadImage(file: File, options: Options): Promise<OptimizedUploadImage> {
  if (!file.size) throw new ImageUploadError("empty");
  if (file.size > MAX_IMAGE_SOURCE_BYTES) throw new ImageUploadError("sourceSize");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isGifImage(bytes)) throw new ImageUploadError("gif");
  const metadata = inspectRasterImage(bytes);
  if (!metadata) throw new ImageUploadError("format");
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new ImageUploadError("dimensions");
  }
  const allowed = options.allowedOriginalTypes ?? ["image/jpeg", "image/png", "image/webp", "image/avif"];
  const originalAllowed = allowed.includes(metadata.mime);
  // Correct misleading filename/type metadata without changing the image bytes.
  const original = renamedFile(file, file, metadata.extension, metadata.mime);
  const result = (output: File, width = metadata.width, height = metadata.height): OptimizedUploadImage => {
    if (output.size > options.maxOutputBytes) throw new ImageUploadError("outputSize");
    return { file: output, width, height, originalBytes: file.size, outputBytes: output.size };
  };
  // Never send animation through a single-frame canvas. Retaining AVIF also keeps
  // HDR/color profiles that a standard canvas cannot represent.
  if (metadata.animated || metadata.mime === "image/avif") {
    if (!originalAllowed) throw new ImageUploadError("targetFormat");
    return result(original);
  }
  if (!originalAllowed) throw new ImageUploadError("targetFormat");
  const decoded = await decodeImage(original);
  const canvas = document.createElement("canvas");
  try {
    if (decoded.width !== metadata.width || decoded.height !== metadata.height) throw new ImageUploadError("decode");
    const scale = options.maxDimension ? Math.min(1, options.maxDimension / decoded.width, options.maxDimension / decoded.height) : 1;
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return result(original);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob || blob.type !== "image/webp" || blob.size >= original.size) return result(original);
    return result(renamedFile(file, blob, "webp", "image/webp"), width, height);
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}

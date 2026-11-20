import { inspectRasterImage, isGifImage, type RasterImageMime } from "./rasterImageMetadata";

export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 16_383;
export const MAX_IMAGE_PIXELS = 40_000_000;
const WEBP_QUALITY = 0.94;
const FIT_WEBP_QUALITY = 0.88;
const RESIZED_WEBP_QUALITY = 0.92;
const MAX_RESIZE_ATTEMPTS = 3;
const FULL_RESOLUTION_RETRY_PIXELS = 12_000_000;

const messages = {
  empty: ["Выбранный файл пуст.", "The selected file is empty."],
  sourceSize: ["Исходное изображение должно быть не больше 20 МБ.", "The source image must not exceed 20 MB."],
  format: ["Выберите изображение JPEG, PNG, WebP или AVIF с корректным содержимым файла.", "Choose a valid JPEG, PNG, WebP or AVIF image."],
  gif: ["GIF здесь не поддерживается. Для анимации используйте анимированный WebP или AVIF: кадры не будут удалены.", "GIF is not supported here. Use animated WebP or AVIF to keep every frame."],
  dimensions: ["Изображение превышает 40 млн пикселей или 16 383 пикселя по стороне. Подготовьте меньший исходник.", "The image exceeds 40 megapixels or 16,383 pixels per side. Prepare a smaller source."],
  decode: ["Браузер не смог прочитать изображение. Попробуйте другой файл или браузер.", "The browser could not decode the image. Try another file or browser."],
  outputSize: ["Не удалось подготовить изображение в пределах лимита загрузки. Выберите более компактный исходник или попробуйте другой браузер.", "The image could not be prepared within the upload limit. Choose a smaller source or try another browser."],
  preservedOutputSize: ["Размер AVIF или анимации превышает лимит загрузки. Загрузите более компактную версию с нужными цветами и кадрами.", "This AVIF or animation exceeds the upload limit. Upload a smaller version that preserves the colors and frames."],
  targetFormat: ["Этот формат не поддерживается для выбранного места загрузки.", "This format is not supported for this upload destination."],
} as const;
type Failure = keyof typeof messages;
export class ImageUploadError extends Error {
  constructor(public readonly code: Failure, fileName?: string) {
    super(fileName ? `«${fileName}». ${messages[code][0]}` : messages[code][0]);
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
  resized: boolean;
};
type Options = {
  maxOutputBytes: number;
  maxDimension?: number;
  allowedOriginalTypes?: readonly RasterImageMime[];
  /** Editorial fallback for oversized static images. */
  fitToUploadLimit?: boolean;
  signal?: AbortSignal;
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
  options.signal?.throwIfAborted();
  if (!file.size) throw new ImageUploadError("empty");
  if (file.size > MAX_IMAGE_SOURCE_BYTES) throw new ImageUploadError("sourceSize");
  const bytes = new Uint8Array(await file.arrayBuffer());
  options.signal?.throwIfAborted();
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
    return {
      file: output, width, height, originalBytes: file.size, outputBytes: output.size,
      resized: width !== metadata.width || height !== metadata.height,
    };
  };
  if (!originalAllowed) throw new ImageUploadError("targetFormat");
  // Never send animation through a single-frame canvas. Retaining AVIF also keeps
  // HDR/color profiles that a standard canvas cannot represent.
  if (metadata.animated || metadata.mime === "image/avif") {
    if (options.fitToUploadLimit && original.size > options.maxOutputBytes) throw new ImageUploadError("preservedOutputSize");
    return result(original);
  }
  const decoded = await decodeImage(original);
  const canvas = document.createElement("canvas");
  try {
    options.signal?.throwIfAborted();
    if (decoded.width !== metadata.width || decoded.height !== metadata.height) throw new ImageUploadError("decode");
    let scale = options.maxDimension ? Math.min(1, options.maxDimension / decoded.width, options.maxDimension / decoded.height) : 1;
    const maximum = options.maxOutputBytes;
    // A prepared editorial WebP can be reused without a second lossy encode.
    if (options.fitToUploadLimit && metadata.mime === "image/webp" && original.size <= maximum && scale === 1) {
      return result(original);
    }
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return result(original);
    const draw = () => {
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    };
    const webpResult = (blob: Blob) => result(renamedFile(file, blob, "webp", "image/webp"), canvas.width, canvas.height);
    const encode = async (quality: number) => {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      options.signal?.throwIfAborted();
      return blob?.type === "image/webp" && blob.size > 0 ? blob : null;
    };

    draw();
    let encoded = await encode(WEBP_QUALITY);
    if (encoded && encoded.size < original.size && encoded.size <= maximum) return webpResult(encoded);
    if (original.size <= maximum || !options.fitToUploadLimit || !encoded) return result(original);

    // Try stronger compression before resizing. Only repeat a large canvas
    // encode if the measured result is already close to the cap.
    if (canvas.width * canvas.height <= FULL_RESOLUTION_RETRY_PIXELS || encoded.size <= maximum * 1.2) {
      const smaller = await encode(FIT_WEBP_QUALITY);
      if (smaller && smaller.size <= maximum) return webpResult(smaller);
    }
    // Estimate the next pixel area from actual output size. Every redraw uses the
    // original pixels, and every encode is checked against the multipart budget.
    for (let attempt = 0; attempt < MAX_RESIZE_ATTEMPTS; attempt += 1) {
      scale *= Math.min(0.9, Math.sqrt(maximum / encoded.size) * 0.95);
      draw();
      encoded = await encode(RESIZED_WEBP_QUALITY);
      if (!encoded) break;
      if (encoded.size <= maximum) return webpResult(encoded);
    }
    throw new ImageUploadError("outputSize");
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}

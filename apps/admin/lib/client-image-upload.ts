"use client";

export type ClientImageUsage = "cover" | "hero" | "gallery" | "inline";

export type PreparedClientImage = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
};

const MEBIBYTE = 1024 * 1024;

export const MAX_CLIENT_IMAGE_SOURCE_BYTES = 20 * MEBIBYTE;
export const MAX_CLIENT_IMAGE_UPLOAD_BYTES = Math.floor(3.8 * MEBIBYTE);

export const CLIENT_IMAGE_ACCEPT_ATTRIBUTE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/jxl",
].join(",");

const acceptedTypes = new Set(CLIENT_IMAGE_ACCEPT_ATTRIBUTE.split(","));

export function isAcceptedClientImageType(value: unknown) {
  return typeof value === "string" && acceptedTypes.has(value.toLowerCase());
}

const sizePresets: Record<ClientImageUsage, { width: number; height: number }> = {
  cover: { width: 1800, height: 2700 },
  hero: { width: 2400, height: 1600 },
  gallery: { width: 2000, height: 2000 },
  inline: { width: 2000, height: 2000 },
};

const qualitySteps = [0.9, 0.84, 0.78, 0.7, 0.62, 0.54] as const;
const maxResizePasses = 6;
const resizeFactor = 0.82;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

function fittedDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Браузер не смог прочитать выбранное изображение."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("У изображения не удалось определить размеры.");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => undefined,
  };
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (!bitmap.width || !bitmap.height) {
        bitmap.close();
        throw new Error("У изображения не удалось определить размеры.");
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Safari and older browsers can reject AVIF or imageOrientation options.
      // The image element fallback keeps the upload usable where decoding exists.
    }
  }

  return decodeWithImageElement(file);
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(
            new Error(
              "Этот браузер не поддерживает подготовку WebP. Обновите браузер или выберите уже готовый файл WebP."
            )
          );
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

function webpFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/u, "").trim() || "image";
  return `${stem}.webp`;
}

export async function prepareClientImage(
  file: File,
  usage: ClientImageUsage = "inline"
): Promise<PreparedClientImage> {
  if (!isAcceptedClientImageType(file.type)) {
    throw new Error(
      file.type === "image/svg+xml"
        ? "SVG нельзя загружать как изображение: используйте растровый исходник без исполняемого кода."
        : "Выберите растровое изображение JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC/HEIF или JPEG XL. Формат должен поддерживаться вашим браузером."
    );
  }
  if (file.size <= 0) {
    throw new Error("Выбранный файл пуст. Выберите другое изображение.");
  }
  if (file.size > MAX_CLIENT_IMAGE_SOURCE_BYTES) {
    throw new Error("Исходное изображение должно быть не больше 20 МБ.");
  }

  const decoded = await decodeImage(file);
  const preset = sizePresets[usage];
  const initialSize = fittedDimensions(
    decoded.width,
    decoded.height,
    preset.width,
    preset.height
  );
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    decoded.close();
    throw new Error("Браузер не смог подготовить изображение к загрузке.");
  }

  try {
    let width = initialSize.width;
    let height = initialSize.height;

    for (let resizePass = 0; resizePass < maxResizePasses; resizePass += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, width, height);

      for (const quality of qualitySteps) {
        const blob = await canvasToWebp(canvas, quality);
        if (blob.size <= MAX_CLIENT_IMAGE_UPLOAD_BYTES) {
          const preparedFile = new File([blob], webpFileName(file.name), {
            type: "image/webp",
            lastModified: file.lastModified || Date.now(),
          });
          return {
            file: preparedFile,
            width,
            height,
            originalBytes: file.size,
            outputBytes: preparedFile.size,
          };
        }
      }

      width = Math.max(1, Math.floor(width * resizeFactor));
      height = Math.max(1, Math.floor(height * resizeFactor));
    }
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }

  throw new Error(
    "Не удалось безопасно уменьшить изображение до 3,8 МБ. Выберите файл меньшего размера."
  );
}

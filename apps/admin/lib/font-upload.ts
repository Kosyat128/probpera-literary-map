import { createHash } from "node:crypto";

import { z } from "zod";

export const SITE_FONT_BUCKET = "site-fonts";
export const MAX_FONT_UPLOAD_BYTES = 2 * 1024 * 1024;

export type UploadedFontFormat = "woff" | "woff2";
export type UploadedFontStyle = "normal" | "italic" | "oblique";

export type FontUploadMetadata = {
  displayName: string;
  familyName: string;
  weightMin: number;
  weightMax: number;
  style: UploadedFontStyle;
  isVariable: boolean;
  licenseName: string;
  licenseUrl: string | null;
};

export type ValidatedFontFile = {
  bytes: Uint8Array;
  byteSize: number;
  contentType: "font/woff" | "font/woff2";
  format: UploadedFontFormat;
  objectPath: string;
  originalName: string;
  sha256Hex: string;
};

export class FontUploadValidationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 = 400
  ) {
    super(message);
    this.name = "FontUploadValidationError";
  }
}

const fontSpecifications = {
  woff: {
    contentType: "font/woff" as const,
    extensions: [".woff"],
    magic: [0x77, 0x4f, 0x46, 0x46],
    mimeTypes: ["font/woff", "application/font-woff", "application/x-font-woff"],
  },
  woff2: {
    contentType: "font/woff2" as const,
    extensions: [".woff2"],
    magic: [0x77, 0x4f, 0x46, 0x32],
    mimeTypes: ["font/woff2", "application/font-woff2"],
  },
} satisfies Record<
  UploadedFontFormat,
  {
    contentType: "font/woff" | "font/woff2";
    extensions: string[];
    magic: number[];
    mimeTypes: string[];
  }
>;

const unsafeFontReference = /(?:@import\b|url\s*\(|https?:\/\/|^\/\/)/iu;
const unsafeMetadataCharacters = /[\u0000-\u001f\u007f{};]/u;

const requiredFontName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} обязательно.`)
    .max(120, `${label} не должно превышать 120 символов.`)
    .refine(
      (value) =>
        !unsafeFontReference.test(value) && !unsafeMetadataCharacters.test(value),
      `${label} содержит недопустимую ссылку или CSS-конструкцию.`
    );

const metadataSchema = z
  .object({
    displayName: requiredFontName("Название шрифта"),
    familyName: requiredFontName("Название семейства"),
    weightMin: z
      .number()
      .int("Минимальная насыщенность должна быть целым числом.")
      .min(1, "Минимальная насыщенность должна быть от 1 до 1000.")
      .max(1000, "Минимальная насыщенность должна быть от 1 до 1000."),
    weightMax: z
      .number()
      .int("Максимальная насыщенность должна быть целым числом.")
      .min(1, "Максимальная насыщенность должна быть от 1 до 1000.")
      .max(1000, "Максимальная насыщенность должна быть от 1 до 1000."),
    style: z.enum(["normal", "italic", "oblique"], {
      message: "Выберите допустимое начертание шрифта.",
    }),
    isVariable: z.boolean({
      message: "Укажите, является ли шрифт вариативным.",
    }),
    licenseName: z
      .string()
      .trim()
      .min(2, "Укажите название лицензии или основание использования.")
      .max(180, "Название лицензии не должно превышать 180 символов."),
    licenseUrl: z
      .string()
      .trim()
      .max(2048, "Ссылка на лицензию слишком длинная.")
      .nullable(),
  })
  .superRefine(({ weightMin, weightMax, isVariable, licenseUrl }, context) => {
    if (weightMin > weightMax) {
      context.addIssue({
        code: "custom",
        message: "Минимальная насыщенность не может быть больше максимальной.",
        path: ["weightMin"],
      });
    }
    if (!isVariable && weightMin !== weightMax) {
      context.addIssue({
        code: "custom",
        message:
          "Для обычного файла укажите одинаковую минимальную и максимальную насыщенность.",
        path: ["weightMax"],
      });
    }
    if (licenseUrl && !isSafeHttpUrl(licenseUrl)) {
      context.addIssue({
        code: "custom",
        message: "Укажите корректную ссылку на лицензию (http или https).",
        path: ["licenseUrl"],
      });
    }
  });

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
  return text || null;
}

function requiredText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function parseInteger(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !/^[0-9]+$/u.test(value.trim())) return Number.NaN;
  return Number(value.trim());
}

function parseBoolean(value: unknown) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
}

export function parseFontUploadMetadata(input: {
  displayName?: unknown;
  familyName?: unknown;
  weightMin?: unknown;
  weightMax?: unknown;
  style?: unknown;
  isVariable?: unknown;
  licenseName?: unknown;
  licenseUrl?: unknown;
}): FontUploadMetadata {
  const weightMin = parseInteger(input.weightMin);
  const weightMax = parseInteger(input.weightMax);
  if (!Number.isFinite(weightMin) || !Number.isFinite(weightMax)) {
    throw new FontUploadValidationError(
      "Насыщенность шрифта должна быть целым числом от 1 до 1000."
    );
  }
  const parsed = metadataSchema.safeParse({
    displayName: requiredText(input.displayName),
    familyName: requiredText(input.familyName),
    weightMin,
    weightMax,
    style: requiredText(input.style),
    isVariable: parseBoolean(input.isVariable),
    licenseName: requiredText(input.licenseName),
    licenseUrl: optionalText(input.licenseUrl),
  });
  if (!parsed.success) {
    throw new FontUploadValidationError(
      parsed.error.issues[0]?.message || "Проверьте данные шрифта."
    );
  }
  return parsed.data;
}

function normalizeMimeType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() || "";
}

function safeOriginalName(value: string) {
  const name = value.split(/[\\/]/u).at(-1)?.trim() || "";
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/u.test(name)) {
    throw new FontUploadValidationError("Имя файла шрифта недопустимо.");
  }
  return name;
}

function formatFromExtension(name: string): UploadedFontFormat | null {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".woff2")) return "woff2";
  if (lowerName.endsWith(".woff")) return "woff";
  return null;
}

function hasExpectedMagic(bytes: Uint8Array, magic: number[]) {
  return magic.every((value, index) => bytes[index] === value);
}

export function validateFontFile(input: {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
}): ValidatedFontFile {
  const { bytes } = input;
  if (bytes.byteLength === 0) {
    throw new FontUploadValidationError("Выбранный файл шрифта пуст.");
  }
  if (bytes.byteLength > MAX_FONT_UPLOAD_BYTES) {
    throw new FontUploadValidationError(
      "Файл шрифта превышает допустимый размер 2 МБ.",
      413
    );
  }

  const originalName = safeOriginalName(input.originalName);
  const format = formatFromExtension(originalName);
  if (!format) {
    throw new FontUploadValidationError(
      "Допустимы только файлы WOFF2 (.woff2) и WOFF (.woff).",
      415
    );
  }

  const specification = fontSpecifications[format];
  const mimeType = normalizeMimeType(input.mimeType);
  if (!specification.mimeTypes.includes(mimeType)) {
    throw new FontUploadValidationError(
      "Тип файла не соответствует допустимому формату WOFF2 или WOFF.",
      415
    );
  }
  if (!hasExpectedMagic(bytes, specification.magic)) {
    throw new FontUploadValidationError(
      "Файл не прошёл проверку сигнатуры WOFF2 или WOFF.",
      415
    );
  }

  const sha256Hex = createHash("sha256").update(bytes).digest("hex");
  return {
    bytes,
    byteSize: bytes.byteLength,
    contentType: specification.contentType,
    format,
    objectPath: `sha256/${sha256Hex.slice(0, 2)}/${sha256Hex}.${format}`,
    originalName,
    sha256Hex,
  };
}

const forbiddenRemoteFields = [
  "css_url",
  "cssUrl",
  "font_url",
  "fontUrl",
  "import_url",
  "importUrl",
  "remote_url",
  "remoteUrl",
] as const;

export function hasForbiddenRemoteFontInput(formData: FormData) {
  return forbiddenRemoteFields.some((field) => {
    const value = formData.get(field);
    return typeof value === "string" && value.trim().length > 0;
  });
}

function errorRecord(error: unknown) {
  return error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : null;
}

export function isStorageObjectAlreadyPresent(error: unknown) {
  const record = errorRecord(error);
  if (!record) return false;
  const status = String(record.statusCode ?? record.status ?? "");
  const message = `${String(record.error ?? "")} ${String(record.message ?? "")}`;
  return status === "409" || /(?:already exists|duplicate)/iu.test(message);
}

export function isDatabaseUniqueConflict(error: unknown) {
  return String(errorRecord(error)?.code ?? "") === "23505";
}

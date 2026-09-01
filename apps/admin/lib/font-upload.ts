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

export type FontUploadValidationErrorCode =
  | "display_name_required"
  | "display_name_too_long"
  | "display_name_unsafe"
  | "family_name_required"
  | "family_name_too_long"
  | "family_name_unsafe"
  | "file_empty"
  | "file_extension_invalid"
  | "file_mime_invalid"
  | "file_name_invalid"
  | "file_signature_invalid"
  | "file_too_large"
  | "fixed_weight_range_invalid"
  | "license_name_required"
  | "license_name_too_long"
  | "license_url_invalid"
  | "license_url_too_long"
  | "metadata_invalid"
  | "metadata_weight_integer"
  | "style_invalid"
  | "variable_flag_invalid"
  | "weight_max_integer"
  | "weight_max_range"
  | "weight_min_integer"
  | "weight_min_range"
  | "weight_order_invalid";

export class FontUploadValidationError extends Error {
  constructor(
    readonly code: FontUploadValidationErrorCode,
    readonly status: 400 | 413 | 415 = 400
  ) {
    super(code);
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

const requiredFontName = (
  codes: Readonly<{
    required: FontUploadValidationErrorCode;
    tooLong: FontUploadValidationErrorCode;
    unsafe: FontUploadValidationErrorCode;
  }>
) =>
  z
    .string()
    .trim()
    .min(1, codes.required)
    .max(120, codes.tooLong)
    .refine(
      (value) =>
        !unsafeFontReference.test(value) && !unsafeMetadataCharacters.test(value),
      codes.unsafe
    );

const metadataSchema = z
  .object({
    displayName: requiredFontName({
      required: "display_name_required",
      tooLong: "display_name_too_long",
      unsafe: "display_name_unsafe",
    }),
    familyName: requiredFontName({
      required: "family_name_required",
      tooLong: "family_name_too_long",
      unsafe: "family_name_unsafe",
    }),
    weightMin: z
      .number()
      .int("weight_min_integer")
      .min(1, "weight_min_range")
      .max(1000, "weight_min_range"),
    weightMax: z
      .number()
      .int("weight_max_integer")
      .min(1, "weight_max_range")
      .max(1000, "weight_max_range"),
    style: z.enum(["normal", "italic", "oblique"], {
      message: "style_invalid",
    }),
    isVariable: z.boolean({
      message: "variable_flag_invalid",
    }),
    licenseName: z
      .string()
      .trim()
      .min(2, "license_name_required")
      .max(180, "license_name_too_long"),
    licenseUrl: z
      .string()
      .trim()
      .max(2048, "license_url_too_long")
      .nullable(),
  })
  .superRefine(({ weightMin, weightMax, isVariable, licenseUrl }, context) => {
    if (weightMin > weightMax) {
      context.addIssue({
        code: "custom",
        message: "weight_order_invalid",
        path: ["weightMin"],
      });
    }
    if (!isVariable && weightMin !== weightMax) {
      context.addIssue({
        code: "custom",
        message: "fixed_weight_range_invalid",
        path: ["weightMax"],
      });
    }
    if (licenseUrl && !isSafeHttpUrl(licenseUrl)) {
      context.addIssue({
        code: "custom",
        message: "license_url_invalid",
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
    throw new FontUploadValidationError("metadata_weight_integer");
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
      (parsed.error.issues[0]?.message as
        | FontUploadValidationErrorCode
        | undefined) ?? "metadata_invalid"
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
    throw new FontUploadValidationError("file_name_invalid");
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
    throw new FontUploadValidationError("file_empty");
  }
  if (bytes.byteLength > MAX_FONT_UPLOAD_BYTES) {
    throw new FontUploadValidationError("file_too_large", 413);
  }

  const originalName = safeOriginalName(input.originalName);
  const format = formatFromExtension(originalName);
  if (!format) {
    throw new FontUploadValidationError("file_extension_invalid", 415);
  }

  const specification = fontSpecifications[format];
  const mimeType = normalizeMimeType(input.mimeType);
  if (!specification.mimeTypes.includes(mimeType)) {
    throw new FontUploadValidationError("file_mime_invalid", 415);
  }
  if (!hasExpectedMagic(bytes, specification.magic)) {
    throw new FontUploadValidationError("file_signature_invalid", 415);
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

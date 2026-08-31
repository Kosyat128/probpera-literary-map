import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
import {
  FontUploadValidationError,
  hasForbiddenRemoteFontInput,
  isDatabaseUniqueConflict,
  isStorageObjectAlreadyPresent,
  MAX_FONT_UPLOAD_BYTES,
  parseFontUploadMetadata,
  SITE_FONT_BUCKET,
  validateFontFile,
} from "@/lib/font-upload";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function formValue(formData: FormData, camelCase: string, snakeCase: string) {
  return formData.get(camelCase) ?? formData.get(snakeCase);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) {
    return errorResponse("Требуется доступ администратора редакции.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Передайте файл шрифта и его описание.", 400);
  }

  if (hasForbiddenRemoteFontInput(formData)) {
    return errorResponse(
      "Загрузка шрифтов по внешней ссылке или через CSS-импорт запрещена.",
      400
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    const remoteAttempt =
      typeof file === "string" &&
      /(?:@import\b|url\s*\(|https?:\/\/|^\/\/)/iu.test(file.trim());
    return errorResponse(
      remoteAttempt
        ? "Загрузка шрифтов по внешней ссылке или через CSS-импорт запрещена."
        : "Выберите локальный файл шрифта WOFF2 или WOFF.",
      400
    );
  }
  if (file.size <= 0) {
    return errorResponse("Выбранный файл шрифта пуст.", 400);
  }
  if (file.size > MAX_FONT_UPLOAD_BYTES) {
    return errorResponse("Файл шрифта превышает допустимый размер 2 МБ.", 413);
  }

  try {
    const metadata = parseFontUploadMetadata({
      displayName: formValue(formData, "displayName", "display_name"),
      familyName: formValue(formData, "familyName", "family_name"),
      weightMin: formValue(formData, "weightMin", "weight_min"),
      weightMax: formValue(formData, "weightMax", "weight_max"),
      style: formData.get("style"),
      isVariable: formValue(formData, "isVariable", "is_variable"),
      licenseName: formValue(formData, "licenseName", "license_name"),
      licenseUrl: formValue(formData, "licenseUrl", "license_url"),
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      return errorResponse(
        "Не удалось подтвердить размер файла шрифта. Выберите файл заново.",
        422
      );
    }
    const font = validateFontFile({
      bytes,
      mimeType: file.type,
      originalName: file.name,
    });

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return errorResponse("Хранилище шрифтов временно недоступно.", 503);
    }

    const storage = supabase.storage.from(SITE_FONT_BUCKET);
    const { error: uploadError } = await storage.upload(font.objectPath, font.bytes, {
      cacheControl: "31536000",
      contentType: font.contentType,
      upsert: false,
    });
    if (uploadError && !isStorageObjectAlreadyPresent(uploadError)) {
      console.error("Font upload: storage rejected the object", uploadError);
      return errorResponse(
        "Не удалось сохранить файл шрифта. Повторите попытку.",
        502
      );
    }

    const { data, error: insertError } = await supabase
      .from("font_assets")
      .insert({
        source_type: "uploaded",
        storage_bucket: SITE_FONT_BUCKET,
        object_path: font.objectPath,
        original_name: font.originalName,
        display_name: metadata.displayName,
        family_name: metadata.familyName,
        format: font.format,
        mime_type: font.contentType,
        sha256_hex: font.sha256Hex,
        byte_size: font.byteSize,
        is_variable: metadata.isVariable,
        weight_min: metadata.weightMin,
        weight_max: metadata.weightMax,
        font_style: metadata.style,
        license_name: metadata.licenseName,
        license_url: metadata.licenseUrl,
        uploaded_by: session.user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      // The content-addressed object is intentionally retained. Deleting it
      // here could race with another request that already references the same
      // hash; unreferenced objects are handled by the staged cleanup workflow.
      if (isDatabaseUniqueConflict(insertError)) {
        return errorResponse("Этот файл шрифта уже добавлен.", 409);
      }
      console.error("Font upload: font_assets insert failed", insertError);
      return errorResponse(
        "Не удалось зарегистрировать шрифт. Повторите попытку.",
        502
      );
    }

    return NextResponse.json(
      {
        ok: true,
        id: data.id,
        sourceType: "uploaded",
        format: font.format,
        displayName: metadata.displayName,
        familyName: metadata.familyName,
        objectPath: font.objectPath,
        sha256: font.sha256Hex,
        byteSize: font.byteSize,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof FontUploadValidationError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Font upload: unexpected failure", error);
    return errorResponse("Не удалось обработать файл шрифта.", 422);
  }
}

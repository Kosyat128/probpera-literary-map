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

function errorResponse(errorCode: string, status: number) {
  return NextResponse.json(
    { errorCode },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) {
    return errorResponse("admin_access_required", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("form_data_invalid", 400);
  }

  if (hasForbiddenRemoteFontInput(formData)) {
    return errorResponse("remote_font_forbidden", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    const remoteAttempt =
      typeof file === "string" &&
      /(?:@import\b|url\s*\(|https?:\/\/|^\/\/)/iu.test(file.trim());
    return errorResponse(
      remoteAttempt ? "remote_font_forbidden" : "file_required",
      400
    );
  }
  if (file.size <= 0) {
    return errorResponse("file_empty", 400);
  }
  if (file.size > MAX_FONT_UPLOAD_BYTES) {
    return errorResponse("file_too_large", 413);
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
      return errorResponse("file_size_mismatch", 422);
    }
    const font = validateFontFile({
      bytes,
      mimeType: file.type,
      originalName: file.name,
    });

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return errorResponse("storage_unavailable", 503);
    }

    const storage = supabase.storage.from(SITE_FONT_BUCKET);
    const { error: uploadError } = await storage.upload(font.objectPath, font.bytes, {
      cacheControl: "31536000",
      contentType: font.contentType,
      upsert: false,
    });
    if (uploadError && !isStorageObjectAlreadyPresent(uploadError)) {
      console.error("Font upload: storage rejected the object", uploadError);
      return errorResponse("storage_write_failed", 502);
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
        return errorResponse("font_already_added", 409);
      }
      console.error("Font upload: font_assets insert failed", insertError);
      return errorResponse("font_registration_failed", 502);
    }

    return NextResponse.json(
      {
        ok: true,
        id: data.id,
        displayName: metadata.displayName,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof FontUploadValidationError) {
      return errorResponse(error.code, error.status);
    }
    console.error("Font upload: unexpected failure", error);
    return errorResponse("font_processing_failed", 422);
  }
}

import { createHash } from "node:crypto";
import { inspectRasterImage, isGifImage } from "../../../../../../src/utils/rasterImageMetadata";
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from "../../../../../../src/utils/imageUploadOptimization";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxClientDimension = MAX_IMAGE_DIMENSION;
const maxClientPixelArea = MAX_IMAGE_PIXELS;
const maxFileSize = Math.floor(3.9 * 1024 * 1024);

const metadataSchema = z
  .object({
    altText: z.string().trim().min(3).max(500),
    caption: z.string().trim().max(1000),
    creator: z.string().trim().max(240),
    sourceUrl: z.string().url().nullable(),
    licenseName: z.string().trim().max(180),
    licenseUrl: z.string().url().nullable(),
    collectionName: z.string().trim().min(2).max(120),
    imageUsage: z.enum(["cover", "hero", "gallery", "inline"]),
    clientWidth: z.coerce.number().int().min(1).max(maxClientDimension),
    clientHeight: z.coerce.number().int().min(1).max(maxClientDimension),
  })
  .refine(
    ({ clientWidth, clientHeight }) =>
      clientWidth * clientHeight <= maxClientPixelArea,
    {
      message: "Размеры подготовленного изображения слишком велики.",
      path: ["clientWidth"],
    }
  );

function optionalUrl(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется редакционный доступ." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Выберите файл." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json(
      { error: "Выбранный файл пуст. Выберите другое изображение." },
      { status: 400 }
    );
  }
  if (file.size > maxFileSize) {
    return NextResponse.json(
      {
        error:
          "Подготовленное изображение превышает 3,9 МБ. Повторите загрузку или выберите файл меньшего размера.",
      },
      { status: 413 }
    );
  }

  const parsed = metadataSchema.safeParse({
    altText: formData.get("alt_text"),
    caption: String(formData.get("caption") || ""),
    creator: String(formData.get("creator") || ""),
    sourceUrl: optionalUrl(formData.get("source_url")),
    licenseName: String(formData.get("license_name") || ""),
    licenseUrl: optionalUrl(formData.get("license_url")),
    collectionName: String(formData.get("collection_name") || "Общее"),
    imageUsage: String(formData.get("image_usage") || "inline"),
    clientWidth: formData.get("client_width"),
    clientHeight: formData.get("client_height"),
  });
  if (!parsed.success) {
    const dimensionError = parsed.error.issues.some((issue) =>
      ["clientWidth", "clientHeight"].includes(String(issue.path[0] || ""))
    );
    return NextResponse.json(
      {
        error: dimensionError
          ? "Не удалось подтвердить размеры изображения. Подготовьте файл в редакторе ещё раз."
          : parsed.error.issues[0]?.message || "Проверьте описание файла.",
      },
      { status: 400 }
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256Hex = createHash("sha256").update(bytes).digest("hex");
    const imageDimensions = inspectRasterImage(bytes);
    if (!imageDimensions || file.type !== imageDimensions.mime) {
      return NextResponse.json(
        {
          error:
            isGifImage(bytes)
              ? "GIF не поддерживается. Используйте анимированный WebP или AVIF, чтобы сохранить все кадры."
              : "Формат или структура изображения не прошли проверку. Поддерживаются JPEG, PNG, WebP и AVIF; выберите файл заново.",
        },
        { status: 415 }
      );
    }
    if (
      imageDimensions.width !== parsed.data.clientWidth ||
      imageDimensions.height !== parsed.data.clientHeight ||
      imageDimensions.width > maxClientDimension ||
      imageDimensions.height > maxClientDimension ||
      imageDimensions.width * imageDimensions.height > maxClientPixelArea
    ) {
      return NextResponse.json(
        {
          error:
            "Размеры файла не совпали с подготовленным изображением. Выберите исходник заново.",
        },
        { status: 422 }
      );
    }

    const today = new Date();
    const objectPath = `${today.getUTCFullYear()}/${String(today.getUTCMonth() + 1).padStart(2, "0")}/${globalThis.crypto.randomUUID()}.${imageDimensions.extension}`;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "База данных не подключена." }, { status: 503 });
    }

    const { error: uploadError } = await supabase.storage
      .from("editorial-media")
      .upload(objectPath, bytes, {
        contentType: imageDimensions.mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("editorial-media")
      .getPublicUrl(objectPath);
    const { data, error: insertError } = await supabase
      .from("media_assets")
      .insert({
        object_path: objectPath,
        original_name: file.name,
        mime_type: imageDimensions.mime,
        byte_size: bytes.byteLength,
        width: imageDimensions.width,
        height: imageDimensions.height,
        sha256_hex: sha256Hex,
        alt_text: parsed.data.altText,
        caption: parsed.data.caption,
        creator: parsed.data.creator,
        source_url: parsed.data.sourceUrl,
        license_name: parsed.data.licenseName,
        license_url: parsed.data.licenseUrl,
        collection_name: parsed.data.collectionName,
        uploaded_by: session.user.id,
      })
      .select("id")
      .single();
    if (insertError) {
      await supabase.storage.from("editorial-media").remove([objectPath]);
      throw insertError;
    }

    await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "media.uploaded",
      entity_type: "media",
      entity_id: data.id,
      metadata: {
        original_name: file.name,
        object_path: objectPath,
        optimized_size: bytes.byteLength,
        image_usage: parsed.data.imageUsage,
        client_prepared: true,
        format: imageDimensions.mime,
        animated: imageDimensions.animated,
        dimensions_source: "validated-image-container",
        source_dimensions: {
          width: imageDimensions.width,
          height: imageDimensions.height,
        },
        sha256: sha256Hex,
      },
    });

    const publication = await requestPublicBuild({
      supabase,
      actorId: session.user.id,
      entityType: "media",
      entityId: data.id,
      reason: "media.uploaded",
      metadata: { imageUsage: parsed.data.imageUsage },
    });

    return NextResponse.json({
      ok: true,
      id: data.id,
      mediaId: data.id,
      url: publicUrlData.publicUrl,
      width: imageDimensions.width,
      height: imageDimensions.height,
      sha256: sha256Hex,
      publication: publication.state,
    });
  } catch (error) {
    const incidentId = globalThis.crypto.randomUUID();
    console.error("media_upload_failed", {
      incidentId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error: `Не удалось безопасно обработать файл. Код события: ${incidentId}`,
      },
      { status: 422 }
    );
  }
}

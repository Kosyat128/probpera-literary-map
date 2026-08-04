import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const metadataSchema = z.object({
  altText: z.string().trim().min(3).max(500),
  caption: z.string().trim().max(1000),
  creator: z.string().trim().max(240),
  sourceUrl: z.string().url().nullable(),
  licenseName: z.string().trim().max(180),
  licenseUrl: z.string().url().nullable(),
  collectionName: z.string().trim().min(2).max(120),
});

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const maxFileSize = 12 * 1024 * 1024;
const resizePresets = {
  cover: { width: 1800, height: 2700 },
  hero: { width: 2400, height: 1600 },
  gallery: { width: 2000, height: 2000 },
  inline: { width: 2000, height: 2000 },
} as const;

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
  if (!acceptedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Разрешены JPEG, PNG, WebP и AVIF. SVG не принимается из соображений безопасности." },
      { status: 415 }
    );
  }
  if (file.size <= 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "Файл должен быть не больше 12 МБ." }, { status: 413 });
  }

  const parsed = metadataSchema.safeParse({
    altText: formData.get("alt_text"),
    caption: String(formData.get("caption") || ""),
    creator: String(formData.get("creator") || ""),
    sourceUrl: optionalUrl(formData.get("source_url")),
    licenseName: String(formData.get("license_name") || ""),
    licenseUrl: optionalUrl(formData.get("license_url")),
    collectionName: String(formData.get("collection_name") || "Общее"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Проверьте описание файла." },
      { status: 400 }
    );
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    const image = sharp(source, { failOn: "warning" }).rotate();
    const imageMetadata = await image.metadata();
    if (!imageMetadata.width || !imageMetadata.height) {
      return NextResponse.json({ error: "Не удалось прочитать изображение." }, { status: 422 });
    }

    const requestedUsage = String(formData.get("image_usage") || "inline");
    const imageUsage =
      requestedUsage in resizePresets
        ? (requestedUsage as keyof typeof resizePresets)
        : "inline";
    const resize = resizePresets[imageUsage];

    const optimized = await image
      .resize({
        width: resize.width,
        height: resize.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86, effort: 5 })
      .toBuffer();
    const finalMetadata = await sharp(optimized).metadata();
    const today = new Date();
    const objectPath = `${today.getUTCFullYear()}/${String(today.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "База данных не подключена." }, { status: 503 });
    }

    const { error: uploadError } = await supabase.storage
      .from("editorial-media")
      .upload(objectPath, optimized, {
        contentType: "image/webp",
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
        mime_type: "image/webp",
        byte_size: optimized.byteLength,
        width: finalMetadata.width || null,
        height: finalMetadata.height || null,
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
        optimized_size: optimized.byteLength,
        image_usage: imageUsage,
        source_dimensions: {
          width: imageMetadata.width,
          height: imageMetadata.height,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      id: data.id,
      url: publicUrlData.publicUrl,
      width: finalMetadata.width,
      height: finalMetadata.height,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать файл.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

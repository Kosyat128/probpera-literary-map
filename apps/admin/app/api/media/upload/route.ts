import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxClientDimension = 4096;
const maxClientPixelArea = 12_000_000;
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

function hasWebpMagic(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (!hasWebpMagic(bytes) || readUint32LE(bytes, 4) + 8 !== bytes.length) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize = readUint32LE(bytes, offset + 4);
    const payload = offset + 8;

    if (payload + chunkSize > bytes.length) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readUint24LE(bytes, payload + 4) + 1,
        height: readUint24LE(bytes, payload + 7) + 1,
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[payload] === 0x2f) {
      const width =
        1 + bytes[payload + 1] + ((bytes[payload + 2] & 0x3f) << 8);
      const height =
        1 +
        (bytes[payload + 2] >> 6) +
        (bytes[payload + 3] << 2) +
        ((bytes[payload + 4] & 0x0f) << 10);
      return { width, height };
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      bytes[payload + 3] === 0x9d &&
      bytes[payload + 4] === 0x01 &&
      bytes[payload + 5] === 0x2a
    ) {
      return {
        width: (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff,
        height: (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff,
      };
    }

    offset = payload + chunkSize + (chunkSize % 2);
  }

  return null;
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
  if (file.type !== "image/webp") {
    return NextResponse.json(
      {
        error:
          "Сервер принимает только WebP, подготовленный редактором. Выберите изображение заново.",
      },
      { status: 415 }
    );
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
    const imageDimensions = readWebpDimensions(bytes);
    if (!imageDimensions) {
      return NextResponse.json(
        {
          error:
            "Файл не прошёл проверку структуры WebP. Выберите исходное изображение и повторите загрузку.",
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
    const objectPath = `${today.getUTCFullYear()}/${String(today.getUTCMonth() + 1).padStart(2, "0")}/${globalThis.crypto.randomUUID()}.webp`;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "База данных не подключена." }, { status: 503 });
    }

    const { error: uploadError } = await supabase.storage
      .from("editorial-media")
      .upload(objectPath, bytes, {
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
        byte_size: bytes.byteLength,
        width: imageDimensions.width,
        height: imageDimensions.height,
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
        client_optimized: true,
        dimensions_source: "client-prepared-webp",
        source_dimensions: {
          width: imageDimensions.width,
          height: imageDimensions.height,
        },
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
      url: publicUrlData.publicUrl,
      width: imageDimensions.width,
      height: imageDimensions.height,
      publication: publication.state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать файл.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

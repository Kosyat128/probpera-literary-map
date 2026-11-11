import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
import {
  EDITOR_MEDIA_PAGE_SIZE,
  encodeEditorMediaCursor,
  isEditorMediaAsset,
  isEditorMediaAssetRow,
  parseEditorMediaCursor,
} from "@/lib/editor-media-assets-contract";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const assetColumns =
  "id,bucket,object_path,alt_text,caption,creator,source_url,license_name,license_url,collection_name,width,height,created_at";

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Требуется редакционный доступ." },
      { status: 401 }
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Медиатека временно недоступна." },
      { status: 503 }
    );
  }

  const parameters = new URL(request.url).searchParams;
  const rawCursor = parameters.get("cursor");
  const cursor = rawCursor === null ? null : parseEditorMediaCursor(rawCursor);
  if (rawCursor !== null && !cursor) {
    return NextResponse.json({ error: "Некорректная страница медиатеки." }, { status: 400 });
  }
  const term = parameters
    .get("q")
    ?.replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
  let query = supabase
    .from("media_assets")
    .select(assetColumns)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(EDITOR_MEDIA_PAGE_SIZE + 1);
  const filters: string[] = [];
  // Escape LIKE metacharacters first, then quote the PostgREST grammar value.
  const quote = (value: string) => `"${value.replace(/[\\"]/gu, (character) => `\\${character}`)}"`;
  if (term) {
    const literalTerm = term.replace(/[\\%_]/gu, (character) => `\\${character}`);
    filters.push(`or(${["original_name", "alt_text", "caption", "collection_name"]
      .map((field) => `${field}.ilike.${quote(`%${literalTerm}%`)}`).join(",")})`);
  }
  if (cursor) filters.push(`or(created_at.lt.${quote(cursor.createdAt)},and(created_at.eq.${quote(cursor.createdAt)},id.lt.${cursor.id}))`);
  if (filters.length) query = query.or(filters.length === 1 ? filters[0].slice(3, -1) : `and(${filters.join(",")})`);

  const response = await query.then((result) => result, () => null);
  const data = response?.data;
  if (!response || response.error || !Array.isArray(data) || data.length > EDITOR_MEDIA_PAGE_SIZE + 1
    || !data.every(isEditorMediaAssetRow) || new Set(data.map((asset) => asset.id.toLowerCase())).size !== data.length) {
    return NextResponse.json(
      { error: "Не удалось загрузить список изображений." },
      { status: 502 }
    );
  }

  const visible = data.slice(0, EDITOR_MEDIA_PAGE_SIZE);
  let assets;
  try { assets = visible.map((asset) => ({
    id: asset.id,
    src: supabase.storage
      .from(asset.bucket)
      .getPublicUrl(asset.object_path).data.publicUrl,
    alt: asset.alt_text || "",
    caption: asset.caption || "",
    creator: asset.creator || "",
    sourceUrl: asset.source_url || "",
    licenseName: asset.license_name || "",
    licenseUrl: asset.license_url || "",
    collectionName: asset.collection_name || "",
    width: Number(asset.width || 0),
    height: Number(asset.height || 0),
  })); } catch {
    return NextResponse.json({ error: "Не удалось загрузить список изображений." }, { status: 502 });
  }
  if (!assets.every(isEditorMediaAsset)) {
    return NextResponse.json({ error: "Не удалось загрузить список изображений." }, { status: 502 });
  }
  const last = visible.at(-1);
  const nextCursor = data.length > EDITOR_MEDIA_PAGE_SIZE && last
    ? encodeEditorMediaCursor({ createdAt: last.created_at, id: last.id }) : null;

  return NextResponse.json(
    { ok: true, assets, nextCursor },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

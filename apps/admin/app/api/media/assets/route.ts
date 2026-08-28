import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
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

  const term = new URL(request.url).searchParams
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
    .limit(60);
  if (term) {
    const literalTerm = term.replace(/[\\%_]/gu, (character) => `\\${character}`);
    query = query.ilike("alt_text", `%${literalTerm}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Не удалось загрузить список изображений." },
      { status: 502 }
    );
  }

  const assets = (data || []).map((asset) => ({
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
  }));

  return NextResponse.json(
    { ok: true, assets },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

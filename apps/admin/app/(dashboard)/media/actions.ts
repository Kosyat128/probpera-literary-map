"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const mediaSchema = z.object({
  id: z.string().uuid(),
  altText: z.string().trim().min(3).max(500),
  caption: z.string().trim().max(1000),
  creator: z.string().trim().max(240),
  sourceUrl: z.union([z.string().url(), z.literal("")]),
  licenseName: z.string().trim().max(180),
  licenseUrl: z.union([z.string().url(), z.literal("")]),
  collectionName: z.string().trim().min(2).max(180),
  focusX: z.coerce.number().min(0).max(1),
  focusY: z.coerce.number().min(0).max(1),
});

export async function updateMediaMetadataAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = mediaSchema.safeParse({
    id: formData.get("id"),
    altText: formData.get("alt_text"),
    caption: String(formData.get("caption") || ""),
    creator: String(formData.get("creator") || ""),
    sourceUrl: String(formData.get("source_url") || ""),
    licenseName: String(formData.get("license_name") || ""),
    licenseUrl: String(formData.get("license_url") || ""),
    collectionName: formData.get("collection_name"),
    focusX: formData.get("focus_x") || 0.5,
    focusY: formData.get("focus_y") || 0.5,
  });
  if (!parsed.success) {
    redirect(
      `/media?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "Проверьте описание изображения"
      )}`
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/media?error=База данных не подключена");
  const { error } = await supabase
    .from("media_assets")
    .update({
      alt_text: parsed.data.altText,
      caption: parsed.data.caption,
      creator: parsed.data.creator,
      source_url: parsed.data.sourceUrl || null,
      license_name: parsed.data.licenseName,
      license_url: parsed.data.licenseUrl || null,
      collection_name: parsed.data.collectionName,
      focus_x: parsed.data.focusX,
      focus_y: parsed.data.focusY,
    })
    .eq("id", parsed.data.id);
  if (error) redirect(`/media?error=${encodeURIComponent(error.message)}`);
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.updated",
    entity_type: "media",
    entity_id: parsed.data.id,
    metadata: {
      license: parsed.data.licenseName,
    },
  });
  await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: parsed.data.id,
    reason: "media.updated",
  });
  revalidatePath("/media");
  redirect("/media?saved=1");
}

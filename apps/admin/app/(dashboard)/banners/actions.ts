"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { isSafePublicHref } from "@/lib/public-href";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]);
const bannerSchema = z.object({
  id: optionalUuid,
  expectedUpdatedAt: z.union([z.string().datetime({ offset: true }), z.literal("")]),
  name: z.string().trim().min(2).max(160),
  title: z.string().trim().max(240),
  description: z.string().trim().max(1200),
  targetUrl: z.string().trim().max(600),
  buttonText: z.string().trim().max(120),
  desktopMediaId: optionalUuid,
  tabletMediaId: optionalUuid,
  mobileMediaId: optionalUuid,
  startsAt: z.string().trim().max(40),
  endsAt: z.string().trim().max(40),
  displayOrder: z.coerce.number().int().min(-10_000).max(10_000),
  pagePatterns: z.array(z.string().max(240)).max(50),
  active: z.boolean(),
});

function pagePatterns(value: FormDataEntryValue | null) {
  return String(value || "/")
    .split(/[\r\n,;]+/u)
    .map((item) => item.trim())
    .filter((item) => item.startsWith("/"))
    .slice(0, 50);
}

function nullable(value: string) {
  return value || null;
}

async function saveAuditAndBuild(
  actorId: string,
  bannerId: string,
  action: string
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return "queue-error" as const;
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "banner",
    entity_id: bannerId,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId,
    entityType: "banner",
    entityId: bannerId,
    reason: action,
  });
  return publication.state;
}

export async function saveBannerAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = bannerSchema.safeParse({
    id: String(formData.get("id") || ""),
    expectedUpdatedAt: String(formData.get("expected_updated_at") || ""),
    name: formData.get("name"),
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    targetUrl: String(formData.get("target_url") || ""),
    buttonText: String(formData.get("button_text") || ""),
    desktopMediaId: String(formData.get("desktop_media_id") || ""),
    tabletMediaId: String(formData.get("tablet_media_id") || ""),
    mobileMediaId: String(formData.get("mobile_media_id") || ""),
    startsAt: String(formData.get("starts_at") || ""),
    endsAt: String(formData.get("ends_at") || ""),
    displayOrder: formData.get("display_order") || 0,
    pagePatterns: pagePatterns(formData.get("page_patterns")),
    active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    redirect(`/banners?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Проверьте поля баннера")}`);
  }
  if (
    parsed.data.targetUrl &&
    !isSafePublicHref(parsed.data.targetUrl)
  ) {
    redirect("/banners?error=Ссылка должна начинаться с / или https://");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/banners?error=База данных не подключена");
  const payload = {
    name: parsed.data.name,
    title: parsed.data.title,
    description: parsed.data.description,
    target_url: nullable(parsed.data.targetUrl),
    button_text: parsed.data.buttonText,
    desktop_media_id: nullable(parsed.data.desktopMediaId),
    tablet_media_id: nullable(parsed.data.tabletMediaId),
    mobile_media_id: nullable(parsed.data.mobileMediaId),
    starts_at: nullable(parsed.data.startsAt),
    ends_at: nullable(parsed.data.endsAt),
    display_order: parsed.data.displayOrder,
    page_patterns: parsed.data.pagePatterns.length
      ? parsed.data.pagePatterns
      : ["/"],
    is_active: parsed.data.active,
    updated_by: session.user.id,
  };
  let bannerId = parsed.data.id;
  if (bannerId) {
    if (!parsed.data.expectedUpdatedAt) {
      redirect("/banners?error=Версия баннера не указана. Обновите страницу.");
    }
    const { data: updated, error } = await supabase
      .from("banners")
      .update(payload)
      .eq("id", bannerId)
      .eq("updated_at", parsed.data.expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error) redirect(`/banners?error=${encodeURIComponent(error.message)}`);
    if (!updated) {
      redirect("/banners?error=Баннер уже изменён в другой вкладке. Обновите страницу и повторите правку.");
    }
  } else {
    const { data, error } = await supabase
      .from("banners")
      .insert({ ...payload, created_by: session.user.id })
      .select("id")
      .single();
    if (error || !data) {
      redirect(`/banners?error=${encodeURIComponent(error?.message || "Баннер не создан")}`);
    }
    bannerId = data.id;
  }
  const publication = await saveAuditAndBuild(
    session.user.id,
    bannerId,
    parsed.data.id ? "banner.updated" : "banner.created"
  );
  revalidatePath("/banners");
  redirect(`/banners?saved=1&published=${publication}`);
}

export async function deleteBannerAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const expectedUpdatedAt = z.string().datetime({ offset: true }).safeParse(
    formData.get("expected_updated_at")
  );
  if (!id.success) redirect("/banners?error=Некорректный баннер");
  if (!expectedUpdatedAt.success) redirect("/banners?error=Версия баннера не указана. Обновите страницу.");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/banners?error=База данных не подключена");
  const { data: deleted, error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt.data)
    .select("id")
    .maybeSingle();
  if (error) redirect(`/banners?error=${encodeURIComponent(error.message)}`);
  if (!deleted) {
    redirect("/banners?error=Баннер уже изменён или удалён. Обновите страницу.");
  }
  const publication = await saveAuditAndBuild(session.user.id, id.data, "banner.deleted");
  revalidatePath("/banners");
  redirect(`/banners?deleted=1&published=${publication}`);
}

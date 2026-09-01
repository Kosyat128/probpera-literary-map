"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { isSafePublicHref } from "@/lib/public-href";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]);
const navigationSchema = z.object({
  id: optionalUuid,
  menuId: z.string().uuid(),
  parentId: optionalUuid,
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(600),
  displayOrder: z.coerce.number().int().min(-10_000).max(10_000),
  newTab: z.boolean(),
  visible: z.boolean(),
  expectedUpdatedAt: z.union([z.string().datetime({ offset: true }), z.literal("")]),
});

function menuTarget(
  formData: FormData,
  notice?: { error?: string; saved?: string; deleted?: string; published?: string },
  itemId?: string
) {
  const params = new URLSearchParams();
  const location = String(formData.get("context_location") || "");
  if (location === "header" || location === "footer") params.set("location", location);
  for (const [name, value] of Object.entries(notice || {})) {
    if (value) params.set(name, value.slice(0, name === "error" ? 500 : 40));
  }
  return `/menus${params.size ? `?${params.toString()}` : ""}${itemId ? `#navigation-item-${itemId}` : ""}`;
}

async function finishNavigationAction(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  itemId: string,
  action: string
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "navigation_item",
    entity_id: itemId,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId,
    entityType: "navigation_item",
    entityId: itemId,
    reason: action,
  });
  revalidatePath("/menus");
  return publication.state;
}

export async function saveNavigationItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = navigationSchema.safeParse({
    id: String(formData.get("id") || ""),
    menuId: formData.get("menu_id"),
    parentId: String(formData.get("parent_id") || ""),
    label: formData.get("label"),
    href: formData.get("href"),
    displayOrder: formData.get("display_order") || 0,
    newTab: formData.get("open_in_new_tab") === "on",
    visible: formData.get("is_visible") === "on",
    expectedUpdatedAt: String(formData.get("expected_updated_at") || ""),
  });
  if (!parsed.success) {
    redirect(menuTarget(formData, { error: parsed.error.issues[0]?.message || "Проверьте пункт меню" }));
  }
  if (
    !isSafePublicHref(parsed.data.href, { allowHash: true })
  ) {
    redirect(menuTarget(formData, { error: "Ссылка должна начинаться с /, # или https://" }));
  }
  if (parsed.data.id && parsed.data.parentId === parsed.data.id) {
    redirect(menuTarget(formData, { error: "Пункт не может быть родителем самому себе" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(menuTarget(formData, { error: "База данных не подключена" }));
  const payload = {
    menu_id: parsed.data.menuId,
    parent_id: parsed.data.parentId || null,
    label: parsed.data.label,
    href: parsed.data.href,
    display_order: parsed.data.displayOrder,
    open_in_new_tab: parsed.data.newTab,
    is_visible: parsed.data.visible,
  };
  let itemId = parsed.data.id;
  if (itemId) {
    if (!parsed.data.expectedUpdatedAt) {
      redirect(menuTarget(formData, { error: "Версия пункта не указана. Обновите страницу." }, itemId));
    }
    const { data: updated, error } = await supabase
      .from("navigation_items")
      .update(payload)
      .eq("id", itemId)
      .eq("updated_at", parsed.data.expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error) redirect(menuTarget(formData, { error: operatorDataError("menus", "save") }, itemId));
    if (!updated) {
      redirect(menuTarget(formData, {
        error: "Пункт меню уже изменили в другой вкладке. Обновите страницу и повторите правку.",
      }, itemId));
    }
  } else {
    const { data, error } = await supabase
      .from("navigation_items")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      redirect(menuTarget(formData, { error: operatorDataError("menus", "create") }));
    }
    itemId = data.id;
  }
  const publication = await finishNavigationAction(
    supabase,
    session.user.id,
    itemId,
    parsed.data.id ? "navigation.updated" : "navigation.created"
  );
  redirect(menuTarget(formData, { saved: "1", published: publication }, itemId));
}

export async function deleteNavigationItemAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const expectedUpdatedAt = z.string().datetime({ offset: true }).safeParse(
    formData.get("expected_updated_at")
  );
  if (!id.success || !expectedUpdatedAt.success) {
    redirect(menuTarget(formData, { error: "Некорректный пункт или версия" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(menuTarget(formData, { error: "База данных не подключена" }));
  const { data: deleted, error } = await supabase
    .from("navigation_items")
    .delete()
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt.data)
    .select("id")
    .maybeSingle();
  if (error) redirect(menuTarget(formData, { error: operatorDataError("menus", "delete") }));
  if (!deleted) {
    redirect(menuTarget(formData, {
      error: "Пункт меню уже изменили в другой вкладке. Обновите страницу перед удалением.",
    }));
  }
  const publication = await finishNavigationAction(
    supabase,
    session.user.id,
    id.data,
    "navigation.deleted"
  );
  redirect(menuTarget(formData, { deleted: "1", published: publication }));
}

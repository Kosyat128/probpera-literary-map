"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { triggerPublicBuild } from "@/lib/public-build";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
});

async function finishNavigationAction(
  actorId: string,
  itemId: string,
  action: string
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return;
  const build = await triggerPublicBuild(action);
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "navigation_item",
    entity_id: itemId,
    metadata: { publicBuildRequested: build.ok },
  });
  revalidatePath("/menus");
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
  });
  if (!parsed.success) {
    redirect(`/menus?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Проверьте пункт меню")}`);
  }
  if (
    !parsed.data.href.startsWith("/") &&
    !parsed.data.href.startsWith("#") &&
    !/^https:\/\//iu.test(parsed.data.href)
  ) {
    redirect("/menus?error=Ссылка должна начинаться с /, # или https://");
  }
  if (parsed.data.id && parsed.data.parentId === parsed.data.id) {
    redirect("/menus?error=Пункт не может быть родителем самому себе");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/menus?error=База данных не подключена");
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
    const { error } = await supabase
      .from("navigation_items")
      .update(payload)
      .eq("id", itemId);
    if (error) redirect(`/menus?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data, error } = await supabase
      .from("navigation_items")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      redirect(`/menus?error=${encodeURIComponent(error?.message || "Пункт не создан")}`);
    }
    itemId = data.id;
  }
  await finishNavigationAction(
    session.user.id,
    itemId,
    parsed.data.id ? "navigation.updated" : "navigation.created"
  );
  redirect("/menus?saved=1");
}

export async function deleteNavigationItemAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/menus?error=Некорректный пункт");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/menus?error=База данных не подключена");
  const { error } = await supabase
    .from("navigation_items")
    .delete()
    .eq("id", id.data);
  if (error) redirect(`/menus?error=${encodeURIComponent(error.message)}`);
  await finishNavigationAction(session.user.id, id.data, "navigation.deleted");
  redirect("/menus?deleted=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { triggerPublicBuild } from "@/lib/public-build";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
});

export async function createTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") || ""),
  });
  if (!parsed.success) redirect("/categories?error=Проверьте название");

  const kind = formData.get("kind") === "tag" ? "tag" : "category";
  const slug = createSlug(parsed.data.name);
  if (!slug) redirect("/categories?error=Не удалось создать адрес");
  const supabase = await createServerSupabaseClient();
  const { error } =
    kind === "tag"
      ? await supabase!.from("tags").insert({
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
        })
      : await supabase!.from("categories").insert({
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
        });
  if (error) redirect(`/categories?error=${encodeURIComponent(error.message)}`);

  await supabase!.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: `${kind}.created`,
    entity_type: kind,
    metadata: { name: parsed.data.name, slug },
  });
  revalidatePath("/categories");
  redirect("/categories?saved=1");
}

export async function updateTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") || ""),
  });
  if (!id.success || !parsed.success) {
    redirect("/categories?error=Проверьте поля элемента");
  }
  const kind = formData.get("kind") === "tag" ? "tag" : "category";
  const slug =
    createSlug(String(formData.get("slug") || parsed.data.name)) ||
    createSlug(parsed.data.name);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/categories?error=База данных не подключена");
  const payload =
    kind === "tag"
      ? {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
        }
      : {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          seo_title: String(formData.get("seo_title") || "").trim() || null,
          seo_description:
            String(formData.get("seo_description") || "").trim() || null,
          display_order: Number(formData.get("display_order") || 0),
          is_visible: formData.get("is_visible") === "on",
        };
  const table = kind === "tag" ? "tags" : "categories";
  const { error } = await supabase.from(table).update(payload).eq("id", id.data);
  if (error) redirect(`/categories?error=${encodeURIComponent(error.message)}`);
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: `${kind}.updated`,
    entity_type: kind,
    entity_id: id.data,
    metadata: { name: parsed.data.name, slug },
  });
  await triggerPublicBuild(`${kind}.updated`);
  revalidatePath("/categories");
  redirect("/categories?saved=1");
}

export async function deleteTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/categories?error=Некорректный элемент");
  const kind = formData.get("kind") === "tag" ? "tag" : "category";
  const table = kind === "tag" ? "tags" : "categories";
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/categories?error=База данных не подключена");
  const { error } = await supabase.from(table).delete().eq("id", id.data);
  if (error) redirect(`/categories?error=${encodeURIComponent(error.message)}`);
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: `${kind}.deleted`,
    entity_type: kind,
    entity_id: id.data,
  });
  await triggerPublicBuild(`${kind}.deleted`);
  revalidatePath("/categories");
  redirect("/categories?deleted=1");
}

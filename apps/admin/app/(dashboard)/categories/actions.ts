"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
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

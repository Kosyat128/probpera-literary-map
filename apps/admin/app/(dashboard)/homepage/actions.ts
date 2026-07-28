"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const blockTypes = new Set([
  "hero", "article-grid", "carousel", "editors-choice", "popular", "latest",
  "categories", "book-vs-screen", "literary-map", "awards", "subscription", "text",
]);

export async function createHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const blockType = String(formData.get("block_type") || "");
  if (!blockTypes.has(blockType)) return;
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase!.from("homepage_blocks").select("*", { count: "exact", head: true });
  await supabase!.from("homepage_blocks").insert({
    block_type: blockType,
    title: String(formData.get("title") || ""),
    display_order: (count || 0) * 10 + 10,
    background_style: String(formData.get("background_style") || "light"),
    updated_by: session.user.id,
  });
  revalidatePath("/homepage");
}

export async function toggleHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "true";
  const supabase = await createServerSupabaseClient();
  await supabase!.from("homepage_blocks").update({
    is_enabled: enabled,
    updated_by: session.user.id,
  }).eq("id", id);
  revalidatePath("/homepage");
}

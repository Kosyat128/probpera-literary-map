"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pageSchema = z.object({
  title: z.string().trim().min(2).max(180),
  excerpt: z.string().trim().max(700),
  content: z.string().max(500_000),
});

export async function createPageAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = pageSchema.safeParse({
    title: formData.get("title"),
    excerpt: String(formData.get("excerpt") || ""),
    content: String(formData.get("content") || ""),
  });
  if (!parsed.success) redirect("/pages?error=Проверьте поля страницы");
  const slug = createSlug(String(formData.get("slug") || parsed.data.title));
  const content = sanitizeHtml(parsed.data.content, {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
  });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!.from("pages").insert({
    title: parsed.data.title,
    slug,
    excerpt: parsed.data.excerpt,
    content_html: content.replace(/\n{2,}/g, "</p><p>").replace(/^|$/g, "<p>"),
    content_json: { type: "doc", content: [] },
    status: "draft",
    created_by: session.user.id,
    updated_by: session.user.id,
  });
  if (error) redirect(`/pages?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/pages");
  redirect("/pages?saved=1");
}

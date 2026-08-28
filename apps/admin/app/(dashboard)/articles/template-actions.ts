"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { sanitizeEditorTemplateHtml } from "@/lib/editor-template-html";
import {
  normalizeShortHyphens,
  normalizeShortHyphensDeep,
} from "@/lib/short-hyphens";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const templateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  html: z.string().min(1).max(500_000),
  json: z.unknown(),
  visibility: z.enum(["personal", "shared"]),
});

export async function saveEditorTemplateAction(input: unknown) {
  const session = await requireStaff();
  if (!session?.user) return { error: "Редакционная сессия завершена." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Некорректный шаблон." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "База данных не подключена." };
  const { data, error } = await supabase
    .from("editor_templates")
    .upsert({
      owner_id: session.user.id,
      label: normalizeShortHyphens(parsed.data.label),
      content_html: sanitizeEditorTemplateHtml(
        normalizeShortHyphens(parsed.data.html)
      ),
      content_json: normalizeShortHyphensDeep(parsed.data.json),
      visibility: parsed.data.visibility,
    }, { onConflict: "owner_id,label" })
    .select("id,label,content_html,visibility,owner_id")
    .single();
  if (error || !data) return { error: error?.message || "Шаблон не сохранён." };
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "editor_template.saved",
    entity_type: "editor_template",
    entity_id: data.id,
    metadata: { label: data.label, visibility: data.visibility },
  });
  revalidatePath("/articles");
  return { template: { id: data.id, label: data.label, html: data.content_html, visibility: data.visibility, canDelete: true } };
}

export async function deleteEditorTemplateAction(id: string) {
  const session = await requireStaff();
  if (!session?.user || !z.string().uuid().safeParse(id).success) return { error: "Некорректный шаблон." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "База данных не подключена." };
  const { error } = await supabase.from("editor_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "editor_template.deleted",
    entity_type: "editor_template",
    entity_id: id,
  });
  revalidatePath("/articles");
  return { ok: true };
}

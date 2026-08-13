"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { commentsCatalogFormHref } from "@/lib/comments-catalog-query";

export async function moderateCommentAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = String(formData.get("id") || "");
  const status = formData.get("status") === "published" ? "published" : "hidden";
  const expectedUpdatedAt = String(formData.get("expected_updated_at") || "");
  const target = (notice?: { error?: string; saved?: string }) =>
    commentsCatalogFormHref(formData, notice);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect(target({ error: "Не удалось определить комментарий." }));
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(expectedUpdatedAt)) {
    redirect(target({ error: "Версия комментария устарела. Обновите страницу." }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена." }));
  const { data: updated, error } = await supabase
    .from("article_comments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(target({ error: error.message }));
  if (!updated) {
    redirect(target({
      error: "Комментарий уже изменён в другой вкладке. Обновите страницу и повторите действие.",
    }));
  }
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: `comment.${status}`,
    entity_type: "comment",
    entity_id: id,
  });
  if (auditError) redirect(target({ error: auditError.message }));
  revalidatePath("/comments");
  redirect(target({ saved: "1" }));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { commentsCatalogFormHref } from "@/lib/comments-catalog-query";

const versionPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function commentMutationError(message?: string) {
  if (message === "COMMENT_WRITE_CONFLICT") {
    return "Один из комментариев уже изменён. Обновите страницу и повторите действие.";
  }
  if (message === "COMMENT_INVALID_INPUT") return "Проверьте выбранные комментарии.";
  if (message === "ADMIN_STAFF_REQUIRED") return "Требуются права редакции.";
  return "Не удалось изменить комментарии.";
}

async function moderateComments(
  formData: FormData,
  items: Array<{ id: string; updatedAt: string }>,
  status: "published" | "hidden"
) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (notice?: { error?: string; saved?: string }) =>
    commentsCatalogFormHref(formData, notice);
  if (
    items.length < 1 || items.length > 100 ||
    items.some(({ id, updatedAt }) =>
      !/^[0-9a-f-]{36}$/iu.test(id) || !versionPattern.test(updatedAt)
    )
  ) {
    redirect(target({ error: "Проверьте выбранные комментарии." }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена." }));
  const { error } = await supabase.rpc("moderate_comments_guarded", {
    p_items: items,
    p_status: status,
  });
  if (error) redirect(target({ error: commentMutationError(error.message) }));
  revalidatePath("/comments");
  redirect(target({ saved: String(items.length) }));
}

export async function moderateCommentAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = formData.get("status") === "published" ? "published" : "hidden";
  const expectedUpdatedAt = String(formData.get("expected_updated_at") || "");
  const target = (notice?: { error?: string; saved?: string }) =>
    commentsCatalogFormHref(formData, notice);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect(target({ error: "Не удалось определить комментарий." }));
  }
  if (!versionPattern.test(expectedUpdatedAt)) {
    redirect(target({ error: "Версия комментария устарела. Обновите страницу." }));
  }

  return moderateComments(formData, [{ id, updatedAt: expectedUpdatedAt }], status);
}

export async function bulkModerateCommentsAction(formData: FormData) {
  const status = formData.get("bulk_status") === "published" ? "published" : "hidden";
  const items = formData.getAll("selected_comment").flatMap((raw) => {
    const [id, updatedAt] = String(raw).split("|", 2);
    return id && updatedAt ? [{ id, updatedAt }] : [];
  });
  return moderateComments(formData, items, status);
}

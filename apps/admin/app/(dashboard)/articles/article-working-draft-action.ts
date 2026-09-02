"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { articleEditPath } from "@/lib/admin-routes";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { discardArticleWorkingDraftRpc } from "./article-working-draft";

export async function discardArticleWorkingDraftAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = z
    .object({
      articleId: z.string().uuid(),
      expectedVersion: z.coerce.number().int().positive(),
    })
    .safeParse({
      articleId: formData.get("id"),
      expectedVersion: formData.get("working_draft_version"),
    });
  if (!parsed.success) {
    redirect("/articles?error=Некорректный рабочий черновик");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(
      articleEditPath(parsed.data.articleId, {
        error: "База данных не подключена.",
      })
    );
  }
  try {
    await discardArticleWorkingDraftRpc(supabase, parsed.data);
  } catch (error) {
    const safeMessage =
      error instanceof Error &&
      [
        "Черновик или опубликованная статья",
        "Рабочий черновик уже удалён",
        "Недостаточно прав",
        "Не удалось подтвердить удаление",
      ].some((prefix) => error.message.startsWith(prefix))
        ? error.message
        : "Не удалось удалить рабочий черновик. Опубликованная версия не изменена.";
    redirect(articleEditPath(parsed.data.articleId, { error: safeMessage }));
  }
  revalidatePath("/articles/edit");
  revalidatePath(`/articles/${parsed.data.articleId}/preview`);
  redirect(articleEditPath(parsed.data.articleId, { saved: "draft-discarded" }));
}

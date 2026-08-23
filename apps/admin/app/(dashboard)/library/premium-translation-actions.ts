"use server";

import { revalidatePath } from "next/cache";

import { ensureLiteraryWorkEnglishTranslation } from "@/lib/auto-translate-literary-work-safe";
import { requireStaff } from "@/lib/auth";
import { libraryCatalogFormHref } from "@/lib/library-catalog-query";
import { parseWorkTranslationEdit } from "@/lib/literary-work-workspace";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function workspaceHref(formData: FormData, options: Record<string, unknown> = {}) {
  return `${libraryCatalogFormHref(formData, options)}#work-workspace`;
}

function workspaceInput(formData: FormData) {
  return {
    workId: formData.get("work_id"),
    translationId: formData.get("translation_id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
    locale: formData.get("locale"),
    title: formData.get("title"),
    description: formData.get("description"),
    sourceLanguage: formData.get("source_language"),
    translationMethod: formData.get("translation_method"),
    editorialStatus: formData.get("editorial_status"),
    sourceUrls: formData.get("source_urls"),
    reviewedAt: formData.get("reviewed_at"),
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function saveWorkTranslationWithPremiumEnglishAction(
  formData: FormData
) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  let edit: ReturnType<typeof parseWorkTranslationEdit>;
  try {
    edit = parseWorkTranslationEdit(workspaceInput(formData));
  } catch (error) {
    redirect(
      workspaceHref(formData, {
        error: errorMessage(error, "Проверьте перевод произведения."),
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  }

  const query = edit.translationId
    ? supabase
        .from("literary_work_translations")
        .update(edit.patch)
        .eq("id", edit.translationId)
        .eq("work_id", edit.workId)
        .eq("updated_at", edit.expectedUpdatedAt!)
    : supabase.from("literary_work_translations").insert({
        work_id: edit.workId,
        locale: edit.locale,
        ...edit.patch,
      });
  const { data: saved, error } = await query.select("id").maybeSingle();
  if (error || !saved) {
    redirect(
      workspaceHref(formData, {
        error:
          error?.message ||
          "Перевод уже изменён в другой вкладке. Обновите страницу и повторите правку.",
      })
    );
  }

  let premiumEnglish:
    | Awaited<ReturnType<typeof ensureLiteraryWorkEnglishTranslation>>
    | null = null;
  if (
    edit.locale === "ru" &&
    new Set(["reviewed", "verified"]).has(edit.patch.editorial_status)
  ) {
    premiumEnglish = await ensureLiteraryWorkEnglishTranslation({
      supabase,
      actorId: session.user.id,
      workId: edit.workId,
    });
  }

  const action = edit.translationId
    ? "literary_work_translation.updated"
    : "literary_work_translation.created";
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: "literary_work_translation",
    entity_id: edit.workId,
    metadata: {
      workId: edit.workId,
      recordId: saved.id,
      locale: edit.locale,
      status: edit.patch.editorial_status,
      premiumEnglishState: premiumEnglish?.state || null,
      premiumEnglishModel: premiumEnglish?.model || null,
      premiumEnglishReviewerModel: premiumEnglish?.reviewerModel || null,
    },
  });

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "literary_work_translation",
    entityId: saved.id,
    reason: action,
    metadata: {
      workId: edit.workId,
      locale: edit.locale,
      premiumEnglishState: premiumEnglish?.state || null,
    },
  });

  revalidatePath("/library");
  revalidatePath("/history");

  const premiumProblem =
    premiumEnglish &&
    new Set(["failed", "conflict", "not-configured"]).has(premiumEnglish.state)
      ? ` Русская версия сохранена, но премиальный EN не обновлён: ${
          premiumEnglish.error || premiumEnglish.state
        }`
      : "";
  const readinessNote =
    premiumEnglish?.state === "not-ready"
      ? " Премиальный EN включится после применения подготовленной DB-миграции."
      : "";
  const auditNote = auditError
    ? ` Журнал аудита недоступен: ${auditError.message}`
    : "";

  redirect(
    workspaceHref(formData, {
      saved: "workspace",
      published: publication.state,
      ...(premiumProblem || readinessNote || auditNote
        ? { error: `${premiumProblem}${readinessNote}${auditNote}`.trim() }
        : {}),
    })
  );
}

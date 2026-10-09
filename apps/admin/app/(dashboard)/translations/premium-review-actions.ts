"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { editorialCountry, loadEditorialCatalog } from "@/lib/editorial-catalog";
import { redirect } from "@/lib/navigation";
import { approvePremiumTranslationReview } from "@/lib/premium-translation-review";
import { discardPremiumTranslationWorkingDraft } from "@/lib/premium-translation-working-draft";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const formSchema = z.object({
  entityType: z.enum(["literary_work", "country"]), entityId: z.string().min(1).max(120),
  draftId: z.string().uuid(), version: z.string().regex(/^[1-9]\d*$/u),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/u), returnTo: z.enum(["library", "editorial-database"]),
}).strict().refine((value) => Number.isSafeInteger(Number(value.version)) &&
  (value.entityType === "literary_work"
    ? z.string().uuid().safeParse(value.entityId).success && value.returnTo === "library"
    : value.returnTo === "editorial-database"));

function formInput(formData: FormData) {
  const parsed = formSchema.safeParse({
    entityType: formData.get("entity_type"), entityId: formData.get("entity_id"),
    draftId: formData.get("draft_id"), version: formData.get("expected_version"),
    candidateHash: formData.get("candidate_hash"), returnTo: formData.get("return_to"),
  });
  if (!parsed.success) return null;
  return { ...parsed.data, version: Number(parsed.data.version) };
}

function target(input: NonNullable<ReturnType<typeof formInput>>, error?: string) {
  const query = new URLSearchParams({
    [input.entityType === "literary_work" ? "work_id" : "country_id"]: input.entityId,
  });
  if (error) query.set("error", error);
  return `/${input.returnTo}?${query.toString()}${input.returnTo === "library" ? "#work-workspace" : ""}`;
}

function refresh() {
  revalidatePath("/library");
  revalidatePath("/editorial-database");
  revalidatePath("/translations");
  revalidatePath("/history");
}

export async function approvePremiumTranslationWorkingDraftAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const input = formInput(formData);
  if (!input) redirect("/translations?errorCode=invalid_input");
  if (formData.get("confirm_human_review") !== "yes") {
    redirect(target(input, "Подтвердите, что вы сверили английский текст, факты и источники."));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target(input, "База данных недоступна. Подтверждение перевода не выполнено."));
  try {
    let sourceFields: Record<string, unknown> | undefined;
    if (input.entityType === "country") {
      const country = editorialCountry(await loadEditorialCatalog({}), input.entityId);
      if (!country) throw new Error("Country source unavailable");
      sourceFields = country.fields;
    }
    const receipt = await approvePremiumTranslationReview({
      supabase, ...input, actorId: session.user.id, sourceFields,
    });
    const publication = await requestPublicBuild({
      supabase, actorId: session.user.id,
      entityType: input.entityType === "literary_work" ? "literary_work_translation" : "country_profile",
      entityId: receipt.canonicalId, reason: "premium_translation.human_reviewed",
      metadata: { translationEntityType: input.entityType, translationEntityId: input.entityId,
        workingDraftId: input.draftId, candidateHash: input.candidateHash,
        reviewedBy: receipt.reviewedBy, reviewedAt: receipt.reviewedAt },
    });
    refresh();
    if (publication.state === "queue-error") {
      redirect(target(input, "Перевод сохранён после вашей проверки, но запрос публикации не подтверждён. Проверьте очередь публикаций."));
    }
  } catch (error) {
    unstable_rethrow(error);
    refresh();
    redirect(target(input, "Подтверждение перевода не подтверждено: кандидат, исходник или английская запись могли измениться. Перечитайте текущие записи перед повторным действием."));
  }
  redirect(target(input));
}

export async function discardPremiumTranslationWorkingDraftAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const input = formInput(formData);
  if (!input) redirect("/translations?errorCode=invalid_input");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target(input, "База данных недоступна. Удаление кандидата не выполнено."));
  try {
    await discardPremiumTranslationWorkingDraft(supabase, input);
  } catch (error) {
    unstable_rethrow(error);
    refresh();
    redirect(target(input, "Удаление машинного кандидата не подтверждено. Перечитайте его текущую версию; редакционные RU и EN не заменяются этим действием."));
  }
  refresh();
  redirect(target(input));
}

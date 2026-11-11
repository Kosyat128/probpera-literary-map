"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { readPublicationRetryForm, type PublicationRetryActionResult } from "@/lib/publication-retry-contract";
import { requestPublicationRetry } from "@/lib/publication-retry";
import { publicationCatalogFormHref } from "@/lib/publication-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function retryPublicationAction(formData: FormData): Promise<PublicationRetryActionResult> {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const request = readPublicationRetryForm(formData);
  if (!request) return { state: "invalid", message: "Намерение повтора не определено. Обновите очередь." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { state: "unconfirmed", message: "Очередь недоступна. Новый запуск не отправлен." };
  return requestPublicationRetry({ supabase, actorId: session.user.id, request });
}
export async function requestFullPublicBuildAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (options?: { error?: string; published?: string }) =>
    publicationCatalogFormHref(formData, options);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена." }));

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site",
    entityId: "full-public-build",
    reason: "manual-full-public-build",
    metadata: { source: "publication-dashboard" },
  });
  revalidatePath("/publication");
  redirect(target({ published: publication.state }));
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { publicationCatalogFormHref } from "@/lib/publication-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";

const outboxIdSchema = z.string().regex(/^[1-9]\d*$/u).max(30);

export async function retryPublicationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (options?: { error?: string; published?: string }) =>
    publicationCatalogFormHref(formData, options);
  const parsedId = outboxIdSchema.safeParse(String(formData.get("outbox_id") || ""));
  if (!parsedId.success) redirect(target({ error: "Не удалось определить запрос публикации." }));

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена." }));
  const { data: event, error } = await supabase
    .from("public_build_outbox")
    .select("id,entity_type,entity_id,reason,status")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) redirect(target({ error: operatorDataError("publication", "publish") }));
  if (!event) redirect(target({ error: "Запрос публикации уже недоступен." }));

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: event.entity_type,
    entityId: event.entity_id,
    reason: `manual-retry:${event.reason}`.slice(0, 240),
    metadata: { retry_of_outbox_id: parsedId.data, previous_status: event.status },
  });
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "public_build.retried",
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    metadata: { retry_of_outbox_id: parsedId.data, publication: publication.state },
  });
  revalidatePath("/publication");
  redirect(target({ published: publication.state }));
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

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { articleEditPath } from "@/lib/admin-routes";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";

function articleIdFromForm(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

export async function requestSocialPublicationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = articleIdFromForm(formData);
  if (!id) redirect("/articles?error=Некорректный идентификатор статьи");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(articleEditPath(id, { error: "База данных не подключена" }));
  const { data: article, error } = await supabase
    .from("articles")
    .select("id,title,slug,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !article) {
    redirect(
      articleEditPath(id, {
        error: error ? operatorDataError("articles", "load") : "Статья не найдена",
      })
    );
  }
  if (article.status !== "published") {
    redirect(
      articleEditPath(id, {
        error: "Автопостинг доступен только для опубликованной статьи",
      })
    );
  }

  const { data: latestRequests, error: latestRequestError } = await supabase
    .from("admin_audit_log")
    .select("id")
    .eq("action", "social_publish.requested")
    .eq("entity_type", "article")
    .eq("entity_id", article.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (latestRequestError) {
    redirect(articleEditPath(id, { error: operatorDataError("publication", "load") }));
  }

  const latestRequest = latestRequests?.[0] || null;
  const { data: completedRows, error: completionError } = latestRequest
    ? await supabase
        .from("admin_audit_log")
        .select("id")
        .eq("action", "social_publish.completed")
        .eq("entity_type", "social_publication")
        .eq("entity_id", String(latestRequest.id))
        .limit(1)
    : { data: [], error: null };
  if (completionError) {
    redirect(articleEditPath(id, { error: operatorDataError("publication", "save") }));
  }

  const resumedPendingRequest = Boolean(latestRequest && !completedRows?.length);
  if (!resumedPendingRequest) {
    const { error: queueError } = await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "social_publish.requested",
      entity_type: "article",
      entity_id: article.id,
      metadata: {
        article_id: article.id,
        title: article.title,
        slug: article.slug,
        platforms: ["dzen"],
        requested_at: new Date().toISOString(),
        reason: "manual-editor-request",
      },
    });
    if (queueError) {
      redirect(articleEditPath(id, { error: operatorDataError("publication", "publish") }));
    }
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: article.id,
    reason: "article.social-publication.requested",
  });
  revalidatePath(articleEditPath(id));
  redirect(
    articleEditPath(id, {
      social: resumedPendingRequest ? "retrying" : "requested",
      publish: publication.state,
    })
  );
}

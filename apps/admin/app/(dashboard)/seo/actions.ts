"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { isSafePublicHref, isSafeRootRelativePath } from "@/lib/public-href";
import { seoCatalogFormHref } from "@/lib/seo-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const redirectSchema = z.object({
  sourcePath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(isSafeRootRelativePath, {
      message: "Старый адрес должен начинаться с одного символа /",
    }),
  destinationPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) => isSafePublicHref(value),
      "Новый адрес должен начинаться с / или https://"
    ),
  statusCode: z.coerce.number().int().refine((value) => [301, 302, 307, 308].includes(value)),
  isActive: z.boolean(),
});

const identitySchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

function catalogTarget(
  formData: FormData,
  notice: Parameters<typeof seoCatalogFormHref>[1] = {}
) {
  return seoCatalogFormHref(formData, notice);
}

function normalizedAddress(value: string) {
  return value.startsWith("/") ? value.replace(/\/+$/u, "") || "/" : value;
}

function parseRedirectForm(formData: FormData) {
  const parsed = redirectSchema.safeParse({
    sourcePath: formData.get("source_path"),
    destinationPath: formData.get("destination_path"),
    statusCode: formData.get("status_code") || 301,
    isActive: formData.get("is_active") === "on",
  });
  if (!parsed.success) return parsed;

  return {
    ...parsed,
    data: {
      ...parsed.data,
      sourcePath: normalizedAddress(parsed.data.sourcePath),
      destinationPath: normalizedAddress(parsed.data.destinationPath),
    },
  };
}

async function auditAndRequestBuild(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  entityId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "redirect",
    entity_id: entityId,
    metadata,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId,
    entityType: "redirect",
    entityId,
    reason: action,
    metadata,
  });
  return publication.state;
}

export async function createRedirectAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = parseRedirectForm(formData);
  if (!parsed.success || parsed.data.sourcePath === parsed.data.destinationPath) {
    redirect(
      catalogTarget(formData, {
        error: parsed.success
          ? "Старый и новый адреса не должны совпадать."
          : parsed.error.issues[0]?.message || "Проверьте адреса.",
      })
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget(formData, { error: "База данных не подключена." }));

  const { data, error } = await supabase
    .from("redirects")
    .insert({
      source_path: parsed.data.sourcePath,
      destination_path: parsed.data.destinationPath,
      status_code: parsed.data.statusCode,
      is_active: parsed.data.isActive,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(catalogTarget(formData, { error: error?.message || "Переадресация не создана." }));
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    data.id,
    "redirect.created",
    {
      sourcePath: parsed.data.sourcePath,
      destinationPath: parsed.data.destinationPath,
      statusCode: parsed.data.statusCode,
      isActive: parsed.data.isActive,
    }
  );
  revalidatePath("/seo");
  redirect(catalogTarget(formData, { saved: "created", published: publication }));
}

export async function updateRedirectAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const identity = identitySchema.safeParse({
    id: formData.get("id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
  });
  if (!identity.success) {
    redirect(
      catalogTarget(formData, {
        error: "Версия переадресации не указана. Обновите страницу и повторите правку.",
      })
    );
  }
  const parsed = parseRedirectForm(formData);
  if (!parsed.success || parsed.data.sourcePath === parsed.data.destinationPath) {
    redirect(
      catalogTarget(formData, {
        error: parsed.success
          ? "Старый и новый адреса не должны совпадать."
          : parsed.error.issues[0]?.message || "Проверьте адреса.",
      })
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget(formData, { error: "База данных не подключена." }));

  const { data: updated, error } = await supabase
    .from("redirects")
    .update({
      source_path: parsed.data.sourcePath,
      destination_path: parsed.data.destinationPath,
      status_code: parsed.data.statusCode,
      is_active: parsed.data.isActive,
    })
    .eq("id", identity.data.id)
    .eq("updated_at", identity.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(catalogTarget(formData, { error: error.message }));
  if (!updated) {
    redirect(
      catalogTarget(formData, {
        error: "Переадресация уже изменена в другой вкладке. Обновите страницу и повторите правку.",
      })
    );
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    identity.data.id,
    "redirect.updated",
    {
      sourcePath: parsed.data.sourcePath,
      destinationPath: parsed.data.destinationPath,
      statusCode: parsed.data.statusCode,
      isActive: parsed.data.isActive,
    }
  );
  revalidatePath("/seo");
  redirect(catalogTarget(formData, { saved: "updated", published: publication }));
}

export async function deleteRedirectAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const identity = identitySchema.safeParse({
    id: formData.get("id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
  });
  if (!identity.success) {
    redirect(
      catalogTarget(formData, {
        error: "Версия переадресации не указана. Обновите страницу перед удалением.",
      })
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget(formData, { error: "База данных не подключена." }));
  const { data: deleted, error } = await supabase
    .from("redirects")
    .delete()
    .eq("id", identity.data.id)
    .eq("updated_at", identity.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(catalogTarget(formData, { error: error.message }));
  if (!deleted) {
    redirect(
      catalogTarget(formData, {
        error: "Переадресация уже изменена или удалена. Обновите страницу.",
      })
    );
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    identity.data.id,
    "redirect.deleted"
  );
  revalidatePath("/seo");
  redirect(catalogTarget(formData, { deleted: "1", published: publication }));
}

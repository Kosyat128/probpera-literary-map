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

const redirectErrorMessages: Record<string, string> = {
  ADMIN_HIGH_RISK_ROLE_REQUIRED: "Для удаления нужны права администратора или владельца.",
  ADMIN_STAFF_REQUIRED: "Требуются права редакции.",
  REDIRECT_COLLISION_OR_CHAIN: "Адрес пересекается с другой активной переадресацией или создаёт цепочку.",
  REDIRECT_INVALID_PATH: "Проверьте старый и новый адреса.",
  REDIRECT_INVALID_STATUS: "Недопустимый код переадресации.",
  REDIRECT_LIVE_ROUTE_COLLISION: "Старый адрес занят опубликованной страницей.",
  REDIRECT_SELF_REFERENCE: "Старый и новый адреса не должны совпадать.",
  REDIRECT_SOURCE_EXISTS: "Переадресация с таким старым адресом уже существует.",
  REDIRECT_WRITE_CONFLICT: "Переадресация уже изменена или удалена. Обновите страницу.",
};

function redirectErrorMessage(message?: string) {
  return (message && redirectErrorMessages[message]) || "Не удалось сохранить переадресацию.";
}

async function requestRedirectBuild(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  entityId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
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

  const { data, error } = await supabase.rpc("create_seo_redirect_guarded", {
    p_source_path: parsed.data.sourcePath,
    p_destination_path: parsed.data.destinationPath,
    p_status_code: parsed.data.statusCode,
    p_is_active: parsed.data.isActive,
  });
  if (error || !data) {
    redirect(catalogTarget(formData, { error: redirectErrorMessage(error?.message) }));
  }

  const publication = await requestRedirectBuild(
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

  const { data: updated, error } = await supabase.rpc("update_seo_redirect_guarded", {
    p_id: identity.data.id,
    p_expected_updated_at: identity.data.expectedUpdatedAt,
    p_source_path: parsed.data.sourcePath,
    p_destination_path: parsed.data.destinationPath,
    p_status_code: parsed.data.statusCode,
    p_is_active: parsed.data.isActive,
  });
  if (error || !updated) {
    redirect(catalogTarget(formData, { error: redirectErrorMessage(error?.message) }));
  }

  const publication = await requestRedirectBuild(
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
  const { data: deleted, error } = await supabase.rpc("delete_seo_redirect_guarded", {
    p_id: identity.data.id,
    p_expected_updated_at: identity.data.expectedUpdatedAt,
  });
  if (error || !deleted) {
    redirect(catalogTarget(formData, { error: redirectErrorMessage(error?.message) }));
  }

  const publication = await requestRedirectBuild(
    supabase,
    session.user.id,
    identity.data.id,
    "redirect.deleted"
  );
  revalidatePath("/seo");
  redirect(catalogTarget(formData, { deleted: "1", published: publication }));
}

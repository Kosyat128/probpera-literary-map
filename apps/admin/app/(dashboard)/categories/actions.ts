"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";
import { taxonomyCatalogFormHref } from "@/lib/taxonomy-catalog-query";

const kindSchema = z.enum(["category", "tag"]);
const versionSchema = z.string().datetime({ offset: true });

const taxonomyFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  slug: z.string().trim().max(120),
  seoTitle: z.string().trim().max(180),
  seoDescription: z.string().trim().max(400),
  displayOrder: z.coerce.number().int().min(-10_000).max(10_000),
  isVisible: z.boolean(),
});

type TaxonomyKind = z.infer<typeof kindSchema>;

function catalogTarget(
  formData: FormData,
  notice: Parameters<typeof taxonomyCatalogFormHref>[1] = {}
) {
  return taxonomyCatalogFormHref(formData, notice);
}

function safeSlug(value: string, fallback: string, maxLength: number) {
  return (createSlug(value) || createSlug(fallback)).slice(0, maxLength);
}

async function auditAndRequestBuild(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  kind: TaxonomyKind,
  entityId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: kind,
    entity_id: entityId,
    metadata,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId,
    entityType: kind,
    entityId,
    reason: action,
    metadata,
  });
  return publication.state;
}

export async function createTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const kind = kindSchema.safeParse(formData.get("kind"));
  if (!kind.success) {
    redirect(catalogTarget(formData, { error: "Некорректный тип элемента." }));
  }

  const parsed = taxonomyFormSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") || ""),
    slug: String(formData.get("slug") || ""),
    seoTitle: "",
    seoDescription: "",
    displayOrder: 0,
    isVisible: true,
  });
  if (!parsed.success) {
    redirect(
      catalogTarget(formData, {
        error: parsed.error.issues[0]?.message || "Проверьте название элемента.",
      })
    );
  }
  if (kind.data === "tag" && parsed.data.name.length > 80) {
    redirect(catalogTarget(formData, { error: "Название тега не должно быть длиннее 80 символов." }));
  }

  const slug = safeSlug(parsed.data.slug, parsed.data.name, kind.data === "tag" ? 80 : 120);
  if (slug.length < 2) {
    redirect(catalogTarget(formData, { error: "Не удалось создать корректный адрес." }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(catalogTarget(formData, { error: "База данных не подключена." }));
  }
  const { data, error } = await supabase
    .from(kind.data === "tag" ? "tags" : "categories")
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(
      catalogTarget(formData, {
        error: operatorDataError("categories", "create"),
      })
    );
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    kind.data,
    data.id,
    `${kind.data}.created`,
    { name: parsed.data.name, slug }
  );
  revalidatePath("/categories");
  redirect(
    catalogTarget(formData, {
      saved: `${kind.data}-created`,
      published: publication,
    })
  );
}

export async function updateTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const identity = z
    .object({
      id: z.string().uuid(),
      kind: kindSchema,
      expectedUpdatedAt: versionSchema,
    })
    .safeParse({
      id: formData.get("id"),
      kind: formData.get("kind"),
      expectedUpdatedAt: formData.get("expected_updated_at"),
    });
  if (!identity.success) {
    redirect(
      catalogTarget(formData, {
        error: "Версия элемента не указана. Обновите страницу и повторите правку.",
      })
    );
  }

  const parsed = taxonomyFormSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") || ""),
    slug: String(formData.get("slug") || ""),
    seoTitle: String(formData.get("seo_title") || ""),
    seoDescription: String(formData.get("seo_description") || ""),
    displayOrder: formData.get("display_order") || 0,
    isVisible: formData.get("is_visible") === "on",
  });
  if (!parsed.success) {
    redirect(
      catalogTarget(formData, {
        error: parsed.error.issues[0]?.message || "Проверьте поля элемента.",
      })
    );
  }
  if (identity.data.kind === "tag" && parsed.data.name.length > 80) {
    redirect(catalogTarget(formData, { error: "Название тега не должно быть длиннее 80 символов." }));
  }

  const slug = safeSlug(
    parsed.data.slug,
    parsed.data.name,
    identity.data.kind === "tag" ? 80 : 120
  );
  if (slug.length < 2) {
    redirect(catalogTarget(formData, { error: "Укажите корректный адрес." }));
  }
  const payload =
    identity.data.kind === "tag"
      ? {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
        }
      : {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          seo_title: parsed.data.seoTitle || null,
          seo_description: parsed.data.seoDescription || null,
          display_order: parsed.data.displayOrder,
          is_visible: parsed.data.isVisible,
        };
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(catalogTarget(formData, { error: "База данных не подключена." }));
  }
  const { data: updated, error } = await supabase
    .from(identity.data.kind === "tag" ? "tags" : "categories")
    .update(payload)
    .eq("id", identity.data.id)
    .eq("updated_at", identity.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(catalogTarget(formData, { error: operatorDataError("categories", "save") }));
  if (!updated) {
    redirect(
      catalogTarget(formData, {
        error: "Элемент уже изменён в другой вкладке. Обновите страницу и повторите правку.",
      })
    );
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    identity.data.kind,
    identity.data.id,
    `${identity.data.kind}.updated`,
    { name: parsed.data.name, slug }
  );
  revalidatePath("/categories");
  redirect(
    catalogTarget(formData, {
      saved: `${identity.data.kind}-updated`,
      published: publication,
    })
  );
}

export async function deleteTaxonomyItemAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const parsed = z
    .object({
      id: z.string().uuid(),
      kind: kindSchema,
      expectedUpdatedAt: versionSchema,
    })
    .safeParse({
      id: formData.get("id"),
      kind: formData.get("kind"),
      expectedUpdatedAt: formData.get("expected_updated_at"),
    });
  if (!parsed.success) {
    redirect(
      catalogTarget(formData, {
        error: "Версия элемента не указана. Обновите страницу перед удалением.",
      })
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(catalogTarget(formData, { error: "База данных не подключена." }));
  }
  const { data: deleted, error } = await supabase
    .from(parsed.data.kind === "tag" ? "tags" : "categories")
    .delete()
    .eq("id", parsed.data.id)
    .eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(catalogTarget(formData, { error: operatorDataError("categories", "delete") }));
  if (!deleted) {
    redirect(
      catalogTarget(formData, {
        error: "Элемент уже изменён или удалён. Обновите страницу.",
      })
    );
  }

  const publication = await auditAndRequestBuild(
    supabase,
    session.user.id,
    parsed.data.kind,
    parsed.data.id,
    `${parsed.data.kind}.deleted`
  );
  revalidatePath("/categories");
  redirect(
    catalogTarget(formData, {
      deleted: parsed.data.kind,
      published: publication,
    })
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import {
  isMediaPurgeConfirmed,
  isOrphanCleanupConfirmed,
  MAX_ORPHAN_CLEANUP_ASSETS,
  mediaSnapshotSetsMatch,
  parseBulkMediaMetadataPatch,
  parseMediaVersionSnapshots,
  type MediaVersionSnapshot,
} from "@/lib/media-bulk-operations";
import { mediaCatalogPageHref, parseMediaCatalogQuery } from "@/lib/media-catalog-query";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const mediaSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  altText: z.string().trim().min(3).max(500),
  caption: z.string().trim().max(1000),
  creator: z.string().trim().max(240),
  sourceUrl: z.union([z.string().url(), z.literal("")]),
  licenseName: z.string().trim().max(180),
  licenseUrl: z.union([z.string().url(), z.literal("")]),
  collectionName: z.string().trim().min(2).max(180),
  focusX: z.coerce.number().min(0).max(1),
  focusY: z.coerce.number().min(0).max(1),
  rightsStatus: z.enum([
    "verified",
    "editorial",
    "public-domain",
    "licensed",
    "unknown",
  ]),
});

const lifecycleSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

const mediaUsageRefSchema = z.object({
  entity_type: z.enum(["article", "page", "homepage", "banner"]),
  entity_id: z.string().uuid(),
  field_name: z.string().trim().min(1).max(80),
});

const mediaUsageRefsSchema = z.array(mediaUsageRefSchema).max(500);

const replacementSchema = z.object({
  oldMediaId: z.string().uuid(),
  newMediaId: z.string().uuid(),
  expectedOldUpdatedAt: z.string().datetime({ offset: true }),
  expectedNewUpdatedAt: z.string().datetime({ offset: true }),
  expectedUsageRefs: z.string().max(100_000),
  replaceAllCurrent: z.boolean(),
});

const orphanPreviewTotalSchema = z.coerce.number().int().min(1).max(1_000_000);

const permanentPurgeSchema = lifecycleSchema.extend({
  confirmation: z.string(),
});

const preparedPurgeSchema = z.object({
  media_id: z.string().uuid(),
  purge_token: z.string().uuid(),
  bucket: z.literal("editorial-media"),
  object_path: z
    .string()
    .min(1)
    .max(1_024)
    .refine((value) => !value.startsWith("/"), "Некорректный путь объекта")
    .refine(
      (value) => !/[\u0000-\u001f\u007f\\]/u.test(value),
      "Некорректный путь объекта"
    )
    .refine(
      (value) => value.split("/").every((segment) => segment && segment !== "." && segment !== ".."),
      "Некорректный путь объекта"
    ),
  prepared_updated_at: z.string().datetime({ offset: true }),
}).strict();

type OrphanCandidateRow = {
  id: string;
  updated_at: string;
  deleted_at: string | null;
  usage_count: number | string | null;
  total_count: number | string | null;
};

type OrphanUsageRow = { media_id: string };

function catalogFromForm(formData: FormData) {
  return parseMediaCatalogQuery({
    q: formData.get("catalog_q"),
    search_field: formData.get("catalog_search_field"),
    state: formData.get("catalog_state"),
    view: formData.get("catalog_view"),
    page: formData.get("catalog_page"),
  });
}

function parseUsageRefs(value: string) {
  return mediaUsageRefsSchema.parse(JSON.parse(value));
}

function replacementErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "40001") {
    return "Файл или места его использования изменились после предпросмотра. Обновите предпросмотр и повторите замену.";
  }
  if (error.code === "23514") {
    return "Новый файл не прошёл проверку SHA-256 или не является отдельным неизменяемым объектом.";
  }
  if (error.code === "23503") {
    return "Один из файлов отсутствует в хранилище. Замена отменена без частичных изменений.";
  }
  if (error.code === "23505") {
    return "Для одного из файлов уже зарегистрирована другая цепочка замены.";
  }
  if (error.code === "42501") {
    return "Безопасная замена доступна только владельцу или администратору.";
  }
  return error.message || "Не удалось безопасно заменить файл.";
}

function permanentPurgeErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return "Безвозвратное удаление доступно только владельцу кабинета.";
  }
  if (error.code === "40001") {
    return "Файл изменился после открытия страницы. Обновите медиатеку и повторите проверку.";
  }
  if (error.code === "23503") {
    return "Удаление запрещено: найдена текущая, историческая, резервная или связанная версия файла.";
  }
  if (error.code === "55000" || error.code === "23514") {
    return "Файл ещё не прошёл 30-дневный срок хранения или не соответствует условиям безопасного удаления.";
  }
  if (error.code === "P0002") return "Файл больше не найден в медиатеке.";
  return error.message || "Не удалось подготовить безвозвратное удаление.";
}

export async function updateMediaMetadataAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: { saved?: string; error?: string; published?: string }) =>
    mediaCatalogPageHref(catalog, catalog.page, notice);
  const parsed = mediaSchema.safeParse({
    id: formData.get("id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
    altText: formData.get("alt_text"),
    caption: String(formData.get("caption") || ""),
    creator: String(formData.get("creator") || ""),
    sourceUrl: String(formData.get("source_url") || ""),
    licenseName: String(formData.get("license_name") || ""),
    licenseUrl: String(formData.get("license_url") || ""),
    collectionName: formData.get("collection_name"),
    focusX: formData.get("focus_x") || 0.5,
    focusY: formData.get("focus_y") || 0.5,
    rightsStatus: formData.get("rights_status") || "unknown",
  });
  if (!parsed.success) {
    redirect(catalogTarget({
      error: parsed.error.issues[0]?.message || "Проверьте описание изображения",
    }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));
  const { data: updated, error } = await supabase
    .from("media_assets")
    .update({
      alt_text: parsed.data.altText,
      caption: parsed.data.caption,
      creator: parsed.data.creator,
      source_url: parsed.data.sourceUrl || null,
      license_name: parsed.data.licenseName,
      license_url: parsed.data.licenseUrl || null,
      collection_name: parsed.data.collectionName,
      focus_x: parsed.data.focusX,
      focus_y: parsed.data.focusY,
      rights_status: parsed.data.rightsStatus,
    })
    .eq("id", parsed.data.id)
    .eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(catalogTarget({ error: error.message }));
  if (!updated) {
    redirect(catalogTarget({
      error: "Изображение уже изменено в другой вкладке. Обновите страницу и повторите правку.",
    }));
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.updated",
    entity_type: "media",
    entity_id: parsed.data.id,
    metadata: {
      license: parsed.data.licenseName,
      rightsStatus: parsed.data.rightsStatus,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: parsed.data.id,
    reason: "media.updated",
  });
  revalidatePath("/media");
  redirect(catalogTarget({ saved: "1", published: publication.state }));
}

export async function bulkUpdateMediaMetadataAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: {
    saved?: string;
    error?: string;
    published?: string;
    bulkCount?: number;
    skippedCount?: number;
  }) => mediaCatalogPageHref(catalog, catalog.page, notice);

  const selection = parseMediaVersionSnapshots(formData.getAll("media_selection"));
  if (!selection.success) redirect(catalogTarget({ error: selection.error }));
  const patch = parseBulkMediaMetadataPatch({
    apply_caption: formData.get("apply_caption"),
    caption: formData.get("caption"),
    apply_creator: formData.get("apply_creator"),
    creator: formData.get("creator"),
    apply_source_url: formData.get("apply_source_url"),
    source_url: formData.get("source_url"),
    apply_license_name: formData.get("apply_license_name"),
    license_name: formData.get("license_name"),
    apply_license_url: formData.get("apply_license_url"),
    license_url: formData.get("license_url"),
    apply_collection_name: formData.get("apply_collection_name"),
    collection_name: formData.get("collection_name"),
    apply_rights_status: formData.get("apply_rights_status"),
    rights_status: formData.get("rights_status"),
  });
  if (!patch.success) redirect(catalogTarget({ error: patch.error }));

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));
  const selectedIds = selection.data.map((item) => item.id);
  const { data: currentAssets, error: currentAssetsError } = await supabase
    .from("media_assets")
    .select("id,updated_at")
    .in("id", selectedIds);
  if (currentAssetsError || !currentAssets || currentAssets.length !== selectedIds.length) {
    redirect(catalogTarget({
      error: currentAssetsError?.message || "Один из выбранных файлов больше не существует.",
    }));
  }
  const currentVersions = new Map(
    currentAssets.map((asset) => [String(asset.id), String(asset.updated_at)])
  );
  if (selection.data.some((item) => currentVersions.get(item.id) !== item.updatedAt)) {
    redirect(catalogTarget({
      error: "Один из выбранных файлов изменился. Обновите страницу перед массовой правкой.",
    }));
  }

  const results = await Promise.all(selection.data.map(async (item) => {
    const { data, error } = await supabase
      .from("media_assets")
      .update(patch.data)
      .eq("id", item.id)
      .eq("updated_at", item.updatedAt)
      .select("id")
      .maybeSingle();
    return { id: item.id, updated: Boolean(data) && !error, error };
  }));
  const updatedIds = results.filter((item) => item.updated).map((item) => item.id);
  const skipped = results.length - updatedIds.length;
  if (updatedIds.length === 0) {
    redirect(catalogTarget({
      error: results.find((item) => item.error)?.error?.message
        || "Файлы изменились до записи. Массовая правка отменена.",
    }));
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.bulk_metadata_updated",
    entity_type: "media",
    entity_id: updatedIds[0],
    metadata: {
      mediaIds: updatedIds,
      updatedCount: updatedIds.length,
      skippedCount: skipped,
      fields: Object.keys(patch.data),
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: updatedIds[0],
    reason: "media.bulk_metadata_updated",
    metadata: { mediaIds: updatedIds, updatedCount: updatedIds.length },
  });
  revalidatePath("/media");
  redirect(catalogTarget({
    saved: "bulk",
    bulkCount: updatedIds.length,
    skippedCount: skipped,
    published: publication.state,
    error: skipped
      ? `${skipped} файлов изменились во время записи и были безопасно пропущены.`
      : undefined,
  }));
}

export async function applyOrphanCleanupAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: {
    saved?: string;
    error?: string;
    published?: string;
    orphanCount?: number;
    skippedCount?: number;
  }) => mediaCatalogPageHref(catalog, catalog.page, notice);

  if (!isOrphanCleanupConfirmed(formData.get("confirm_orphan_cleanup"))) {
    redirect(catalogTarget({ error: "Очистка не подтверждена. Изменения не выполнены." }));
  }
  const expectedPreview = parseMediaVersionSnapshots(
    formData.getAll("orphan_preview_snapshot"),
    { max: MAX_ORPHAN_CLEANUP_ASSETS }
  );
  const selection = parseMediaVersionSnapshots(
    formData.getAll("orphan_selection"),
    { max: MAX_ORPHAN_CLEANUP_ASSETS }
  );
  const expectedTotal = orphanPreviewTotalSchema.safeParse(
    formData.get("orphan_preview_total")
  );
  if (!expectedPreview.success || !selection.success || !expectedTotal.success) {
    redirect(catalogTarget({ error: "Снимок предпросмотра повреждён. Откройте его заново." }));
  }
  const previewById = new Map(expectedPreview.data.map((item) => [item.id, item.updatedAt]));
  if (selection.data.some((item) => previewById.get(item.id) !== item.updatedAt)) {
    redirect(catalogTarget({ error: "Выбран файл вне подтверждённого предпросмотра." }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));
  const { data: candidatesResult, error: candidatesError } = await supabase.rpc(
    "list_media_studio_assets",
    {
      p_state: "unused",
      p_search_column: "alt_text",
      p_search_pattern: null,
      p_offset: 0,
      p_limit: MAX_ORPHAN_CLEANUP_ASSETS,
    }
  );
  if (candidatesError) {
    redirect(catalogTarget({ error: candidatesError.message }));
  }
  const candidateRows = (candidatesResult || []) as OrphanCandidateRow[];
  const currentTotal = Number(candidateRows[0]?.total_count || 0);
  const { data: candidateUsages, error: candidateUsagesError } = candidateRows.length
    ? await supabase.rpc("list_media_asset_usages", {
        p_media_ids: candidateRows.map((asset) => asset.id),
      })
    : { data: [], error: null };
  if (candidateUsagesError) {
    redirect(catalogTarget({ error: candidateUsagesError.message }));
  }
  const referencedIds = new Set(
    ((candidateUsages || []) as OrphanUsageRow[]).map((usage) => String(usage.media_id))
  );
  const candidates = candidateRows.filter((asset) =>
    !asset.deleted_at
    && Number(asset.usage_count || 0) === 0
    && !referencedIds.has(String(asset.id))
  );
  const currentPreview: MediaVersionSnapshot[] = candidates.map((asset) => ({
    id: String(asset.id),
    updatedAt: String(asset.updated_at),
  }));
  if (
    currentTotal !== expectedTotal.data
    || !mediaSnapshotSetsMatch(expectedPreview.data, currentPreview)
  ) {
    redirect(catalogTarget({
      error: "Список неиспользуемых файлов изменился после предпросмотра. Операция отменена.",
    }));
  }

  const results: Array<{ id: string; moved: boolean; error?: string }> = [];
  for (const item of selection.data) {
    const { error } = await supabase.rpc("trash_media_asset", {
      p_media_id: item.id,
      p_expected_updated_at: item.updatedAt,
    });
    results.push({ id: item.id, moved: !error, error: error?.message });
  }
  const movedIds = results.filter((item) => item.moved).map((item) => item.id);
  const skipped = results.length - movedIds.length;
  if (movedIds.length === 0) {
    redirect(catalogTarget({
      error: results.find((item) => item.error)?.error
        || "Файлы больше не являются безопасными сиротами. Очистка отменена.",
    }));
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.orphan_cleanup_applied",
    entity_type: "media",
    entity_id: movedIds[0],
    metadata: {
      mediaIds: movedIds,
      movedCount: movedIds.length,
      skippedCount: skipped,
      previewTotal: expectedTotal.data,
      physicalPurge: false,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: movedIds[0],
    reason: "media.orphan_cleanup_applied",
    metadata: { mediaIds: movedIds, movedCount: movedIds.length },
  });
  revalidatePath("/media");
  redirect(catalogTarget({
    saved: "orphan-cleanup",
    orphanCount: movedIds.length,
    skippedCount: skipped,
    published: publication.state,
    error: skipped
      ? `${skipped} файлов получили новые связи и не были перемещены в корзину.`
      : undefined,
  }));
}

export async function permanentlyPurgeMediaAction(formData: FormData) {
  const session = await requireStaff(["owner"]);
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: {
    saved?: string;
    error?: string;
    published?: string;
  }) => mediaCatalogPageHref(catalog, catalog.page, notice);
  const parsed = permanentPurgeSchema.safeParse({
    id: formData.get("id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
    confirmation: formData.get("purge_confirmation"),
  });
  if (!parsed.success || !isMediaPurgeConfirmed(parsed.data.confirmation)) {
    redirect(catalogTarget({
      error: "Фраза безвозвратного удаления введена неверно. Файл не изменён.",
    }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));
  const { data: preparedResult, error: prepareError } = await supabase.rpc(
    "prepare_media_asset_purge",
    {
      p_media_id: parsed.data.id,
      p_expected_updated_at: parsed.data.expectedUpdatedAt,
    }
  );
  if (prepareError) {
    redirect(catalogTarget({ error: permanentPurgeErrorMessage(prepareError) }));
  }
  const preparedCandidate = Array.isArray(preparedResult)
    ? preparedResult[0]
    : preparedResult;
  const prepared = preparedPurgeSchema.safeParse(preparedCandidate);
  if (!prepared.success || prepared.data.media_id !== parsed.data.id) {
    redirect(catalogTarget({
      error: "Сервер вернул повреждённый план удаления. Storage не изменён.",
    }));
  }

  const { error: storageError } = await supabase.storage
    .from(prepared.data.bucket)
    .remove([prepared.data.object_path]);
  if (storageError) {
    const { error: cancelError } = await supabase.rpc("cancel_media_asset_purge", {
      p_media_id: prepared.data.media_id,
      p_purge_token: prepared.data.purge_token,
      p_expected_updated_at: prepared.data.prepared_updated_at,
    });
    await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "media.purge_storage_failed",
      entity_type: "media",
      entity_id: prepared.data.media_id,
      metadata: {
        storageError: storageError.message.slice(0, 500),
        preparationCancelled: !cancelError,
        cancelError: cancelError?.message.slice(0, 500) || null,
      },
    });
    redirect(catalogTarget({
      error: cancelError
        ? "Ответ Storage неоднозначен, поэтому заявка сохранена. Обновите страницу и повторите удаление: тот же защищённый токен будет продолжен."
        : "Storage не подтвердил удаление. Подготовка отменена без удаления записи; можно безопасно повторить позже.",
    }));
  }

  const { error: finalizeError } = await supabase.rpc(
    "finalize_media_asset_purge",
    {
      p_media_id: prepared.data.media_id,
      p_purge_token: prepared.data.purge_token,
      p_expected_updated_at: prepared.data.prepared_updated_at,
    }
  );
  if (finalizeError) {
    await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "media.purge_finalize_failed",
      entity_type: "media",
      entity_id: prepared.data.media_id,
      metadata: { error: finalizeError.message.slice(0, 500) },
    });
    redirect(catalogTarget({
      error: "Storage-объект удалён, но финализация записи не подтверждена. Обновите страницу и повторите действие - подготовленный токен будет продолжен безопасно.",
    }));
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.purge_completed",
    entity_type: "media",
    entity_id: prepared.data.media_id,
    metadata: {
      bucket: prepared.data.bucket,
      objectPath: prepared.data.object_path,
      retentionDays: 30,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: prepared.data.media_id,
    reason: "media.permanently_purged",
    metadata: { retentionDays: 30 },
  });
  revalidatePath("/media");
  redirect(catalogTarget({ saved: "purge", published: publication.state }));
}

async function changeMediaLifecycle(
  formData: FormData,
  operation: "trash" | "restore"
) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: {
    saved?: string;
    error?: string;
    published?: string;
  }) => mediaCatalogPageHref(catalog, catalog.page, notice);
  const parsed = lifecycleSchema.safeParse({
    id: formData.get("id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
  });
  if (!parsed.success) {
    redirect(catalogTarget({ error: "Не удалось определить версию файла." }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));

  const rpcName = operation === "trash"
    ? "trash_media_asset"
    : "restore_media_asset";
  const { error } = await supabase.rpc(rpcName, {
    p_media_id: parsed.data.id,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
  });
  if (error) {
    const message = error.code === "23503"
      ? operation === "restore"
        ? "Исходный объект отсутствует в Storage. Восстановление отменено; загрузите проверенную новую версию."
        : "Файл используется или хранится в истории версий. Сначала проверьте все связи."
      : error.message;
    redirect(catalogTarget({ error: message }));
  }

  const reason = operation === "trash" ? "media.trashed" : "media.restored";
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: parsed.data.id,
    reason,
  });
  revalidatePath("/media");
  redirect(catalogTarget({ saved: operation, published: publication.state }));
}

export async function trashMediaAction(formData: FormData) {
  return changeMediaLifecycle(formData, "trash");
}

export async function restoreMediaAction(formData: FormData) {
  return changeMediaLifecycle(formData, "restore");
}

export async function replaceMediaCurrentUsagesAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const catalog = catalogFromForm(formData);
  const catalogTarget = (notice?: {
    saved?: string;
    error?: string;
    published?: string;
    replacementCount?: number;
  }) => mediaCatalogPageHref(catalog, catalog.page, notice);
  const parsed = replacementSchema.safeParse({
    oldMediaId: formData.get("old_media_id"),
    newMediaId: formData.get("new_media_id"),
    expectedOldUpdatedAt: formData.get("expected_old_updated_at"),
    expectedNewUpdatedAt: formData.get("expected_new_updated_at"),
    expectedUsageRefs: String(formData.get("expected_usage_refs") || ""),
    replaceAllCurrent: formData.get("replace_all_current") === "1",
  });
  if (!parsed.success) {
    redirect(catalogTarget({ error: "Данные предпросмотра замены устарели или повреждены." }));
  }

  let expectedUsageRefs: z.infer<typeof mediaUsageRefsSchema>;
  let selectedUsageRefs: z.infer<typeof mediaUsageRefsSchema>;
  try {
    expectedUsageRefs = parseUsageRefs(parsed.data.expectedUsageRefs);
    selectedUsageRefs = mediaUsageRefsSchema.parse(
      formData.getAll("usage_ref").map((value) => JSON.parse(String(value)))
    );
  } catch {
    redirect(catalogTarget({ error: "Не удалось проверить выбранные места использования." }));
  }
  if (!parsed.data.replaceAllCurrent && selectedUsageRefs.length === 0) {
    redirect(catalogTarget({ error: "Выберите хотя бы одно текущее место использования." }));
  }

  const uniqueSelectedUsageRefs = Array.from(
    new Map(selectedUsageRefs.map((usage) => [
      `${usage.entity_type}:${usage.entity_id}:${usage.field_name}`,
      usage,
    ])).values()
  );
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));

  const { data: assets, error: assetsError } = await supabase
    .from("media_assets")
    .select("id,bucket,object_path")
    .in("id", [parsed.data.oldMediaId, parsed.data.newMediaId]);
  if (assetsError || !assets || assets.length !== 2) {
    redirect(catalogTarget({
      error: assetsError?.message || "Не удалось проверить исходный и новый файлы.",
    }));
  }
  const oldAsset = assets.find((asset) => asset.id === parsed.data.oldMediaId);
  const newAsset = assets.find((asset) => asset.id === parsed.data.newMediaId);
  if (!oldAsset || !newAsset) {
    redirect(catalogTarget({ error: "Исходный или новый файл больше не доступен." }));
  }
  const oldPublicUrl = supabase.storage
    .from(oldAsset.bucket)
    .getPublicUrl(oldAsset.object_path).data.publicUrl;
  const newPublicUrl = supabase.storage
    .from(newAsset.bucket)
    .getPublicUrl(newAsset.object_path).data.publicUrl;

  const { data: replacement, error } = await supabase.rpc(
    "replace_media_asset_current_usages",
    {
      p_old_media_id: parsed.data.oldMediaId,
      p_new_media_id: parsed.data.newMediaId,
      p_expected_old_updated_at: parsed.data.expectedOldUpdatedAt,
      p_expected_new_updated_at: parsed.data.expectedNewUpdatedAt,
      p_expected_usage_refs: expectedUsageRefs,
      p_selected_usage_refs: uniqueSelectedUsageRefs,
      p_replace_all_current: parsed.data.replaceAllCurrent,
      p_old_public_url: oldPublicUrl,
      p_new_public_url: newPublicUrl,
    }
  );
  if (error) {
    redirect(catalogTarget({ error: replacementErrorMessage(error) }));
  }

  const replacedUsageCount = Number(replacement?.[0]?.replaced_usage_count || 0);
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: parsed.data.oldMediaId,
    reason: "media.current_usages_replaced",
    metadata: {
      replacementMediaId: parsed.data.newMediaId,
      replacedUsageCount,
      oldObjectRetained: true,
    },
  });
  revalidatePath("/media");
  redirect(catalogTarget({
    saved: "replacement",
    replacementCount: replacedUsageCount,
    published: publication.state,
  }));
}

export async function republishMediaAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsedId = z.string().uuid().safeParse(formData.get("id"));
  if (!parsedId.success) {
    redirect("/media?error=Не удалось определить загруженное изображение");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/media?error=База данных не подключена");

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "media",
    entityId: parsedId.data,
    reason: "media.uploaded.retry",
    metadata: { source: "media_uploader_retry" },
  });
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "media.publication_retried",
    entity_type: "media",
    entity_id: parsedId.data,
    metadata: { publication: publication.state },
  });
  revalidatePath("/media");
  redirect(`/media?published=${publication.state}`);
}

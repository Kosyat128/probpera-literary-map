"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild, type PublicationState } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  parseVisualContentEdit,
  type VisualContentEditInput,
} from "@/lib/visual-content-edit";
import {
  mergeHomepageVisualSettings,
  parseHomepageVisualSettings,
} from "@/lib/homepage-visual-settings";

export type VisualContentEditResult =
  | { ok: true; publication: PublicationState; updatedAt?: string }
  | { ok: false; error: string };

export type VisualContentVersionResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

export type HomepageBlockVisualSettingsInput = {
  entityId: string;
  expectedUpdatedAt: string;
  settings: unknown;
  reset?: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

function normalizedExpectedUpdatedAt(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return ISO_TIMESTAMP_PATTERN.test(normalized) && !Number.isNaN(Date.parse(normalized))
    ? normalized
    : "";
}

export async function getVisualContentVersionAction(input: {
  entityType: keyof typeof entityConfiguration;
  entityId: string;
}): Promise<VisualContentVersionResult> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется вход в редакцию." };
  const entityId = String(input?.entityId || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(entityId) || !Object.hasOwn(entityConfiguration, input?.entityType)) {
    return { ok: false, error: "Некорректная запись для прямого редактирования." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };
  const configuration = entityConfiguration[input.entityType];
  const { data, error } = await supabase
    .from(configuration.table)
    .select("updated_at")
    .eq("id", entityId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Запись не найдена." };
  return { ok: true, updatedAt: data.updated_at };
}

const entityConfiguration = {
  page: {
    table: "pages",
    auditAction: "page.visual_field_updated",
    publicationType: "page",
  },
  "navigation-item": {
    table: "navigation_items",
    auditAction: "navigation.visual_field_updated",
    publicationType: "navigation_item",
  },
  banner: {
    table: "banners",
    auditAction: "banner.visual_field_updated",
    publicationType: "banner",
  },
  "homepage-block": {
    table: "homepage_blocks",
    auditAction: "homepage.block.visual_field_updated",
    publicationType: "homepage",
  },
} as const;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function saveHomepageBlockVisualSettingsAction(
  input: HomepageBlockVisualSettingsInput
): Promise<VisualContentEditResult> {
  const session = await requireStaff();
  if (!session?.user) {
    return { ok: false, error: "Требуется вход в редакцию." };
  }

  const entityId = String(input?.entityId || "").trim().toLowerCase();
  const expectedUpdatedAt = String(input?.expectedUpdatedAt || "").trim();
  if (!UUID_PATTERN.test(entityId)) {
    return { ok: false, error: "Некорректный идентификатор блока." };
  }
  if (!expectedUpdatedAt) {
    return { ok: false, error: "Версия блока не указана. Обновите предпросмотр." };
  }

  let normalizedSettings;
  try {
    // Validate the complete allowlisted payload even during reset. No CSS text
    // or arbitrary JSON is accepted from the visual editor.
    normalizedSettings = parseHomepageVisualSettings(input.settings);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Некорректные настройки оформления.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "База данных не подключена." };
  }

  const { data: existingBlock, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("settings,is_enabled,updated_at")
    .eq("id", entityId)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (!existingBlock?.is_enabled) {
    return {
      ok: false,
      error: "Блок не найден или сейчас скрыт на сайте.",
    };
  }
  if (existingBlock.updated_at !== expectedUpdatedAt) {
    return {
      ok: false,
      error: "Блок уже изменили в другой вкладке. Обновите предпросмотр и повторите правку.",
    };
  }
  const existingSettings = objectValue(existingBlock.settings);
  if (existingSettings.systemKey) {
    return {
      ok: false,
      error: "Системный блок нельзя оформлять из визуального редактора.",
    };
  }

  const settings = mergeHomepageVisualSettings(
    existingSettings,
    normalizedSettings,
    input.reset === true
  );
  const { data: updated, error: updateError } = await supabase
    .from("homepage_blocks")
    .update({ settings, updated_by: session.user.id })
    .eq("id", entityId)
    .eq("is_enabled", true)
    .eq("updated_at", expectedUpdatedAt)
    .select("id,updated_at")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    return {
      ok: false,
      error:
        "Блок уже изменили в другой вкладке. Обновите предпросмотр и повторите правку.",
    };
  }

  const action = input.reset
    ? "homepage.block.visual_settings_reset"
    : "homepage.block.visual_settings_updated";
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: "homepage",
    entity_id: entityId,
    metadata: {
      fields: Object.keys(normalizedSettings),
      editor: "visual",
    },
  });
  if (auditError) {
    return {
      ok: false,
      error: `Оформление сохранено, но не записано в журнал: ${auditError.message}`,
    };
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "homepage",
    entityId,
    reason: action,
    metadata: { editor: "visual" },
  });

  revalidatePath("/homepage");
  return {
    ok: true,
    publication: publication.state,
    updatedAt: updated.updated_at,
  };
}

export async function saveVisualContentFieldAction(
  input: VisualContentEditInput
): Promise<VisualContentEditResult> {
  const session = await requireStaff();
  if (!session?.user) {
    return { ok: false, error: "Требуется вход в редакцию." };
  }

  let edit: ReturnType<typeof parseVisualContentEdit>;
  try {
    edit = parseVisualContentEdit(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Некорректное изменение.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "База данных не подключена." };
  }
  const expectedUpdatedAt = normalizedExpectedUpdatedAt(input.expectedUpdatedAt);
  if (!expectedUpdatedAt) {
    return {
      ok: false,
      error: "Версия записи не загружена. Выберите поле заново и повторите правку.",
    };
  }

  if (edit.isMedia && edit.value) {
    const { data: mediaAsset, error: mediaError } = await supabase
      .from("media_assets")
      .select("id")
      .eq("id", edit.value)
      .is("deleted_at", null)
      .maybeSingle();
    if (mediaError) return { ok: false, error: mediaError.message };
    if (!mediaAsset) {
      return {
        ok: false,
        error: "Изображение не найдено в действующей медиатеке.",
      };
    }
  }

  const configuration = entityConfiguration[edit.entityType];
  const patch: Record<string, unknown> = { [edit.column]: edit.value };
  if (edit.entityType === "page" || edit.entityType === "banner") {
    patch.updated_by = session.user.id;
  }

  if (edit.entityType === "homepage-block") {
    const { data: existingBlock, error: existingError } = await supabase
      .from("homepage_blocks")
      .select("settings,is_enabled,updated_at")
      .eq("id", edit.entityId)
      .maybeSingle();
    if (existingError) return { ok: false, error: existingError.message };
    const existingSettings = objectValue(existingBlock?.settings);
    if (
      !existingBlock?.is_enabled ||
      existingSettings.systemKey ||
      existingSettings.coreSectionKey
    ) {
      return {
        ok: false,
        error:
          "Этот блок скрыт или управляется отдельной формой основной композиции.",
      };
    }
    if (existingBlock.updated_at !== expectedUpdatedAt) {
      return {
        ok: false,
        error: "Блок уже изменили в другой вкладке. Выберите поле заново и повторите правку.",
      };
    }
    if (edit.column === "settings") {
      patch.settings = {
        ...existingSettings,
        [edit.field]: edit.value,
      };
    }
    patch.updated_by = session.user.id;
  }

  let updateQuery = supabase
    .from(configuration.table)
    .update(patch)
    .eq("id", edit.entityId);
  if (edit.entityType === "page") updateQuery = updateQuery.eq("status", "published");
  if (edit.entityType === "navigation-item") {
    updateQuery = updateQuery.eq("is_visible", true);
  }
  if (edit.entityType === "banner") updateQuery = updateQuery.eq("is_active", true);
  if (edit.entityType === "homepage-block") {
    updateQuery = updateQuery.eq("is_enabled", true);
  }
  updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt);

  const { data: updated, error: updateError } = await updateQuery
    .select("id,updated_at")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    return {
      ok: false,
      error:
        edit.entityType === "homepage-block"
          ? "Блок уже изменили в другой вкладке. Обновите предпросмотр и повторите правку."
          : "Опубликованная запись не найдена или больше не доступна для прямого редактирования.",
    };
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: configuration.auditAction,
    entity_type: configuration.publicationType,
    entity_id: edit.entityId,
    metadata: {
      field: edit.field,
      editor: "visual",
    },
  });
  if (auditError) {
    return {
      ok: false,
      error: `Изменение сохранено, но не записано в журнал: ${auditError.message}`,
    };
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: configuration.publicationType,
    entityId: edit.entityId,
    reason: configuration.auditAction,
    metadata: { field: edit.field, editor: "visual" },
  });

  revalidatePath("/homepage");
  if (edit.entityType === "page") {
    revalidatePath("/pages");
    revalidatePath(`/pages/${edit.entityId}`);
  } else if (edit.entityType === "navigation-item") {
    revalidatePath("/menus");
  } else if (edit.entityType === "banner") {
    revalidatePath("/banners");
  }

  return {
    ok: true,
    publication: publication.state,
    updatedAt: updated.updated_at,
  };
}

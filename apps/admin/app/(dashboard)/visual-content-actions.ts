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

function visualEditDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return "Не удалось сохранить изменение.";
  if (error.code === "40001" || /visual_edit_conflict/iu.test(error.message || "")) {
    return "Запись уже изменили в другой вкладке. Обновите предпросмотр и повторите правку.";
  }
  if (error.code === "42501" || /visual_edit_forbidden/iu.test(error.message || "")) {
    return "Недостаточно прав для прямого редактирования.";
  }
  if (error.code === "23503" || /visual_edit_media_missing/iu.test(error.message || "")) {
    return "Изображение не найдено в действующей медиатеке.";
  }
  if (error.code === "22023" || /visual_edit_(?:invalid|field|entity)/iu.test(error.message || "")) {
    return "Изменение не прошло безопасную проверку.";
  }
  return "База данных временно не приняла изменение.";
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
  if (error) return { ok: false, error: visualEditDatabaseError(error) };
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

  const action = input.reset
    ? "homepage.block.visual_settings_reset"
    : "homepage.block.visual_settings_updated";
  const { data: updated, error: updateError } = await supabase.rpc(
    "save_homepage_visual_settings_v2",
    {
      p_entity_id: entityId,
      p_settings: normalizedSettings,
      p_reset: input.reset === true,
      p_expected_updated_at: expectedUpdatedAt,
    }
  );
  if (updateError) {
    return { ok: false, error: visualEditDatabaseError(updateError) };
  }
  const updatedAt =
    updated && typeof updated === "object" && "updatedAt" in updated &&
    typeof updated.updatedAt === "string"
      ? updated.updatedAt
      : "";
  if (!updatedAt) {
    return { ok: false, error: "База данных не вернула новую версию блока." };
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
    updatedAt,
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

  const configuration = entityConfiguration[edit.entityType];
  const { data: updated, error: updateError } = await supabase.rpc(
    "save_visual_content_field_v2",
    {
      p_entity_type: edit.entityType,
      p_entity_id: edit.entityId,
      p_field: edit.field,
      p_value: edit.value,
      p_expected_updated_at: expectedUpdatedAt,
    }
  );
  if (updateError) {
    return { ok: false, error: visualEditDatabaseError(updateError) };
  }
  const updatedAt =
    updated && typeof updated === "object" && "updatedAt" in updated &&
    typeof updated.updatedAt === "string"
      ? updated.updatedAt
      : "";
  if (!updatedAt) {
    return { ok: false, error: "База данных не вернула новую версию записи." };
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
    updatedAt,
  };
}

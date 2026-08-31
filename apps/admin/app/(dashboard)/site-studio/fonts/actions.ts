"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  expectedTypographyVersionFromForm,
  typographyPropertiesInputFromForm,
  typographyTargetFromForm,
} from "@/lib/site-typography";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pagePath = "/site-studio/fonts";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function pageTarget(
  values: Record<string, string | number | undefined> = {}
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value)) query.set(key, String(value));
  }
  return query.size ? `${pagePath}?${query.toString()}` : pagePath;
}

function requiredUuid(value: FormDataEntryValue | null, label: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!uuidPattern.test(candidate)) throw new Error(`Некорректный ${label}.`);
  return candidate.toLowerCase();
}

function rpcErrorMessage(
  error: { code?: string; message?: string } | null,
  fallback: string
) {
  if (error?.code === "40001" || /(?:version|верс|conflict|stale)/iu.test(error?.message || "")) {
    return "Настройка уже изменена в другой вкладке. Обновите страницу и повторите действие.";
  }
  if (error?.code === "23503") {
    return "Шрифт используется в настройках или истории типографики и не может быть архивирован.";
  }
  if (error?.code === "42501") return "Недостаточно прав для этого действия.";
  return fallback;
}

async function mutationContext() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(pageTarget({ error: "База данных не подключена" }));
  return { session, supabase };
}

export async function saveTypographyOverrideAction(formData: FormData) {
  const { supabase } = await mutationContext();
  const overrideValue = formData.get("override_id");
  const overrideId =
    typeof overrideValue === "string" && overrideValue.trim()
      ? requiredUuid(overrideValue, "идентификатор настройки")
      : null;

  let target;
  let settings;
  let expectedVersion: number | null = null;
  try {
    target = typographyTargetFromForm(formData);
    settings = typographyPropertiesInputFromForm(formData);
    if (!Object.keys(settings).length) {
      throw new Error(
        "Укажите хотя бы один параметр. Чтобы убрать настройку, используйте «Сбросить»."
      );
    }
    if (overrideId) expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        override: overrideId || undefined,
        error: error instanceof Error ? error.message : "Проверьте настройки",
      })
    );
  }

  const { data, error } = await supabase.rpc("save_site_typography_override", {
    p_override_id: overrideId,
    p_layer: target.layer,
    p_target_key: target.targetKey,
    p_semantic_scope: target.semanticScope,
    p_breakpoint: target.breakpoint,
    p_draft_settings: settings,
    p_expected_cas_version: expectedVersion,
  });
  const saved = Array.isArray(data) ? data[0] : data;
  if (error || !saved || typeof saved !== "object") {
    redirect(
      pageTarget({
        override: overrideId || undefined,
        error: rpcErrorMessage(error, "Не удалось сохранить настройку."),
      })
    );
  }
  const savedId = String((saved as { id?: unknown }).id || overrideId || "");
  revalidatePath(pagePath);
  redirect(pageTarget({ saved: 1, override: savedId || undefined }));
}

export async function resetTypographyOverrideAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let overrideId: string;
  let expectedVersion: number;
  let target;
  try {
    overrideId = requiredUuid(formData.get("override_id"), "идентификатор настройки");
    expectedVersion = expectedTypographyVersionFromForm(formData);
    target = typographyTargetFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: error instanceof Error ? error.message : "Проверьте настройку",
      })
    );
  }

  const { data: savedData, error: saveError } = await supabase.rpc(
    "save_site_typography_override",
    {
      p_override_id: overrideId,
      p_layer: target.layer,
      p_target_key: target.targetKey,
      p_semantic_scope: target.semanticScope,
      p_breakpoint: target.breakpoint,
      p_draft_settings: {},
      p_expected_cas_version: expectedVersion,
    }
  );
  const saved = Array.isArray(savedData) ? savedData[0] : savedData;
  const savedVersion = Number(
    saved && typeof saved === "object"
      ? (saved as { cas_version?: unknown }).cas_version
      : Number.NaN
  );
  if (saveError || !Number.isSafeInteger(savedVersion)) {
    redirect(
      pageTarget({
        override: overrideId,
        error: rpcErrorMessage(saveError, "Не удалось сбросить настройку."),
      })
    );
  }
  const { error: publishError } = await supabase.rpc(
    "publish_site_typography_override",
    {
      p_override_id: overrideId,
      p_expected_cas_version: savedVersion,
    }
  );
  if (publishError) {
    redirect(
      pageTarget({
        override: overrideId,
        error: rpcErrorMessage(
          publishError,
          "Сброс сохранён как черновик, но опубликовать его не удалось."
        ),
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ reset: 1 }));
}

export async function publishTypographyOverrideAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let overrideId: string;
  let expectedVersion: number;
  try {
    overrideId = requiredUuid(formData.get("override_id"), "идентификатор настройки");
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: error instanceof Error ? error.message : "Проверьте настройку",
      })
    );
  }

  const { data, error } = await supabase.rpc("publish_site_typography_override", {
    p_override_id: overrideId,
    p_expected_cas_version: expectedVersion,
  });
  if (error || !data) {
    redirect(
      pageTarget({
        override: overrideId,
        error: rpcErrorMessage(error, "Не удалось опубликовать настройку."),
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ published: 1, override: overrideId }));
}

export async function restoreTypographyRevisionAction(formData: FormData) {
  const { supabase } = await mutationContext();
  const revisionValue = formData.get("revision_id");
  const revisionId =
    typeof revisionValue === "string" && /^[0-9]+$/u.test(revisionValue.trim())
      ? Number(revisionValue)
      : Number.NaN;
  let expectedVersion: number;
  try {
    if (!Number.isSafeInteger(revisionId) || revisionId < 1) {
      throw new Error("Некорректная версия истории.");
    }
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: error instanceof Error ? error.message : "Проверьте версию",
      })
    );
  }

  const { data, error } = await supabase.rpc("restore_site_typography_revision", {
    p_revision_id: revisionId,
    p_expected_cas_version: expectedVersion,
  });
  const restored = Array.isArray(data) ? data[0] : data;
  if (error || !restored || typeof restored !== "object") {
    redirect(
      pageTarget({
        error: rpcErrorMessage(error, "Не удалось восстановить версию."),
      })
    );
  }
  const restoredId = String((restored as { id?: unknown }).id || "");
  revalidatePath(pagePath);
  redirect(pageTarget({ restored: 1, override: restoredId || undefined }));
}

export async function archiveFontAssetAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let fontId: string;
  let expectedVersion: number;
  try {
    fontId = requiredUuid(formData.get("font_id"), "идентификатор шрифта");
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: error instanceof Error ? error.message : "Проверьте шрифт",
      })
    );
  }

  const { error } = await supabase.rpc("archive_font_asset", {
    p_font_id: fontId,
    p_expected_cas_version: expectedVersion,
    p_reason: "Архивирован через Site Studio",
  });
  if (error) {
    redirect(
      pageTarget({
        error: rpcErrorMessage(error, "Не удалось архивировать шрифт."),
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ archived: 1 }));
}

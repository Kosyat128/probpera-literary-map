"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  allSiteCopyKeys,
} from "@/lib/site-copy-catalog";
import {
  mergeSiteCopyRows,
  readSiteCopyValues,
} from "@/lib/site-copy-storage";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";
const SITE_COPY_DISPLAY_ORDER = 2_000_000_000;
const MAX_COPY_LENGTH = 4_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isAllowedCopyKey(key: string) {
  return (
    allSiteCopyKeys.has(key) ||
    (key.startsWith("interface.") &&
      key.slice("interface.".length).trim().length > 0 &&
      key.length <= 1_200)
  );
}

function submittedRows(formData: FormData) {
  const keys = formData.getAll("copy_key").map(String);
  const russianValues = formData.getAll("copy_ru").map(String);
  const englishValues = formData.getAll("copy_en").map(String);
  if (
    keys.length !== russianValues.length ||
    keys.length !== englishValues.length ||
    keys.length > allSiteCopyKeys.size + 100
  ) {
    throw new Error("Форма текстов повреждена. Обновите страницу и повторите.");
  }

  const rows = keys.map((key, index) => ({
    key: key.trim(),
    ru: russianValues[index]?.trim() || "",
    en: englishValues[index]?.trim() || "",
  }));
  const customSource = String(formData.get("custom_source") || "").trim();
  if (customSource) {
    rows.push({
      key: `interface.${customSource}`,
      ru: String(formData.get("custom_ru") || "").trim(),
      en: String(formData.get("custom_en") || "").trim(),
    });
  }

  for (const row of rows) {
    if (!isAllowedCopyKey(row.key)) {
      throw new Error(`Неизвестное поле текста: ${row.key}`);
    }
    if (row.ru.length > MAX_COPY_LENGTH || row.en.length > MAX_COPY_LENGTH) {
      throw new Error(
        `Текст «${row.key}» длиннее ${MAX_COPY_LENGTH} символов.`
      );
    }
  }
  return rows;
}

export async function saveSiteCopyAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const expectedUpdatedAt = String(
    formData.get("expected_updated_at") || ""
  ).trim();

  let rows: ReturnType<typeof submittedRows>;
  try {
    rows = submittedRows(formData);
  } catch (error) {
    redirect(
      `/site-copy?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Проверьте тексты"
      )}`
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/site-copy?error=База данных не подключена");

  const { data: existingRows, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingError) {
    redirect(`/site-copy?error=${encodeURIComponent(existingError.message)}`);
  }

  const existing = existingRows?.[0];
  if (existing && (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt)) {
    redirect(
      "/site-copy?error=" +
        encodeURIComponent(
          "Тексты уже изменили в другой вкладке. Обновите страницу и повторите сохранение."
        )
    );
  }
  const existingSettings = objectValue(existing?.settings);
  const { ru, en } = mergeSiteCopyRows(
    readSiteCopyValues(existingSettings.siteCopy),
    rows
  );

  const payload = {
    block_type: "text",
    title: "Системные тексты сайта",
    settings: {
      ...existingSettings,
      systemKey: SITE_COPY_SYSTEM_KEY,
      version: 1,
      siteCopy: { ru, en },
    },
    display_order: SITE_COPY_DISPLAY_ORDER,
    is_enabled: true,
    background_style: "transparent",
    background_media_id: null,
    updated_by: session.user.id,
  };

  let blockId = existing?.id;
  if (blockId) {
    const { data: updated, error } = await supabase
      .from("homepage_blocks")
      .update(payload)
      .eq("id", blockId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error) redirect(`/site-copy?error=${encodeURIComponent(error.message)}`);
    if (!updated) {
      redirect(
        "/site-copy?error=" +
          encodeURIComponent(
            "Тексты уже изменили в другой вкладке. Обновите страницу и повторите сохранение."
          )
      );
    }
  } else {
    const { data, error } = await supabase
      .from("homepage_blocks")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      redirect(
        `/site-copy?error=${encodeURIComponent(
          error?.message || "Не удалось сохранить тексты"
        )}`
      );
    }
    blockId = data.id;
  }
  if (!blockId) redirect("/site-copy?error=Не удалось определить запись текстов");

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "site_copy.updated",
    entity_type: "site_copy",
    entity_id: blockId,
    metadata: {
      russian_overrides: Object.keys(ru).length,
      english_overrides: Object.keys(en).length,
      storage: "homepage_blocks",
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site_copy",
    entityId: blockId,
    reason: "site-copy.updated",
    metadata: { storage: "homepage_blocks" },
  });

  revalidatePath("/site-copy");
  revalidatePath("/homepage");
  redirect(`/site-copy?saved=1&published=${publication.state}`);
}

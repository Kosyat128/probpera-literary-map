"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild, type PublicationState } from "@/lib/publication";
import {
  normalizeShortHyphens,
  normalizeShortHyphensDeep,
} from "@/lib/short-hyphens";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mergeInlineRussianSiteCopy,
  readSiteCopyValues,
} from "@/lib/site-copy-storage";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";
const SITE_COPY_DISPLAY_ORDER = 2_000_000_000;
const MAX_COPY_KEY_LENGTH = 1_200;
const MAX_COPY_LENGTH = 4_000;

export type InlineSiteCopyResult =
  | { ok: true; publication: PublicationState }
  | { ok: false; error: string };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function validInterfaceKey(value: string) {
  return (
    value.startsWith("interface.") &&
    value.slice("interface.".length).trim().length > 0 &&
    value.length <= MAX_COPY_KEY_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export async function saveInlineSiteCopyAction(input: {
  key: string;
  value: string;
}): Promise<InlineSiteCopyResult> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется вход в редакцию." };

  const key = normalizeShortHyphens(String(input.key || "").trim());
  const value = normalizeShortHyphens(String(input.value || "").trim());
  if (!validInterfaceKey(key)) {
    return { ok: false, error: "Некорректный ключ текста." };
  }
  if (value.length > MAX_COPY_LENGTH) {
    return {
      ok: false,
      error: `Текст длиннее ${MAX_COPY_LENGTH} символов.`,
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };

  const { data: existingRows, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingError) {
    return { ok: false, error: "Не удалось безопасно прочитать тексты." };
  }

  const existing = existingRows?.[0];
  const existingSettings = objectValue(existing?.settings);
  const siteCopy = mergeInlineRussianSiteCopy(
    readSiteCopyValues(existingSettings.siteCopy),
    key,
    value
  );
  const payload = {
    block_type: "text",
    title: "Системные тексты сайта",
    settings: {
      ...existingSettings,
      systemKey: SITE_COPY_SYSTEM_KEY,
      version: 1,
      siteCopy: normalizeShortHyphensDeep(siteCopy),
    },
    display_order: SITE_COPY_DISPLAY_ORDER,
    is_enabled: true,
    background_style: "transparent",
    background_media_id: null,
    updated_by: session.user.id,
  };

  const { data: blockId, error: saveError } = await supabase.rpc(
    "save_site_copy_block",
    {
      p_expected_updated_at: existing ? existing.updated_at : null,
      p_payload: payload,
      p_audit_metadata: { key, inline_editor: true },
    }
  );
  if (saveError?.message === "SITE_COPY_WRITE_CONFLICT") {
    return {
      ok: false,
      error:
        "Текст уже изменили в другой вкладке. Обновите предпросмотр и повторите правку.",
    };
  }
  if (saveError) {
    return { ok: false, error: "Не удалось безопасно сохранить текст." };
  }
  if (!blockId) return { ok: false, error: "Не удалось определить запись текста." };
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site_copy",
    entityId: blockId,
    reason: "site-copy.inline-updated",
    metadata: { key, storage: "homepage_blocks" },
  });

  revalidatePath("/site-copy");
  revalidatePath("/homepage");
  return { ok: true, publication: publication.state };
}

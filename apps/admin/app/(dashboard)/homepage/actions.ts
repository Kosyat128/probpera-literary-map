"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
import {
  HOMEPAGE_BUTTON_URL_ERROR,
  homepageSettingsPatch,
  isSafeHomepageButtonUrl,
} from "@/lib/homepage-settings";
import {
  homepageVisualSettingsInputFromForm,
  mergeHomepageVisualSettings,
  resetHomepageImageVisualSettings,
} from "@/lib/homepage-visual-settings";
import {
  bookArchiveSceneSettingsInputFromForm,
  mergeBookArchiveSceneSettings,
} from "@/lib/book-archive-scene-settings";
import { bookArchiveBackgroundMediaIssue } from "@/lib/book-archive-media-policy";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const blockTypes = new Set([
  "hero",
  "article-grid",
  "carousel",
  "editors-choice",
  "popular",
  "latest",
  "categories",
  "book-vs-screen",
  "literary-map",
  "awards",
  "subscription",
  "text",
]);
const backgroundStyles = new Set([
  "light",
  "violet",
  "orange",
  "paper",
  "transparent",
]);
const coreSectionTypes: Record<string, string> = {
  hero: "hero",
  atlas: "literary-map",
  "book-month": "book-vs-screen",
  "editorial-standard": "text",
  "book-archive": "carousel",
  "featured-journal": "article-grid",
  community: "subscription",
  authors: "carousel",
  sections: "categories",
  trust: "text",
  calendar: "text",
};
const coreSectionOrder = Object.keys(coreSectionTypes);
const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";

function text(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) || "").trim().slice(0, maxLength);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isSystemHomepageBlock(block: { settings?: unknown }) {
  return objectValue(block.settings).systemKey === SITE_COPY_SYSTEM_KEY;
}

function isProtectedHomepageBlock(block: { settings?: unknown }) {
  const settings = objectValue(block.settings);
  return Boolean(settings.systemKey || settings.coreSectionKey);
}

function optionalUuid(formData: FormData, key: string) {
  const value = text(formData, key, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value
  )
    ? value
    : null;
}

function settingsFromForm(formData: FormData) {
  const buttonUrl = text(formData, "button_url", 500);
  if (!isSafeHomepageButtonUrl(buttonUrl)) {
    redirect(`/homepage?error=${encodeURIComponent(HOMEPAGE_BUTTON_URL_ERROR)}`);
  }
  return homepageSettingsPatch({
    eyebrow: text(formData, "eyebrow", 160),
    description: text(formData, "description", 2_000),
    buttonText: text(formData, "button_text", 120),
    buttonUrl,
    ...(formData.has("article_ids")
      ? { articleIdsText: text(formData, "article_ids", 8_000) }
      : {}),
  });
}

function mergedSettingsFromForm(
  existingSettings: Record<string, unknown>,
  formData: FormData
) {
  const contentSettings = {
    ...existingSettings,
    ...settingsFromForm(formData),
  };
  if (!formData.has("imageFit")) return contentSettings;
  return mergeHomepageVisualSettings(
    contentSettings,
    homepageVisualSettingsInputFromForm(formData),
    formData.get("reset_visual_settings") === "1"
  );
}

async function recordBuildRequest(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  entityId: string,
  reason: string
) {
  return requestPublicBuild({
    supabase,
    actorId,
    entityType: "homepage",
    entityId,
    reason,
  });
}

export async function createHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const blockType = text(formData, "block_type", 80);
  const backgroundStyle = text(formData, "background_style", 40);
  if (!blockTypes.has(blockType) || !backgroundStyles.has(backgroundStyle)) {
    redirect("/homepage?error=Некорректный тип блока");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: homepageBlocks } = await supabase
    .from("homepage_blocks")
    .select("display_order,settings");
  const lastDisplayOrder = Math.max(
    0,
    ...(homepageBlocks || [])
      .filter((block) => !isSystemHomepageBlock(block))
      .map((block) => block.display_order || 0)
  );
  const { data, error } = await supabase
    .from("homepage_blocks")
    .insert({
      block_type: blockType,
      title: text(formData, "title", 240),
      settings: settingsFromForm(formData),
      display_order: lastDisplayOrder + 10,
      background_style: backgroundStyle,
      background_media_id: optionalUuid(formData, "background_media_id"),
      updated_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(
      `/homepage?error=${encodeURIComponent(
        error?.message || "Не удалось создать блок"
      )}`
    );
  }
  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    data.id,
    "homepage.block.created"
  );
  revalidatePath("/homepage");
  redirect(`/homepage?saved=1&published=${publication.state}`);
}

export async function updateHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = text(formData, "id", 80);
  const expectedUpdatedAt = text(formData, "expected_updated_at", 80);
  const backgroundStyle = text(formData, "background_style", 40);
  if (!id || !backgroundStyles.has(backgroundStyle)) {
    redirect("/homepage?error=Некорректные параметры блока");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("settings,updated_at")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    redirect(
      `/homepage?error=${encodeURIComponent(
        existingError?.message || "Блок не найден"
      )}`
    );
  }
  if (isSystemHomepageBlock(existing)) {
    redirect("/homepage?error=Системный блок редактируется в разделе текстов сайта");
  }
  if (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt) {
    redirect("/homepage?error=Блок уже изменён в другой вкладке. Обновите страницу и повторите правку.");
  }
  const existingSettings =
    existing.settings &&
    typeof existing.settings === "object" &&
    !Array.isArray(existing.settings)
      ? (existing.settings as Record<string, unknown>)
      : {};
  const { data: updated, error } = await supabase
    .from("homepage_blocks")
    .update({
      title: text(formData, "title", 240),
      settings: mergedSettingsFromForm(existingSettings, formData),
      background_style: backgroundStyle,
      background_media_id: optionalUuid(formData, "background_media_id"),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    if (!error) {
      redirect("/homepage?error=Блок уже изменён в другой вкладке. Обновите страницу и повторите правку.");
    }
    redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
  }
  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    id,
    "homepage.block.updated"
  );
  revalidatePath("/homepage");
  redirect(`/homepage?saved=1&published=${publication.state}`);
}

export async function toggleHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = text(formData, "id", 80);
  const expectedUpdatedAt = text(formData, "expected_updated_at", 80);
  const enabled = formData.get("enabled") === "true";
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("settings,updated_at")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    redirect(`/homepage?error=${encodeURIComponent(existingError?.message || "Блок не найден")}`);
  }
  if (isProtectedHomepageBlock(existing)) {
    redirect("/homepage?error=Основной или системный блок нельзя выключить здесь");
  }
  if (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt) {
    redirect("/homepage?error=Блок уже изменён в другой вкладке. Обновите страницу.");
  }
  const { data: updated, error } = await supabase
    .from("homepage_blocks")
    .update({
      is_enabled: enabled,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
  if (!updated) redirect("/homepage?error=Блок уже изменён в другой вкладке. Обновите страницу.");
  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    id,
    enabled ? "homepage.block.enabled" : "homepage.block.disabled"
  );
  revalidatePath("/homepage");
  redirect(`/homepage?saved=1&published=${publication.state}`);
}

export async function moveHomepageBlockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = text(formData, "id", 80);
  const direction = formData.get("direction") === "up" ? "up" : "down";
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: moved, error } = await supabase.rpc("move_homepage_block", {
    p_block_id: id,
    p_direction: direction,
  });
  if (error) {
    redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
  }
  if (!moved) return;
  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    id,
    "homepage.block.moved"
  );
  revalidatePath("/homepage");
  redirect(`/homepage?saved=1&published=${publication.state}`);
}

export async function deleteHomepageBlockAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = text(formData, "id", 80);
  const expectedUpdatedAt = text(formData, "expected_updated_at", 80);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("settings,updated_at")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    redirect(`/homepage?error=${encodeURIComponent(existingError?.message || "Блок не найден")}`);
  }
  if (isProtectedHomepageBlock(existing)) {
    redirect("/homepage?error=Основной или системный блок нельзя удалить");
  }
  if (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt) {
    redirect("/homepage?error=Блок уже изменён в другой вкладке. Обновите страницу.");
  }
  const { data: deleted, error } = await supabase
    .from("homepage_blocks")
    .delete()
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
  if (!deleted) redirect("/homepage?error=Блок уже изменён или удалён. Обновите страницу.");
  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    id,
    "homepage.block.deleted"
  );
  revalidatePath("/homepage");
  redirect(`/homepage?deleted=1&published=${publication.state}`);
}

export async function republishHomepageAction() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=Ошибка доступа к БД");

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "homepage",
    entityId: "manual_publish",
    reason: "homepage.manual_republish",
    metadata: { source: "admin_manual_republish" },
  });

  revalidatePath("/homepage");
  redirect(
    `/homepage?published=${publication.state}`
  );
}

export async function saveCoreHomepageSectionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const coreSectionKey = text(formData, "core_section_key", 80);
  const expectedUpdatedAt = text(formData, "expected_updated_at", 80);
  const blockType = coreSectionTypes[coreSectionKey];
  const backgroundStyle = text(formData, "background_style", 40);
  if (!blockType || !backgroundStyles.has(backgroundStyle)) {
    redirect("/homepage?error=Некорректный основной блок");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { coreSectionKey })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    redirect(`/homepage?error=${encodeURIComponent(existingError.message)}`);
  }

  const existingSettings =
    existing?.settings &&
    typeof existing.settings === "object" &&
    !Array.isArray(existing.settings)
      ? (existing.settings as Record<string, unknown>)
      : {};
  const resetBookScene =
    coreSectionKey === "book-archive" &&
    formData.get("reset_book_scene_settings") === "1";
  let nextSettings = mergedSettingsFromForm(existingSettings, formData);
  if (resetBookScene) {
    nextSettings = resetHomepageImageVisualSettings(nextSettings);
  }
  if (
    coreSectionKey === "book-archive" &&
    (formData.has("bookScenePreset") || resetBookScene)
  ) {
    try {
      nextSettings = mergeBookArchiveSceneSettings(
        nextSettings,
        bookArchiveSceneSettingsInputFromForm(formData),
        resetBookScene
      );
    } catch (error) {
      redirect(
        `/homepage?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Invalid book scene settings"
        )}`
      );
    }
  }
  const backgroundMediaId = resetBookScene
    ? null
    : optionalUuid(formData, "background_media_id");
  if (coreSectionKey === "book-archive" && backgroundMediaId) {
    const { data: sceneMedia, error: sceneMediaError } = await supabase
      .from("media_assets")
      .select("mime_type,alt_text,creator,source_url,license_name,license_url")
      .eq("id", backgroundMediaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (sceneMediaError) {
      redirect(`/homepage?error=${encodeURIComponent(sceneMediaError.message)}`);
    }
    const mediaIssue = bookArchiveBackgroundMediaIssue(sceneMedia);
    if (mediaIssue) {
      redirect(`/homepage?error=${encodeURIComponent(mediaIssue)}`);
    }
  }
  const payload = {
    block_type: blockType,
    title: text(formData, "title", 240),
    settings: {
      ...nextSettings,
      coreSectionKey,
    },
    display_order: (coreSectionOrder.indexOf(coreSectionKey) + 1) * 10,
    is_enabled: true,
    background_style: backgroundStyle,
    background_media_id: backgroundMediaId,
    updated_by: session.user.id,
  };

  let blockId = existing?.id;
  if (existing && blockId) {
    if (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt) {
      redirect("/homepage?error=Основной блок уже изменён в другой вкладке. Обновите страницу и повторите правку.");
    }
    const { data: updated, error } = await supabase
      .from("homepage_blocks")
      .update(payload)
      .eq("id", blockId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      if (!error) {
        redirect("/homepage?error=Основной блок уже изменён в другой вкладке. Обновите страницу и повторите правку.");
      }
      redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { data, error } = await supabase
      .from("homepage_blocks")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      redirect(
        `/homepage?error=${encodeURIComponent(
          error?.message || "Не удалось подключить основной блок"
        )}`
      );
    }
    blockId = data.id;
  }
  if (!blockId) redirect("/homepage?error=Не удалось определить основной блок");

  const publication = await recordBuildRequest(
    supabase,
    session.user.id,
    blockId,
    `homepage.core.${coreSectionKey}.updated`
  );
  revalidatePath("/homepage");
  redirect(`/homepage?saved=1&published=${publication.state}#core-${coreSectionKey}`);
}

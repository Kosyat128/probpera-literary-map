"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
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
  "featured-journal": "article-grid",
  community: "subscription",
  authors: "carousel",
  sections: "categories",
  trust: "text",
  calendar: "text",
};
const coreSectionOrder = Object.keys(coreSectionTypes);

function text(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) || "").trim().slice(0, maxLength);
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
  const articleIds = text(formData, "article_ids", 8_000)
    .split(/[\s,;]+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 24);
  return {
    eyebrow: text(formData, "eyebrow", 160),
    description: text(formData, "description", 2_000),
    buttonText: text(formData, "button_text", 120),
    buttonUrl: text(formData, "button_url", 500),
    articleIds,
  };
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
  const { data: lastBlock } = await supabase
    .from("homepage_blocks")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("homepage_blocks")
    .insert({
      block_type: blockType,
      title: text(formData, "title", 240),
      settings: settingsFromForm(formData),
      display_order: (lastBlock?.display_order || 0) + 10,
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
  const backgroundStyle = text(formData, "background_style", 40);
  if (!id || !backgroundStyles.has(backgroundStyle)) {
    redirect("/homepage?error=Некорректные параметры блока");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("settings")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    redirect(
      `/homepage?error=${encodeURIComponent(
        existingError?.message || "Блок не найден"
      )}`
    );
  }
  const existingSettings =
    existing.settings &&
    typeof existing.settings === "object" &&
    !Array.isArray(existing.settings)
      ? (existing.settings as Record<string, unknown>)
      : {};
  const { error } = await supabase
    .from("homepage_blocks")
    .update({
      title: text(formData, "title", 240),
      settings: {
        ...existingSettings,
        ...settingsFromForm(formData),
      },
      background_style: backgroundStyle,
      background_media_id: optionalUuid(formData, "background_media_id"),
      updated_by: session.user.id,
    })
    .eq("id", id);
  if (error) {
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
  const enabled = formData.get("enabled") === "true";
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { error } = await supabase
    .from("homepage_blocks")
    .update({
      is_enabled: enabled,
      updated_by: session.user.id,
    })
    .eq("id", id);
  if (error) redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
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
  const { data: blocks, error } = await supabase
    .from("homepage_blocks")
    .select("id,display_order")
    .order("display_order");
  if (error || !blocks) {
    redirect(`/homepage?error=${encodeURIComponent(error?.message || "Блоки не найдены")}`);
  }
  const index = blocks.findIndex((block) => block.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= blocks.length) return;
  const target = blocks[targetIndex];
  const current = blocks[index];
  const temporaryOrder =
    Math.min(...blocks.map((block) => block.display_order || 0), 0) - 10;
  const { error: holdError } = await supabase
    .from("homepage_blocks")
    .update({ display_order: temporaryOrder, updated_by: session.user.id })
    .eq("id", current.id);
  if (holdError) {
    redirect(`/homepage?error=${encodeURIComponent(holdError.message)}`);
  }
  const { error: targetError } = await supabase
    .from("homepage_blocks")
    .update({
      display_order: current.display_order,
      updated_by: session.user.id,
    })
    .eq("id", target.id);
  if (targetError) {
    await supabase
      .from("homepage_blocks")
      .update({ display_order: current.display_order })
      .eq("id", current.id);
    redirect(`/homepage?error=${encodeURIComponent(targetError.message)}`);
  }
  const { error: currentError } = await supabase
    .from("homepage_blocks")
    .update({
      display_order: target.display_order,
      updated_by: session.user.id,
    })
    .eq("id", current.id);
  if (currentError) {
    await supabase
      .from("homepage_blocks")
      .update({ display_order: target.display_order })
      .eq("id", target.id);
    await supabase
      .from("homepage_blocks")
      .update({ display_order: current.display_order })
      .eq("id", current.id);
    redirect(`/homepage?error=${encodeURIComponent(currentError.message)}`);
  }
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
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { error } = await supabase.from("homepage_blocks").delete().eq("id", id);
  if (error) redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
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
  const blockType = coreSectionTypes[coreSectionKey];
  const backgroundStyle = text(formData, "background_style", 40);
  if (!blockType || !backgroundStyles.has(backgroundStyle)) {
    redirect("/homepage?error=Некорректный основной блок");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/homepage?error=База данных не подключена");
  const { data: existing, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings")
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
  const payload = {
    block_type: blockType,
    title: text(formData, "title", 240),
    settings: {
      ...existingSettings,
      ...settingsFromForm(formData),
      coreSectionKey,
    },
    display_order: (coreSectionOrder.indexOf(coreSectionKey) + 1) * 10,
    is_enabled: true,
    background_style: backgroundStyle,
    background_media_id: optionalUuid(formData, "background_media_id"),
    updated_by: session.user.id,
  };

  let blockId = existing?.id;
  if (blockId) {
    const { error } = await supabase
      .from("homepage_blocks")
      .update(payload)
      .eq("id", blockId);
    if (error) redirect(`/homepage?error=${encodeURIComponent(error.message)}`);
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

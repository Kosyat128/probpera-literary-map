"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  expectedTypographyVersionFromForm,
  SiteTypographyValidationError,
  typographyPropertiesInputFromForm,
  typographyTargetFromForm,
  type SiteTypographyErrorCode,
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

function requiredUuid(value: FormDataEntryValue | null) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!uuidPattern.test(candidate)) {
    throw new SiteTypographyValidationError("typography_id_invalid");
  }
  return candidate.toLowerCase();
}

function typographyErrorCode(
  error: unknown,
  fallback: SiteTypographyErrorCode = "typography_request_invalid"
) {
  return error instanceof SiteTypographyValidationError ? error.code : fallback;
}

function rpcErrorCode(
  error: { code?: string; message?: string } | null,
  fallback: SiteTypographyErrorCode
): SiteTypographyErrorCode {
  if (
    error?.code === "40001" ||
    /(?:version|верс|conflict|stale)/iu.test(error?.message || "")
  ) {
    return "typography_stale";
  }
  if (error?.code === "23503") {
    return "typography_font_in_use";
  }
  if (error?.code === "42501") return "typography_forbidden";
  return fallback;
}

async function mutationContext() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(pageTarget({ error: "typography_database_unavailable" }));
  }
  return { session, supabase };
}

export async function saveTypographyOverrideAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let overrideId: string | null = null;
  let target;
  let settings;
  let expectedVersion: number | null = null;
  try {
    const overrideValue = formData.get("override_id");
    overrideId =
      typeof overrideValue === "string" && overrideValue.trim()
        ? requiredUuid(overrideValue)
        : null;
    target = typographyTargetFromForm(formData);
    settings = typographyPropertiesInputFromForm(formData);
    if (!Object.keys(settings).length) {
      throw new SiteTypographyValidationError("typography_empty");
    }
    if (overrideId) expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        override: overrideId || undefined,
        error: typographyErrorCode(error),
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
        error: rpcErrorCode(error, "typography_save_failed"),
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
    overrideId = requiredUuid(formData.get("override_id"));
    expectedVersion = expectedTypographyVersionFromForm(formData);
    target = typographyTargetFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: typographyErrorCode(error),
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
        error: rpcErrorCode(saveError, "typography_reset_failed"),
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
        error: rpcErrorCode(publishError, "typography_reset_publish_failed"),
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
    overrideId = requiredUuid(formData.get("override_id"));
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: typographyErrorCode(error),
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
        error: rpcErrorCode(error, "typography_publish_failed"),
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
      throw new SiteTypographyValidationError("typography_revision_invalid");
    }
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: typographyErrorCode(error),
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
        error: rpcErrorCode(error, "typography_restore_failed"),
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
    fontId = requiredUuid(formData.get("font_id"));
    expectedVersion = expectedTypographyVersionFromForm(formData);
  } catch (error) {
    redirect(
      pageTarget({
        error: typographyErrorCode(error),
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
        error: rpcErrorCode(error, "typography_font_archive_failed"),
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ archived: 1 }));
}

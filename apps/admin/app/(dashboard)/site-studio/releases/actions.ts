"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  parseSiteDesignChangeSetForm,
  requiredSiteStudioUuid,
  requiredSiteStudioVersion,
  SiteStudioFormError,
} from "@/lib/site-studio-form";
import {
  siteStudioRpcErrorCode,
  type SiteStudioActionErrorCode,
} from "@/lib/site-studio-messages";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pagePath = "/site-studio/releases";

function pageTarget(values: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value)) query.set(key, String(value));
  });
  return query.size ? `${pagePath}?${query.toString()}` : pagePath;
}

async function mutationContext() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(pageTarget({ error: "site_studio_database_unavailable" }));
  }
  return { supabase };
}

function formErrorCode(error: unknown): SiteStudioActionErrorCode {
  return error instanceof SiteStudioFormError
    ? error.code
    : "site_studio_change_set_invalid";
}

function scheduledAt(value: FormDataEntryValue | null) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new SiteStudioFormError("site_studio_change_set_invalid");
  }
  return parsed.toISOString();
}

export async function saveSiteDesignChangeSetAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let input;
  try {
    input = parseSiteDesignChangeSetForm(formData);
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }
  const { data, error } = await supabase.rpc("save_site_design_change_set", {
    p_change_set_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_expected_cas_version: input.expectedVersion,
  });
  const saved = Array.isArray(data) ? data[0] : data;
  const id =
    saved && typeof saved === "object"
      ? String((saved as { id?: unknown }).id || input.id || "")
      : "";
  if (error || !id) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(
          error,
          "site_studio_change_set_save_failed"
        ),
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ saved: 1, set: id }));
}

export async function transitionSiteDesignChangeSetAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let id: string;
  let version: number;
  let nextStatus: "review" | "approved" | "cancelled";
  let schedule: string | null;
  try {
    id = requiredSiteStudioUuid(formData.get("change_set_id"));
    version = requiredSiteStudioVersion(formData.get("expected_version"));
    const status = String(formData.get("next_status") || "");
    if (!(["review", "approved", "cancelled"] as const).includes(
      status as "review" | "approved" | "cancelled"
    )) {
      throw new SiteStudioFormError("site_studio_change_set_invalid");
    }
    nextStatus = status as typeof nextStatus;
    schedule = nextStatus === "approved" ? scheduledAt(formData.get("scheduled_at")) : null;
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }
  const { error } = await supabase.rpc("transition_site_design_change_set", {
    p_change_set_id: id,
    p_expected_cas_version: version,
    p_next_status: nextStatus,
    p_scheduled_at: schedule,
  });
  if (error) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(error, "site_studio_transition_failed"),
        set: id,
      })
    );
  }
  revalidatePath(pagePath);
  redirect(pageTarget({ transitioned: 1, set: id }));
}

export async function publishSiteDesignChangeSetAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let id: string;
  let version: number;
  try {
    id = requiredSiteStudioUuid(formData.get("change_set_id"));
    version = requiredSiteStudioVersion(formData.get("expected_version"));
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }
  const { error } = await supabase.rpc("publish_site_design_change_set", {
    p_change_set_id: id,
    p_expected_cas_version: version,
  });
  if (error) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(error, "site_studio_publish_failed"),
        set: id,
      })
    );
  }
  revalidatePath(pagePath);
  revalidatePath("/site-studio/tokens");
  redirect(pageTarget({ published: 1, set: id }));
}

export async function rollbackSiteDesignReleaseAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let releaseId: string;
  try {
    releaseId = requiredSiteStudioUuid(formData.get("release_id"));
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }
  const { error } = await supabase.rpc("rollback_site_design_release", {
    p_release_id: releaseId,
  });
  if (error) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(error, "site_studio_rollback_failed"),
      })
    );
  }
  revalidatePath(pagePath);
  revalidatePath("/site-studio/tokens");
  redirect(pageTarget({ rolled_back: 1 }));
}

export async function removeSiteDesignChangeSetItemAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let changeSetId: string;
  let tokenId: string;
  let version: number;
  try {
    changeSetId = requiredSiteStudioUuid(formData.get("change_set_id"));
    tokenId = requiredSiteStudioUuid(formData.get("token_id"));
    version = requiredSiteStudioVersion(formData.get("expected_version"));
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }
  const { error } = await supabase.rpc("remove_site_design_change_set_item", {
    p_change_set_id: changeSetId,
    p_token_id: tokenId,
    p_expected_change_set_cas_version: version,
  });
  if (error) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(error, "site_studio_remove_failed"),
        set: changeSetId,
      })
    );
  }
  revalidatePath(pagePath);
  revalidatePath("/site-studio/tokens");
  redirect(pageTarget({ removed: 1, set: changeSetId }));
}

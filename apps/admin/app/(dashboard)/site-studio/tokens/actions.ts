"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  parseSiteDesignTokenForm,
  requiredSiteStudioUuid,
  requiredSiteStudioVersion,
  SiteStudioFormError,
} from "@/lib/site-studio-form";
import {
  siteStudioRpcErrorCode,
  type SiteStudioActionErrorCode,
} from "@/lib/site-studio-messages";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pagePath = "/site-studio/tokens";

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
    : "site_studio_identity_invalid";
}

export async function saveSiteDesignTokenAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let input;
  try {
    input = parseSiteDesignTokenForm(formData);
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }

  const { data, error } = await supabase.rpc("save_site_design_token", {
    p_token_id: input.id,
    p_layer: input.layer,
    p_target_key: input.targetKey,
    p_token_key: input.tokenKey,
    p_category: input.category,
    p_value_type: input.valueType,
    p_breakpoint: input.breakpoint,
    p_state: input.state,
    p_description: input.description,
    p_draft_value: input.draftValue,
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
        error: siteStudioRpcErrorCode(error, "site_studio_token_save_failed"),
        token: input.id || undefined,
      })
    );
  }
  revalidatePath(pagePath);
  revalidatePath("/site-studio");
  redirect(pageTarget({ saved: 1, token: id }));
}

export async function stageSiteDesignTokenAction(formData: FormData) {
  const { supabase } = await mutationContext();
  let changeSetId: string;
  let tokenId: string;
  let changeSetVersion: number;
  let tokenVersion: number;
  try {
    changeSetId = requiredSiteStudioUuid(formData.get("change_set_id"));
    tokenId = requiredSiteStudioUuid(formData.get("token_id"));
    changeSetVersion = requiredSiteStudioVersion(
      formData.get("change_set_version")
    );
    tokenVersion = requiredSiteStudioVersion(formData.get("token_version"));
  } catch (error) {
    redirect(pageTarget({ error: formErrorCode(error) }));
  }

  const { error } = await supabase.rpc("set_site_design_change_set_item", {
    p_change_set_id: changeSetId,
    p_token_id: tokenId,
    p_expected_change_set_cas_version: changeSetVersion,
    p_expected_token_cas_version: tokenVersion,
  });
  if (error) {
    redirect(
      pageTarget({
        error: siteStudioRpcErrorCode(error, "site_studio_stage_failed"),
        token: tokenId,
      })
    );
  }
  revalidatePath(pagePath);
  revalidatePath("/site-studio/releases");
  redirect(pageTarget({ staged: 1, token: tokenId }));
}

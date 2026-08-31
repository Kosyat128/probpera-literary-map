import { AdminDependencyState } from "@/components/AdminStatusState";
import { getStaffSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  parseTypographyTarget,
  readSiteTypographyProperties,
  type SiteTypographyProperties,
} from "@/lib/site-typography";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import TypographyWorkspaceLoader from "./TypographyWorkspaceLoader";
import type {
  FontAssetView,
  TypographyOverrideView,
  TypographyPageMessages,
  TypographyRevisionView,
} from "./TypographyWorkspace";

export const metadata = { title: "Шрифты · Site Studio" };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOverride(value: unknown): TypographyOverrideView | null {
  const source = record(value);
  if (!source) return null;
  try {
    const target = parseTypographyTarget({
      layer: source.layer,
      targetKey: source.target_key,
      semanticScope: source.semantic_scope,
      breakpoint: source.breakpoint,
    });
    const id = stringValue(source.id);
    const casVersion = numberValue(source.cas_version, -1);
    if (!id || !Number.isSafeInteger(casVersion) || casVersion < 0) return null;
    const draftSettings: SiteTypographyProperties = readSiteTypographyProperties(
      source.draft_settings
    );
    return {
      id,
      casVersion,
      ...target,
      settings: draftSettings,
      draftSettings,
      publishedSettings: readSiteTypographyProperties(source.published_settings),
      updatedAt: stringValue(source.updated_at),
    };
  } catch {
    return null;
  }
}

function normalizeRevision(value: unknown): TypographyRevisionView | null {
  const source = record(value);
  if (!source) return null;
  const id = numberValue(source.id, -1);
  const overrideId = stringValue(source.override_id);
  const snapshot = record(source.snapshot);
  if (!Number.isSafeInteger(id) || id < 1 || !overrideId || !snapshot) return null;
  const createdAt = stringValue(source.created_at);
  return {
    id,
    overrideId,
    revisionNumber: numberValue(source.revision_number),
    action: stringValue(source.action),
    createdLabel: createdAt ? formatDate(createdAt, true) : "Дата не указана",
  };
}

export default async function SiteTypographyPage({
  searchParams,
}: {
  searchParams: Promise<
    TypographyPageMessages & {
      override?: string;
    }
  >;
}) {
  const query = await searchParams;
  const [session, supabase] = await Promise.all([
    getStaffSession(),
    createServerSupabaseClient(),
  ]);
  if (!supabase) return <AdminDependencyState />;
  const canManage = session.role === "owner" || session.role === "admin";

  const [assetResult, overrideResult, revisionResult] = await Promise.all([
    supabase
      .from("font_assets")
      .select(
        "id,display_name,family_name,source_type,format,font_style,weight_min,weight_max,byte_size,is_variable,license_name,license_url,created_at,cas_version"
      )
      .is("deleted_at", null)
      .order("family_name")
      .order("weight_min"),
    supabase
      .from("site_typography_overrides")
      .select("*")
      .order("layer")
      .order("target_key")
      .order("semantic_scope")
      .order("breakpoint"),
    supabase
      .from("site_typography_revisions")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
  ]);

  const fonts = (assetResult.data || []) as FontAssetView[];
  const overrides = (overrideResult.data || []).flatMap((value) => {
    const normalized = normalizeOverride(value);
    return normalized ? [normalized] : [];
  });
  const revisions = (revisionResult.data || []).flatMap((value) => {
    const normalized = normalizeRevision(value);
    return normalized ? [normalized] : [];
  });
  const messages: TypographyPageMessages = {
    error: query.error,
    saved: query.saved,
    published: query.published,
    restored: query.restored,
    reset: query.reset,
    archived: query.archived,
  };

  return (
    <TypographyWorkspaceLoader
      fonts={fonts}
      overrides={overrides}
      revisions={revisions}
      selectedId={query.override || null}
      messages={messages}
      schemaUnavailable={Boolean(
        assetResult.error || overrideResult.error || revisionResult.error
      )}
      canManage={canManage}
    />
  );
}

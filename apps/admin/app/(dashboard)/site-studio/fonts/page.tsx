import { AdminDependencyState } from "@/components/AdminStatusState";
import SiteStudioLoadState from "@/components/SiteStudioLoadState";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { isReadRecord } from "@/lib/admin-read-result";
import { isStudioFont, isStudioTypography, isStudioTypographyRevision, readStudioRows, studioActionUuid, studioTypographyEditorSettings, studioTypographyRevisionIdentity } from "@/lib/site-studio-load-validation";
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

  const [assetResult, overrideResult, revisionResult] = await Promise.allSettled([
    supabase
      .from("font_assets")
      .select(
        "id,display_name,family_name,source_type,format,font_style,weight_min,weight_max,byte_size,is_variable,license_name,license_url,created_at,cas_version",
        { count: "exact" }
      )
      .is("deleted_at", null)
      .order("family_name")
      .order("weight_min"),
    supabase
      .from("site_typography_overrides")
      .select("*", { count: "exact" })
      .order("layer")
      .order("target_key")
      .order("semantic_scope")
      .order("breakpoint"),
    supabase
      .from("site_typography_revisions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
  ]);

  const fontRead = readStudioRows(assetResult, isStudioFont, (row) => String(row.id));
  const overrideRead = readStudioRows(overrideResult, isStudioTypography, (row) => String(row.id));
  const revisionRead = readStudioRows(revisionResult, isStudioTypographyRevision, (row) => String(row.id), false);
  const fonts = fontRead.rows as unknown as FontAssetView[];
  const settingsHaveKnownFont = (settings: unknown) => {
    if (!isReadRecord(settings) || !studioTypographyEditorSettings(settings)) return false;
    if (!settings.familyId) return true;
    const familyId = typeof settings.familyId === "string" ? settings.familyId.trim().toLowerCase() : null;
    return familyId !== null && fonts.some((font) => font.id.toLowerCase() === familyId);
  };
  const selectedOverride = query.override ? overrideRead.rows.find((row) => String(row.id).toLowerCase() === query.override!.toLowerCase()) : null;
  const compatible = fonts.every((font) => studioActionUuid(font.id, true))
    && overrideRead.rows.every((row) => studioActionUuid(row.id, true) && settingsHaveKnownFont(row.draft_settings)
      && (row.published_settings === null || settingsHaveKnownFont(row.published_settings)))
    && revisionRead.rows.every((row) => {
      const snapshot = row.snapshot;
      return overrideRead.rows.some((current) => current.id === row.override_id)
        && studioTypographyRevisionIdentity(snapshot) && settingsHaveKnownFont(snapshot.publishedSettings)
        && overrideRead.rows.every((current) => current.id === row.override_id
          || current.layer !== snapshot.layer || current.target_key !== snapshot.targetKey
          || current.semantic_scope !== snapshot.semanticScope || current.breakpoint !== snapshot.breakpoint);
    })
    && (!query.override || Boolean(selectedOverride));
  const issue = fontRead.issue ?? overrideRead.issue ?? revisionRead.issue ?? (compatible ? null : "invalid");
  const overrides = issue ? [] : overrideRead.rows.map((value) => normalizeOverride(value)!);
  const revisions = issue ? [] : revisionRead.rows.map((value) => normalizeRevision(value)!);
  const messages: TypographyPageMessages = {};
  const retrySearch = new URLSearchParams();
  if (query.override) retrySearch.set("override", query.override);
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH) + "/site-studio/fonts" + (retrySearch.size ? `?${retrySearch}` : "");
  const notice = query.error || query.saved || query.published || query.restored || query.reset || query.archived;

  return (
    <>
    {notice && <p className="form-message" role="status">Результат действия по параметрам страницы не подтверждён. Проверьте актуальные данные.</p>}
    {issue ? <SiteStudioLoadState issue={issue} retryHref={retryHref}
      message={!fontRead.issue && !overrideRead.issue && !revisionRead.issue ? "Загруженные данные несовместимы с текущим редактором. Изменение недоступно до проверки." : undefined}
      sections={[
      { label: "Шрифты", rows: fonts.map((row) => row.display_name || row.family_name) },
      { label: "Настройки", rows: overrideRead.rows.map((row) => `${row.layer} · ${row.target_key} · ${row.semantic_scope}: ${JSON.stringify(row.draft_settings)}`) },
      { label: "История", rows: revisionRead.rows.map((row) => `${row.action} · ${row.revision_number}`) },
    ]} /> : <TypographyWorkspaceLoader
      fonts={fonts}
      overrides={overrides}
      revisions={revisions}
      selectedId={selectedOverride ? String(selectedOverride.id) : null}
      messages={messages}
      schemaUnavailable={false}
      canManage={canManage}
    />}
    </>
  );
}

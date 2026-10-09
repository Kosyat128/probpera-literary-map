import { AdminDependencyState } from "@/components/AdminStatusState";
import SiteStudioLoadState from "@/components/SiteStudioLoadState";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { isStudioComponent, isStudioDraftSet, isStudioToken, readStudioRows, studioActionUuid } from "@/lib/site-studio-load-validation";
import { getStaffSession } from "@/lib/auth";
import {
  siteStudioBreakpoints,
  siteStudioLayers,
  siteStudioStates,
  siteStudioTokenCategories,
  siteStudioTokenValueTypes,
  type SiteStudioBreakpoint,
  type SiteStudioLayer,
  type SiteStudioState,
  type SiteStudioTokenCategory,
  type SiteStudioTokenValueType,
} from "@/lib/site-studio-contract";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import TokenStudio, {
  type DesignChangeSetOption,
  type DesignComponentOption,
  type DesignTokenView,
  type TokenStudioMessages,
} from "./TokenStudio";

export const metadata = { title: "Токены дизайна · Site Studio" };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function tokenView(value: unknown): DesignTokenView | null {
  const row = record(value);
  const id = typeof row?.id === "string" ? row.id : "";
  const targetKey = typeof row?.target_key === "string" ? row.target_key : "";
  const tokenKey = typeof row?.token_key === "string" ? row.token_key : "";
  const casVersion = Number(row?.cas_version);
  if (!id || !targetKey || !tokenKey || !Number.isSafeInteger(casVersion)) {
    return null;
  }
  return {
    id,
    layer: safeEnum(row?.layer, siteStudioLayers, "site") as SiteStudioLayer,
    targetKey,
    tokenKey,
    category: safeEnum(
      row?.category,
      siteStudioTokenCategories,
      "color"
    ) as SiteStudioTokenCategory,
    valueType: safeEnum(
      row?.value_type,
      siteStudioTokenValueTypes,
      "color"
    ) as SiteStudioTokenValueType,
    breakpoint: safeEnum(
      row?.breakpoint,
      siteStudioBreakpoints,
      "base"
    ) as SiteStudioBreakpoint,
    state: safeEnum(row?.state, siteStudioStates, "default") as SiteStudioState,
    description: typeof row?.description === "string" ? row.description : "",
    draftValue: row?.draft_value ?? null,
    publishedValue: row?.published_value ?? null,
    casVersion,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : "",
  };
}

function componentOption(value: unknown): DesignComponentOption | null {
  const row = record(value);
  const key = typeof row?.component_key === "string" ? row.component_key : "";
  if (!key) return null;
  return {
    key,
    displayName:
      typeof row?.display_name === "string" ? row.display_name : key,
    ownerLock: row?.owner_lock === true,
  };
}

function changeSetOption(value: unknown): DesignChangeSetOption | null {
  const row = record(value);
  const id = typeof row?.id === "string" ? row.id : "";
  const name = typeof row?.name === "string" ? row.name : "";
  const casVersion = Number(row?.cas_version);
  if (!id || !name || !Number.isSafeInteger(casVersion)) return null;
  return { id, name, casVersion };
}

export default async function SiteStudioTokensPage({
  searchParams,
}: {
  searchParams: Promise<
    TokenStudioMessages & {
      token?: string;
      layer?: string;
      target?: string;
    }
  >;
}) {
  const query = await searchParams;
  const [session, supabase] = await Promise.all([
    getStaffSession(),
    createServerSupabaseClient(),
  ]);
  if (!supabase) return <AdminDependencyState />;

  const [tokenResult, componentResult, changeSetResult] = await Promise.allSettled([
    supabase
      .from("site_design_tokens")
      .select(
        "id,layer,target_key,token_key,category,value_type,breakpoint,state,description,draft_value,published_value,cas_version,updated_at",
        { count: "exact" }
      )
      .order("layer")
      .order("target_key")
      .order("token_key")
      .limit(1024),
    supabase
      .from("site_component_registry")
      .select("component_key,display_name,owner_lock", { count: "exact" })
      .eq("is_active", true)
      .order("display_name")
      .limit(256),
    supabase
      .from("site_design_change_sets")
      .select("id,name,cas_version", { count: "exact" })
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const tokenRead = readStudioRows(tokenResult, isStudioToken, (row) => String(row.id));
  const componentRead = readStudioRows(componentResult, isStudioComponent, (row) => String(row.component_key));
  const changeSetRead = readStudioRows(changeSetResult, isStudioDraftSet, (row) => String(row.id));
  const tokens = tokenRead.rows.map((value) => tokenView(value)!);
  const components = componentRead.rows.map((value) => componentOption(value)!);
  const changeSets = changeSetRead.rows.map((value) => changeSetOption(value)!);
  const selectedToken = query.token ? tokens.find((token) => token.id.toLowerCase() === query.token!.toLowerCase()) : null;
  const validIdentity = tokens.every((token) => studioActionUuid(token.id)
    && /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){1,5}$/u.test(token.tokenKey)
    && (token.layer !== "component" || components.some((component) => component.key === token.targetKey)))
    && changeSets.every((set) => studioActionUuid(set.id))
    && (!query.token || Boolean(selectedToken));
  const issue = tokenRead.issue ?? componentRead.issue ?? changeSetRead.issue ?? (validIdentity ? null : "invalid");
  const defaultLayer = safeEnum(query.layer, siteStudioLayers, "site");
  const defaultTarget =
    typeof query.target === "string" && /^[a-z][a-z0-9_-]{0,119}$/u.test(query.target)
      ? query.target
      : defaultLayer === "site"
        ? "site"
        : "magazine";

  const retrySearch = new URLSearchParams();
  for (const key of ["token", "layer", "target"] as const) if (query[key]) retrySearch.set(key, query[key]!);
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH) + "/site-studio/tokens" + (retrySearch.size ? `?${retrySearch}` : "");
  const notice = query.error || query.saved || query.staged;

  return (
    <>
    {notice && <p className="form-message" role="status">Результат действия по параметрам страницы не подтверждён. Проверьте актуальные данные.</p>}
    {issue ? <SiteStudioLoadState issue={issue} retryHref={retryHref}
      message={!tokenRead.issue && !componentRead.issue && !changeSetRead.issue ? "Загруженные данные несовместимы с текущим редактором. Изменение недоступно до проверки." : undefined}
      sections={[
      { label: "Токены", rows: tokenRead.rows.map((row) => `${row.token_key}: ${JSON.stringify(row.draft_value)}`) },
      { label: "Компоненты", rows: components.map((row) => row.displayName) },
      { label: "Наборы изменений", rows: changeSets.map((row) => row.name) },
    ]} /> : <TokenStudio
      tokens={tokens}
      components={components}
      changeSets={changeSets}
      selectedId={selectedToken?.id || null}
      defaultLayer={defaultLayer}
      defaultTarget={defaultTarget}
      canManage={session.role === "owner" || session.role === "admin"}
      isOwner={session.role === "owner"}
      schemaUnavailable={false}
      messages={{}}
    />}
    </>
  );
}

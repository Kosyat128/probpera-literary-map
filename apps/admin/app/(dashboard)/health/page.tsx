import {
  CURRENT_EDITORIAL_SCHEMA_VERSION,
  EDITORIAL_SCHEMA_REQUIRED_FLAGS,
  getMissingEditorialSchemaCapabilities,
  isEditorialSchemaReady,
  type EditorialSchemaHealth,
} from "@/lib/editorial-schema-health";
import { adminEnv } from "@/lib/env";
import { formatDate, safeCount } from "@/lib/format";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList, readAdminResult } from "@/lib/admin-read-result";
import {
  healthStatusLabels,
  redactHealthDiagnosticText,
  safeDiagnosticPath,
  type HealthStatus,
} from "@/lib/health-status";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { premiumTranslationRuntimeReadiness } from "@/lib/premium-english-translation";
import {
  PREMIUM_TRANSLATION_PROBE_COLUMNS, isPremiumTranslationProbe,
  premiumTranslationConfigurationIdentity, premiumTranslationProbeStatus,
  type PremiumTranslationProbe,
} from "@/lib/premium-translation-probe";
import { unstable_rethrow } from "next/navigation";
import { setDiagnosticStatusAction } from "./actions";

export const metadata = { title: "Состояние сайта" };

type Diagnostic = {
  id: number;
  fingerprint: string;
  message: string;
  path: string;
  source: string;
  status: string;
  created_at: string;
};

type OperationalMarker = {
  marker_key: "encrypted_backup" | "restore_drill";
  status: "ok" | "failed";
  occurred_at: string;
};

function isDiagnostic(item: Diagnostic): boolean {
  return Number.isSafeInteger(item.id) && item.id > 0
    && typeof item.fingerprint === "string" && item.fingerprint.length >= 4 && item.fingerprint.length <= 120
    && typeof item.message === "string" && typeof item.path === "string"
    && typeof item.source === "string" && ["open", "resolved", "ignored"].includes(item.status)
    && typeof item.created_at === "string" && Number.isFinite(Date.parse(item.created_at));
}

function isOperationalMarker(item: OperationalMarker): boolean {
  return typeof item.marker_key === "string" && ["ok", "failed"].includes(item.status)
    && typeof item.occurred_at === "string" && Number.isFinite(Date.parse(item.occurred_at));
}

function isSchemaHealth(value: unknown): value is EditorialSchemaHealth {
  if (!isReadRecord(value)) return false;
  if (value.version !== undefined && (typeof value.version !== "string"
    || !/^[a-z0-9_-]{1,120}$/iu.test(value.version))) return false;
  if (value.version === CURRENT_EDITORIAL_SCHEMA_VERSION
    && !EDITORIAL_SCHEMA_REQUIRED_FLAGS.every((flag) => typeof value[flag] === "boolean")) return false;
  return (typeof value.version === "string" || EDITORIAL_SCHEMA_REQUIRED_FLAGS.some((flag) => flag in value))
    && EDITORIAL_SCHEMA_REQUIRED_FLAGS.every((flag) =>
      value[flag] === undefined || typeof value[flag] === "boolean");
}

function operationalMarkerHealth(
  marker: OperationalMarker | undefined,
  available: boolean
): { status: HealthStatus; detail: string } {
  if (!available) {
    return { status: "UNKNOWN", detail: "проверка operational markers недоступна" };
  }
  if (!marker) {
    return { status: "UNKNOWN", detail: "успешный запуск ещё не зафиксирован" };
  }
  const occurredAt = Date.parse(marker.occurred_at);
  if (!Number.isFinite(occurredAt)) {
    return { status: "UNKNOWN", detail: "дата последнего запуска повреждена" };
  }
  const ageHours = Math.max(0, (Date.now() - occurredAt) / (60 * 60 * 1000));
  const detail = `${formatDate(marker.occurred_at, true)} · ${Math.floor(ageHours)} ч назад`;
  if (marker.status !== "ok") return { status: "FAILED", detail };
  if (ageHours <= 36) return { status: "OK", detail };
  if (ageHours <= 72) return { status: "DEGRADED", detail };
  return { status: "FAILED", detail };
}

function HealthValue({ status }: { status: HealthStatus }) {
  return (
    <strong className="health-status" data-health-status={status}>
      {healthStatusLabels[status]}
    </strong>
  );
}

export default async function HealthPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const queries = await Promise.allSettled([
    supabase.from("client_errors").select("id,fingerprint,message,path,source,status,created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("admin_ops_markers").select("marker_key,status,occurred_at"),
    supabase.rpc("get_editorial_schema_health"),
    supabase.from("translation_provider_self_tests").select(PREMIUM_TRANSLATION_PROBE_COLUMNS)
      .eq("provider", adminEnv.premiumTranslationProvider).maybeSingle(),
  ]);
  const diagnosticsRead = readAdminList<Diagnostic>(queries[0], isDiagnostic);
  const openCount = safeCount(queries[1].status === "fulfilled" ? queries[1].value : null);
  const recentCount = safeCount(queries[2].status === "fulfilled" ? queries[2].value : null);
  const markersRead = readAdminList<OperationalMarker>(queries[3], isOperationalMarker);
  const operationalMarkerError = markersRead.status === "failed";
  const schemaRead = readAdminResult<EditorialSchemaHealth | null>(queries[4], isSchemaHealth);
  const translationProbeRead = readAdminResult<PremiumTranslationProbe | null>(queries[5], (data) =>
    data === null || isPremiumTranslationProbe(data) && data.provider === adminEnv.premiumTranslationProvider);
  const schemaHealth = schemaRead.status === "success" ? schemaRead.data : null;
  const schemaReady = isEditorialSchemaReady(schemaHealth);
  const missingSchemaCapabilities = getMissingEditorialSchemaCapabilities(schemaHealth);
  const schemaCheckAvailable = schemaRead.status === "success" && schemaHealth !== null;
  const pendingPublicBuilds = schemaCheckAvailable
    ? safeCount({ count: schemaHealth?.pendingPublicBuilds ?? null })
    : null;
  const publicationStatus: HealthStatus = pendingPublicBuilds === null
    ? "UNKNOWN" : pendingPublicBuilds > 50 ? "DEGRADED" : "OK";
  const hasUnavailableRead = diagnosticsRead.status === "failed" || markersRead.status === "failed"
    || schemaRead.status === "failed" || translationProbeRead.status === "failed"
    || openCount === null || recentCount === null || pendingPublicBuilds === null;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/health`;
  const schemaStatus: HealthStatus = !schemaCheckAvailable
    ? "UNKNOWN"
    : schemaReady
      ? "OK"
      : "FAILED";
  const schemaStatusDetail = schemaReady
    ? schemaHealth?.version || "актуальная версия"
    : schemaRead.status === "failed"
      ? adminReadMessage(schemaRead.issue)
      : schemaHealth
        ? `Не готовы: ${missingSchemaCapabilities.join(", ")}`
        : "версия не определена";
  const atomicArticleSaveReady = Boolean(
    schemaCheckAvailable &&
      schemaHealth?.version === CURRENT_EDITORIAL_SCHEMA_VERSION &&
      schemaHealth?.articleBundleRpc === true
  );
  const atomicArticleSaveStatus: HealthStatus = atomicArticleSaveReady
    ? "OK"
    : schemaCheckAvailable
      ? "FAILED"
      : "UNKNOWN";
  const atomicArticleSaveDetail = atomicArticleSaveReady
    ? "RU + EN сохраняются одной транзакцией"
    : schemaCheckAvailable
      ? "Требуется актуальная production-схема с save_article_bundle"
      : "Проверка production-схемы недоступна; сохранение закрыто безопасно";
  const mediaStudioReady = Boolean(
    schemaCheckAvailable
      && schemaHealth?.version === CURRENT_EDITORIAL_SCHEMA_VERSION
      && schemaHealth?.mediaStudioLifecycle === true
      && schemaHealth?.mediaUsageGraph === true
      && schemaHealth?.mediaSafeReplaceRpc === true
  );
  const mediaStudioDetail = mediaStudioReady
    ? "граф связей, корзина и атомарная замена готовы"
    : schemaCheckAvailable
      ? "нужна актуальная lifecycle-миграция Media Studio"
      : "проверка схемы недоступна; опасные операции закрыты";
  const translationRuntime = premiumTranslationRuntimeReadiness();
  const translationConfigured = translationRuntime.configured && translationRuntime.bindingFound;
  const translationEnabled = adminEnv.openAiAutoTranslateArticles;
  const workersAi = adminEnv.premiumTranslationProvider === "cloudflare";
  const translationModel = workersAi
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const [identityResult] = await Promise.allSettled([premiumTranslationConfigurationIdentity()]);
  if (identityResult.status === "rejected") unstable_rethrow(identityResult.reason);
  const translationProbeStatus = premiumTranslationProbeStatus(
    translationProbeRead.status === "success" ? translationProbeRead.data : null,
    translationRuntime, identityResult.status === "fulfilled" ? identityResult.value : null);
  const translationStatus: HealthStatus = !translationEnabled
    ? "NOT CONFIGURED"
    : translationProbeRead.status === "failed" ? "UNKNOWN"
      : !translationConfigured || identityResult.status === "rejected" ? "FAILED"
        : translationProbeStatus === "ready" ? "OK"
          : translationProbeStatus === "failed" ? "FAILED" : "DEGRADED";
  const translationStatusDetail = !translationEnabled
    ? "автоперевод отключён operational kill switch"
    : translationProbeRead.status === "failed" ? `Проверка провайдера недоступна. ${adminReadMessage(translationProbeRead.issue)}`
      : translationConfigured
      ? `${workersAi ? "Workers AI" : "OpenAI"}: ${translationModel}; ${translationProbeStatus === "ready"
        ? "обе модели проверены для текущей конфигурации"
        : translationProbeStatus === "pending" ? "проверка выполняется; прошлый результат сохранён"
          : translationProbeStatus === "failed" ? "проверка текущей конфигурации завершилась ошибкой"
            : "требуется реальный self-test провайдера для текущей конфигурации"}`
      : workersAi
        ? "не подключён Cloudflare Workers AI binding"
        : "добавьте OPENAI_API_KEY в Secret Worker";
  const operationalMarkers = new Map(
    (markersRead.status === "success" ? markersRead.data : []).map((marker) => [
      marker.marker_key,
      marker,
    ])
  );
  const backupHealth = operationalMarkerHealth(
    operationalMarkers.get("encrypted_backup"),
    !operationalMarkerError
  );
  const restoreHealth = operationalMarkerHealth(
    operationalMarkers.get("restore_drill"),
    !operationalMarkerError
  );
  const grouped = new Map<string, { latest: Diagnostic; count: number }>();
  for (const item of diagnosticsRead.status === "success" ? diagnosticsRead.data : []) {
    const current = grouped.get(item.fingerprint);
    if (current) current.count += 1;
    else grouped.set(item.fingerprint, { latest: item, count: 1 });
  }
  const diagnostics = [...grouped.values()];

  return <>
    <header className="page-heading"><div><span className="eyebrow">Наблюдаемость</span><h1>Состояние сайта</h1><p>Ошибки интерфейса записываются внутри «Пробы Пера» без передачи сторонним системам.</p></div></header>
    {hasUnavailableRead && <section className="panel" role="status">
      <p>Некоторые показатели сейчас недоступны. <a href={retryHref}>Повторить загрузку</a></p>
    </section>}
    <section className="stat-grid">
      <article className="stat-card"><span>Открыто</span><strong>{openCount === null ? "Недоступно" : openCount}</strong><small>требуют внимания</small></article>
      <article className="stat-card"><span>За 24 часа</span><strong>{recentCount === null ? "Недоступно" : recentCount}</strong><small>включая повторения</small></article>
      <article className="stat-card"><span>Групп</span><strong>{diagnosticsRead.status === "success" ? diagnostics.length : "Недоступно"}</strong><small>уникальных причин</small></article>
      <article className="stat-card"><span>Схема CMS</span><HealthValue status={schemaStatus} /><small>{schemaStatusDetail}</small></article>
      <article className="stat-card"><span>Сохранение RU+EN</span><HealthValue status={atomicArticleSaveStatus} /><small>{atomicArticleSaveDetail}</small></article>
      <article className="stat-card"><span>Media Studio</span><HealthValue status={mediaStudioReady ? "OK" : schemaCheckAvailable ? "FAILED" : "UNKNOWN"} /><small>{mediaStudioDetail}</small></article>
      <article className="stat-card"><span>Публикация</span><HealthValue status={publicationStatus} /><small>{pendingPublicBuilds === null ? "транзакционная очередь недоступна" : `${pendingPublicBuilds} запросов ожидают подтверждения deploy`}</small></article>
      <article className="stat-card"><span>Перевод на английский</span><HealthValue status={translationStatus} /><small>{translationStatusDetail}</small></article>
      <article className="stat-card"><span>Резервная копия DB + Storage</span><HealthValue status={backupHealth.status} /><small>{backupHealth.detail}</small></article>
      <article className="stat-card"><span>Проверка восстановления</span><HealthValue status={restoreHealth.status} /><small>{restoreHealth.detail}</small></article>
    </section>
    <section className="panel">
      {diagnosticsRead.status === "failed" ? <div className="empty-state" role="alert"><p>Список ошибок недоступен. {adminReadMessage(diagnosticsRead.issue)}</p></div> :
        diagnostics.length === 0 ? <div className="empty-state"><p>Клиентских ошибок пока не зарегистрировано.</p></div> :
        <table className="data-table"><thead><tr><th>Ошибка</th><th>Путь и дата</th><th>Повторы</th><th>Статус</th></tr></thead><tbody>
          {diagnostics.map(({ latest, count }) => <tr key={latest.fingerprint}>
            <td className="data-title"><strong>{redactHealthDiagnosticText(latest.message)}</strong><small>{redactHealthDiagnosticText(latest.source, 80)} · {redactHealthDiagnosticText(latest.fingerprint, 120)}</small></td>
            <td><strong>{safeDiagnosticPath(latest.path)}</strong><small>{formatDate(latest.created_at, true)}</small></td>
            <td>{count}</td>
            <td><form action={setDiagnosticStatusAction}><input type="hidden" name="fingerprint" value={latest.fingerprint}/><select name="status" defaultValue={latest.status}><option value="open">Открыта</option><option value="resolved">Исправлена</option><option value="ignored">Игнорировать</option></select><button className="button-secondary" type="submit">Сохранить</button></form></td>
          </tr>)}
        </tbody></table>}
    </section>
  </>;
}

import {
  CURRENT_EDITORIAL_SCHEMA_VERSION,
  getMissingEditorialSchemaCapabilities,
  isEditorialSchemaReady,
  type EditorialSchemaHealth,
} from "@/lib/editorial-schema-health";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import {
  healthStatusLabels,
  redactHealthDiagnosticText,
  safeDiagnosticPath,
  type HealthStatus,
} from "@/lib/health-status";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  const [
    { data },
    { count: openCount },
    { count: recentCount },
    { data: operationalMarkerData, error: operationalMarkerError },
  ] = await Promise.all([
    supabase.from("client_errors").select("id,fingerprint,message,path,source,status,created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("admin_ops_markers").select("marker_key,status,occurred_at"),
  ]);
  const { data: schemaHealthData, error: schemaHealthError } = await supabase.rpc(
    "get_editorial_schema_health"
  );
  const schemaHealth =
    schemaHealthData && typeof schemaHealthData === "object"
      ? (schemaHealthData as EditorialSchemaHealth)
      : null;
  const schemaReady = isEditorialSchemaReady(schemaHealth);
  const missingSchemaCapabilities =
    getMissingEditorialSchemaCapabilities(schemaHealth);
  const schemaCheckAvailable = !schemaHealthError && Boolean(schemaHealth);
  const schemaStatus: HealthStatus = !schemaCheckAvailable
    ? "UNKNOWN"
    : schemaReady
      ? "OK"
      : "FAILED";
  const schemaStatusDetail = schemaReady
    ? schemaHealth?.version || "актуальная версия"
    : schemaHealthError
      ? "health-check недоступен"
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
  const translationConfigured = adminEnv.premiumTranslationConfigured;
  const translationEnabled = adminEnv.openAiAutoTranslateArticles;
  const workersAi = adminEnv.premiumTranslationProvider === "cloudflare";
  const translationModel = workersAi
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const translationStatus: HealthStatus = !translationEnabled
    ? "NOT CONFIGURED"
    : translationConfigured
      ? "DEGRADED"
      : "FAILED";
  const translationStatusDetail = !translationEnabled
    ? "автоперевод отключён operational kill switch"
    : translationConfigured
      ? `${workersAi ? "Workers AI" : "OpenAI"}: ${translationModel}; требуется реальный self-test провайдера`
      : workersAi
        ? "не подключён Cloudflare Workers AI binding"
        : "добавьте OPENAI_API_KEY в Secret Worker";
  const operationalMarkers = new Map(
    ((operationalMarkerData || []) as OperationalMarker[]).map((marker) => [
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
  for (const item of (data || []) as Diagnostic[]) {
    const current = grouped.get(item.fingerprint);
    if (current) current.count += 1;
    else grouped.set(item.fingerprint, { latest: item, count: 1 });
  }
  const diagnostics = [...grouped.values()];

  return <>
    <header className="page-heading"><div><span className="eyebrow">Наблюдаемость</span><h1>Состояние сайта</h1><p>Ошибки интерфейса записываются внутри «Пробы Пера» без передачи сторонним системам.</p></div></header>
    <section className="stat-grid">
      <article className="stat-card"><span>Открыто</span><strong>{openCount || 0}</strong><small>требуют внимания</small></article>
      <article className="stat-card"><span>За 24 часа</span><strong>{recentCount || 0}</strong><small>включая повторения</small></article>
      <article className="stat-card"><span>Групп</span><strong>{diagnostics.length}</strong><small>уникальных причин</small></article>
      <article className="stat-card"><span>Схема CMS</span><HealthValue status={schemaStatus} /><small>{schemaStatusDetail}</small></article>
      <article className="stat-card"><span>Сохранение RU+EN</span><HealthValue status={atomicArticleSaveStatus} /><small>{atomicArticleSaveDetail}</small></article>
      <article className="stat-card"><span>Media Studio</span><HealthValue status={mediaStudioReady ? "OK" : schemaCheckAvailable ? "FAILED" : "UNKNOWN"} /><small>{mediaStudioDetail}</small></article>
      <article className="stat-card"><span>Публикация</span><HealthValue status={!schemaHealth ? "UNKNOWN" : Number(schemaHealth.pendingPublicBuilds || 0) > 50 ? "DEGRADED" : "OK"} /><small>{schemaHealthError || !schemaHealth ? "транзакционная очередь недоступна" : `${schemaHealth.pendingPublicBuilds || 0} запросов ожидают подтверждения deploy`}</small></article>
      <article className="stat-card"><span>Перевод на английский</span><HealthValue status={translationStatus} /><small>{translationStatusDetail}</small></article>
      <article className="stat-card"><span>Резервная копия DB + Storage</span><HealthValue status={backupHealth.status} /><small>{backupHealth.detail}</small></article>
      <article className="stat-card"><span>Проверка восстановления</span><HealthValue status={restoreHealth.status} /><small>{restoreHealth.detail}</small></article>
    </section>
    <section className="panel">
      {diagnostics.length === 0 ? <div className="empty-state"><p>Клиентских ошибок пока не зарегистрировано.</p></div> :
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

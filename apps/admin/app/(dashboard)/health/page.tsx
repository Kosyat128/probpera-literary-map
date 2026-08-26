import {
  CURRENT_EDITORIAL_SCHEMA_VERSION,
  getMissingEditorialSchemaCapabilities,
  isEditorialSchemaReady,
  type EditorialSchemaHealth,
} from "@/lib/editorial-schema-health";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
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

export default async function HealthPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data }, { count: openCount }, { count: recentCount }] = await Promise.all([
    supabase.from("client_errors").select("id,fingerprint,message,path,source,status,created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
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
  const schemaStatusLabel = !schemaCheckAvailable
    ? "Проверка недоступна"
    : schemaReady
      ? "Готова"
      : "Требует миграций";
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
  const atomicArticleSaveLabel = atomicArticleSaveReady
    ? "Атомарно"
    : "Legacy fallback";
  const atomicArticleSaveDetail = atomicArticleSaveReady
    ? "RU + EN сохраняются одной транзакцией"
    : schemaCheckAvailable
      ? "save_article_bundle ещё не подтверждён production-схемой"
      : "ожидается доступный schema health-check";
  const translationConfigured = adminEnv.premiumTranslationConfigured;
  const translationEnabled = adminEnv.openAiAutoTranslateArticles;
  const workersAi = adminEnv.premiumTranslationProvider === "cloudflare";
  const translationModel = workersAi
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const translationStatusLabel = !translationEnabled
    ? "Отключён"
    : translationConfigured
      ? "Готов"
      : "Нужна настройка";
  const translationStatusDetail = !translationEnabled
    ? "автоперевод отключён operational kill switch"
    : translationConfigured
      ? `${workersAi ? "Workers AI" : "OpenAI"}: ${translationModel}`
      : workersAi
        ? "не подключён Cloudflare Workers AI binding"
        : "добавьте OPENAI_API_KEY в Secret Worker";
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
      <article className="stat-card"><span>Схема CMS</span><strong>{schemaStatusLabel}</strong><small>{schemaStatusDetail}</small></article>
      <article className="stat-card"><span>Сохранение RU+EN</span><strong>{atomicArticleSaveLabel}</strong><small>{atomicArticleSaveDetail}</small></article>
      <article className="stat-card"><span>Публикация</span><strong>{schemaHealth?.pendingPublicBuilds ?? "—"}</strong><small>{schemaHealthError || !schemaHealth ? "транзакционная очередь недоступна" : "ожидают подтверждения deploy"}</small></article>
      <article className="stat-card"><span>Автоперевод EN</span><strong>{translationStatusLabel}</strong><small>{translationStatusDetail}</small></article>
    </section>
    <section className="panel">
      {diagnostics.length === 0 ? <div className="empty-state"><p>Клиентских ошибок пока не зарегистрировано.</p></div> :
        <table className="data-table"><thead><tr><th>Ошибка</th><th>Путь и дата</th><th>Повторы</th><th>Статус</th></tr></thead><tbody>
          {diagnostics.map(({ latest, count }) => <tr key={latest.fingerprint}>
            <td className="data-title"><strong>{latest.message}</strong><small>{latest.source} · {latest.fingerprint}</small></td>
            <td><strong>{latest.path}</strong><small>{formatDate(latest.created_at, true)}</small></td>
            <td>{count}</td>
            <td><form action={setDiagnosticStatusAction}><input type="hidden" name="fingerprint" value={latest.fingerprint}/><select name="status" defaultValue={latest.status}><option value="open">Открыта</option><option value="resolved">Исправлена</option><option value="ignored">Игнорировать</option></select><button className="button-secondary" type="submit">Сохранить</button></form></td>
          </tr>)}
        </tbody></table>}
    </section>
  </>;
}
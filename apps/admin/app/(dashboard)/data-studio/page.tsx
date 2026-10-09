import Link from "next/link";

import { AdminDependencyState } from "@/components/AdminStatusState";
import { getStaffSession } from "@/lib/auth";
import { loadEditorialCatalog, type EditorialCatalog } from "@/lib/editorial-catalog";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, isReadRecordList, readAdminResult } from "@/lib/admin-read-result";
import { safeCount } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { synchronizeEditorialReferencesAction } from "./actions";

export const metadata = { title: "Студия данных" };

type SearchParams = {
  synchronized?: string;
  error?: string;
};

const errorMessages: Record<string, string> = {
  forbidden: "Синхронизация справочников доступна владельцу и администратору.",
  database: "Редакционная база не подключена.",
  sync: "Результат синхронизации не удалось подтвердить. Проверьте актуальные справочники, прежде чем повторять изменение.",
};

const dataStudioRequiredHealthKeys = [
  "countries",
  "writers",
  "forceRls",
  "authenticatedSelectOnly",
  "directMutationClosed",
  "staffSelectPolicies",
  "validatedForeignKeys",
  "ensureReferenceRpc",
  "manualReferenceRpc",
  "catalogSyncRpc",
  "manualReferencesValid",
  "atomicEditionCreate",
  "atomicEditionUpdate",
] as const;

function isDataStudioHealth(value: unknown): value is Record<string, unknown> {
  return isReadRecord(value) && typeof value.version === "string"
    && /^[a-z0-9_-]{1,120}$/iu.test(value.version)
    && dataStudioRequiredHealthKeys.every((key) =>
      value[key] === undefined || typeof value[key] === "boolean");
}

function isCatalogSummary(value: unknown): value is EditorialCatalog {
  return isReadRecord(value) && value.version === 1 && isReadRecordList(value.countries)
    && value.countries.every((country) => typeof country.id === "string"
      && typeof country.label === "string" && isReadRecord(country.fields)
      && isReadRecordList(country.writers) && country.writers.every((writer) =>
        typeof writer.id === "string" && typeof writer.label === "string" && isReadRecord(writer.fields)));
}

function displayCount(count: number | null) {
  return count === null ? "Недоступно" : count;
}

export default async function DataStudioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, session, supabase] = await Promise.all([
    searchParams,
    getStaffSession(),
    createServerSupabaseClient(),
  ]);
  if (!supabase) return <AdminDependencyState />;

  const reads = await Promise.allSettled([
    supabase.from("editorial_countries").select("id", { count: "exact", head: true }),
    supabase.from("editorial_writers").select("id", { count: "exact", head: true }),
    supabase.from("literary_works").select("id", { count: "exact", head: true }),
    supabase.from("book_editions").select("id", { count: "exact", head: true }),
    supabase.from("book_import_candidates").select("id", { count: "exact", head: true }),
    supabase.rpc("get_data_studio_schema_health"),
    loadEditorialCatalog().then((catalog) => ({ data: catalog, error: null })),
  ] as const);
  const counts = [reads[0], reads[1], reads[2], reads[3], reads[4]].map((read) =>
    safeCount(read.status === "fulfilled" ? read.value : null));
  const [countries, writers, works, editions, imports] = counts;
  const healthRead = readAdminResult<Record<string, unknown> | null>(reads[5], isDataStudioHealth);
  const catalogRead = readAdminResult<EditorialCatalog | null>(reads[6], isCatalogSummary);
  const dataStudioHealth = healthRead.status === "success" ? healthRead.data : null;
  const schemaReady = healthRead.status === "success"
    && dataStudioHealth?.version === "20260901_zz_data_studio_integrity"
    && dataStudioRequiredHealthKeys.every((key) => dataStudioHealth?.[key] === true);
  const schemaNeedsMigration = Boolean(healthRead.status === "success" && dataStudioHealth
    && (dataStudioHealth.version !== "20260901_zz_data_studio_integrity"
      || dataStudioRequiredHealthKeys.some((key) => dataStudioHealth[key] === false)));
  const schemaUnverified = !schemaReady && !schemaNeedsMigration;
  const catalog = catalogRead.status === "success" ? catalogRead.data : null;
  const sourceWriterCount = catalog ? catalog.countries.reduce(
    (total, country) => total + country.writers.length,
    0
  ) : null;
  const hasUnavailableCount = counts.some((count) => count === null);
  const hasUnavailableRead = hasUnavailableCount || !catalog || schemaUnverified;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/data-studio`;
  const canSynchronize = (session.role === "owner" || session.role === "admin")
    && schemaReady && catalog !== null && !hasUnavailableCount;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Фаза 6</span>
          <h1>Студия данных</h1>
          <p>
            Единая точка для стран, авторов, произведений, изданий и
            импорта. Связи защищены внешними ключами, а смена основного
            издания выполняется транзакционно.
          </p>
        </div>
        {canSynchronize && (
          <form action={synchronizeEditorialReferencesAction}>
            <button className="button-secondary" type="submit">
              Сверить справочники
            </button>
          </form>
        )}
      </header>

      {query.synchronized === "1" && (
        <p className="form-message">
          Проверьте актуальные справочники, чтобы подтвердить результат синхронизации.
        </p>
      )}
      {query.error && (
        <p className="form-message">{Object.hasOwn(errorMessages, query.error) ? errorMessages[query.error] : "Результат операции не удалось подтвердить."}</p>
      )}
      {hasUnavailableRead && <section className="panel" role="status">
        <p>Некоторые данные сейчас недоступны. Сверка справочников закрыта до успешной загрузки. <a href={retryHref}>Повторить загрузку</a></p>
        {schemaUnverified && <p>Схема не проверена. {adminReadMessage(healthRead.status === "failed" ? healthRead.issue : "invalid")}</p>}
        {catalogRead.status === "failed" && <p>Каталог недоступен. {adminReadMessage(catalogRead.issue)}</p>}
      </section>}
      {schemaNeedsMigration && (
        <p className="form-message">
          Канонические справочники ещё не готовы: примените миграцию
          20260901_zz_data_studio_integrity.sql.
        </p>
      )}

      <section className="stats-grid" aria-label="Сводка базы">
        <article className="stat-card"><span>Страны</span><strong>{displayCount(countries)}</strong><small>{catalog ? `${catalog.countries.length} в каталоге` : "Каталог недоступен"}</small></article>
        <article className="stat-card"><span>Авторы</span><strong>{displayCount(writers)}</strong><small>{sourceWriterCount === null ? "Каталог недоступен" : `${sourceWriterCount.toLocaleString("ru-RU")} в каталоге`}</small></article>
        <article className="stat-card"><span>Произведения</span><strong>{displayCount(works)}</strong><small>канонические записи</small></article>
        <article className="stat-card"><span>Издания</span><strong>{displayCount(editions)}</strong><small>точные ISBN</small></article>
        <article className="stat-card"><span>Кандидаты</span><strong>{displayCount(imports)}</strong><small>очередь импорта</small></article>
      </section>

      <section className="panel">
        <header>
          <div><span className="eyebrow">Разделы</span><h2>Редакционные данные</h2></div>
          <span className="badge">{schemaReady ? "Схема готова" : schemaNeedsMigration ? "Нужна миграция" : "Схема не проверена"}</span>
        </header>
        <div className="quick-actions">
          <Link href="/editorial-database"><strong>◉</strong><span>Страны и авторы</span></Link>
          <Link href="/library"><strong>▥</strong><span>Произведения и издания</span></Link>
          <Link href="/library?workspace=imports"><strong>⇣</strong><span>Импорт и разбор дублей</span></Link>
          <Link href="/editor-autosave"><strong>↺</strong><span>Автосохранение и восстановление</span></Link>
          <Link href="/history"><strong>⌚</strong><span>Версии и журнал изменений</span></Link>
        </div>
      </section>
    </>
  );
}

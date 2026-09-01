import Link from "next/link";

import { AdminDependencyState } from "@/components/AdminStatusState";
import { getStaffSession } from "@/lib/auth";
import { loadEditorialCatalog } from "@/lib/editorial-catalog";
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
  sync: "Справочники не синхронизированы. Проверьте миграцию Data Studio.",
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

export default async function DataStudioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, catalog, session, supabase] = await Promise.all([
    searchParams,
    loadEditorialCatalog(),
    getStaffSession(),
    createServerSupabaseClient(),
  ]);
  if (!supabase) return <AdminDependencyState />;

  const [countries, writers, works, editions, imports, health] = await Promise.all([
    supabase.from("editorial_countries").select("id", { count: "exact", head: true }),
    supabase.from("editorial_writers").select("id", { count: "exact", head: true }),
    supabase.from("literary_works").select("id", { count: "exact", head: true }),
    supabase.from("book_editions").select("id", { count: "exact", head: true }),
    supabase.from("book_import_candidates").select("id", { count: "exact", head: true }),
    supabase.rpc("get_data_studio_schema_health"),
  ]);
  const dataStudioHealth = health.data as Record<string, unknown> | null;
  const schemaReady =
    !countries.error &&
    !writers.error &&
    !health.error &&
    dataStudioHealth?.version === "20260901_zz_data_studio_integrity" &&
    dataStudioRequiredHealthKeys.every(
      (key) => dataStudioHealth?.[key] === true
    );
  const sourceWriterCount = catalog.countries.reduce(
    (total, country) => total + country.writers.length,
    0
  );
  const canSynchronize = session.role === "owner" || session.role === "admin";

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
        <p className="form-message form-success">
          Канонические страны и авторы сверены с редакционным каталогом.
        </p>
      )}
      {query.error && (
        <p className="form-message">{errorMessages[query.error] || "Операция не выполнена."}</p>
      )}
      {!schemaReady && (
        <p className="form-message">
          Канонические справочники ещё не готовы: примените миграцию
          20260901_zz_data_studio_integrity.sql.
        </p>
      )}

      <section className="stats-grid" aria-label="Сводка базы">
        <article className="stat-card"><span>Страны</span><strong>{countries.count ?? 0}</strong><small>{catalog.countries.length} в каталоге</small></article>
        <article className="stat-card"><span>Авторы</span><strong>{writers.count ?? 0}</strong><small>{sourceWriterCount.toLocaleString("ru-RU")} в каталоге</small></article>
        <article className="stat-card"><span>Произведения</span><strong>{works.count ?? 0}</strong><small>канонические записи</small></article>
        <article className="stat-card"><span>Издания</span><strong>{editions.count ?? 0}</strong><small>точные ISBN</small></article>
        <article className="stat-card"><span>Кандидаты</span><strong>{imports.count ?? 0}</strong><small>очередь импорта</small></article>
      </section>

      <section className="panel">
        <header>
          <div><span className="eyebrow">Разделы</span><h2>Редакционные данные</h2></div>
          <span className="badge">{schemaReady ? "Схема готова" : "Нужна миграция"}</span>
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

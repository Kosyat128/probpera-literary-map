import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { formatDate } from "@/lib/format";
import {
  HISTORY_EVENTS_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  historyAuditEntityTypes,
  historyCatalogHref,
  historyRevisionKinds,
  parseHistoryCatalogQuery,
} from "@/lib/history-catalog-query";
import { redirect } from "@/lib/navigation";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";
import { restoreRevisionAction } from "./actions";

export const metadata = { title: "История изменений" };

type RevisionRow = {
  revision_id: string | number;
  entity_id: string;
  snapshot: unknown;
  actor_id: string | null;
  created_at: string;
  revision_number: number | null;
  kind: keyof typeof historyRevisionKinds;
  restorable: boolean;
  entity_updated_at: string | null;
};

function snapshotLabel(snapshot: unknown, fallback: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return fallback;
  const record = snapshot as Record<string, unknown>;
  return String(
    record.title || record.name || record.label || record.legacy_id || fallback
  );
}

function revisionDetail(row: RevisionRow) {
  const label = historyRevisionKinds[row.kind] || row.kind;
  return row.revision_number ? `${label} · версия ${row.revision_number}` : label;
}

function HistoryPagination({
  label,
  page,
  totalPages,
  href,
}: {
  label: string;
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination history-pagination" aria-label={label}>
      {page > 1 ? <Link href={href(1)}>Первая</Link> : <span aria-disabled="true">Первая</span>}
      {page > 1 ? <Link href={href(page - 1)}>Назад</Link> : <span aria-disabled="true">Назад</span>}
      <span aria-current="page">Страница {page} из {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)}>Вперёд</Link> : <span aria-disabled="true">Вперёд</span>}
      {page < totalPages ? <Link href={href(totalPages)}>Последняя</Link> : <span aria-disabled="true">Последняя</span>}
    </nav>
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    restored?: string;
    published?: string;
    kind?: string;
    entity?: string;
    page?: string;
    events_page?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parseHistoryCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  let revisionsRequest = supabase
    .from("admin_revision_history")
    .select(
      "revision_id,entity_id,snapshot,actor_id,created_at,revision_number,kind,restorable,entity_updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("revision_id", { ascending: false })
    .order("kind", { ascending: true });
  let restorableRequest = supabase
    .from("admin_revision_history")
    .select("revision_id", { count: "exact", head: true })
    .eq("restorable", true);
  let eventsRequest = supabase
    .from("admin_audit_log")
    .select("id,action,entity_type,entity_id,actor_id,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (catalog.kind) {
    revisionsRequest = revisionsRequest.eq("kind", catalog.kind);
    restorableRequest = restorableRequest.eq("kind", catalog.kind);
    eventsRequest = eventsRequest.in("entity_type", historyAuditEntityTypes[catalog.kind]);
  }
  if (catalog.entity) {
    revisionsRequest = revisionsRequest.ilike("search_text", catalog.entityPattern);
    restorableRequest = restorableRequest.ilike("search_text", catalog.entityPattern);
    eventsRequest = eventsRequest.ilike("entity_id", catalog.entityPattern);
  }

  const [revisionResult, restorableResult, eventsResult] = await Promise.all([
    revisionsRequest.range(catalog.from, catalog.to),
    restorableRequest,
    eventsRequest.range(catalog.eventsFrom, catalog.eventsTo),
  ]);
  const revisions = (revisionResult.data || []) as RevisionRow[];
  const events = eventsResult.data || [];
  const revisionCount = revisionResult.count || 0;
  const eventsCount = eventsResult.count || 0;
  const revisionPages = Math.max(1, Math.ceil(revisionCount / HISTORY_PAGE_SIZE));
  const eventPages = Math.max(1, Math.ceil(eventsCount / HISTORY_EVENTS_PAGE_SIZE));

  if (
    !revisionResult.error &&
    !eventsResult.error &&
    (catalog.page > revisionPages || catalog.eventsPage > eventPages)
  ) {
    redirect(
      historyCatalogHref(catalog, {
        page: Math.min(catalog.page, revisionPages),
        eventsPage: Math.min(catalog.eventsPage, eventPages),
      })
    );
  }
  const schemaWarnings = [revisionResult.error, restorableResult.error, eventsResult.error]
    .filter(Boolean)
    .map((error) => error ? operatorDataError("history", "load") : undefined);

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Прозрачность и восстановление</span>
          <h1>История изменений</h1>
          <p>
            Полный журнал загружается с сервера страницами. Фильтры не подставляются
            в запрос напрямую и сохраняются после восстановления версии.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.restored && query.published !== "queue-error" && (
        <p className="form-message form-success">
          Версия восстановлена и передана в публикацию. {query.published === "started" ? "Сборка запущена." : "Запрос сохранён в очереди."}
        </p>
      )}
      {query.restored && query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Версия восстановлена, но запрос публикации записать не удалось. Повторите публикацию позже.
        </p>
      )}
      {schemaWarnings.length > 0 && (
        <p className="form-message">
          Единый каталог истории ещё недоступен. Примените миграцию
          20260813_unified_revision_history.sql.
        </p>
      )}

      <section className="panel history-catalog-filters">
        <form method="get">
          <label className="field">
            <span>Тип объекта</span>
            <select name="kind" defaultValue={catalog.kind}>
              <option value="">Все типы</option>
              {Object.entries(historyRevisionKinds).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field history-entity-filter">
            <span>Сущность, название, ISBN или постоянный ID</span>
            <input name="entity" type="search" maxLength={180} defaultValue={catalog.entity} placeholder="Название или ID" />
          </label>
          <button className="button" type="submit">Применить</button>
          {(catalog.kind || catalog.entity) && <Link className="button-secondary" href="/history">Сбросить</Link>}
        </form>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Версий по фильтру</span>
          <strong>{revisionCount.toLocaleString("ru-RU")}</strong>
          <small>{(restorableResult.count || 0).toLocaleString("ru-RU")} доступны для восстановления</small>
        </article>
        <article className="stat-card">
          <span>Событий по фильтру</span>
          <strong>{eventsCount.toLocaleString("ru-RU")}</strong>
          <small>полный журнал без фиксированного ограничения</small>
        </article>
        <article className="stat-card">
          <span>Защита правок</span>
          <strong>Включена</strong>
          <small>восстановление тоже публикуется</small>
        </article>
      </section>

      <section className="panel">
        <h2>Версии контента</h2>
        {revisionResult.error ? (
          <p className="form-message">{operatorDataError("history", "load")}</p>
        ) : revisions.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Объект</th><th>Тип</th><th>Дата</th><th>Пользователь</th><th></th></tr></thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={`${revision.kind}-${revision.revision_id}`}>
                    <td className="data-title">
                      <strong>{snapshotLabel(revision.snapshot, revision.entity_id)}</strong>
                      <small>{revision.entity_id}</small>
                    </td>
                    <td>{revisionDetail(revision)}</td>
                    <td>{formatDate(revision.created_at, true)}</td>
                    <td>{revision.actor_id || "Система"}</td>
                    <td>
                      {revision.restorable && revision.entity_updated_at ? (
                        <form action={restoreRevisionAction}>
                          <input name="kind" type="hidden" value={revision.kind} />
                          <input name="revision_id" type="hidden" value={revision.revision_id} />
                          <input name="expected_updated_at" type="hidden" value={revision.entity_updated_at} />
                          <input name="history_kind" type="hidden" value={catalog.kind} />
                          <input name="history_entity" type="hidden" value={catalog.entity} />
                          <input name="history_page" type="hidden" value={catalog.page} />
                          <input name="history_events_page" type="hidden" value={catalog.eventsPage} />
                          <ConfirmSubmitButton message="Восстановить эту версию и сразу опубликовать её?">
                            Восстановить
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <span className="badge">Объект удалён</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>Версии по этим фильтрам не найдены.</p></div>
        )}
        <HistoryPagination
          label="Страницы версий"
          page={catalog.page}
          totalPages={revisionPages}
          href={(page) => historyCatalogHref(catalog, { page })}
        />
      </section>

      <section className="panel">
        <h2>Журнал операций</h2>
        {eventsResult.error ? (
          <p className="form-message">{operatorDataError("history", "load")}</p>
        ) : events.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Событие</th><th>Объект</th><th>Дата</th><th>Пользователь</th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.action}</td>
                    <td>{event.entity_type}{event.entity_id ? ` · ${event.entity_id}` : ""}</td>
                    <td>{formatDate(event.created_at, true)}</td>
                    <td>{event.actor_id || "Система"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>Операции по этим фильтрам не найдены.</p></div>
        )}
        <HistoryPagination
          label="Страницы журнала операций"
          page={catalog.eventsPage}
          totalPages={eventPages}
          href={(eventsPage) => historyCatalogHref(catalog, { eventsPage })}
        />
      </section>
    </>
  );
}

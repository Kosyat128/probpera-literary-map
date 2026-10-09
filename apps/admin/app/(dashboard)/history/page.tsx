import Link from "next/link";
import { z } from "zod";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { formatDate, safeCount } from "@/lib/format";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList, readAdminResult, type AdminReadResult } from "@/lib/admin-read-result";
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
import { restoreRevisionAction } from "./actions";

export const metadata = { title: "История изменений" };

type RevisionRow = {
  revision_id: string | number;
  entity_id: string | null;
  snapshot: unknown;
  actor_id: string | null;
  created_at: string;
  revision_number: number | null;
  kind: keyof typeof historyRevisionKinds;
  restorable: boolean;
  entity_updated_at: string | null;
};

type AuditRow = {
  id: number | string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
};

function isHistoryId(value: unknown): value is number | string {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  // Preserve the full SQL bigint identity without a lossy Number conversion.
  return typeof value === "string" && /^[1-9]\d{0,18}$/u.test(value)
    && (value.length < 19 || value <= "9223372036854775807");
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isRevisionRow(value: unknown): value is RevisionRow {
  return isReadRecord(value) && isHistoryId(value.revision_id)
    && isNullableText(value.entity_id) && Object.hasOwn(value, "snapshot")
    && value.snapshot !== undefined && isNullableText(value.actor_id)
    && isTimestamp(value.created_at)
    && (value.revision_number === null || (typeof value.revision_number === "number"
      && Number.isInteger(value.revision_number) && value.revision_number >= -2147483648
      && value.revision_number <= 2147483647))
    && typeof value.kind === "string" && Object.hasOwn(historyRevisionKinds, value.kind)
    && typeof value.restorable === "boolean"
    && (value.entity_updated_at === null || isTimestamp(value.entity_updated_at));
}

function isAuditRow(value: unknown): value is AuditRow {
  return isReadRecord(value) && isHistoryId(value.id)
    && typeof value.action === "string" && typeof value.entity_type === "string"
    && isNullableText(value.entity_id) && isNullableText(value.actor_id)
    && isTimestamp(value.created_at);
}

function readHistoryCount(
  result: PromiseSettledResult<{ data: unknown; count: number | null; error?: unknown }>,
): AdminReadResult<number> {
  const envelope = readAdminResult(result, (data) => data === null || Array.isArray(data));
  if (envelope.status === "failed") return envelope;
  const count = safeCount(result.status === "fulfilled" ? result.value : null);
  return count === null ? { status: "failed", issue: "invalid" }
    : { status: "success", data: count };
}

function displayCount(read: AdminReadResult<number>) {
  return read.status === "success" ? read.data.toLocaleString("ru-RU") : "Недоступно";
}

function snapshotLabel(snapshot: unknown, fallback: string | null) {
  const label = fallback ?? "Идентификатор не сохранён";
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return label;
  const record = snapshot as Record<string, unknown>;
  const value = record.title || record.name || record.label || record.legacy_id || label;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value) : label;
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

  const reads = await Promise.allSettled([
    revisionsRequest.range(catalog.from, catalog.to),
    restorableRequest,
    eventsRequest.range(catalog.eventsFrom, catalog.eventsTo),
  ]);
  const revisionsRead = readAdminList<RevisionRow>(reads[0], isRevisionRow);
  const eventsRead = readAdminList<AuditRow>(reads[2], isAuditRow);
  const revisions = revisionsRead.status === "success" ? revisionsRead.data : [];
  const events = eventsRead.status === "success" ? eventsRead.data : [];
  const [revisionCount, restorableCount, eventsCount] = reads.map(readHistoryCount);
  const revisionPages = revisionCount.status === "success"
    ? Math.max(1, Math.ceil(revisionCount.data / HISTORY_PAGE_SIZE)) : null;
  const eventPages = eventsCount.status === "success"
    ? Math.max(1, Math.ceil(eventsCount.data / HISTORY_EVENTS_PAGE_SIZE)) : null;
  const issues = [revisionsRead, eventsRead, revisionCount, restorableCount, eventsCount]
    .filter((read) => read.status === "failed");
  const canRestore = issues.length === 0;
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)
    + historyCatalogHref(catalog);
  const page = revisionsRead.status === "success" && revisionPages !== null
    ? Math.min(catalog.page, revisionPages) : catalog.page;
  const eventsPage = eventsRead.status === "success" && eventPages !== null
    ? Math.min(catalog.eventsPage, eventPages) : catalog.eventsPage;

  if (
    page !== catalog.page || eventsPage !== catalog.eventsPage
  ) {
    redirect(
      historyCatalogHref(catalog, {
        page,
        eventsPage,
      })
    );
  }

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
      {(query.error || query.restored || query.published) && (
        <p className="form-message" role="status">
          Результат действия по параметрам страницы не подтверждён. Проверьте актуальную историю и очередь публикации перед повторным изменением.
        </p>
      )}
      {issues.length > 0 && (
        <p className="form-message form-error" role="alert">
          {adminReadMessage(issues[0].issue)}{" "}
          Восстановление недоступно до полной загрузки истории и её счётчиков.{" "}
          <a href={retryHref}>Повторить загрузку</a>
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
          <strong>{displayCount(revisionCount)}</strong>
          <small>{displayCount(restorableCount)} доступны для восстановления</small>
        </article>
        <article className="stat-card">
          <span>Событий по фильтру</span>
          <strong>{displayCount(eventsCount)}</strong>
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
        {revisionsRead.status === "failed" ? (
          <p className="form-message form-error" role="alert">{adminReadMessage(revisionsRead.issue)}</p>
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
                      {revision.restorable && revision.entity_updated_at ? canRestore
                        && isReadRecord(revision.snapshot)
                        && z.string().datetime({ offset: true }).safeParse(revision.entity_updated_at).success ? (
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
                      ) : <span className="badge">Восстановление недоступно</span> : (
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
        {revisionsRead.status === "success" && revisionPages !== null && <HistoryPagination
          label="Страницы версий"
          page={catalog.page}
          totalPages={revisionPages}
          href={(page) => historyCatalogHref(catalog, { page })}
        />}
      </section>

      <section className="panel">
        <h2>Журнал операций</h2>
        {eventsRead.status === "failed" ? (
          <p className="form-message form-error" role="alert">{adminReadMessage(eventsRead.issue)}</p>
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
        {eventsRead.status === "success" && eventPages !== null && <HistoryPagination
          label="Страницы журнала операций"
          page={catalog.eventsPage}
          totalPages={eventPages}
          href={(eventsPage) => historyCatalogHref(catalog, { eventsPage })}
        />}
      </section>
    </>
  );
}

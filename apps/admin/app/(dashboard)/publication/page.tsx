import Link from "next/link";

import { formatDate, safeCount } from "@/lib/format";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList } from "@/lib/admin-read-result";
import { redirect } from "@/lib/navigation";
import {
  PUBLICATION_CATALOG_PAGE_SIZE,
  parsePublicationCatalogQuery,
  publicationCatalogHref,
} from "@/lib/publication-catalog-query";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";
import { requestFullPublicBuildAction, retryPublicationAction } from "./actions";

export const metadata = { title: "Публикация сайта" };

type OutboxEvent = {
  id: number | string;
  entity_type: string;
  entity_id: string;
  reason: string;
  status: "requested" | "dispatched" | "deployed" | "failed";
  attempt_count: number;
  last_error: string | null;
  provider: string | null;
  requested_at: string;
  dispatched_at: string | null;
  deployed_at: string | null;
  deployment_run_id: string | null;
};

const statusLabels: Record<OutboxEvent["status"], string> = {
  requested: "В очереди",
  dispatched: "Сборка запущена",
  deployed: "Опубликовано",
  failed: "Требует повтора",
};

function isOutboxId(value: unknown): value is number | string {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  // Preserve decimal strings exactly; the SQL identity is a positive signed bigint.
  return typeof value === "string" && /^[1-9]\d{0,18}$/u.test(value)
    && (value.length < 19 || value <= "9223372036854775807");
}

function isSqlText(value: unknown, max: number): value is string {
  if (typeof value !== "string") return false;
  const length = Array.from(value).length;
  return length >= 1 && length <= max;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isOutboxEvent(value: unknown): value is OutboxEvent {
  return isReadRecord(value) && isOutboxId(value.id)
    && isSqlText(value.entity_type, 120) && isSqlText(value.entity_id, 240)
    && isSqlText(value.reason, 240) && typeof value.status === "string"
    && Object.hasOwn(statusLabels, value.status)
    && typeof value.attempt_count === "number" && Number.isSafeInteger(value.attempt_count)
    && value.attempt_count >= 0 && value.attempt_count <= 2147483647
    && (value.last_error === null || typeof value.last_error === "string")
    && (value.provider === null || typeof value.provider === "string")
    && isTimestamp(value.requested_at)
    && (value.dispatched_at === null || isTimestamp(value.dispatched_at))
    && (value.deployed_at === null || isTimestamp(value.deployed_at))
    && (value.deployment_run_id === null || typeof value.deployment_run_id === "string");
}

function displayCount(count: number | null) {
  return count === null ? "Недоступно" : count.toLocaleString("ru-RU");
}

function CatalogContext({ catalog }: { catalog: ReturnType<typeof parsePublicationCatalogQuery> }) {
  return (
    <>
      <input type="hidden" name="catalog_q" value={catalog.term} />
      <input type="hidden" name="catalog_status" value={catalog.status} />
      <input type="hidden" name="catalog_page" value={catalog.page} />
    </>
  );
}
export default async function PublicationPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    published?: string;
    error?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parsePublicationCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  let eventsRequest = supabase
    .from("public_build_outbox")
    .select(
      "id,entity_type,entity_id,reason,status,attempt_count,last_error,provider,requested_at,dispatched_at,deployed_at,deployment_run_id",
      { count: "exact" }
    )
    .order("id", { ascending: false });
  if (catalog.status) eventsRequest = eventsRequest.eq("status", catalog.status);
  if (catalog.orFilter) eventsRequest = eventsRequest.or(catalog.orFilter);

  const reads = await Promise.allSettled([
    eventsRequest.range(catalog.from, catalog.to),
    supabase
      .from("public_build_outbox")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "dispatched"]),
    supabase
      .from("public_build_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);
  const eventsRead = readAdminList<OutboxEvent>(reads[0], isOutboxEvent);
  const events = eventsRead.status === "success" ? eventsRead.data : [];
  const [totalCount, pendingCount, failedCount] = reads.map((read) =>
    safeCount(read.status === "fulfilled" ? read.value : null));
  const totalPages = totalCount === null
    ? null : Math.max(1, Math.ceil(totalCount / PUBLICATION_CATALOG_PAGE_SIZE));
  const canChangePublication = eventsRead.status === "success"
    && totalCount !== null && pendingCount !== null && failedCount !== null;
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)
    + publicationCatalogHref(catalog);
  if (eventsRead.status === "success" && totalPages !== null && catalog.page > totalPages) {
    redirect(publicationCatalogHref(catalog, { page: totalPages }));
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Путь изменения до продакшена</span>
          <h1>Публикация сайта</h1>
          <p>
            Здесь видно не только принятие запроса, но и его очередь, запуск сборки,
            число попыток и подтверждённое развёртывание.
          </p>
        </div>
        {canChangePublication && (
          <form action={requestFullPublicBuildAction}>
            <CatalogContext catalog={catalog} />
            <button className="button" type="submit">Пересобрать весь сайт</button>
          </form>
        )}
      </header>

      {(query.error || query.published) && (
        <p className="form-message" role="status">
          Результат действия по параметрам страницы не подтверждён. Проверьте актуальную очередь перед повторным изменением.
        </p>
      )}
      {!canChangePublication && (
        <p className="form-message form-error" role="alert">
          {eventsRead.status === "failed" ? adminReadMessage(eventsRead.issue)
            : "Не удалось загрузить все счётчики публикации."}
          {" "}Действия публикации недоступны до полной загрузки очереди и её счётчиков.{" "}
          <a href={retryHref}>Повторить загрузку</a>
        </p>
      )}

      <section className="stat-grid">
        <article className="stat-card">
          <span>В работе</span>
          <strong>{displayCount(pendingCount)}</strong>
          <small>очередь и запущенные сборки</small>
        </article>
        <article className="stat-card">
          <span>С ошибкой</span>
          <strong>{displayCount(failedCount)}</strong>
          <small>можно повторить вручную</small>
        </article>
        <article className="stat-card">
          <span>В выборке</span>
          <strong>{displayCount(totalCount)}</strong>
          <small>с учётом активных фильтров</small>
        </article>
      </section>

      <section className="panel">
        <form className="toolbar">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={catalog.term}
            placeholder="Тип, идентификатор или причина"
            maxLength={160}
          />
          <select name="status" defaultValue={catalog.status}>
            <option value="">Все состояния</option>
            <option value="requested">В очереди</option>
            <option value="dispatched">Сборка запущена</option>
            <option value="deployed">Опубликовано</option>
            <option value="failed">С ошибкой</option>
          </select>
          <button className="button-secondary" type="submit">Применить</button>
        </form>

        {eventsRead.status === "failed" ? (
          <p className="form-message form-error" role="alert">
            {operatorDataError("publication", "load")}
          </p>
        ) : events.length === 0 ? (
          <div className="empty-state"><p>Запросов с такими условиями пока нет.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Сущность</th>
                <th>Состояние</th>
                <th>Время и попытки</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const runUrl = event.deployment_run_id && /^\d+$/u.test(event.deployment_run_id)
                  ? `https://github.com/Kosyat128/probpera-literary-map/actions/runs/${event.deployment_run_id}`
                  : "";
                return (
                  <tr key={String(event.id)}>
                    <td className="data-title">
                      <strong>{event.entity_type} · {event.entity_id}</strong>
                      <small>{event.reason}</small>
                      {event.last_error && <small className="form-error">Не удалось подтвердить выполнение запроса. Проверьте состояние очереди перед повтором.</small>}
                    </td>
                    <td>
                      <span className={`badge publication-status-${event.status}`}>
                        {statusLabels[event.status]}
                      </span>
                      <small>{event.provider || "обработчик не назначен"}</small>
                    </td>
                    <td>
                      <strong>{formatDate(event.deployed_at || event.dispatched_at || event.requested_at, true)}</strong>
                      <small>Попыток: {event.attempt_count}</small>
                      {runUrl && <a href={runUrl} target="_blank" rel="noreferrer">Открыть сборку ↗</a>}
                    </td>
                    <td>
                      {event.status !== "deployed" ? canChangePublication ? (
                        <form action={retryPublicationAction}>
                          <CatalogContext catalog={catalog} />
                          <input type="hidden" name="outbox_id" value={String(event.id)} />
                          <button className="button-secondary" type="submit">Повторить</button>
                        </form>
                      ) : (
                        <span>Действие недоступно</span>
                      ) : (
                        <span aria-label="Публикация подтверждена">Готово</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {eventsRead.status === "success" && totalPages !== null && totalPages > 1 && (
          <nav className="pagination" aria-label="Страницы публикационной очереди">
            {catalog.page > 1 ? (
              <Link href={publicationCatalogHref(catalog, { page: catalog.page - 1 })}>← Назад</Link>
            ) : (
              <span aria-disabled="true">← Назад</span>
            )}
            <span aria-current="page">Страница {catalog.page} из {totalPages}</span>
            {catalog.page < totalPages ? (
              <Link href={publicationCatalogHref(catalog, { page: catalog.page + 1 })}>Вперёд →</Link>
            ) : (
              <span aria-disabled="true">Вперёд →</span>
            )}
          </nav>
        )}
      </section>
    </>
  );
}

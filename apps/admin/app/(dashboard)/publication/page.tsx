import Link from "next/link";

import { formatDate } from "@/lib/format";
import { redirect } from "@/lib/navigation";
import {
  PUBLICATION_CATALOG_PAGE_SIZE,
  parsePublicationCatalogQuery,
  publicationCatalogHref,
} from "@/lib/publication-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  if (!supabase) return null;

  let eventsRequest = supabase
    .from("public_build_outbox")
    .select(
      "id,entity_type,entity_id,reason,status,attempt_count,last_error,provider,requested_at,dispatched_at,deployed_at,deployment_run_id",
      { count: "exact" }
    )
    .order("id", { ascending: false });
  if (catalog.status) eventsRequest = eventsRequest.eq("status", catalog.status);
  if (catalog.orFilter) eventsRequest = eventsRequest.or(catalog.orFilter);

  const [eventsResponse, pendingResponse, failedResponse] = await Promise.all([
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
  const events = (eventsResponse.data || []) as OutboxEvent[];
  const totalCount = eventsResponse.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PUBLICATION_CATALOG_PAGE_SIZE));
  if (!eventsResponse.error && catalog.page > totalPages) {
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
        <form action={requestFullPublicBuildAction}>
          <CatalogContext catalog={catalog} />
          <button className="button" type="submit">Пересобрать весь сайт</button>
        </form>
      </header>

      {query.error && <p className="form-message form-error" role="alert">{query.error}</p>}
      {query.published === "started" && (
        <p className="form-message form-success">Запрос надёжно записан, сборка запущена.</p>
      )}
      {query.published === "queued" && (
        <p className="form-message form-success">
          Запрос надёжно записан в очередь. Плановый обработчик повторит запуск.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Запрос не удалось надёжно записать в очередь. Повторите действие после проверки базы.
        </p>
      )}

      <section className="stat-grid">
        <article className="stat-card">
          <span>В работе</span>
          <strong>{pendingResponse.count ?? "-"}</strong>
          <small>очередь и запущенные сборки</small>
        </article>
        <article className="stat-card">
          <span>С ошибкой</span>
          <strong>{failedResponse.count ?? "-"}</strong>
          <small>можно повторить вручную</small>
        </article>
        <article className="stat-card">
          <span>В выборке</span>
          <strong>{totalCount.toLocaleString("ru-RU")}</strong>
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

        {eventsResponse.error ? (
          <p className="form-message form-error" role="alert">
            Очередь публикации недоступна: {eventsResponse.error.message}. Примените миграцию
            20260814 и проверьте состояние схемы.
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
                      {event.last_error && <small className="form-error">{event.last_error}</small>}
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
                      {event.status !== "deployed" ? (
                        <form action={retryPublicationAction}>
                          <CatalogContext catalog={catalog} />
                          <input type="hidden" name="outbox_id" value={String(event.id)} />
                          <button className="button-secondary" type="submit">Повторить</button>
                        </form>
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

        {!eventsResponse.error && totalPages > 1 && (
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

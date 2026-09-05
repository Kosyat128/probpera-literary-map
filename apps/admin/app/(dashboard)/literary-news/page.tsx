import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import AdminStatusState from "@/components/AdminStatusState";
import { requireStaff } from "@/lib/auth";
import { filterHeldNewsQueue, formatNewsQueueDate as stamp, literaryNewsQueueHref, loadLiteraryNewsQueue, newsHoldReason } from "@/lib/literary-news-queue";

export const metadata = { title: "Литературная сводка" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LiteraryNewsQueuePage({ searchParams }: {
  searchParams: Promise<{ q?: string; source?: string; page?: string }>;
}) {
  noStore();
  const session = await requireStaff();
  if (!session || session.mfa.checkError) return <AdminStatusState eyebrow="Редакционная очередь" title="Нужно подтвердить редакционный доступ" description="Войдите в кабинет и завершите проверку учётной записи, чтобы открыть найденные материалы." />;
  const snapshot = await loadLiteraryNewsQueue();
  const query = filterHeldNewsQueue(snapshot.queue?.items ?? [], await searchParams);
  const allSources = new Map((snapshot.sources?.sources ?? []).map((source) => [source.id, source.name]));
  for (const item of snapshot.queue?.items ?? []) allSources.set(item.sourceId, item.source.name);
  const filtersActive = Boolean(query.q || query.source);
  const unavailable = !snapshot.configured || snapshot.queueError;

  return <>
    <header className="page-heading"><div>
      <span className="eyebrow">Мировая литература</span>
      <h1>Литературная сводка</h1>
      <p>Найденные материалы ожидают редакционной проверки. Они не подтверждены и не попадают в публичную ленту автоматически.</p>
    </div></header>

    <section className="panel" aria-labelledby="news-review-workflow">
      <h2 id="news-review-workflow">Подготовка к публикации</h2>
      <ol>
        <li>Откройте первоисточник, подтвердите событие, его дату и категорию. Дата обнаружения и дата публикации материала не заменяют дату события.</li>
        <li>Подготовьте собственные краткие заголовок и описание на русском и английском; сохраните ссылку на подтверждающий источник.</li>
        <li>Добавьте проверенную карточку в <code>data/news/reviewed.json</code> и отправьте изменение на проверку в защищённую ветку <code>main</code>. <a href="https://github.com/Kosyat128/probpera-literary-map/blob/main/data/news/reviewed.json" target="_blank" rel="noopener noreferrer">Открыть проверенную подборку на GitHub ↗</a>. Отзыв или исправление опубликованной карточки проходит тем же путём.</li>
      </ol>
      <p className="catalog-summary">Эта страница показывает очередь для чтения. Статус <code>held</code> означает, что редакционная проверка ещё не завершена.</p>
    </section>

    <section className="panel" aria-labelledby="news-queue-title">
      <h2 id="news-queue-title">Материалы на проверке</h2>
      <form className="toolbar" method="get">
        <input className="search-input" type="search" name="q" defaultValue={query.q} maxLength={160} aria-label="Поиск в редакционной очереди" placeholder="Заголовок, описание или источник" />
        <select name="source" defaultValue={query.source} aria-label="Источник материала">
          <option value="">Все источники</option>
          {query.source && !allSources.has(query.source) && <option value={query.source}>Источник больше не доступен</option>}
          {[...allSources].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button className="button-secondary" type="submit">Применить</button>
        {filtersActive && <Link href="/literary-news">Сбросить фильтры</Link>}
      </form>
      {unavailable ? <p className="form-message form-error" role="alert">{snapshot.configured ? "Не удалось прочитать очередь. Данные недоступны или не прошли проверку формата; повторите позже." : "Хранилище очереди не подключено к этому экземпляру кабинета."}</p>
        : !snapshot.queue ? <p className="empty-state">Снимок очереди ещё не получен. Первый сбор источников создаст его автоматически.</p>
          : <>
            <p className="catalog-summary">Найдено: <strong>{query.total}</strong>. Всего ожидают проверки: <strong>{snapshot.queue.items.length}</strong>. Снимок: <time dateTime={snapshot.queue.generatedAt}>{stamp(snapshot.queue.generatedAt)}</time>.</p>
            {query.items.length === 0 ? <p className="empty-state">{filtersActive ? "Материалов с такими фильтрами нет." : "В этом снимке нет материалов, ожидающих проверки."}</p>
              : <ol style={{ listStyle: "none", padding: 0 }}>
                {query.items.map((item) => <li key={item.source.url} style={{ borderTop: "1px solid var(--line, #e5dfe6)", padding: "20px 0", overflowWrap: "anywhere" }}>
                  <article>
                    <p className="eyebrow">Не подтверждено · {item.source.name} · {item.source.language}</p>
                    <h3 lang={item.source.language}>{item.title}</h3>
                    {item.description && <p lang={item.source.language}>{item.description}</p>}
                    <p><a href={item.source.url} target="_blank" rel="noopener noreferrer">Открыть оригинал: {item.source.name} ↗</a></p>
                    <p className="catalog-summary">Обнаружено: <time dateTime={item.discoveredAt}>{stamp(item.discoveredAt)}</time><br />
                      {item.publishedAt ? <>Дата публикации по данным источника: <time dateTime={item.publishedAt}>{stamp(item.publishedAt)}</time></> : "Дата публикации источником не указана."}
                    </p>
                    <ul aria-label="Что требуется проверить">{item.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{newsHoldReason(reason)}</li>)}</ul>
                  </article>
                </li>)}
              </ol>}
            {query.pages > 1 && <nav className="pagination" aria-label="Страницы редакционной очереди">
              {query.page > 1 ? <Link href={literaryNewsQueueHref(query, query.page - 1)}>← Назад</Link> : <span aria-disabled="true">← Назад</span>}
              <span aria-current="page">Страница {query.page} из {query.pages}</span>
              {query.page < query.pages ? <Link href={literaryNewsQueueHref(query, query.page + 1)}>Вперёд →</Link> : <span aria-disabled="true">Вперёд →</span>}
            </nav>}
          </>}
    </section>

    <section className="panel" aria-labelledby="news-sources-title">
      <h2 id="news-sources-title">Последний сбор источников</h2>
      {snapshot.sourcesError ? <p className="form-message form-error" role="alert">Состояние источников временно недоступно.</p>
        : !snapshot.sources ? <p>Состояние источников ещё не получено.</p>
          : <>
            <p>{snapshot.sources.lastCheckedAt ? <>Последняя попытка: <time dateTime={snapshot.sources.lastCheckedAt}>{stamp(snapshot.sources.lastCheckedAt)}</time>.</> : "Проверка источников ещё не запускалась."} Плановый интервал: {Math.round(snapshot.sources.refreshIntervalSeconds / 60)} мин.</p>
            <p className="catalog-summary">Доступность источника не подтверждает содержание новости. Снимки очереди и состояния могут обновляться с небольшим интервалом.</p>
            <ul>{snapshot.sources.sources.map((source) => <li key={source.id} style={{ marginBlock: 12, overflowWrap: "anywhere" }}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a> - {source.status === "ok" ? "Доступен" : source.status === "error" ? "Последняя попытка не удалась" : "Ещё не проверен"}
              {source.lastSuccessAt && <>. Последний успешный сбор: <time dateTime={source.lastSuccessAt}>{stamp(source.lastSuccessAt)}</time></>}
            </li>)}</ul>
          </>}
    </section>
  </>;
}

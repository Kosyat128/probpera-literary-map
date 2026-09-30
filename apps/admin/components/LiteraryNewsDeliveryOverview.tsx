import Link from "next/link";
import { NewsDestinationControls, NewsJobResolutionControls } from "@/components/LiteraryNewsRuntimeControls";
import type { LiteraryNewsRuntimeOverview, NewsDeliveryStatus } from "@/lib/literary-news-runtime-overview";
import { NEWS_RUNTIME_PAGE_SIZE, newsDeliveryStatuses } from "@/lib/literary-news-runtime-overview";
import { formatNewsQueueDate as stamp } from "@/lib/literary-news-queue";

const statusLabels: Record<NewsDeliveryStatus, string> = { pending: "Ожидают", inflight: "Запрос выполняется", sent_current: "Подтверждена текущая версия", correction_pending: "Ждут исправления", ambiguous: "Результат неизвестен", blocked: "Заблокированы", explicitly_closed: "Закрыты явно", unknown: "Неизвестное состояние" };
const modeLabels: Record<string, string> = { off: "Выключено", shadow: "Без отправки", canary: "Пробная отправка", on: "Включено", unknown: "Не подтверждён" };
const runLabels: Record<string, string> = { "native-cron": "Нативный планировщик", "--preview-local": "Локальный предпросмотр", "--shadow": "Проверка без отправки", "--capture": "Учёт опубликованных карточек", "--send": "Обработка отправок", "--preflight": "Проверка доступа" };
const showTime = (value: string | null) => value ? <time dateTime={value}>{stamp(value)}</time> : "Нет подтверждения";

export default function LiteraryNewsDeliveryOverview({ snapshot, page: requestedPage, query, canManage = false }: { canManage?: boolean; snapshot: LiteraryNewsRuntimeOverview; page?: string; query: { q?: string; source?: string; page?: string } }) {
  const pages = Math.max(1, Math.ceil(snapshot.posts.length / NEWS_RUNTIME_PAGE_SIZE));
  const numeric = Number(requestedPage || 1);
  const page = Number.isSafeInteger(numeric) ? Math.max(1, Math.min(pages, numeric)) : 1;
  const posts = snapshot.posts.slice((page - 1) * NEWS_RUNTIME_PAGE_SIZE, page * NEWS_RUNTIME_PAGE_SIZE);
  const href = (value: number) => {
    const params = new URLSearchParams();
    for (const key of ["q", "source", "page"] as const) if (query[key]) params.set(key, query[key]!);
    if (value > 1) params.set("delivery_page", String(value));
    return `/literary-news${params.size ? `?${params}` : ""}#news-delivery`;
  };
  return <section className="panel" id="news-delivery" aria-labelledby="news-delivery-title">
    <h2 id="news-delivery-title">Отправка литературной повестки</h2>
    <p>Запуск планировщика и подтверждение публикации в канале учитываются отдельно. {canManage ? "Решения по паузе и неопределённым результатам сохраняются с проверкой версии записи." : "Этот обзор доступен только для чтения."}</p>
    {!snapshot.configured ? <p className="form-message form-error">Редакционная база не подключена. Состояние отправок неизвестно.</p>
      : !snapshot.hasRuntime && !snapshot.readError ? <p className="empty-state">Журнал отправок ещё не получен. Работа планировщика, подключение схемы и доставка в каналы не подтверждены.</p>
        : <>
          {snapshot.readError && <p className="form-message form-error" role="alert">Журнал прочитан не полностью: доступ к базе или необходимой схеме недоступен. Счётчики ниже охватывают только полученные записи.</p>}
          {!snapshot.complete && !snapshot.readError && <p className="form-message form-error" role="alert">Обзор неполный: достигнут предел чтения или обнаружены некорректные записи. Полное количество ожидающих отправок неизвестно; проценты доставки не рассчитываются.</p>}
          <dl className="settings-stack">
            <div><dt>Последний завершённый запуск планировщика</dt><dd>{showTime(snapshot.lastSchedulerAt)}{snapshot.schedulerMode && <> · {runLabels[snapshot.schedulerMode] || "Режим не подтверждён"}</>}</dd></div>
            <div><dt>Последняя подтверждённая доставка</dt><dd>{showTime(snapshot.lastDeliveryAt)}</dd></div>
            <div><dt>Начало наблюдаемой истории</dt><dd>{showTime(snapshot.historyObservedSince)}{snapshot.historyStatus === "gap_before_first_observation" && <>. До этой даты есть исторический пробел; старые публикации требуют сверки.</>}</dd></div>
          </dl>
          <section aria-labelledby="news-daily-delivery">
            <h3 id="news-daily-delivery">Подтверждённые новости за день</h3>
            {snapshot.nativeDeliveryInvalid ? <p className="form-message form-error">Дневная сводка планировщика не прошла проверку. Количество отправок за сегодня неизвестно.</p>
              : !snapshot.nativeDelivery ? <p>Подтверждённая дневная сводка нативного планировщика ещё не получена. Количество отправок за сегодня неизвестно.</p>
                : !snapshot.nativeDelivery.isCurrentDay ? <p>Сводка за сегодня ещё не получена. Последние подтверждённые данные относятся к <time dateTime={snapshot.nativeDelivery.editorialDay}>{snapshot.nativeDelivery.editorialDay}</time>.</p>
                  : <>
                    <p>За <time dateTime={snapshot.nativeDelivery.editorialDay}>{snapshot.nativeDelivery.editorialDay}</time> по московскому времени подтверждено свежих новостей: <strong>{snapshot.nativeDelivery.freshCreates}</strong>. Из них с фото: <strong>{snapshot.nativeDelivery.freshPhotoCreates}</strong>, без фото: <strong>{snapshot.nativeDelivery.freshTextCreates}</strong>. Цель: {snapshot.nativeDelivery.minimum}-{snapshot.nativeDelivery.maximum} в день. До минимума осталось: <strong>{snapshot.nativeDelivery.deficitToMinimum}</strong>.</p>
                    <p>Новые посты выходят примерно раз в час с 08:00 до 22:00 по московскому времени. Новости с фото получают приоритет.</p>
                    <p>Других первых отправок за день: <strong>{snapshot.nativeDelivery.acknowledgedCreates - snapshot.nativeDelivery.freshCreates}</strong>. Подтверждений без известной даты первой отправки в истории: <strong>{snapshot.nativeDelivery.legacyReceiptsWithUnknownFirstDate}</strong>; они не включены в дневной результат.</p>
                    <p className="catalog-summary">Сводка проверена: {showTime(snapshot.nativeDelivery.finishedAt)}. Правки ранее опубликованных сообщений не считаются новыми отправками.</p>
                  </>}
          </section>
          {snapshot.destinations.length === 0 ? <p>Сохранённые назначения каналов не найдены. Доставка не включена этим обзором.</p> : snapshot.destinations.map(destination => <article key={`${destination.platform}:${destination.id}`} style={{ marginBlock: 20, overflowWrap: "anywhere" }}>
            <h3>{destination.platform === "telegram" ? "Telegram" : "VK"} · {destination.id}</h3>
            <p>Режим: <strong>{modeLabels[destination.mode] || modeLabels.unknown}</strong>. Пауза: {destination.paused === true ? "включена" : destination.paused === false ? "выключена" : "не подтверждена"}. История: {destination.historyReconciled ? "отмечена как сверенная" : "сверка не подтверждена"}.</p>
            {destination.pauseReason && <p>Причина паузы: <code>{destination.pauseReason}</code></p>}
            <p>Самая старая незавершённая запись: {showTime(destination.oldestBacklogAt)}. Последняя доставка: {showTime(destination.lastDeliveryAt)}.</p>
            <p className="catalog-summary">Известных записей этого назначения: {destination.knownJobs}. Это сохранённый журнал, включая карточки, которые уже вышли из текущей публичной подборки.</p>
            {canManage && <NewsDestinationControls platform={destination.platform} id={destination.id} paused={destination.paused} version={destination.expectedVersion} />}
            <ul>{newsDeliveryStatuses.filter(status => destination.counts[status] > 0).map(status => <li key={status}>{statusLabels[status]}: <strong>{destination.counts[status]}</strong></li>)}</ul>
          </article>)}
          <h3>Подготовленные публикации и подтверждения</h3>
          {posts.length === 0 ? <p>Сохранённых заданий отправки пока нет.</p> : posts.map(post => <article key={post.key} style={{ borderTop: "1px solid var(--line, #e5dfe6)", paddingBlock: 16, overflowWrap: "anywhere" }}>
            <h4>{post.platform === "telegram" ? "Telegram" : "VK"} · {post.destinationId} · {post.newsId}</h4>
            <p><strong>{statusLabels[post.status]}</strong>. Поступило в журнал: {showTime(post.admittedAt)}.</p>
            {post.acknowledgedAt && <p>Есть подтверждение доставки от {showTime(post.acknowledgedAt)}{post.status !== "sent_current" && "; оно не подтверждает текущую версию"}.</p>}
            {post.remoteUrl && <p><a href={post.remoteUrl} target="_blank" rel="noopener noreferrer">Открыть публикацию в канале ↗</a></p>}
            {post.error && <p>Требуется проверка: <code>{post.error}</code></p>}
            {post.nextDueAt && <p>Следующая разрешённая попытка: {showTime(post.nextDueAt)}.</p>}
            {canManage && <NewsJobResolutionControls recordKey={post.key} version={post.expectedVersion} status={post.status} platform={post.platform} destinationId={post.destinationId} />}
            <details><summary>Точный подготовленный текст</summary>{post.preparedText !== null ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{post.preparedText}</pre> : <p>Подготовленный текст отсутствует или не прошёл проверку формата.</p>}</details>
            {post.media && <details><summary>Подготовленное изображение и права</summary>
              <p>{post.media.credit}</p>
              <p>Лицензия: {post.media.license}. Размер: {post.media.width} × {post.media.height}.</p>
              <p>Сведения проверены: {showTime(post.media.checkedAt)}. Срок разрешения: {showTime(post.media.validUntil)}.</p>
              <p>SHA-256 подготовленного файла: <code>{post.media.sha256}</code>.</p>
              {post.media.sourceUrl && <p><a href={post.media.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть исходное изображение ↗</a></p>}
              {post.media.licenseEvidenceUrl && <p><a href={post.media.licenseEvidenceUrl} target="_blank" rel="noopener noreferrer">Основание использования ↗</a></p>}
              <p>Сведения относятся к подготовленному файлу. Вид и наличие изображения в канале проверяются по опубликованному посту.</p>
            </details>}
            {post.mediaInvalid && <p className="form-message form-error">Сведения об изображении не прошли проверку формата или назначения.</p>}
            {!post.media && post.fallbackReason && <p>Текстовый вариант: <code>{post.fallbackReason}</code>.</p>}
          </article>)}
          {pages > 1 && <nav className="pagination" aria-label="Страницы журнала отправок">{page > 1 ? <Link href={href(page - 1)}>← Назад</Link> : <span aria-disabled="true">← Назад</span>}<span>Страница {page} из {pages}</span>{page < pages ? <Link href={href(page + 1)}>Вперёд →</Link> : <span aria-disabled="true">Вперёд →</span>}</nav>}
        </>}
  </section>;
}

import type { SiteCopyOperationRead } from "@/lib/site-copy-translation-operation-read";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { translationErrorMessage } from "@/lib/translation-errors";
import { recoverSiteCopyTranslationOperationAction } from "./site-copy-operation-actions";

export default function SiteCopyTranslationOperationReceiptPanel({ read, returnTo = "translations" }: {
  read: SiteCopyOperationRead; returnTo?: "site-copy" | "translations";
}) {
  const base = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH);
  if (read.status === "failed") return <section className="panel settings-stack" role="status">
    <h2>Перевод текстов сайта</h2><p>{translationErrorMessage(read.errorCode)}</p>
    <p>Состояние сохранённой попытки не подтверждено. Повторный платный запрос недоступен до проверки журнала.</p>
  </section>;
  const receipt = read.data;
  if (!receipt) return null;
  return <section className="panel settings-stack" aria-label="Сохранённая попытка перевода текстов сайта">
    <h2>Сохранённая попытка перевода текстов сайта</h2>
    <p role="status">{receipt.phase === "finished" ? "Учёт попытки завершён." : receipt.pendingCallId !== null
      ? "Исход последнего запроса не подтверждён. Повторная отправка остановлена."
      : "Попытка сохранена. Проверка журнала не отправляет новый запрос к модели."}
      {` Зарезервировано запросов к модели: ${receipt.providerCalls} из 4.`}</p>
    {receipt.blockReason === "operation_owned_by_another_actor" || !read.owned
      ? <p>Эта попытка принадлежит другому редактору. Доступны только сведения журнала.</p> : null}
    {receipt.blockReason === "operation_stopped" || receipt.blockReason === "operation_deadline"
      ? <p>Новые запросы этой попытки остановлены. Уже полученный полный результат можно проверить отдельно.</p> : null}
    {receipt.result?.persistence === "working-draft" && <p>В этой попытке был создан машинный кандидат.
      Его актуальное состояние и возможность подтверждения проверяются в редакторе текстов сайта.</p>}
    {receipt.result?.persistence === "private-artifact" && <p>Результат сохранён отдельно. Эта попытка не изменила тексты сайта и не запустила публикацию.</p>}
    {read.previewUnconfirmed && <p>Полный проверенный перевод пока не подтверждён. Сохранённые ответы остаются в попытке.</p>}
    <a href={`${base}/translations#translation-job-${encodeURIComponent(receipt.jobId)}`}>Открыть попытку в журнале</a>
    {returnTo !== "site-copy" && <a href={`${base}/site-copy?translation_operation=${encodeURIComponent(receipt.operationId)}`}>Проверить кандидат в редакторе текстов</a>}
    {read.owned && <form action={recoverSiteCopyTranslationOperationAction}>
      <input type="hidden" name="operation_id" value={receipt.operationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button className="button-secondary" type="submit">Проверить сохранённый результат</button>
      <small>Проверка использует сохранённые ответы и не отправляет новый запрос к модели.</small>
    </form>}
    {read.preview && <details><summary>Полученный перевод и исходный русский текст</summary>
      <p>Это сохранённый результат попытки. Подтверждение актуального кандидата выполняется отдельно ниже.</p>
      {read.preview.map(item => <div key={item.key} className="settings-stack">
        <strong>{item.key}</strong><p lang="ru">{item.source}</p><p lang="en">{item.text}</p>
      </div>)}
    </details>}
  </section>;
}

import Link from "next/link";

import type { CatalogTranslationOperationReceipt } from "@/lib/catalog-translation-operation-rpc";

export default function CatalogTranslationOperationReceiptPanel({ receipt }: { receipt: CatalogTranslationOperationReceipt }) {
  const message = receipt.blockReason === "provider_outcome_unknown"
    ? "Ответ провайдера не подтверждён. Новый запрос для этой карточки заблокирован до выяснения исхода."
    : receipt.blockReason === "operation_owned_by_another_actor"
    ? "С карточкой связана операция другого редактора. Проверьте её состояние в журнале."
    : receipt.blockReason === "operation_stopped" || receipt.result?.state === "cancelled"
    ? "В журнале отмечена отмена операции. Полученные ответы и итог проверяйте в журнале."
    : receipt.phase !== "finished"
    ? "Подтверждённого итогового результата пока нет. Проверьте запись в журнале."
    : receipt.result?.candidateHash
    ? "В квитанции зафиксировано приватное сохранение результата. Текущее состояние черновика проверяйте в карточке."
    : "Операция завершена без создания нового машинного черновика.";
  return <section className="panel" aria-label="Квитанция операции перевода">
    <h2>Операция перевода {receipt.entityType === "country" ? "страны" : "произведения"}</h2>
    <p role="status">{message}</p>
    {receipt.result?.candidateHash && <p>Эта операция не публиковала машинный результат. Для публикации требуется отдельное редакторское одобрение.</p>}
    <Link href={`/translations#translation-job-${receipt.jobId}`}>Открыть журнал переводов</Link>
  </section>;
}

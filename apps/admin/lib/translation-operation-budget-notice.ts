import type { TranslationOperationBudgetReason, TranslationOperationBudgetSnapshot } from "./translation-operation-budget";

export function translationOperationBudgetNotice(budget: TranslationOperationBudgetSnapshot, reason: TranslationOperationBudgetReason | null) {
  const reasons: Record<TranslationOperationBudgetReason, string> = {
    "attempt-limit": "достигнут лимит попыток",
    "provider-call-limit": "достигнут лимит запросов к провайдеру",
    deadline: "истекло время пакета",
    stopped: "получена команда остановки",
  };
  return ` Попыток перевода ${budget.attempts}, допущенных запросов к провайдеру ${budget.providerCalls}.` +
    (reason ? ` Пакет остановлен: ${reasons[reason]}. Для продолжения используйте текущую позицию.` : "");
}

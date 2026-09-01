export const translationErrorCodes = [
  "translation_not_configured",
  "database_unavailable",
  "database_read_failed",
  "database_write_failed",
  "invalid_input",
  "self_test_cooldown",
  "translation_migration_required",
  "provider_unavailable",
  "provider_request_failed",
  "provider_invalid_response",
  "source_changed",
  "write_conflict",
  "unexpected",
] as const;

export type TranslationErrorCode = (typeof translationErrorCodes)[number];

const messages: Record<TranslationErrorCode, string> = {
  translation_not_configured:
    "Провайдер перевода не подключён на сервере. Проверьте серверную конфигурацию.",
  database_unavailable: "База данных временно недоступна.",
  database_read_failed:
    "Не удалось безопасно прочитать данные для перевода. Повторите запуск позже.",
  database_write_failed:
    "Не удалось безопасно сохранить результат. Исходные данные не изменены.",
  invalid_input:
    "Проверьте заполнение полей: одно из значений не прошло безопасную проверку.",
  self_test_cooldown:
    "Контрольный запрос уже выполнялся недавно. Повторите self-test после окончания паузы.",
  translation_migration_required:
    "Для этого раздела ещё не применена обязательная миграция переводов.",
  provider_unavailable:
    "Сервис перевода временно недоступен. Повторите запуск позже.",
  provider_request_failed:
    "Провайдер не завершил перевод. Пакет остановлен без записи некорректного результата.",
  provider_invalid_response:
    "Ответ провайдера не прошёл редакционную проверку. Пакет безопасно остановлен.",
  source_changed:
    "Исходный материал изменился во время перевода. Запустите пакет ещё раз.",
  write_conflict:
    "Результат не сохранён из-за конфликта версий. Обновите страницу и повторите.",
  unexpected:
    "Перевод не завершён из-за внутренней ошибки. Некорректный результат не сохранён.",
};

export function translationErrorCode(
  error: unknown,
  fallback: TranslationErrorCode = "unexpected"
): TranslationErrorCode {
  const value =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = value.toLowerCase();
  if (!normalized) return fallback;
  if (
    normalized.includes("binding is not configured") ||
    normalized.includes("api_key is not configured") ||
    normalized.includes("not configured")
  ) {
    return "translation_not_configured";
  }
  if (
    normalized.includes("changed during translation") ||
    normalized.includes("source changed") ||
    normalized.includes("stale")
  ) {
    return "source_changed";
  }
  if (
    normalized.includes("editorial schema") ||
    normalized.includes("schema mismatch") ||
    normalized.includes("invalid shape") ||
    normalized.includes("invalid translation json") ||
    normalized.includes("contains cyrillic") ||
    normalized.includes("still contains cyrillic") ||
    normalized.includes("must contain") ||
    normalized.includes("changed protected") ||
    normalized.includes("changed keys") ||
    normalized.includes("changed a protected") ||
    normalized.includes("item count")
  ) {
    return "provider_invalid_response";
  }
  if (
    normalized.includes("request failed") ||
    normalized.includes("returned no") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("abort")
  ) {
    return "provider_request_failed";
  }
  if (normalized.includes("conflict") || normalized.includes("version")) {
    return "write_conflict";
  }
  return fallback;
}

export function translationErrorMessage(value: unknown) {
  const code = String(value || "") as TranslationErrorCode;
  return translationErrorCodes.includes(code) ? messages[code] : null;
}

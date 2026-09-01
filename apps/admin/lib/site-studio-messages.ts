import type { SiteStudioFormErrorCode } from "./site-studio-form";

export type SiteStudioActionErrorCode =
  | SiteStudioFormErrorCode
  | "site_studio_database_unavailable"
  | "site_studio_forbidden"
  | "site_studio_stale"
  | "site_studio_locked"
  | "site_studio_not_found"
  | "site_studio_token_save_failed"
  | "site_studio_change_set_save_failed"
  | "site_studio_stage_failed"
  | "site_studio_transition_failed"
  | "site_studio_publish_failed"
  | "site_studio_rollback_failed"
  | "site_studio_remove_failed";

const messages: Record<SiteStudioActionErrorCode, string> = {
  site_studio_id_invalid: "Некорректный идентификатор записи.",
  site_studio_identity_invalid: "Проверьте область и ключ настройки.",
  site_studio_value_invalid: "Значение не соответствует выбранному безопасному типу.",
  site_studio_version_invalid: "Версия записи устарела. Обновите страницу.",
  site_studio_change_set_invalid: "Проверьте название и описание набора изменений.",
  site_studio_database_unavailable: "База данных сейчас недоступна.",
  site_studio_forbidden: "Для этого действия недостаточно прав.",
  site_studio_stale: "Запись уже изменили в другой вкладке. Обновите страницу.",
  site_studio_locked: "Запись находится на проверке и временно недоступна для правки.",
  site_studio_not_found: "Запись не найдена или уже удалена.",
  site_studio_token_save_failed: "Не удалось сохранить токен дизайна.",
  site_studio_change_set_save_failed: "Не удалось сохранить набор изменений.",
  site_studio_stage_failed: "Не удалось добавить настройку в выпуск.",
  site_studio_transition_failed: "Не удалось изменить этап согласования.",
  site_studio_publish_failed: "Не удалось атомарно опубликовать выпуск.",
  site_studio_rollback_failed: "Не удалось выполнить групповой откат.",
  site_studio_remove_failed: "Не удалось убрать настройку из выпуска.",
};

export function siteStudioErrorMessage(value: unknown) {
  const code = typeof value === "string" ? value : "";
  return Object.hasOwn(messages, code)
    ? messages[code as SiteStudioActionErrorCode]
    : "Операция не выполнена. Обновите страницу и повторите попытку.";
}

export function siteStudioRpcErrorCode(
  error: { code?: string; message?: string } | null,
  fallback: SiteStudioActionErrorCode
): SiteStudioActionErrorCode {
  const message = error?.message || "";
  if (error?.code === "40001" || /(?:changed|stale|version)/iu.test(message)) {
    return "site_studio_stale";
  }
  if (error?.code === "42501") return "site_studio_forbidden";
  if (error?.code === "P0002" || error?.code === "23503") {
    return "site_studio_not_found";
  }
  if (error?.code === "55000" || /(?:immutable|locked|draft)/iu.test(message)) {
    return "site_studio_locked";
  }
  return fallback;
}

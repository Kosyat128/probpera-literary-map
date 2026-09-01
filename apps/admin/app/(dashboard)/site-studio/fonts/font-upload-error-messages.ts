"use client";

export const FONT_UPLOAD_ERROR_MESSAGES = {
  admin_access_required: "Требуется доступ администратора редакции.",
  display_name_required: "Название шрифта обязательно.",
  display_name_too_long: "Название шрифта не должно превышать 120 символов.",
  display_name_unsafe:
    "Название шрифта содержит недопустимую ссылку или CSS-конструкцию.",
  family_name_required: "Название семейства обязательно.",
  family_name_too_long:
    "Название семейства не должно превышать 120 символов.",
  family_name_unsafe:
    "Название семейства содержит недопустимую ссылку или CSS-конструкцию.",
  file_empty: "Выбранный файл шрифта пуст.",
  file_extension_invalid:
    "Допустимы только файлы WOFF2 (.woff2) и WOFF (.woff).",
  file_mime_invalid:
    "Тип файла не соответствует допустимому формату WOFF2 или WOFF.",
  file_name_invalid: "Имя файла шрифта недопустимо.",
  file_required: "Выберите локальный файл шрифта WOFF2 или WOFF.",
  file_signature_invalid: "Файл не прошёл проверку сигнатуры WOFF2 или WOFF.",
  file_size_mismatch:
    "Не удалось подтвердить размер файла шрифта. Выберите файл заново.",
  file_too_large: "Файл шрифта превышает допустимый размер 2 МБ.",
  fixed_weight_range_client:
    "Для обычного шрифта укажите одинаковую насыщенность от и до. Диапазон доступен вариативному шрифту.",
  fixed_weight_range_invalid:
    "Для обычного файла укажите одинаковую минимальную и максимальную насыщенность.",
  font_already_added: "Этот файл шрифта уже добавлен.",
  font_processing_failed: "Не удалось обработать файл шрифта.",
  font_registration_failed:
    "Не удалось зарегистрировать шрифт. Повторите попытку.",
  form_data_invalid: "Передайте файл шрифта и его описание.",
  license_name_required: "Укажите название лицензии или основание использования.",
  license_name_too_long:
    "Название лицензии не должно превышать 180 символов.",
  license_url_invalid:
    "Укажите корректную ссылку на лицензию (http или https).",
  license_url_too_long: "Ссылка на лицензию слишком длинная.",
  metadata_invalid: "Проверьте данные шрифта.",
  metadata_weight_integer:
    "Насыщенность шрифта должна быть целым числом от 1 до 1000.",
  remote_font_forbidden:
    "Загрузка шрифтов по внешней ссылке или через CSS-импорт запрещена.",
  storage_unavailable: "Хранилище шрифтов временно недоступно.",
  storage_write_failed: "Не удалось сохранить файл шрифта. Повторите попытку.",
  style_invalid: "Выберите допустимое начертание шрифта.",
  variable_flag_invalid: "Укажите, является ли шрифт вариативным.",
  weight_max_integer: "Максимальная насыщенность должна быть целым числом.",
  weight_max_range: "Максимальная насыщенность должна быть от 1 до 1000.",
  weight_min_integer: "Минимальная насыщенность должна быть целым числом.",
  weight_min_range: "Минимальная насыщенность должна быть от 1 до 1000.",
  weight_order_invalid:
    "Минимальная насыщенность не может быть больше максимальной.",
} as const;

export function fontUploadErrorMessage(errorCode: unknown) {
  if (
    typeof errorCode === "string" &&
    Object.prototype.hasOwnProperty.call(FONT_UPLOAD_ERROR_MESSAGES, errorCode)
  ) {
    return FONT_UPLOAD_ERROR_MESSAGES[
      errorCode as keyof typeof FONT_UPLOAD_ERROR_MESSAGES
    ];
  }
  return "Не удалось загрузить шрифт.";
}

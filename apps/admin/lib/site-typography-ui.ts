"use client";

import {
  readSiteTypographyProperties,
  siteTypographyPropertyKeys,
  typographyLayers,
  type SiteTypographyErrorCode,
  type SiteTypographyOverride,
  type SiteTypographyProperties,
  type SiteTypographyResolutionContext,
  type TypographyBreakpoint,
  type TypographyLayer,
  type TypographySemanticScope,
  type TypographySystemFamily,
} from "./site-typography";

export const TYPOGRAPHY_ERROR_MESSAGES = {
  typography_target_invalid: "Некорректная область оформления.",
  typography_value_invalid: "Недопустимое значение параметра типографики.",
  typography_target_key_invalid:
    "Ключ области должен начинаться с латинской буквы или цифры и содержать только a-z, 0-9, _ или -.",
  typography_site_key_invalid:
    "Для уровня всего сайта ключ области должен быть «site».",
  typography_settings_invalid: "Некорректные параметры типографики.",
  typography_property_unknown: "Передано неизвестное CSS-свойство.",
  typography_font_id_invalid: "Выбран неизвестный файл шрифта.",
  typography_number_invalid:
    "Числовой параметр типографики вне допустимого диапазона.",
  typography_font_source_conflict:
    "Выберите либо загруженный, либо системный шрифт.",
  typography_family_kind_invalid: "Выбран неизвестный источник шрифта.",
  typography_asset_required: "Выберите шрифт из менеджера шрифтов.",
  typography_system_required: "Выберите системный шрифт.",
  typography_version_invalid: "Версия настройки устарела или повреждена.",
  typography_id_invalid: "Некорректный идентификатор.",
  typography_request_invalid: "Проверьте данные типографики.",
  typography_empty:
    "Укажите хотя бы один параметр. Чтобы убрать настройку, используйте «Сбросить».",
  typography_stale:
    "Настройка уже изменена в другой вкладке. Обновите страницу и повторите действие.",
  typography_font_in_use:
    "Шрифт используется в настройках или истории типографики и не может быть архивирован.",
  typography_forbidden: "Недостаточно прав для этого действия.",
  typography_database_unavailable: "База данных не подключена.",
  typography_save_failed: "Не удалось сохранить настройку.",
  typography_reset_failed: "Не удалось сбросить настройку.",
  typography_reset_publish_failed:
    "Сброс сохранён как черновик, но опубликовать его не удалось.",
  typography_publish_failed: "Не удалось опубликовать настройку.",
  typography_revision_invalid: "Некорректная версия истории.",
  typography_restore_failed: "Не удалось восстановить версию.",
  typography_font_archive_failed: "Не удалось архивировать шрифт.",
} as const satisfies Record<SiteTypographyErrorCode, string>;

export function typographyErrorMessage(errorCode: unknown) {
  if (
    typeof errorCode === "string" &&
    Object.prototype.hasOwnProperty.call(TYPOGRAPHY_ERROR_MESSAGES, errorCode)
  ) {
    return TYPOGRAPHY_ERROR_MESSAGES[
      errorCode as keyof typeof TYPOGRAPHY_ERROR_MESSAGES
    ];
  }
  return "Не удалось выполнить действие с типографикой.";
}

export const typographyScopeLabels: Record<TypographySemanticScope, string> = {
  body: "Основной текст",
  navigation: "Навигация",
  h1: "Заголовок H1",
  h2: "Заголовок H2",
  h3: "Заголовок H3",
  h4: "Заголовок H4",
  h5: "Заголовок H5",
  h6: "Заголовок H6",
  article: "Текст статьи",
  page: "Текст страницы",
  lead: "Лид",
  quote: "Цитата",
  caption: "Подпись",
  button: "Кнопка",
  card: "Карточка",
  footer: "Подвал",
};

export const typographyLayerLabels: Record<TypographyLayer, string> = {
  site: "Весь сайт",
  component: "Компонент",
  template: "Шаблон",
  page: "Страница",
  instance: "Отдельный элемент",
};

export const typographyBreakpointLabels: Record<TypographyBreakpoint, string> = {
  base: "Все экраны",
  mobile: "Телефон",
  tablet: "Планшет",
  desktop: "Компьютер",
};

export const typographySystemFamilyLabels: Record<
  TypographySystemFamily,
  string
> = {
  "system-sans": "Системный без засечек",
  "system-serif": "Системный с засечками",
  georgia: "Georgia",
  arial: "Arial",
  times: "Times New Roman",
};

export function typographyPropertyFormValues(
  input: unknown
): Record<(typeof siteTypographyPropertyKeys)[number], string> {
  const settings = readSiteTypographyProperties(input);
  return Object.fromEntries(
    siteTypographyPropertyKeys.map((key) => [
      key,
      settings[key] === undefined ? "" : String(settings[key]),
    ])
  ) as Record<(typeof siteTypographyPropertyKeys)[number], string>;
}

/** Resolves the client preview without adding presentation data to the Worker. */
export function resolveSiteTypography(
  overrides: readonly SiteTypographyOverride[],
  context: SiteTypographyResolutionContext
) {
  const resolved: SiteTypographyProperties = {};
  for (const layer of typographyLayers) {
    const expectedTarget =
      layer === "site" ? "site" : context.targetKeys?.[layer];
    if (!expectedTarget) continue;
    const breakpoints: TypographyBreakpoint[] =
      context.breakpoint === "base"
        ? ["base"]
        : ["base", context.breakpoint];
    for (const breakpoint of breakpoints) {
      for (const override of overrides) {
        if (
          override.layer === layer &&
          override.targetKey === expectedTarget &&
          override.semanticScope === context.semanticScope &&
          override.breakpoint === breakpoint
        ) {
          const settings = readSiteTypographyProperties(override.settings);
          // A later family source replaces the earlier source as one property.
          // Keeping both would make a stale uploaded font beat a system override.
          if (settings.familyId) delete resolved.systemFamily;
          if (settings.systemFamily) delete resolved.familyId;
          Object.assign(resolved, settings);
        }
      }
    }
  }
  return resolved;
}

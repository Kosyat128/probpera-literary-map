import {
  readAdminCatalogText,
  type AdminCatalogReadOptions,
} from "./admin-catalog-assets";

export type SiteCopyDefinition = {
  key: string;
  group: string;
  label: string;
  defaultRu: string;
  defaultEn?: string;
  multiline?: boolean;
};

const curatedSiteCopyDefinitions = [
  { key: "chrome.brand.subtitle", group: "Шапка и навигация", label: "Подпись под логотипом", defaultRu: "Литературный журнал" },
  { key: "chrome.nav.planet", group: "Шапка и навигация", label: "Пункт «Литературная планета»", defaultRu: "Литературная планета", defaultEn: "Literary Planet" },
  { key: "chrome.nav.sections", group: "Шапка и навигация", label: "Пункт «Разделы»", defaultRu: "Разделы" },
  { key: "chrome.nav.calendar", group: "Шапка и навигация", label: "Пункт «Календарь»", defaultRu: "Календарь" },
  { key: "chrome.nav.forum", group: "Шапка и навигация", label: "Пункт «Форум»", defaultRu: "Форум" },
  { key: "chrome.nav.about", group: "Шапка и навигация", label: "Пункт «О проекте»", defaultRu: "О проекте" },
  { key: "chrome.nav.search", group: "Шапка и навигация", label: "Кнопка поиска", defaultRu: "Поиск" },
  { key: "chrome.sections.eyebrow", group: "Шапка и навигация", label: "Надзаголовок меню разделов", defaultRu: "Навигация по «Пробе Пера»" },
  { key: "chrome.sections.title", group: "Шапка и навигация", label: "Заголовок меню разделов", defaultRu: "Все темы и разделы сайта" },
  { key: "chrome.sections.description", group: "Шапка и навигация", label: "Описание меню разделов", defaultRu: "От редакционных статей до мировой литературной энциклопедии.", multiline: true },
  { key: "chrome.sections.action", group: "Шапка и навигация", label: "Кнопка каталога", defaultRu: "Открыть интерактивный каталог" },

  { key: "home.hero.secondary_action", group: "Главная", label: "Вторая кнопка первого экрана", defaultRu: "Читать журнал" },
  { key: "home.hero.cover_badge", group: "Главная", label: "Подпись под изображением журнала", defaultRu: "Литературный журнал · с 2025 года" },
  { key: "home.hero.metric.countries", group: "Главная", label: "Подпись счётчика стран", defaultRu: "стран" },
  { key: "home.hero.metric.writers", group: "Главная", label: "Подпись счётчика писателей", defaultRu: "писателей" },
  { key: "home.hero.metric.works", group: "Главная", label: "Подпись счётчика произведений", defaultRu: "произведений" },
  { key: "home.atlas.search_label", group: "Главная", label: "Подпись поиска по планете", defaultRu: "Найти страну, писателя или книгу" },
  { key: "home.atlas.search_placeholder", group: "Главная", label: "Пример поиска", defaultRu: "Россия, Достоевский, «Моби Дик»…" },
  { key: "home.atlas.filters_label", group: "Главная", label: "Доступное имя фильтров", defaultRu: "Фильтры глобуса" },
  { key: "home.atlas.filter.all", group: "Главная", label: "Фильтр всех стран", defaultRu: "Все страны" },
  { key: "home.atlas.filter.nobel", group: "Главная", label: "Фильтр лауреатов", defaultRu: "Нобелевские лауреаты" },
  { key: "home.atlas.filter.rich", group: "Главная", label: "Фильтр больших архивов", defaultRu: "10+ авторов" },
  { key: "home.atlas.filter.portrait", group: "Главная", label: "Фильтр портретов", defaultRu: "С реальными портретами" },
  { key: "home.atlas.filter.verified", group: "Главная", label: "Фильтр стран с проверенными карточками", defaultRu: "Страны с проверенными карточками" },
  { key: "home.atlas.archives", group: "Главная", label: "Кнопка крупнейших архивов", defaultRu: "Крупнейшие архивы" },
  { key: "home.atlas.globe_kicker", group: "Главная", label: "Подпись над глобусом", defaultRu: "Интерактивный глобус · ручная навигация" },

  { key: "globe.loading", group: "Глобус", label: "Загрузка глобуса", defaultRu: "Готовим интерактивный глобус…" },
  { key: "globe.unavailable", group: "Глобус", label: "Ошибка глобуса", defaultRu: "Литературная планета временно недоступна" },
  { key: "globe.text_fallback", group: "Глобус", label: "Текстовый запасной режим", defaultRu: "Используйте текстовый указатель стран ниже" },
  { key: "globe.edition.group", group: "Глобус", label: "Название переключателя издания", defaultRu: "Издание глобуса" },
  { key: "globe.style.antique", group: "Глобус", label: "Старинный стиль", defaultRu: "Старинный" },
  { key: "globe.style.classic", group: "Глобус", label: "Классический стиль", defaultRu: "Классический" },
  { key: "globe.style.modern", group: "Глобус", label: "Современный стиль", defaultRu: "Современный" },
  { key: "globe.classic_badge", group: "Глобус", label: "Плашка классического атласа", defaultRu: "Классический атлас · 2026" },
  { key: "globe.classic_badge_title", group: "Глобус", label: "Описание классического атласа", defaultRu: "Классический картографический атлас, редакция 2026 года. Картография: Natural Earth.", multiline: true },
  { key: "globe.instruction.rotate", group: "Глобус", label: "Подсказка вращения", defaultRu: "Тяните или используйте стрелки" },
  { key: "globe.laureate.open_card", group: "Глобус", label: "Подсказка карточки лауреата", defaultRu: "Нажмите на метку - откроется карточка лауреата", multiline: true },

  { key: "popup.search.eyebrow", group: "Всплывающие панели", label: "Надзаголовок общего поиска", defaultRu: "Единый каталог" },
  { key: "popup.search.title", group: "Всплывающие панели", label: "Заголовок общего поиска", defaultRu: "Найти в «Пробе Пера»" },
  { key: "popup.search.close", group: "Всплывающие панели", label: "Описание кнопки закрытия", defaultRu: "Закрыть поиск" },
  { key: "popup.search.placeholder", group: "Всплывающие панели", label: "Подсказка поля поиска", defaultRu: "Страна, писатель, книга, статья, эпоха…" },
  { key: "popup.search.intro", group: "Всплывающие панели", label: "Описание возможностей поиска", defaultRu: "Поиск одновременно проверяет страны, писателей, произведения и редакционные публикации.", multiline: true },
  { key: "popup.search.loading", group: "Всплывающие панели", label: "Загрузка результатов", defaultRu: "Ищем во всём архиве…" },
  { key: "popup.search.empty", group: "Всплывающие панели", label: "Нет результатов", defaultRu: "Совпадений не найдено" },
  { key: "popup.search.empty_hint", group: "Всплывающие панели", label: "Совет при пустом поиске", defaultRu: "Попробуйте фамилию, название произведения или другую форму слова.", multiline: true },
  { key: "popup.search.private_note", group: "Всплывающие панели", label: "Подпись поиска", defaultRu: "Поиск выполняется внутри сайта" },

  { key: "footer.brand.description", group: "Подвал", label: "Описание журнала", defaultRu: "Авторские статьи и единая интерактивная экосистема о мировой литературе: страны, писатели, книги, эпохи и разговор читателей.", multiline: true },
  { key: "footer.copyright", group: "Подвал", label: "Текст об авторских правах", defaultRu: "Авторские публикации защищены законом." },
  { key: "footer.independent", group: "Подвал", label: "Нижняя подпись", defaultRu: "Независимый литературный журнал" },
] as const satisfies readonly SiteCopyDefinition[];

export const siteCopyCatalog: readonly SiteCopyDefinition[] =
  curatedSiteCopyDefinitions.map((definition) => ({
    ...definition,
    key: `interface.${definition.defaultRu}`,
  }));

let cachedAllSiteCopyCatalog: readonly SiteCopyDefinition[] | null = null;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validatedText(
  value: unknown,
  field: string,
  maximumLength: number
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maximumLength
  ) {
    throw new Error(`Interface copy catalog has an invalid ${field}`);
  }
  return value;
}

export function parseInterfaceCopyCatalog(
  source: string
): readonly SiteCopyDefinition[] {
  const raw = JSON.parse(source);
  if (!Array.isArray(raw) || raw.length < 100) {
    throw new Error("Interface copy catalog is unexpectedly incomplete");
  }
  const keys = new Set<string>();
  return raw.map((candidate) => {
    const definition = objectValue(candidate);
    if (!definition) {
      throw new Error("Interface copy catalog has an invalid definition");
    }
    const key = validatedText(definition.key, "key", 1_200);
    if (!/^(?:interface|country|globe)\./u.test(key)) {
      throw new Error(`Interface copy catalog has an invalid key: ${key}`);
    }
    if (keys.has(key)) {
      throw new Error(`Interface copy catalog has a duplicate key: ${key}`);
    }
    keys.add(key);
    const defaultEn =
      typeof definition.defaultEn === "string"
        ? definition.defaultEn
        : undefined;
    return {
      key,
      group: validatedText(definition.group, "group", 300),
      label: validatedText(definition.label, "label", 2_000),
      defaultRu: validatedText(definition.defaultRu, "defaultRu", 4_000),
      ...(defaultEn === undefined ? {} : { defaultEn }),
      ...(definition.multiline === true ? { multiline: true } : {}),
    };
  });
}

function mergeWithCuratedCatalog(
  generated: readonly SiteCopyDefinition[]
): readonly SiteCopyDefinition[] {
  const curatedSourceTexts = new Set(
    siteCopyCatalog.map((definition) => definition.defaultRu)
  );
  const merged = [
    ...siteCopyCatalog,
    ...generated.filter(
      (definition) => !curatedSourceTexts.has(definition.defaultRu)
    ),
  ];
  const keys = merged.map((definition) => definition.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Interface copy catalog has duplicate merged keys");
  }
  return merged;
}

export async function loadAllSiteCopyCatalog(
  options?: AdminCatalogReadOptions
): Promise<readonly SiteCopyDefinition[]> {
  if (options) {
    return mergeWithCuratedCatalog(
      parseInterfaceCopyCatalog(
        await readAdminCatalogText("interface-copy-catalog.json", options)
      )
    );
  }
  if (cachedAllSiteCopyCatalog) {
    return cachedAllSiteCopyCatalog;
  }
  const catalog = mergeWithCuratedCatalog(
    parseInterfaceCopyCatalog(
      await readAdminCatalogText("interface-copy-catalog.json")
    )
  );
  cachedAllSiteCopyCatalog = catalog;
  return catalog;
}

export async function loadAllSiteCopyKeys(options?: AdminCatalogReadOptions) {
  return new Set(
    (await loadAllSiteCopyCatalog(options)).map(
      (definition) => definition.key
    )
  );
}

export async function loadSiteCopyDefinitionByKey(
  options?: AdminCatalogReadOptions
) {
  return new Map(
    (await loadAllSiteCopyCatalog(options)).map((definition) => [
      definition.key,
      definition,
    ])
  );
}

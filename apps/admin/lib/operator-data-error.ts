export type OperatorDataArea =
  | "articles"
  | "banners"
  | "categories"
  | "history"
  | "homepage"
  | "menus"
  | "pages"
  | "publication";

export type OperatorDataOperation =
  | "audit"
  | "create"
  | "delete"
  | "load"
  | "publish"
  | "restore"
  | "save";

const areaLabels: Record<OperatorDataArea, string> = {
  articles: "статьи",
  banners: "баннеры",
  categories: "рубрики и теги",
  history: "историю изменений",
  homepage: "главную страницу",
  menus: "меню",
  pages: "страницы",
  publication: "очередь публикации",
};

const operationLabels: Record<OperatorDataOperation, string> = {
  audit: "записать действие в журнал",
  create: "создать запись",
  delete: "удалить запись",
  load: "загрузить",
  publish: "отправить изменения на публикацию",
  restore: "восстановить версию",
  save: "сохранить изменения",
};

/** Stable operator copy: intentionally accepts no provider/database error. */
export function operatorDataError(
  area: OperatorDataArea,
  operation: OperatorDataOperation
) {
  return `Не удалось ${operationLabels[operation]}: ${areaLabels[area]}. Обновите страницу или повторите позже.`;
}

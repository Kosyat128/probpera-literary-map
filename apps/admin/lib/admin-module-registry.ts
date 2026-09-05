export type AdminNavigationEntry = readonly [
  icon: string,
  label: string,
  href: string,
];

export type AdminModule = {
  entry: AdminNavigationEntry;
  sidebar: boolean;
  operatorNote?: string;
};

// Canonical operator-facing registry. AdminShell and the command palette must
// consume this list instead of maintaining independent route inventories.
export const adminModuleRegistry = [
  { entry: ["⌂", "Обзор", "/dashboard"], sidebar: true },
  { entry: ["✎", "Статьи", "/articles"], sidebar: true },
  { entry: ["◷", "Литературная сводка", "/literary-news"], sidebar: true },
  { entry: ["＋", "Новая статья", "/articles/new"], sidebar: false },
  { entry: ["◉", "Студия данных", "/data-studio"], sidebar: true },
  { entry: ["▥", "Произведения и издания", "/library"], sidebar: true },
  { entry: ["▥", "Редакционные досье книг", "/library/dossiers"], sidebar: false },
  { entry: ["◎", "Страны и авторы", "/editorial-database"], sidebar: true },
  { entry: ["EN", "Premium English", "/translations"], sidebar: true },
  { entry: ["▤", "Рубрики и теги", "/categories"], sidebar: true },
  { entry: ["▧", "Медиатека", "/media"], sidebar: true },
  { entry: ["◫", "Страницы", "/pages"], sidebar: true },
  { entry: ["⌘", "Главная страница", "/homepage"], sidebar: true },
  { entry: ["Aa", "Тексты сайта", "/site-copy"], sidebar: true },
  { entry: ["✦", "Студия сайта", "/site-studio"], sidebar: true },
  { entry: ["▦", "Компоненты сайта", "/site-studio/components"], sidebar: false },
  { entry: ["◈", "Токены дизайна", "/site-studio/tokens"], sidebar: false },
  { entry: ["Ff", "Шрифты сайта", "/site-studio/fonts"], sidebar: false },
  { entry: ["⇥", "Выпуски дизайна", "/site-studio/releases"], sidebar: false },
  { entry: ["▱", "Баннеры", "/banners"], sidebar: true },
  { entry: ["☷", "Меню", "/menus"], sidebar: true },
  { entry: ["◌", "Комментарии", "/comments"], sidebar: true },
  { entry: ["⌁", "Статистика", "/analytics"], sidebar: true },
  { entry: ["⚕", "Состояние сайта", "/health"], sidebar: true },
  { entry: ["⇧", "Публикация", "/publication"], sidebar: true },
  { entry: ["◎", "SEO и адреса", "/seo"], sidebar: true },
  { entry: ["⚙", "Настройки", "/settings"], sidebar: true },
  { entry: ["↺", "История изменений", "/history"], sidebar: true },
] as const satisfies readonly AdminModule[];

export const adminSidebarEntries = adminModuleRegistry
  .filter((module) => module.sidebar)
  .map((module) => module.entry);

export const adminCommandEntries = adminModuleRegistry.map(
  (module) => module.entry
);

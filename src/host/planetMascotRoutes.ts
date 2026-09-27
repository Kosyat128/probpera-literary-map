export type PlanetMascotRoute = "overview" | "country-to-book";
export type PlanetMascotAction = "search" | "country" | "writer" | "books" | "writer-books" | "appearance" | "return-globe"
  | "random-country" | "recent" | "downloads" | "graphics" | "writer-books-all";
export type PlanetMascotTarget = "search" | "country" | "writer" | "books" | "appearance";
export type PlanetMascotScreen = "globe" | "collection";
export type PlanetMascotCopy = Readonly<{ ru: string; en: string }>;
export type PlanetMascotStep = Readonly<{
  id: string;
  title: PlanetMascotCopy;
  body: PlanetMascotCopy;
  action: PlanetMascotAction | null;
  actionLabel: PlanetMascotCopy | null;
  target: PlanetMascotTarget;
  requiredScreen: PlanetMascotScreen | null;
  requirement: "none" | "country" | "writer" | "collection";
}>;
export type PlanetMascotRouteDefinition = Readonly<{
  version: number;
  title: PlanetMascotCopy;
  steps: readonly PlanetMascotStep[];
}>;

const copy = (ru: string, en: string): PlanetMascotCopy => Object.freeze({ ru, en });
const step = (value: PlanetMascotStep): PlanetMascotStep => Object.freeze(value);

/** Authored navigation instructions only. The App resolves semantic targets to
 * existing visible controls; this module never selects DOM or invents content. */
export const PLANET_MASCOT_ROUTES: Readonly<Record<PlanetMascotRoute, PlanetMascotRouteDefinition>> = Object.freeze({
  overview: Object.freeze({
    version: 1,
    title: copy("Знакомство с приложением", "Meet the app"),
    steps: Object.freeze([
      step({ id: "search", title: copy("Найдите интересное", "Find something to read"),
        body: copy("Откройте поиск, чтобы найти страну, писателя или книгу.",
          "Open search to find a country, writer or book."),
        action: "search", actionLabel: copy("Открыть поиск", "Open search"), target: "search",
        requiredScreen: "globe", requirement: "none" }),
      step({ id: "country", title: copy("Исследуйте страну", "Explore a country"),
        body: copy("Выберите страну на глобусе или через поиск. В её архиве можно выбрать писателя.",
          "Choose a country on the globe or through search. Its archive lets you choose a writer."),
        action: "country", actionLabel: copy("К странам", "Explore countries"), target: "country",
        requiredScreen: "globe", requirement: "none" }),
      step({ id: "collection", title: copy("Откройте коллекцию", "Open the collection"),
        body: copy("В коллекции можно искать книги и открывать их карточки. Перейдите туда, чтобы продолжить.",
          "Browse books and open their details in the collection. Open it to continue."),
        action: "books", actionLabel: copy("К книгам", "Explore books"), target: "books",
        requiredScreen: "collection", requirement: "collection" }),
      step({ id: "appearance", title: copy("Оформите глобус", "Choose the globe's appearance"),
        body: copy("Вернитесь к глобусу и откройте «Оформление». Можно примерить подставку и фон, затем применить выбор или отменить его.",
          "Return to the globe and open Appearance. Preview a stand and background, then apply your choice or cancel."),
        action: "appearance", actionLabel: copy("Открыть оформление", "Open Appearance"),
        target: "appearance", requiredScreen: "globe", requirement: "none" }),
    ]),
  }),
  "country-to-book": Object.freeze({
    version: 1,
    title: copy("От страны к книгам", "From a country to books"),
    steps: Object.freeze([
      step({ id: "choose-country", title: copy("Выберите страну", "Choose a country"),
        body: copy("Выберите страну на глобусе или найдите её через поиск. После выбора станет доступен следующий шаг.",
          "Choose a country on the globe or find it through search. Then you can go to the next step."),
        action: "country", actionLabel: copy("Выбрать страну", "Choose a country"), target: "country",
        requiredScreen: "globe", requirement: "country" }),
      step({ id: "choose-writer", title: copy("Выберите писателя", "Choose a writer"),
        body: copy("Откройте архив выбранной страны и выберите писателя из списка.",
          "Open the selected country's archive and choose a writer from the list."),
        action: "writer", actionLabel: copy("К писателям страны", "Show country writers"), target: "writer",
        requiredScreen: "globe", requirement: "writer" }),
      step({ id: "open-books", title: copy("Продолжите с книгами", "Continue with books"),
        body: copy("Откройте книги выбранного писателя в коллекции. Завершить маршрут можно, когда они будут показаны.",
          "Open the selected writer's books in the collection. You can finish the tour when they are shown."),
        action: "books", actionLabel: copy("К книгам", "Explore books"), target: "books",
        requiredScreen: "collection", requirement: "collection" }),
    ]),
  }),
});

export function getPlanetMascotStep(route: PlanetMascotRoute | null, index: number): PlanetMascotStep | null {
  if (route !== "overview" && route !== "country-to-book") return null;
  if (!Number.isSafeInteger(index) || index < 0) return null;
  return PLANET_MASCOT_ROUTES[route].steps[index] ?? null;
}

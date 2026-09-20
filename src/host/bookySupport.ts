import type { Connectivity } from "../platform/ports";
import type { PlanetMascotCopy, PlanetMascotScreen } from "./planetMascotRoutes";

export type BookySupportContentStatus = "idle" | "loading" | "ready" | "error";
export type BookySupportInput = Readonly<{
  connectivity: Connectivity;
  screen: PlanetMascotScreen;
  countryStatus: BookySupportContentStatus;
  booksStatus: BookySupportContentStatus;
}>;
export type BookySupport = Readonly<{
  id: "countries-error" | "books-error" | "countries-loading" | "books-loading" | "offline" | "network-unknown";
  kind: "error" | "loading" | "connectivity";
  title: PlanetMascotCopy;
  body: PlanetMascotCopy;
  retry: "countries" | "books" | null;
}>;

/** Adult interface guidance only; this is not reviewed literary dialogue or
 * evidence of child, editorial or release acceptance. */
export const BOOKY_SUPPORT_COPY_METADATA = Object.freeze({ status: "draft", releaseReady: false } as const);

const copy = (ru: string, en: string): PlanetMascotCopy => Object.freeze({ ru, en });
const support = (value: BookySupport): BookySupport => Object.freeze(value);
const countriesError = support({
  id: "countries-error", kind: "error", retry: "countries",
  title: copy("Не удалось открыть страны", "Countries could not be opened"),
  body: copy("Попробуйте ещё раз. Без сети можно открыть только материалы, уже доступные на устройстве.",
    "Try again. Without a connection, only materials already available on this device can be opened."),
});
const booksError = support({
  id: "books-error", kind: "error", retry: "books",
  title: copy("Не удалось открыть коллекцию", "The collection could not be opened"),
  body: copy("Попробуйте ещё раз. Без сети можно открыть только материалы, уже доступные на устройстве.",
    "Try again. Without a connection, only materials already available on this device can be opened."),
});
const countriesLoading = support({
  id: "countries-loading", kind: "loading", retry: null,
  title: copy("Открываем страны", "Opening countries"),
  body: copy("Материалы ещё загружаются. Дождитесь результата, чтобы выбрать страну.",
    "Materials are still loading. Wait for the result before choosing a country."),
});
const booksLoading = support({
  id: "books-loading", kind: "loading", retry: null,
  title: copy("Открываем коллекцию", "Opening the collection"),
  body: copy("Книги ещё загружаются. Дождитесь результата, чтобы выбрать книгу.",
    "Books are still loading. Wait for the result before choosing a book."),
});
const offline = support({
  id: "offline", kind: "connectivity", retry: null,
  title: copy("Сейчас нет подключения", "Currently offline"),
  body: copy("Можно пользоваться только материалами, уже доступными на устройстве. Для загрузки новых материалов потребуется сеть.",
    "You can use only materials already available on this device. Loading new materials needs a connection."),
});
const unknown = support({
  id: "network-unknown", kind: "connectivity", retry: null,
  title: copy("Подключение пока не определено", "Connection status is unknown"),
  body: copy("Пока неизвестно, есть ли подключение. Попробуйте открыть нужный материал. Если он недоступен, проверьте сеть.",
    "It is not yet known whether there is a connection. Try opening the material you need. If it is unavailable, check your connection."),
});

/** A read-only view of existing host state. It never checks the network, starts
 * a retry or navigation, changes permissions, or promises offline retention.
 * The host remains responsible for accepting an explicit recovery action. */
export function getBookySupport(input: BookySupportInput): BookySupport | null {
  if (input.screen === "collection" && input.booksStatus === "error") return booksError;
  // Country data is shared by the globe, search and collection. Its failure
  // remains relevant while the visible collection is still loading.
  if (input.countryStatus === "error") return countriesError;
  if (input.screen === "collection" && input.booksStatus === "loading") return booksLoading;
  if (input.countryStatus === "loading") return countriesLoading;
  if (input.connectivity === "offline") return offline;
  if (input.connectivity === "unknown") return unknown;
  return null;
}

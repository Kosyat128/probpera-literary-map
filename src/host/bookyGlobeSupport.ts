import { getBookySupport, type BookySupport, type BookySupportInput } from "./bookySupport";
import type { PlanetMascotCopy } from "./planetMascotRoutes";

/** New adult interface copy only. Outside the historical dialogue inventory;
 * not reviewed literary dialogue, child guidance or approved narration. */
export const BOOKY_GLOBE_SUPPORT_COPY_METADATA = Object.freeze({
  status: "draft", humanReviewed: false, childApproved: false, narrationApproved: false, releaseReady: false,
} as const);

type GlobeDisplaySupport = Readonly<{
  id: "globe-unavailable";
  kind: "error" | "loading";
  title: PlanetMascotCopy;
  body: PlanetMascotCopy;
  retry: null;
  restart?: "books";
}>;
const globeUnavailable: GlobeDisplaySupport = Object.freeze({
  id: "globe-unavailable", kind: "error", retry: null,
  title: Object.freeze({ ru: "Отображение глобуса временно недоступно", en: "The globe display is temporarily unavailable" }),
  body: Object.freeze({
    ru: "Попробуйте поиск или откройте коллекцию. Без сети можно открыть только материалы, уже доступные на устройстве.",
    en: "Try search or open the collection. Without a connection, only materials already available on this device can be opened.",
  }),
});

const globeLoading: GlobeDisplaySupport = Object.freeze({
  id: "globe-unavailable", kind: "loading", retry: null,
  title: Object.freeze({ ru: "Глобус ещё загружается", en: "The globe is still loading" }),
  body: Object.freeze({
    ru: "Пока можно воспользоваться поиском или открыть коллекцию. Без сети можно открыть только материалы, уже доступные на устройстве.",
    en: "You can use search or open the collection while you wait. Without a connection, only materials already available on this device can be opened.",
  }),
});
const globeLoadError: GlobeDisplaySupport = Object.freeze({
  id: "globe-unavailable", kind: "error", retry: null,
  title: Object.freeze({ ru: "Глобус не удалось загрузить", en: "The globe could not be loaded" }),
  body: Object.freeze({
    ru: "Повторите загрузку кнопкой в области глобуса. Также можно воспользоваться поиском или открыть коллекцию. Без сети можно открыть только материалы, уже доступные на устройстве.",
    en: "Use the button in the globe area to try loading again. You can also use search or open the collection. Without a connection, only materials already available on this device can be opened.",
  }),
});

/** The host reports committed load state or known display loss. Unknown and
 * idle do not imply failure. The real globe retains its retry ownership. */
export function getBookyGlobeSupport(input: BookySupportInput & Readonly<{
  globeDisplayUnavailable?: boolean;
  globeLoadStatus?: BookySupportInput["countryStatus"] | null;
}>): BookySupport | GlobeDisplaySupport | null {
  const existing = getBookySupport(input);
  if (existing?.kind === "error" || existing?.kind === "loading") return existing;
  if (input.screen === "globe") {
    if (input.globeDisplayUnavailable === true) return globeUnavailable;
    if (input.globeLoadStatus === "error") return globeLoadError;
    if (input.globeLoadStatus === "loading") return globeLoading;
  }
  return existing;
}

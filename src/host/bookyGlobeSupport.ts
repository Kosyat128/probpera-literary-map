import { getBookySupport, type BookySupport, type BookySupportInput } from "./bookySupport";
import type { PlanetMascotCopy } from "./planetMascotRoutes";

/** New adult interface copy only. Outside the historical dialogue inventory;
 * not reviewed literary dialogue, child guidance or approved narration. */
export const BOOKY_GLOBE_SUPPORT_COPY_METADATA = Object.freeze({
  status: "draft", humanReviewed: false, childApproved: false, narrationApproved: false, releaseReady: false,
} as const);

type GlobeUnavailableSupport = Readonly<{
  id: "globe-unavailable";
  kind: "error";
  title: PlanetMascotCopy;
  body: PlanetMascotCopy;
  retry: null;
}>;
const globeUnavailable: GlobeUnavailableSupport = Object.freeze({
  id: "globe-unavailable", kind: "error", retry: null,
  title: Object.freeze({ ru: "Отображение глобуса временно недоступно", en: "The globe display is temporarily unavailable" }),
  body: Object.freeze({
    ru: "Попробуйте поиск или откройте коллекцию. Без сети можно открыть только материалы, уже доступные на устройстве.",
    en: "Try search or open the collection. Without a connection, only materials already available on this device can be opened.",
  }),
});

/** The host supplies a known display loss on its active globe. No initial
 * atlas status, recovery command, retry or material availability is inferred. */
export function getBookyGlobeSupport(input: BookySupportInput & Readonly<{ globeDisplayUnavailable?: boolean }>): BookySupport | GlobeUnavailableSupport | null {
  const existing = getBookySupport(input);
  if (existing?.kind === "error" || existing?.kind === "loading") return existing;
  if (input.screen === "globe" && input.globeDisplayUnavailable === true) return globeUnavailable;
  return existing;
}

import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";

export const GLOBE_EDITION_IDS = [
  "behaim-1492",
  "hondius-1615",
  "coronelli-1697",
  "scherer-1700",
  "cassini-1790",
  "rand-mcnally-1887",
  "us-army-general-reference-1943",
  "nasa-blue-marble",
  "natural-earth-2026",
] as const;

export type GlobeEditionId = (typeof GLOBE_EDITION_IDS)[number];
export type LegacyGlobeVisualStyle = "antique" | "earth" | "modern";
export type GlobeEditionStatus = "available" | "blocked-rights";
export type LocalizedGlobeEditionText = Readonly<Record<InterfaceLanguage, string>>;
export type GlobeEditionTexture = string | LocalizedGlobeEditionText;

export type GlobeOverlayProfile = Readonly<{
  profileId: string;
  permanentCountryBorders: boolean;
  selectionRasterFill: boolean;
  selectionRasterOutline: boolean;
  selectionVectorOutline: boolean;
  selectionCentroidMarker: boolean;
}>;

export const STANDARD_GLOBE_OVERLAY_PROFILE = Object.freeze({
  profileId: "standard-canonical-overlay-v1",
  permanentCountryBorders: true,
  selectionRasterFill: true,
  selectionRasterOutline: true,
  selectionVectorOutline: true,
  selectionCentroidMarker: false,
} satisfies GlobeOverlayProfile);

export const SOURCE_ONLY_CENTROID_OVERLAY_PROFILE = Object.freeze({
  profileId: "source-only-centroid-selection-v2",
  permanentCountryBorders: false,
  selectionRasterFill: false,
  selectionRasterOutline: false,
  selectionVectorOutline: false,
  selectionCentroidMarker: true,
} satisfies GlobeOverlayProfile);

export type GlobeEditionDefinition = Readonly<{
  id: GlobeEditionId;
  compactLabel: LocalizedGlobeEditionText;
  fullLabel: LocalizedGlobeEditionText;
  creator: LocalizedGlobeEditionText;
  sourceTitle: LocalizedGlobeEditionText;
  sourceInstitution: LocalizedGlobeEditionText;
  sourceCatalogId: string | null;
  sourceUrl: string;
  rightsSummary: LocalizedGlobeEditionText;
  alignmentDisclosure: LocalizedGlobeEditionText | null;
  reconstructionNote: LocalizedGlobeEditionText | null;
  desktopTexture: GlobeEditionTexture | null;
  mobileTexture: GlobeEditionTexture | null;
  textureContentVersion: string | null;
  overlayProfile: GlobeOverlayProfile;
  legacySurfaceProfile: LegacyGlobeVisualStyle;
  visitorAvailable: boolean;
  status: GlobeEditionStatus;
}>;

const adapted: LocalizedGlobeEditionText = {
  ru: "Цифровая реконструкция исторического источника",
  en: "Digital reconstruction of a historical source",
};

const historicalCentroidDisclosure: LocalizedGlobeEditionText = {
  ru: "Исторический рисунок не деформирован под современную географию. Современные границы не накладываются: выбранная страна отмечается точкой без ложного контура.",
  en: "The historical artwork is not warped to modern geography. Modern borders are not overlaid; the selected country is marked with a point instead of a misleading outline.",
};

export const GLOBE_EDITIONS = [
  {
    id: "behaim-1492",
    compactLabel: { ru: "Бехайм · 1492", en: "Behaim · 1492" },
    fullLabel: {
      ru: "Мартин Бехайм — «Земное яблоко», 1492–1494; факсимиле Равенштейна, 1908",
      en: "Martin Behaim — Erdapfel, 1492–1494; Ravenstein facsimile, 1908",
    },
    creator: { ru: "Мартин Бехайм", en: "Martin Behaim" },
    sourceTitle: {
      ru: "«Мартин Бехайм: его жизнь и его глобус» — факсимильные листы",
      en: "Martin Behaim: His Life and His Globe — facsimile sheets",
    },
    sourceInstitution: {
      ru: "Университетская библиотека Фрайбурга",
      en: "Universitätsbibliothek Freiburg",
    },
    sourceCatalogId: "Ravenstein 1908, plates 124–127",
    sourceUrl: "https://dl.ub.uni-freiburg.de/diglit/ravenstein1908",
    rightsSummary: {
      ru: "Основа — четыре факсимильных листа Равенштейна с отметкой Public Domain Mark 1.0. Ограниченная современная поверхность GNM/FAU не используется.",
      en: "Built from four Ravenstein facsimile sheets marked Public Domain Mark 1.0. The restricted modern GNM/FAU surface is not used.",
    },
    alignmentDisclosure: {
      ru: "Америка, которой нет на глобусе Бехайма, не дорисована. Современные границы не накладываются; выбор отмечается точкой.",
      en: "Behaim's absent Americas are not invented. Modern borders are not overlaid; selection uses a point marker.",
    },
    reconstructionNote: adapted,
    desktopTexture: "textures/behaim-1492-ravenstein-1908.webp",
    mobileTexture: "textures/behaim-1492-ravenstein-1908-mobile.webp",
    textureContentVersion: "sha256-61b8fc02a496babf",
    overlayProfile: SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "hondius-1615",
    compactLabel: { ru: "Хондиус · 1615", en: "Hondius · 1615" },
    fullLabel: {
      ru: "Йодокус Хондиус / Джузеппе де Росси — листы земного глобуса, 1615",
      en: "Jodocus Hondius / Giuseppe di Rossi — Terrestrial Globe Gores, 1615",
    },
    creator: {
      ru: "Йодокус Хондиус / Джузеппе де Росси",
      en: "Jodocus Hondius / Giuseppe di Rossi",
    },
    sourceTitle: { ru: "Листы земного глобуса", en: "Terrestrial Globe Gores" },
    sourceInstitution: {
      ru: "Отдел географии и карт Библиотеки Конгресса",
      en: "Library of Congress Geography and Map Division",
    },
    sourceCatalogId: "2008627640 / g3201b.ct000726",
    sourceUrl: "https://www.loc.gov/item/2008627640/",
    rightsSummary: {
      ru: "Использован полный скан Библиотеки Конгресса: запись не содержит специального ограничения, а коллекция отмечена как свободная для использования и повторного использования.",
      en: "Built from the complete Library of Congress scan; the item has no specific restriction and the collection is marked free to use and reuse.",
    },
    alignmentDisclosure: historicalCentroidDisclosure,
    reconstructionNote: adapted,
    desktopTexture: "textures/hondius-rossi-1615.webp",
    mobileTexture: "textures/hondius-rossi-1615-mobile.webp",
    textureContentVersion: "sha256-7d8ef5ed66fe4daf",
    overlayProfile: SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "coronelli-1697",
    compactLabel: { ru: "Коронелли · 1697", en: "Coronelli · 1697" },
    fullLabel: {
      ru: "Винченцо Коронелли — листы глобуса, 1697",
      en: "Vincenzo Coronelli — Globe Gores, 1697",
    },
    creator: { ru: "Винченцо Коронелли", en: "Vincenzo Coronelli" },
    sourceTitle: { ru: "Листы глобуса", en: "Globe Gores" },
    sourceInstitution: {
      ru: "Библиотеки Стэнфордского университета, Центр карт Дэвида Рамси",
      en: "Stanford University Libraries, David Rumsey Map Center",
    },
    sourceCatalogId: "fw438kx8748",
    sourceUrl: "https://purl.stanford.edu/fw438kx8748",
    rightsSummary: {
      ru: "Использован скан Стэнфордского университета с отметкой Public Domain Mark 1.0.",
      en: "Built from Stanford University's scan marked Public Domain Mark 1.0.",
    },
    alignmentDisclosure: historicalCentroidDisclosure,
    reconstructionNote: adapted,
    desktopTexture: "textures/coronelli-1697.webp",
    mobileTexture: "textures/coronelli-1697-mobile.webp",
    textureContentVersion: "sha256-11728e93c8ba3d53",
    overlayProfile: SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "scherer-1700",
    compactLabel: { ru: "Шерер · 1700", en: "Scherer · 1700" },
    fullLabel: {
      ru: "Генрих Шерер — «Typus Totius Orbis Terraquei», 1700",
      en: "Heinrich Scherer — Typus Totius Orbis Terraquei, 1700",
    },
    creator: { ru: "Генрих Шерер", en: "Heinrich Scherer" },
    sourceTitle: { ru: "«Typus Totius Orbis Terraquei»", en: "Typus Totius Orbis Terraquei" },
    sourceInstitution: {
      ru: "Библиотека Университета Иллинойса в Урбане-Шампейне",
      en: "University of Illinois Urbana-Champaign Library",
    },
    sourceCatalogId: "17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9",
    sourceUrl: "https://digital.library.illinois.edu/items/17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9",
    rightsSummary: {
      ru: "Использован скан Университета Иллинойса с отметкой «Нет авторских прав — США».",
      en: "Built from the University of Illinois scan marked No Copyright — United States.",
    },
    alignmentDisclosure: {
      ru: "Современные границы не накладываются; выбор отмечается точкой. Архивный мастер 10 147 × 7 371 (16-битный RGB, 600 dpi, 2 страницы) не используется до успешной геометрической регистрации.",
      en: "Modern borders are not overlaid; selection uses a point. The 10147×7371 preservation master (16-bit RGB, 600 dpi, two pages) is not used until geometric registration passes.",
    },
    reconstructionNote: adapted,
    desktopTexture: "textures/scherer-1700.webp",
    mobileTexture: "textures/scherer-1700-mobile.webp",
    textureContentVersion: "sha256-53bdbfbca466a77f",
    overlayProfile: SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "cassini-1790",
    compactLabel: { ru: "Кассини · 1790", en: "Cassini · 1790" },
    fullLabel: {
      ru: "Джованни Мария Кассини — «Globo terrestre», 1790",
      en: "Giovanni Maria Cassini — Globo terrestre, 1790",
    },
    creator: {
      ru: "Джованни Мария Кассини / Calcografia camerale",
      en: "Giovanni Maria Cassini / Calcografia camerale",
    },
    sourceTitle: { ru: "«Globo terrestre» («Земной глобус»)", en: "Globo terrestre" },
    sourceInstitution: {
      ru: "Отдел географии и карт Библиотеки Конгресса",
      en: "Library of Congress Geography and Map Division",
    },
    sourceCatalogId: "2004626115 / g3201b.ct001065a–e",
    sourceUrl: "https://www.loc.gov/item/2004626115/",
    rightsSummary: {
      ru: "Использованы пять официальных сканов Библиотеки Конгресса; мастер и производные версии закреплены контрольными суммами.",
      en: "Built from five official Library of Congress scans; the master and derivatives are checksum-pinned.",
    },
    alignmentDisclosure: {
      ru: "Полярный стык собран из оригинала, Антарктида не добавлялась. Современные границы не накладываются; выбор отмечается точкой.",
      en: "The polar join is source-derived and no synthetic Antarctica was added. Modern borders are not overlaid; selection uses a point.",
    },
    reconstructionNote: adapted,
    desktopTexture: "textures/cassini-globo-terrestre-1790.webp",
    mobileTexture: "textures/cassini-globo-terrestre-1790-mobile.webp",
    textureContentVersion: "sha256-3cb4692a97d0bb22",
    overlayProfile: SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "rand-mcnally-1887",
    compactLabel: { ru: "Rand · 1887", en: "Rand · 1887" },
    fullLabel: {
      ru: "Rand McNally & Co. — двенадцатидюймовый земной глобус, 1887",
      en: "Rand McNally & Co. — New Twelve Inch Terrestrial Globe, 1887",
    },
    creator: { ru: "Rand McNally & Co.", en: "Rand McNally & Co." },
    sourceTitle: {
      ru: "Новый двенадцатидюймовый земной глобус",
      en: "New Twelve Inch Terrestrial Globe",
    },
    sourceInstitution: {
      ru: "Отдел географии и карт Библиотеки Конгресса",
      en: "Library of Congress Geography and Map Division",
    },
    sourceCatalogId: "g3201b.ct001417",
    sourceUrl: "https://www.loc.gov/resource/g3201b.ct001417/",
    rightsSummary: {
      ru: "Библиотека Конгресса описывает скан общественного достояния как свободный для использования и повторного использования.",
      en: "The Library of Congress describes the public-domain scan as free to use and reuse.",
    },
    alignmentDisclosure: null,
    reconstructionNote: null,
    desktopTexture: "textures/antique-world-1887.webp",
    mobileTexture: "textures/antique-world-1887-mobile.webp",
    textureContentVersion: "sha256-aca29559635dc981",
    overlayProfile: STANDARD_GLOBE_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "us-army-general-reference-1943",
    compactLabel: { ru: "M-101 · 1943", en: "M-101 · 1943" },
    fullLabel: {
      ru: "Службы снабжения Армии США — «Обзорная карта мира № 1», армейский атлас M-101, ноябрь 1943 года",
      en: "U.S. Army Service Forces — General Reference Map No. 1, Army atlas M-101, November 1943",
    },
    creator: {
      ru: "Американское географическое общество подготовило карту для Государственного департамента США; издатель — Службы снабжения Армии США",
      en: "American Geographical Society for the U.S. Department of State; issued by Army Service Forces",
    },
    sourceTitle: {
      ru: "«Обзорная карта мира № 1» из «Атласа карт мира для изучения географии по программе специальной подготовки Армии США»",
      en: "General Reference Map No. 1 from Atlas of World Maps for the Study of Geography in the Army Specialized Training Program",
    },
    sourceInstitution: {
      ru: "David Rumsey Map Collection, David Rumsey Map Center, Stanford University Libraries / зеркало Викисклада",
      en: "David Rumsey Map Collection, David Rumsey Map Center, Stanford University Libraries / Wikimedia Commons mirror",
    },
    sourceCatalogId: "M-101 · 1057-G · Rumsey List No. 6351.015 · Wikimedia 113387121",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:General_Reference_Map_1.jpg",
    rightsSummary: {
      ru: "Оригинальная федеральная карта 1943 года отдельно отмечена Викискладом как общественное достояние в США (PD-USGov-Military). Используемый цифровой скан — Rumsey List No. 6351.015; правила коллекции разрешают публикацию при обязательном указании: “David Rumsey Map Collection, David Rumsey Map Center, Stanford University Libraries”. Статус оригинальной карты не отменяет условия использования скана.",
      en: "Wikimedia Commons separately marks the underlying 1943 federal map public domain in the United States (PD-USGov-Military). The digital scan used here is Rumsey List No. 6351.015; the collection permits publication with the required credit: “David Rumsey Map Collection, David Rumsey Map Center, Stanford University Libraries”. The underlying map's status does not waive the scan-use terms.",
    },
    alignmentDisclosure: {
      ru: "Три фрагмента исходной карты преобразованы по её печатной координатной сетке в стандартную прямоугольную развёртку глобуса. Контуры стран, выбор и заливка флагом совмещены с той же геометрией, что и у глобуса 1887 года.",
      en: "The source's three sinusoidal panels are transformed by their graticule into an equirectangular texture. The modern SVG layer for borders, country selection and flags remains fully enabled, as on the 1887 globe.",
    },
    reconstructionNote: adapted,
    desktopTexture: "textures/us-army-general-reference-1943.webp",
    mobileTexture: "textures/us-army-general-reference-1943-mobile.webp",
    textureContentVersion: "sha256-eca2ae835ef2d061",
    overlayProfile: STANDARD_GLOBE_OVERLAY_PROFILE,
    legacySurfaceProfile: "antique",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "nasa-blue-marble",
    compactLabel: { ru: "NASA · Blue Marble", en: "NASA · Blue Marble" },
    fullLabel: {
      ru: "NASA — «Голубой мрамор: новое поколение»",
      en: "NASA — Blue Marble: Next Generation",
    },
    creator: {
      ru: "NASA / Центр Годдарда / Студия научной визуализации",
      en: "NASA/Goddard Space Flight Center Scientific Visualization Studio",
    },
    sourceTitle: {
      ru: "«Голубой мрамор: новое поколение» (июль)",
      en: "Blue Marble: Next Generation (July)",
    },
    sourceInstitution: {
      ru: "Центр космических полётов имени Годдарда NASA",
      en: "NASA Goddard Space Flight Center",
    },
    sourceCatalogId: "SVS 3487",
    sourceUrl: "https://svs.gsfc.nasa.gov/3487",
    rightsSummary: {
      ru: "Изображение используется по правилам NASA для изображений и медиаматериалов с указанием NASA/GSFC Scientific Visualization Studio.",
      en: "Used under the NASA Images and Media Usage Guidelines with NASA/GSFC Scientific Visualization Studio credit.",
    },
    alignmentDisclosure: null,
    reconstructionNote: null,
    desktopTexture: "textures/earth-blue-marble.webp",
    mobileTexture: "textures/earth-blue-marble-mobile.webp",
    textureContentVersion: "sha256-cfa65dea7bdfea51",
    overlayProfile: STANDARD_GLOBE_OVERLAY_PROFILE,
    legacySurfaceProfile: "earth",
    visitorAvailable: true,
    status: "available",
  },
  {
    id: "natural-earth-2026",
    compactLabel: { ru: "Natural Earth · 2026", en: "Natural Earth · 2026" },
    fullLabel: {
      ru: "Natural Earth — литературный атлас, 2026",
      en: "Natural Earth — Literary Atlas, 2026",
    },
    creator: { ru: "Natural Earth", en: "Natural Earth" },
    sourceTitle: {
      ru: "Литературный атлас Natural Earth",
      en: "Natural Earth — Literary Atlas",
    },
    sourceInstitution: { ru: "Natural Earth", en: "Natural Earth" },
    sourceCatalogId: "Natural Earth I 3.2.0 / Admin 0 v5.1.2",
    sourceUrl: "https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/10m-natural-earth-1-with-shaded-relief-and-water/",
    rightsSummary: {
      ru: "Растровые и векторные картографические данные Natural Earth находятся в общественном достоянии.",
      en: "Natural Earth raster and vector map data are public domain.",
    },
    alignmentDisclosure: null,
    reconstructionNote: null,
    desktopTexture: {
      ru: "textures/modern-atlas-2026-ru.webp",
      en: "textures/modern-atlas-2026-en.webp",
    },
    mobileTexture: {
      ru: "textures/modern-atlas-2026-ru-mobile.webp",
      en: "textures/modern-atlas-2026-en-mobile.webp",
    },
    textureContentVersion: "sha256-78388ac530e7a515",
    overlayProfile: STANDARD_GLOBE_OVERLAY_PROFILE,
    legacySurfaceProfile: "modern",
    visitorAvailable: true,
    status: "available",
  },
] as const satisfies readonly GlobeEditionDefinition[];

export const DEFAULT_GLOBE_EDITION_ID: GlobeEditionId = "rand-mcnally-1887";

export const GLOBE_EDITION_BY_ID = Object.fromEntries(
  GLOBE_EDITIONS.map((edition) => [edition.id, edition])
) as Readonly<Record<GlobeEditionId, GlobeEditionDefinition>>;

export const AVAILABLE_GLOBE_EDITIONS = GLOBE_EDITIONS.filter(
  (edition) => edition.visitorAvailable
);

const LEGACY_STYLE_TO_EDITION: Readonly<Record<LegacyGlobeVisualStyle, GlobeEditionId>> = {
  antique: "rand-mcnally-1887",
  earth: "nasa-blue-marble",
  modern: "natural-earth-2026",
};

export function isGlobeEditionId(value: unknown): value is GlobeEditionId {
  return typeof value === "string" && GLOBE_EDITION_IDS.some((id) => id === value);
}

export function parseStoredGlobeEdition(value: unknown): GlobeEditionId {
  if (isGlobeEditionId(value) && GLOBE_EDITION_BY_ID[value].visitorAvailable) {
    return value;
  }
  if (value === "antique" || value === "earth" || value === "modern") {
    return LEGACY_STYLE_TO_EDITION[value];
  }
  return DEFAULT_GLOBE_EDITION_ID;
}

export function legacySurfaceProfileForEdition(
  editionId: GlobeEditionId
): LegacyGlobeVisualStyle {
  return GLOBE_EDITION_BY_ID[editionId].legacySurfaceProfile;
}

export function editionIdForLegacySurfaceProfile(
  profile: LegacyGlobeVisualStyle
): GlobeEditionId {
  return LEGACY_STYLE_TO_EDITION[profile];
}

export function resolveGlobeEditionTexturePath(
  editionId: GlobeEditionId,
  compact: boolean,
  language: InterfaceLanguage = "ru"
): string | null {
  const edition = GLOBE_EDITION_BY_ID[editionId];
  const texture = compact ? edition.mobileTexture : edition.desktopTexture;
  if (!texture) return null;
  return typeof texture === "string" ? texture : texture[language];
}

export function resolveGlobeEditionTextureUrl(
  editionId: GlobeEditionId,
  compact: boolean,
  language: InterfaceLanguage = "ru"
): string | null {
  const path = resolveGlobeEditionTexturePath(editionId, compact, language);
  if (!path) return null;
  const version = GLOBE_EDITION_BY_ID[editionId].textureContentVersion;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}

export function globeEditionText(
  text: LocalizedGlobeEditionText,
  language: InterfaceLanguage
) {
  return text[language];
}

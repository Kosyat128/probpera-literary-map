export const MODERN_GLOBE_OCEAN_LABELS = [
  {
    key: "globe.ocean.pacific",
    longitude: -145,
    latitude: -8,
    ru: "Тихий океан",
    en: "Pacific Ocean",
  },
  {
    key: "globe.ocean.atlantic",
    longitude: -32,
    latitude: 5,
    ru: "Атлантический океан",
    en: "Atlantic Ocean",
  },
  {
    key: "globe.ocean.indian",
    longitude: 79,
    latitude: -26,
    ru: "Индийский океан",
    en: "Indian Ocean",
  },
  {
    key: "globe.ocean.arctic",
    longitude: 5,
    latitude: 77,
    ru: "Северный Ледовитый океан",
    en: "Arctic Ocean",
  },
  {
    key: "globe.ocean.southern",
    longitude: 8,
    latitude: -61,
    ru: "Южный океан",
    en: "Southern Ocean",
  },
];

export const MODERN_GLOBE_COUNTRY_LABEL_OVERRIDES = {
  CHN: { ru: "Китай", en: "China" },
  COD: { ru: "ДР Конго", en: "DR Congo" },
  // Natural Earth's stock label point sits on western Sumatra. A visual
  // center across the full archipelago keeps the name with the country when
  // the equirectangular sheet is wrapped onto the sphere.
  IDN: {
    ru: "Индонезия",
    en: "Indonesia",
    longitude: 117.37,
    latitude: -2.28,
  },
  USA: { ru: "США", en: "United States" },
};

const specialCountryCodes = {
  CYN: "CY",
  KOS: "XK",
  NOR: "NO",
  SOL: "SO",
  TWN: "TW",
};

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizedAlpha2(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/u.test(normalized) ? normalized : "";
}

export function atlasCountrySiteCopyKey(properties) {
  const adm0A3 = String(properties?.ADM0_A3 ?? "").trim().toUpperCase();
  const code =
    specialCountryCodes[adm0A3] ||
    normalizedAlpha2(properties?.ISO_A2) ||
    normalizedAlpha2(properties?.WB_A2) ||
    "";
  if (!code) {
    throw new Error(
      `Modern globe feature ${adm0A3 || "<unknown>"} has no site-copy country code.`
    );
  }
  return `country.${code}`;
}

export function resolveSiteCopyText(siteCopy, key, fallback, locale) {
  const localized = objectValue(objectValue(siteCopy)[locale]);
  const candidate = localized[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : fallback;
}

export function resolveModernGlobeLabels({
  features,
  siteCopy,
  countryLabelOverrides = MODERN_GLOBE_COUNTRY_LABEL_OVERRIDES,
  oceanLabels = MODERN_GLOBE_OCEAN_LABELS,
}) {
  const countryLabels = {};
  const appliedCountryKeys = new Set();

  for (const feature of features) {
    const properties = objectValue(feature?.properties);
    const adm0A3 = String(properties.ADM0_A3 ?? "").trim().toUpperCase();
    if (!adm0A3 || countryLabels[adm0A3]) {
      throw new Error(
        `Modern globe feature has a missing or duplicate ADM0_A3 value: ${adm0A3 || "<empty>"}.`
      );
    }
    const key = atlasCountrySiteCopyKey(properties);
    const fixed = objectValue(countryLabelOverrides[adm0A3]);
    const fallbackRu = String(fixed.ru ?? properties.NAME_RU ?? "").trim();
    const fallbackEn = String(fixed.en ?? properties.NAME_EN ?? "").trim();
    const ru = resolveSiteCopyText(siteCopy, key, fallbackRu, "ru");
    const en = resolveSiteCopyText(siteCopy, key, fallbackEn, "en");
    if (ru !== fallbackRu || en !== fallbackEn) appliedCountryKeys.add(key);
    countryLabels[adm0A3] = { ...fixed, key, ru, en };
  }

  const appliedOceanKeys = new Set();
  const resolvedOceanLabels = oceanLabels.map((ocean) => {
    const ru = resolveSiteCopyText(siteCopy, ocean.key, ocean.ru, "ru");
    const en = resolveSiteCopyText(siteCopy, ocean.key, ocean.en, "en");
    if (ru !== ocean.ru || en !== ocean.en) appliedOceanKeys.add(ocean.key);
    return { ...ocean, ru, en };
  });

  return {
    countryLabels,
    oceanLabels: resolvedOceanLabels,
    appliedCountryKeys: [...appliedCountryKeys].sort(),
    appliedOceanKeys: [...appliedOceanKeys].sort(),
  };
}

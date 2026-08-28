export const homepageImageFits = ["cover", "contain", "fill"] as const;

export const homepageImagePositions = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export const homepageTextAlignments = ["left", "center", "right"] as const;
export const homepageTextWeights = [400, 500, 600, 700, 800] as const;

export type HomepageVisualSettings = {
  imageFit: (typeof homepageImageFits)[number];
  imagePosition: (typeof homepageImagePositions)[number];
  imageZoom: number;
  imageBrightness: number;
  imageContrast: number;
  imageSaturation: number;
  imageBlur: number;
  imageOverlay: number;
  titleFontSize: number;
  titleAlign: (typeof homepageTextAlignments)[number];
  titleWeight: (typeof homepageTextWeights)[number];
  titleLineHeight: number;
  bodyFontSize: number;
  bodyAlign: (typeof homepageTextAlignments)[number];
  bodyWeight: (typeof homepageTextWeights)[number];
  bodyLineHeight: number;
};

export const homepageImageVisualSettingKeys = [
  "imageFit",
  "imagePosition",
  "imageZoom",
  "imageBrightness",
  "imageContrast",
  "imageSaturation",
  "imageBlur",
  "imageOverlay",
] as const satisfies readonly (keyof HomepageVisualSettings)[];

export const homepageVisualSettingKeys = [
  ...homepageImageVisualSettingKeys,
  "titleFontSize",
  "titleAlign",
  "titleWeight",
  "titleLineHeight",
  "bodyFontSize",
  "bodyAlign",
  "bodyWeight",
  "bodyLineHeight",
] as const satisfies readonly (keyof HomepageVisualSettings)[];

export const defaultHomepageVisualSettings: Readonly<HomepageVisualSettings> =
  Object.freeze({
    imageFit: "cover",
    imagePosition: "center",
    imageZoom: 100,
    imageBrightness: 100,
    imageContrast: 100,
    imageSaturation: 100,
    imageBlur: 0,
    imageOverlay: 0,
    titleFontSize: 48,
    titleAlign: "left",
    titleWeight: 700,
    titleLineHeight: 1.05,
    bodyFontSize: 18,
    bodyAlign: "left",
    bodyWeight: 400,
    bodyLineHeight: 1.55,
  });

type EnumRule = {
  kind: "enum";
  values: readonly (string | number)[];
};

type NumberRule = {
  kind: "number";
  min: number;
  max: number;
  step: number;
};

type VisualRule = EnumRule | NumberRule;

const visualRules = {
  imageFit: { kind: "enum", values: homepageImageFits },
  imagePosition: { kind: "enum", values: homepageImagePositions },
  imageZoom: { kind: "number", min: 50, max: 200, step: 1 },
  imageBrightness: { kind: "number", min: 0, max: 200, step: 1 },
  imageContrast: { kind: "number", min: 0, max: 200, step: 1 },
  imageSaturation: { kind: "number", min: 0, max: 200, step: 1 },
  imageBlur: { kind: "number", min: 0, max: 20, step: 0.1 },
  imageOverlay: { kind: "number", min: 0, max: 90, step: 1 },
  titleFontSize: { kind: "number", min: 20, max: 112, step: 1 },
  titleAlign: { kind: "enum", values: homepageTextAlignments },
  titleWeight: { kind: "enum", values: homepageTextWeights },
  titleLineHeight: { kind: "number", min: 0.8, max: 1.6, step: 0.05 },
  bodyFontSize: { kind: "number", min: 12, max: 32, step: 1 },
  bodyAlign: { kind: "enum", values: homepageTextAlignments },
  bodyWeight: { kind: "enum", values: homepageTextWeights },
  bodyLineHeight: { kind: "number", min: 1, max: 2.2, step: 0.05 },
} as const satisfies Record<keyof HomepageVisualSettings, VisualRule>;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isAllowedStep(value: number, rule: NumberRule) {
  const quotient = (value - rule.min) / rule.step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-8;
}

function normalizeSetting(
  key: keyof HomepageVisualSettings,
  value: unknown
): string | number {
  const rule: VisualRule = visualRules[key];
  if (rule.kind === "enum") {
    const candidate =
      typeof rule.values[0] === "number" && typeof value === "string"
        ? Number(value)
        : value;
    if (!rule.values.includes(candidate as never)) {
      throw new Error(`Недопустимое значение настройки «${key}».`);
    }
    return candidate as string | number;
  }

  const candidate =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isFinite(candidate) ||
    candidate < rule.min ||
    candidate > rule.max ||
    !isAllowedStep(candidate, rule)
  ) {
    throw new Error(
      `Настройка «${key}» должна быть от ${rule.min} до ${rule.max}.`
    );
  }
  return Number(candidate.toFixed(2));
}

/**
 * Validates a complete visual-settings payload. Unknown or missing properties
 * are rejected so a client cannot smuggle arbitrary CSS or JSON into settings.
 */
export function parseHomepageVisualSettings(
  input: unknown
): HomepageVisualSettings {
  if (!plainRecord(input)) {
    throw new Error("Некорректные настройки оформления.");
  }
  const unknownKeys = Object.keys(input).filter(
    (key) => !homepageVisualSettingKeys.includes(key as never)
  );
  if (unknownKeys.length) {
    throw new Error("Неизвестная настройка оформления.");
  }
  if (homepageVisualSettingKeys.some((key) => !(key in input))) {
    throw new Error("Передан неполный набор настроек оформления.");
  }

  return Object.fromEntries(
    homepageVisualSettingKeys.map((key) => [key, normalizeSetting(key, input[key])])
  ) as HomepageVisualSettings;
}

/** Reads stored settings defensively; invalid legacy values fall back safely. */
export function readHomepageVisualSettings(
  input: unknown
): HomepageVisualSettings {
  const source = plainRecord(input) ? input : {};
  return Object.fromEntries(
    homepageVisualSettingKeys.map((key) => {
      try {
        return [
          key,
          key in source
            ? normalizeSetting(key, source[key])
            : defaultHomepageVisualSettings[key],
        ];
      } catch {
        return [key, defaultHomepageVisualSettings[key]];
      }
    })
  ) as HomepageVisualSettings;
}

/**
 * Merges validated visual settings with unrelated block settings. A reset
 * removes only the allowlisted visual keys, restoring the site's native CSS.
 */
export function mergeHomepageVisualSettings(
  existing: unknown,
  input: unknown,
  reset = false
) {
  const merged = plainRecord(existing) ? { ...existing } : {};
  for (const key of homepageVisualSettingKeys) delete merged[key];
  if (reset) return merged;
  return { ...merged, ...parseHomepageVisualSettings(input) };
}

export function resetHomepageImageVisualSettings(existing: unknown) {
  const merged = plainRecord(existing) ? { ...existing } : {};
  for (const key of homepageImageVisualSettingKeys) delete merged[key];
  return merged;
}

export function homepageVisualSettingsInputFromForm(formData: FormData) {
  return Object.fromEntries(
    homepageVisualSettingKeys.map((key) => [key, formData.get(key)])
  );
}

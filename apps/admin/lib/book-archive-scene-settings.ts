export const bookArchiveScenePresetIds = [
  "dynamic",
  "violet-library",
  "warm-paper",
  "museum-ivory",
  "midnight-archive",
  "amber-reading-room",
  "orange-violet-twilight",
  "ink-room",
  "deep-blue-study",
  "muted-green-library",
  "burgundy-edition",
  "charcoal-gallery",
  "cream-publishing-room",
] as const;

export const bookArchiveSceneAmbientTints = [
  "theme",
  "probpera-violet",
  "warm-amber",
  "deep-blue",
  "muted-green",
  "burgundy",
  "neutral-ivory",
] as const;

export const bookArchiveSceneShelfMaterials = [
  "dark-walnut",
  "smoked-oak",
  "ink-lacquer",
  "museum-brass",
] as const;

export type BookArchiveSceneSettings = {
  bookScenePreset: (typeof bookArchiveScenePresetIds)[number];
  bookSceneDarkness: number;
  bookSceneDynamicThemes: boolean;
  bookSceneIntensity: number;
  bookSceneAmbientTint: (typeof bookArchiveSceneAmbientTints)[number];
  bookSceneShelfMaterial: (typeof bookArchiveSceneShelfMaterials)[number];
};

export const bookArchiveSceneSettingKeys = [
  "bookScenePreset",
  "bookSceneDarkness",
  "bookSceneDynamicThemes",
  "bookSceneIntensity",
  "bookSceneAmbientTint",
  "bookSceneShelfMaterial",
] as const satisfies readonly (keyof BookArchiveSceneSettings)[];

export const defaultBookArchiveSceneSettings: Readonly<BookArchiveSceneSettings> =
  Object.freeze({
    bookScenePreset: "dynamic",
    bookSceneDarkness: 42,
    bookSceneDynamicThemes: true,
    bookSceneIntensity: 72,
    bookSceneAmbientTint: "theme",
    bookSceneShelfMaterial: "dark-walnut",
  });

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function enumValue<Value extends string>(
  key: string,
  value: unknown,
  values: readonly Value[]
): Value {
  if (typeof value === "string" && values.includes(value as Value)) {
    return value as Value;
  }
  throw new Error(`Недопустимое значение настройки «${key}».`);
}

function integerValue(key: string, value: unknown, maximum: number) {
  const candidate =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(candidate) || candidate < 0 || candidate > maximum) {
    throw new Error(`Настройка «${key}» должна быть целым числом от 0 до ${maximum}.`);
  }
  return candidate;
}

function booleanValue(key: string, value: unknown) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`Настройка «${key}» должна быть логическим значением.`);
}

export function parseBookArchiveSceneSettings(input: unknown): BookArchiveSceneSettings {
  if (!plainRecord(input)) {
    throw new Error("Некорректные настройки сцены книжного архива.");
  }
  if (
    Object.keys(input).some(
      (key) => !bookArchiveSceneSettingKeys.includes(key as never)
    )
  ) {
    throw new Error("Неизвестная настройка сцены книжного архива.");
  }
  if (bookArchiveSceneSettingKeys.some((key) => !(key in input))) {
    throw new Error("Передан неполный набор настроек сцены книжного архива.");
  }
  return {
    bookScenePreset: enumValue(
      "bookScenePreset",
      input.bookScenePreset,
      bookArchiveScenePresetIds
    ),
    bookSceneDarkness: integerValue(
      "bookSceneDarkness",
      input.bookSceneDarkness,
      90
    ),
    bookSceneDynamicThemes: booleanValue(
      "bookSceneDynamicThemes",
      input.bookSceneDynamicThemes
    ),
    bookSceneIntensity: integerValue(
      "bookSceneIntensity",
      input.bookSceneIntensity,
      100
    ),
    bookSceneAmbientTint: enumValue(
      "bookSceneAmbientTint",
      input.bookSceneAmbientTint,
      bookArchiveSceneAmbientTints
    ),
    bookSceneShelfMaterial: enumValue(
      "bookSceneShelfMaterial",
      input.bookSceneShelfMaterial,
      bookArchiveSceneShelfMaterials
    ),
  };
}

export function readBookArchiveSceneSettings(input: unknown): BookArchiveSceneSettings {
  const source = plainRecord(input) ? input : {};
  const value = { ...defaultBookArchiveSceneSettings };
  for (const key of bookArchiveSceneSettingKeys) {
    if (!(key in source)) continue;
    try {
      if (key === "bookScenePreset") {
        value[key] = enumValue(key, source[key], bookArchiveScenePresetIds);
      } else if (key === "bookSceneAmbientTint") {
        value[key] = enumValue(key, source[key], bookArchiveSceneAmbientTints);
      } else if (key === "bookSceneShelfMaterial") {
        value[key] = enumValue(key, source[key], bookArchiveSceneShelfMaterials);
      } else if (key === "bookSceneDynamicThemes") {
        value[key] = booleanValue(key, source[key]);
      } else if (key === "bookSceneDarkness") {
        value[key] = integerValue(key, source[key], 90);
      } else {
        value[key] = integerValue(key, source[key], 100);
      }
    } catch {
      value[key] = defaultBookArchiveSceneSettings[key] as never;
    }
  }
  return value;
}

export function mergeBookArchiveSceneSettings(
  existing: unknown,
  input: unknown,
  reset = false
) {
  const merged = plainRecord(existing) ? { ...existing } : {};
  for (const key of bookArchiveSceneSettingKeys) delete merged[key];
  return reset ? merged : { ...merged, ...parseBookArchiveSceneSettings(input) };
}

export function bookArchiveSceneSettingsInputFromForm(formData: FormData) {
  return Object.fromEntries(
    bookArchiveSceneSettingKeys.map((key) => [key, formData.get(key)])
  );
}

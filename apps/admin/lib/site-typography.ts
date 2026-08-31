export const typographySemanticScopes = [
  "body",
  "navigation",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "article",
  "page",
  "lead",
  "quote",
  "caption",
  "button",
  "card",
  "footer",
] as const;

export const typographyLayers = [
  "site",
  "component",
  "template",
  "page",
  "instance",
] as const;

export const typographyBreakpoints = [
  "base",
  "mobile",
  "tablet",
  "desktop",
] as const;

export const typographySystemFamilies = [
  "system-sans",
  "system-serif",
  "georgia",
  "arial",
  "times",
] as const;

export const typographyFontStyles = ["normal", "italic", "oblique"] as const;
export const typographyTextAlignments = [
  "left",
  "center",
  "right",
  "justify",
] as const;
export const typographyTextTransforms = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export const typographyTextDecorations = [
  "none",
  "underline",
  "line-through",
] as const;

export type TypographySemanticScope =
  (typeof typographySemanticScopes)[number];
export type TypographyLayer = (typeof typographyLayers)[number];
export type TypographyBreakpoint = (typeof typographyBreakpoints)[number];
export type TypographySystemFamily =
  (typeof typographySystemFamilies)[number];
export type TypographyFontStyle = (typeof typographyFontStyles)[number];
export type TypographyTextAlignment =
  (typeof typographyTextAlignments)[number];
export type TypographyTextTransform =
  (typeof typographyTextTransforms)[number];
export type TypographyTextDecoration =
  (typeof typographyTextDecorations)[number];

export const typographyScopeLabels: Record<TypographySemanticScope, string> = {
  body: "Основной текст",
  navigation: "Навигация",
  h1: "Заголовок H1",
  h2: "Заголовок H2",
  h3: "Заголовок H3",
  h4: "Заголовок H4",
  h5: "Заголовок H5",
  h6: "Заголовок H6",
  article: "Текст статьи",
  page: "Текст страницы",
  lead: "Лид",
  quote: "Цитата",
  caption: "Подпись",
  button: "Кнопка",
  card: "Карточка",
  footer: "Подвал",
};

export const typographyLayerLabels: Record<TypographyLayer, string> = {
  site: "Весь сайт",
  component: "Компонент",
  template: "Шаблон",
  page: "Страница",
  instance: "Отдельный элемент",
};

export const typographyBreakpointLabels: Record<TypographyBreakpoint, string> = {
  base: "Все экраны",
  mobile: "Телефон",
  tablet: "Планшет",
  desktop: "Компьютер",
};

export const typographySystemFamilyLabels: Record<
  TypographySystemFamily,
  string
> = {
  "system-sans": "Системный без засечек",
  "system-serif": "Системный с засечками",
  georgia: "Georgia",
  arial: "Arial",
  times: "Times New Roman",
};

export type SiteTypographyProperties = {
  familyId?: string;
  systemFamily?: TypographySystemFamily;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: TypographyFontStyle;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TypographyTextAlignment;
  textTransform?: TypographyTextTransform;
  textDecoration?: TypographyTextDecoration;
  textIndent?: number;
  wordSpacing?: number;
};

export type SiteTypographyTarget = {
  layer: TypographyLayer;
  targetKey: string;
  semanticScope: TypographySemanticScope;
  breakpoint: TypographyBreakpoint;
};

export type SiteTypographyOverride = SiteTypographyTarget & {
  id?: string;
  version?: number;
  settings: SiteTypographyProperties;
};

export type SiteTypographyResolutionContext = {
  semanticScope: TypographySemanticScope;
  breakpoint: TypographyBreakpoint;
  targetKeys?: Partial<Record<Exclude<TypographyLayer, "site">, string>>;
};

export const siteTypographyPropertyKeys = [
  "familyId",
  "systemFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "textIndent",
  "wordSpacing",
] as const satisfies readonly (keyof SiteTypographyProperties)[];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const targetKeyPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const typographyPropertyKeySet = new Set<string>(siteTypographyPropertyKeys);

type NumericRule = {
  min: number;
  max: number;
  integer?: boolean;
};

const numericRules = {
  fontSize: { min: 8, max: 144 },
  fontWeight: { min: 1, max: 1000, integer: true },
  lineHeight: { min: 0.8, max: 3 },
  letterSpacing: { min: -0.2, max: 1 },
  textIndent: { min: 0, max: 12 },
  wordSpacing: { min: -0.2, max: 2 },
} as const satisfies Partial<
  Record<keyof SiteTypographyProperties, NumericRule>
>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseEnum<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string
): Values[number] {
  if (typeof value !== "string" || !values.includes(value as Values[number])) {
    throw new Error(`Недопустимое значение поля «${label}».`);
  }
  return value as Values[number];
}

function parseNumber(value: unknown, rule: NumericRule, label: string) {
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
    (rule.integer && !Number.isInteger(candidate))
  ) {
    throw new Error(
      `Поле «${label}» должно быть от ${rule.min} до ${rule.max}.`
    );
  }
  return Number(candidate.toFixed(4));
}

export function parseTypographyTarget(input: unknown): SiteTypographyTarget {
  if (!isPlainRecord(input)) throw new Error("Некорректная область оформления.");
  const layer = parseEnum(input.layer, typographyLayers, "Уровень");
  const targetKey =
    typeof input.targetKey === "string" ? input.targetKey.trim() : "";
  if (!targetKeyPattern.test(targetKey)) {
    throw new Error(
      "Ключ области должен начинаться с латинской буквы или цифры и содержать только a-z, 0-9, _ или -."
    );
  }
  if (layer === "site" && targetKey !== "site") {
    throw new Error("Для уровня всего сайта ключ области должен быть «site».");
  }
  return {
    layer,
    targetKey,
    semanticScope: parseEnum(
      input.semanticScope,
      typographySemanticScopes,
      "Тип текста"
    ),
    breakpoint: parseEnum(
      input.breakpoint,
      typographyBreakpoints,
      "Экран"
    ),
  };
}

/**
 * Strictly parses the JSON settings accepted by the publication pipeline.
 * Unknown keys, raw CSS and arbitrary font-family strings are rejected.
 */
export function parseSiteTypographyProperties(
  input: unknown
): SiteTypographyProperties {
  if (!isPlainRecord(input)) {
    throw new Error("Некорректные параметры типографики.");
  }
  const unknownKeys = Object.keys(input).filter(
    (key) => !typographyPropertyKeySet.has(key)
  );
  if (unknownKeys.length) {
    throw new Error("Передано неизвестное CSS-свойство.");
  }

  const parsed: SiteTypographyProperties = {};
  for (const key of siteTypographyPropertyKeys) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "familyId") {
      if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
        throw new Error("Выбран неизвестный файл шрифта.");
      }
      parsed.familyId = value.trim().toLowerCase();
      continue;
    }
    if (key in numericRules) {
      parsed[key as keyof typeof numericRules] = parseNumber(
        value,
        numericRules[key as keyof typeof numericRules],
        key
      );
      continue;
    }
    if (key === "systemFamily") {
      parsed.systemFamily = parseEnum(value, typographySystemFamilies, key);
    } else if (key === "fontStyle") {
      parsed.fontStyle = parseEnum(value, typographyFontStyles, key);
    } else if (key === "textAlign") {
      parsed.textAlign = parseEnum(value, typographyTextAlignments, key);
    } else if (key === "textTransform") {
      parsed.textTransform = parseEnum(value, typographyTextTransforms, key);
    } else if (key === "textDecoration") {
      parsed.textDecoration = parseEnum(value, typographyTextDecorations, key);
    }
  }

  if (parsed.familyId && parsed.systemFamily) {
    throw new Error("Выберите либо загруженный, либо системный шрифт.");
  }
  return parsed;
}

/** Invalid persisted settings fail closed instead of becoming CSS. */
export function readSiteTypographyProperties(
  input: unknown
): SiteTypographyProperties {
  try {
    return parseSiteTypographyProperties(input);
  } catch {
    return {};
  }
}

export function typographyTargetFromForm(formData: FormData) {
  return parseTypographyTarget({
    layer: formData.get("layer"),
    targetKey: formData.get("target_key"),
    semanticScope: formData.get("semantic_scope"),
    breakpoint: formData.get("breakpoint"),
  });
}

export function typographyPropertiesInputFromForm(formData: FormData) {
  const familyKind = String(formData.get("family_kind") || "inherit");
  if (!["inherit", "system", "asset"].includes(familyKind)) {
    throw new Error("Выбран неизвестный источник шрифта.");
  }
  const input: Record<string, unknown> = {};
  if (familyKind === "asset") {
    const familyId = formData.get("familyId");
    if (typeof familyId !== "string" || !familyId.trim()) {
      throw new Error("Выберите шрифт из менеджера шрифтов.");
    }
    input.familyId = familyId;
  }
  if (familyKind === "system") {
    const systemFamily = formData.get("systemFamily");
    if (typeof systemFamily !== "string" || !systemFamily.trim()) {
      throw new Error("Выберите системный шрифт.");
    }
    input.systemFamily = systemFamily;
  }
  for (const key of siteTypographyPropertyKeys) {
    if (key === "familyId" || key === "systemFamily") continue;
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) input[key] = value.trim();
  }
  return parseSiteTypographyProperties(input);
}

export function expectedTypographyVersionFromForm(formData: FormData) {
  const raw = formData.get("expected_version");
  const version =
    typeof raw === "string" && /^[0-9]+$/u.test(raw.trim())
      ? Number(raw)
      : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Версия настройки устарела или повреждена.");
  }
  return version;
}

export function typographyPropertyFormValues(
  input: unknown
): Record<(typeof siteTypographyPropertyKeys)[number], string> {
  const settings = readSiteTypographyProperties(input);
  return Object.fromEntries(
    siteTypographyPropertyKeys.map((key) => [
      key,
      settings[key] === undefined ? "" : String(settings[key]),
    ])
  ) as Record<(typeof siteTypographyPropertyKeys)[number], string>;
}

/**
 * Resolves the admin preview using the same deterministic inheritance order:
 * site → component → template → page → instance, with base before the selected
 * breakpoint inside every layer.
 */
export function resolveSiteTypography(
  overrides: readonly SiteTypographyOverride[],
  context: SiteTypographyResolutionContext
) {
  const resolved: SiteTypographyProperties = {};
  for (const layer of typographyLayers) {
    const expectedTarget =
      layer === "site" ? "site" : context.targetKeys?.[layer];
    if (!expectedTarget) continue;
    const breakpoints: TypographyBreakpoint[] =
      context.breakpoint === "base"
        ? ["base"]
        : ["base", context.breakpoint];
    for (const breakpoint of breakpoints) {
      for (const override of overrides) {
        if (
          override.layer === layer &&
          override.targetKey === expectedTarget &&
          override.semanticScope === context.semanticScope &&
          override.breakpoint === breakpoint
        ) {
          Object.assign(resolved, readSiteTypographyProperties(override.settings));
        }
      }
    }
  }
  return resolved;
}

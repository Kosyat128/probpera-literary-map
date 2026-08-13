export type VisualContentEntityType =
  | "page"
  | "navigation-item"
  | "banner"
  | "homepage-block";

export type VisualContentEditInput = {
  entityType: VisualContentEntityType;
  entityId: string;
  field: string;
  value: unknown;
  expectedUpdatedAt?: string;
};

type TextRule = {
  kind: "text";
  minLength?: number;
  maxLength: number;
};

type LinkRule = {
  kind: "link";
  maxLength: number;
  allowEmpty?: boolean;
  allowHash?: boolean;
  allowMailto?: boolean;
};

type MediaRule = {
  kind: "media";
};

type StyleRule = {
  kind: "style";
};

type FieldRule = TextRule | LinkRule | MediaRule | StyleRule;

const pageRules = {
  title: { kind: "text", minLength: 2, maxLength: 180 },
  excerpt: { kind: "text", maxLength: 700 },
} as const satisfies Record<string, FieldRule>;

const navigationRules = {
  label: { kind: "text", minLength: 1, maxLength: 100 },
  href: { kind: "link", maxLength: 600, allowHash: true },
} as const satisfies Record<string, FieldRule>;

const bannerRules = {
  title: { kind: "text", maxLength: 240 },
  description: { kind: "text", maxLength: 1_200 },
  buttonText: { kind: "text", maxLength: 120 },
  targetUrl: { kind: "link", maxLength: 600, allowEmpty: true },
  desktopMediaId: { kind: "media" },
  tabletMediaId: { kind: "media" },
  mobileMediaId: { kind: "media" },
} as const satisfies Record<string, FieldRule>;

const homepageBlockRules = {
  title: { kind: "text", maxLength: 240 },
  eyebrow: { kind: "text", maxLength: 160 },
  description: { kind: "text", maxLength: 2_000 },
  copy: { kind: "text", maxLength: 2_000 },
  buttonText: { kind: "text", maxLength: 120 },
  buttonUrl: {
    kind: "link",
    maxLength: 500,
    allowEmpty: true,
    allowHash: true,
    allowMailto: true,
  },
  backgroundMediaId: { kind: "media" },
  backgroundStyle: { kind: "style" },
} as const satisfies Record<string, FieldRule>;

const rulesByEntity = {
  page: pageRules,
  "navigation-item": navigationRules,
  banner: bannerRules,
  "homepage-block": homepageBlockRules,
} as const;

const databaseColumnByEntity = {
  page: {
    title: "title",
    excerpt: "excerpt",
  },
  "navigation-item": {
    label: "label",
    href: "href",
  },
  banner: {
    title: "title",
    description: "description",
    buttonText: "button_text",
    targetUrl: "target_url",
    desktopMediaId: "desktop_media_id",
    tabletMediaId: "tablet_media_id",
    mobileMediaId: "mobile_media_id",
  },
  "homepage-block": {
    title: "title",
    eyebrow: "settings",
    description: "settings",
    copy: "settings",
    buttonText: "settings",
    buttonUrl: "settings",
    backgroundMediaId: "background_media_id",
    backgroundStyle: "background_style",
  },
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedUuid(value: unknown, allowEmpty: true): string | null;
function normalizedUuid(value: unknown, allowEmpty?: false): string;
function normalizedUuid(value: unknown, allowEmpty = false): string | null {
  if (typeof value !== "string") {
    throw new Error("Идентификатор должен быть текстом.");
  }
  const normalized = value.trim();
  if (allowEmpty && !normalized) return null;
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("Некорректный идентификатор записи.");
  }
  return normalized.toLowerCase();
}

function normalizedText(value: unknown, rule: TextRule) {
  if (typeof value !== "string") {
    throw new Error("Значение должно быть текстом.");
  }
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new Error("Поле содержит недопустимые управляющие символы.");
  }
  if (rule.minLength && normalized.length < rule.minLength) {
    throw new Error(`Поле должно содержать не менее ${rule.minLength} символов.`);
  }
  if (normalized.length > rule.maxLength) {
    throw new Error(`Поле длиннее ${rule.maxLength} символов.`);
  }
  return normalized;
}

function normalizedLink(value: unknown, rule: LinkRule) {
  const normalized = normalizedText(value, {
    kind: "text",
    minLength: rule.allowEmpty ? undefined : 1,
    maxLength: rule.maxLength,
  });
  if (!normalized && rule.allowEmpty) return null;
  if (
    (normalized.startsWith("/") &&
      !normalized.startsWith("//") &&
      !normalized.includes("\\")) ||
    (rule.allowHash && normalized.startsWith("#"))
  ) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (
      url.protocol === "https:" ||
      (rule.allowMailto && url.protocol === "mailto:")
    ) {
      return url.toString();
    }
  } catch {
    // A precise validation error is returned below.
  }
  throw new Error(
    rule.allowHash
      ? "Ссылка должна начинаться с /, # или https://."
      : "Ссылка должна начинаться с / или https://."
  );
}

function normalizedMediaId(value: unknown) {
  return normalizedUuid(value, true);
}

function normalizedStyle(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Стиль фона должен быть текстом.");
  }
  const normalized = value.trim();
  if (!["light", "violet", "orange", "paper", "transparent"].includes(normalized)) {
    throw new Error("Неизвестный стиль фона.");
  }
  return normalized;
}

function normalizeValue(value: unknown, rule: FieldRule) {
  if (rule.kind === "media") return normalizedMediaId(value);
  if (rule.kind === "style") return normalizedStyle(value);
  if (rule.kind === "link") return normalizedLink(value, rule);
  return normalizedText(value, rule);
}

export function parseVisualContentEdit(input: unknown) {
  if (!plainRecord(input)) throw new Error("Некорректное изменение.");
  const entityType = input.entityType;
  if (
    entityType !== "page" &&
    entityType !== "navigation-item" &&
    entityType !== "banner" &&
    entityType !== "homepage-block"
  ) {
    throw new Error("Эта сущность не поддерживает прямое редактирование.");
  }
  const entityId = normalizedUuid(input.entityId);
  const field = typeof input.field === "string" ? input.field : "";
  const rules = rulesByEntity[entityType] as Record<string, FieldRule>;
  const rule = rules[field];
  if (!rule) {
    throw new Error("Это поле нельзя менять из визуального редактора.");
  }
  const columns = databaseColumnByEntity[entityType] as Record<string, string>;
  const normalizedValue = normalizeValue(input.value, rule);
  return {
    entityType,
    entityId,
    field,
    column: columns[field],
    value:
      entityType === "homepage-block" &&
      field === "buttonUrl" &&
      normalizedValue === null
        ? ""
        : normalizedValue,
    isMedia: rule.kind === "media",
  } as const;
}

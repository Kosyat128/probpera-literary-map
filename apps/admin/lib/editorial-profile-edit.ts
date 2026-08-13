export type EditorialProfileEntityType = "country" | "writer";

type FieldRule = {
  kind: "text" | "list" | "integer" | "image" | "coordinates" | "timeline";
  maxLength?: number;
  maxItems?: number;
  required?: boolean;
};

export const countryProfileFieldRules = {
  name: { kind: "text", maxLength: 240, required: true },
  code: { kind: "text", maxLength: 2 },
  flag: { kind: "text", maxLength: 32 },
  coordinates: { kind: "coordinates" },
  region: { kind: "text", maxLength: 240 },
  continent: { kind: "text", maxLength: 240 },
  officialLanguage: { kind: "text", maxLength: 500 },
  literaryPeriods: { kind: "list", maxItems: 100, maxLength: 500 },
  literaryMovements: { kind: "list", maxItems: 100, maxLength: 500 },
  periods: { kind: "list", maxItems: 100, maxLength: 500 },
  capital: { kind: "text", maxLength: 240 },
  description: { kind: "text", maxLength: 20_000 },
  history: { kind: "text", maxLength: 50_000 },
  historicalNote: { kind: "text", maxLength: 20_000 },
  facts: { kind: "list", maxItems: 300, maxLength: 2_000 },
  literaryPlaces: { kind: "list", maxItems: 300, maxLength: 1_000 },
  timeline: { kind: "timeline", maxItems: 300, maxLength: 2_000 },
  chronology: { kind: "timeline", maxItems: 300, maxLength: 2_000 },
  nobel: { kind: "integer" },
  places: { kind: "integer" },
  influence: { kind: "integer" },
} as const satisfies Record<string, FieldRule>;

export const writerProfileFieldRules = {
  name: { kind: "text", maxLength: 300, required: true },
  fullName: { kind: "text", maxLength: 300 },
  birth: { kind: "text", maxLength: 100 },
  death: { kind: "text", maxLength: 100 },
  years: { kind: "text", maxLength: 100 },
  birthDate: { kind: "text", maxLength: 100 },
  deathDate: { kind: "text", maxLength: 100 },
  birthPlace: { kind: "text", maxLength: 500 },
  deathPlace: { kind: "text", maxLength: 500 },
  portrait: { kind: "image", maxLength: 2_000 },
  portraitAlt: { kind: "text", maxLength: 1_000 },
  portraitSourceUrl: { kind: "image", maxLength: 2_000 },
  country: { kind: "text", maxLength: 240 },
  movement: { kind: "text", maxLength: 500 },
  literaryEra: { kind: "text", maxLength: 500 },
  genres: { kind: "list", maxItems: 100, maxLength: 500 },
  languages: { kind: "list", maxItems: 100, maxLength: 240 },
  language: { kind: "text", maxLength: 240 },
  nationality: { kind: "text", maxLength: 500 },
  tags: { kind: "list", maxItems: 200, maxLength: 500 },
  category: { kind: "text", maxLength: 500 },
  bio: { kind: "text", maxLength: 50_000 },
  biography: { kind: "text", maxLength: 50_000 },
  description: { kind: "text", maxLength: 20_000 },
  works: { kind: "list", maxItems: 500, maxLength: 1_000 },
  awards: { kind: "list", maxItems: 300, maxLength: 1_000 },
  places: { kind: "list", maxItems: 300, maxLength: 1_000 },
  relatedWriters: { kind: "list", maxItems: 300, maxLength: 500 },
  articleUrl: { kind: "image", maxLength: 2_000 },
} as const satisfies Record<string, FieldRule>;

export const countryProfileFields = Object.freeze(
  Object.keys(countryProfileFieldRules)
);
export const writerProfileFields = Object.freeze(
  Object.keys(writerProfileFieldRules)
);

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeIdentifier(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    !normalized ||
    normalized.length > 240 ||
    !/^[\p{L}\p{N}_.-]+$/u.test(normalized)
  ) {
    throw new Error(`Некорректный идентификатор: ${label}.`);
  }
  return normalized;
}

function normalizedText(value: unknown, rule: FieldRule) {
  if (typeof value !== "string") throw new Error("Значение должно быть текстом.");
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new Error("Поле содержит недопустимые управляющие символы.");
  }
  if (rule.required && !normalized) throw new Error("Поле не может быть пустым.");
  if (rule.maxLength && normalized.length > rule.maxLength) {
    throw new Error(`Поле длиннее ${rule.maxLength} символов.`);
  }
  return normalized;
}

function normalizedList(value: unknown, rule: FieldRule) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/gu)
      : null;
  if (!source) throw new Error("Список должен быть передан строками.");
  const seen = new Set<string>();
  const result = source.flatMap((item) => {
    if (typeof item !== "string") throw new Error("Элемент списка должен быть текстом.");
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) return [];
    if (rule.maxLength && normalized.length > rule.maxLength) {
      throw new Error(`Элемент списка длиннее ${rule.maxLength} символов.`);
    }
    if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
      throw new Error("Элемент списка содержит управляющий символ.");
    }
    seen.add(normalized);
    return [normalized];
  });
  if (rule.maxItems && result.length > rule.maxItems) {
    throw new Error(`В списке больше ${rule.maxItems} элементов.`);
  }
  return result;
}

function normalizedInteger(value: unknown) {
  if (String(value ?? "").trim() === "") return null;
  const normalized = Number(String(value ?? "").trim());
  if (!Number.isInteger(normalized) || normalized < -1_000_000 || normalized > 1_000_000) {
    throw new Error("Значение должно быть целым числом.");
  }
  return normalized;
}

function normalizedImage(value: unknown, rule: FieldRule) {
  const normalized = normalizedText(value, rule);
  if (!normalized) return "";
  if (
    !normalized.startsWith("/") &&
    !normalized.startsWith("https://") &&
    !/^[\p{L}\p{N}_.-]+(?:\/[\p{L}\p{N}_.% -]+)+$/u.test(normalized)
  ) {
    throw new Error("Укажите HTTPS-адрес или безопасный путь сайта.");
  }
  return normalized;
}

function normalizedCoordinates(value: unknown) {
  if (!plainRecord(value)) throw new Error("Укажите широту и долготу.");
  if (!String(value.lat ?? "").trim() && !String(value.lng ?? "").trim()) {
    return null;
  }
  const lat = Number(String(value.lat ?? "").replace(",", "."));
  const lng = Number(String(value.lng ?? "").replace(",", "."));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Широта должна быть от −90 до 90.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("Долгота должна быть от −180 до 180.");
  }
  return { lat, lng };
}

function normalizedTimeline(value: unknown, rule: FieldRule) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") throw new Error("Хронология должна быть текстом.");
  const rows = value.split(/\r?\n/gu).flatMap((row) => {
    const normalized = row.trim();
    if (!normalized) return [];
    const [year = "", title = "", ...descriptionParts] = normalized
      .split("|")
      .map((part) => part.trim());
    if (!title && !descriptionParts.length) return [year];
    const description = descriptionParts.join(" | ").trim();
    return [
      Object.fromEntries(
        [
          ["year", year],
          ["title", title],
          ["description", description],
        ].filter(([, fieldValue]) => fieldValue)
      ),
    ];
  });
  if (rule.maxItems && rows.length > rule.maxItems) {
    throw new Error(`В хронологии больше ${rule.maxItems} строк.`);
  }
  if (
    rule.maxLength &&
    rows.some((row) => JSON.stringify(row).length > rule.maxLength!)
  ) {
    throw new Error(`Строка хронологии длиннее ${rule.maxLength} символов.`);
  }
  return rows;
}

function normalizeByRule(value: unknown, rule: FieldRule) {
  if (rule.kind === "list") return normalizedList(value, rule);
  if (rule.kind === "integer") return normalizedInteger(value);
  if (rule.kind === "image") return normalizedImage(value, rule);
  if (rule.kind === "coordinates") return normalizedCoordinates(value);
  if (rule.kind === "timeline") return normalizedTimeline(value, rule);
  return normalizedText(value, rule);
}

export function parseEditorialProfileOverride(input: unknown) {
  if (!plainRecord(input)) throw new Error("Некорректное изменение профиля.");
  const entityType = input.entityType;
  if (entityType !== "country" && entityType !== "writer") {
    throw new Error("Неизвестный тип редакционного профиля.");
  }
  const countryId = safeIdentifier(input.countryId, "страна");
  const writerId =
    entityType === "writer" ? safeIdentifier(input.writerId, "автор") : null;
  const values = plainRecord(input.values) ? input.values : {};
  const enabledFields = new Set(
    Array.isArray(input.enabledFields)
      ? input.enabledFields.filter((field): field is string => typeof field === "string")
      : []
  );
  const rules: Record<string, FieldRule> =
    entityType === "country" ? countryProfileFieldRules : writerProfileFieldRules;
  const fields = Object.fromEntries(
    Object.entries(rules).flatMap(([field, rule]) => {
      if (!enabledFields.has(field)) return [];
      return [[field, normalizeByRule(values[field], rule)]];
    })
  );
  return { entityType, countryId, writerId, fields } as const;
}

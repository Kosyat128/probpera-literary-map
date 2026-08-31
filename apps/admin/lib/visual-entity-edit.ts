export type VisualEntityType = "writer" | "book";

export type VisualEntityEditInput = {
  entityType: VisualEntityType;
  entityId: string;
  field: string;
  value: unknown;
  expectedUpdatedAt?: string;
};

type FieldRule = {
  kind: "text" | "integer" | "list" | "image";
  maxLength?: number;
  maxItems?: number;
  required?: boolean;
};

const writerFieldRules = {
  // An empty quick edit removes the override and reveals the reviewed source
  // name again; it never publishes an empty writer name.
  name: { kind: "text", maxLength: 300 },
  fullName: { kind: "text", maxLength: 300 },
  years: { kind: "text", maxLength: 80 },
  birthDate: { kind: "text", maxLength: 80 },
  deathDate: { kind: "text", maxLength: 80 },
  birthPlace: { kind: "text", maxLength: 300 },
  deathPlace: { kind: "text", maxLength: 300 },
  awards: { kind: "list", maxItems: 120, maxLength: 500 },
  genres: { kind: "list", maxItems: 80, maxLength: 240 },
  languages: { kind: "list", maxItems: 40, maxLength: 120 },
  nationality: { kind: "text", maxLength: 240 },
} as const satisfies Record<string, FieldRule>;

const bookFieldRules = {
  title: { kind: "text", maxLength: 300, required: true },
  originalTitle: { kind: "text", maxLength: 300 },
  firstPublished: { kind: "integer" },
  originalLanguage: { kind: "text", maxLength: 120 },
  description: { kind: "text", maxLength: 5_000 },
  genres: { kind: "list", maxItems: 80, maxLength: 240 },
  tags: { kind: "list", maxItems: 80, maxLength: 240 },
  sourceUrl: { kind: "image", maxLength: 2_000 },
  editorialStatus: { kind: "text", maxLength: 16, required: true },
} as const satisfies Record<string, FieldRule>;

export const visualWriterFields = Object.freeze(
  Object.keys(writerFieldRules)
);
export const visualBookFields = Object.freeze(Object.keys(bookFieldRules));

const protectedWriterPortraitFields = new Set([
  "portrait",
  "portraitAlt",
  "portraitSourceUrl",
  "portraitRights",
]);

const workColumnByField = {
  title: "title",
  originalTitle: "original_title",
  firstPublished: "first_published",
  originalLanguage: "original_language",
  description: "description",
  genres: "genres",
  tags: "tags",
  sourceUrl: "source_url",
  editorialStatus: "editorial_status",
} as const;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
  const items = source.flatMap((item) => {
    if (typeof item !== "string") throw new Error("Элемент списка должен быть текстом.");
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) return [];
    if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
      throw new Error("Элемент списка содержит управляющий символ.");
    }
    if (rule.maxLength && normalized.length > rule.maxLength) {
      throw new Error(`Элемент списка длиннее ${rule.maxLength} символов.`);
    }
    seen.add(normalized);
    return [normalized];
  });
  if (rule.maxItems && items.length > rule.maxItems) {
    throw new Error(`В списке больше ${rule.maxItems} элементов.`);
  }
  return items;
}

function normalizedInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(normalized) || normalized < -3000 || normalized > 2100) {
    throw new Error("Год должен быть целым числом от −3000 до 2100.");
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
    throw new Error("Укажите HTTPS-адрес или безопасный путь к файлу сайта.");
  }
  return normalized;
}

function normalizeByRule(value: unknown, rule: FieldRule) {
  if (rule.kind === "integer") return normalizedInteger(value);
  if (rule.kind === "list") return normalizedList(value, rule);
  if (rule.kind === "image") return normalizedImage(value, rule);
  return normalizedText(value, rule);
}

function stableParts(entityId: string, expected: 2 | 3) {
  const normalized = entityId.trim();
  if (!normalized || normalized.length > 520 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("Некорректный идентификатор сущности.");
  }
  const parts = normalized.split(":");
  if (
    parts.length !== expected ||
    parts.some(
      (part) =>
        !part ||
        part.length > 240 ||
        !/^[\p{L}\p{N}_.-]+$/u.test(part)
    )
  ) {
    throw new Error("Некорректный постоянный идентификатор сущности.");
  }
  return parts;
}

export function parseWriterEntityId(entityId: string) {
  const [countryId, writerId] = stableParts(entityId, 2);
  return { entityId: `${countryId}:${writerId}`, countryId, writerId };
}

export function parseBookEntityId(entityId: string) {
  const [countryId, writerId, localWorkId] = stableParts(entityId, 3);
  return {
    entityId: `${countryId}:${writerId}:${localWorkId}`,
    countryId,
    writerId,
    localWorkId,
  };
}

export function parseVisualEntityEdit(input: unknown) {
  if (!plainRecord(input)) throw new Error("Некорректное изменение.");
  const entityType = input.entityType;
  const entityId = typeof input.entityId === "string" ? input.entityId : "";
  const field = typeof input.field === "string" ? input.field : "";
  if (entityType !== "writer" && entityType !== "book") {
    throw new Error("Эта сущность не поддерживает прямое редактирование.");
  }
  const rules: Record<string, FieldRule> =
    entityType === "writer" ? writerFieldRules : bookFieldRules;
  const rule = rules[field];
  if (!rule) throw new Error("Это поле нельзя менять из визуального редактора.");
  const identity =
    entityType === "writer"
      ? parseWriterEntityId(entityId)
      : parseBookEntityId(entityId);
  if (
    entityType === "book" &&
    field === "editorialStatus" &&
    !["draft", "reviewed", "verified"].includes(String(input.value))
  ) {
    throw new Error("Недопустимый редакционный статус произведения.");
  }
  return {
    entityType,
    entityId: identity.entityId,
    identity,
    field,
    value: normalizeByRule(input.value, rule),
  } as const;
}

function isEmptyWriterOverride(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Empty quick edits remove the override instead of masking the reviewed source
 * profile with an empty string/list. Non-empty legacy fields are preserved.
 */
export function mergeWriterOverrideFields(
  existing: unknown,
  field: string,
  value: unknown
) {
  if (!(field in writerFieldRules)) {
    throw new Error("Это поле писателя нельзя менять.");
  }
  const source = plainRecord(existing) ? existing : {};
  const merged = Object.fromEntries(
    Object.entries(source).filter(
      ([fieldName, current]) =>
        !protectedWriterPortraitFields.has(fieldName) &&
        !isEmptyWriterOverride(current)
    )
  );
  if (isEmptyWriterOverride(value)) {
    delete merged[field];
  } else {
    merged[field] = value;
  }
  return merged;
}

export function literaryWorkPatch(field: string, value: unknown) {
  const column = workColumnByField[field as keyof typeof workColumnByField];
  if (!column) throw new Error("Это поле произведения нельзя менять.");
  return { [column]: value } as Record<string, unknown>;
}

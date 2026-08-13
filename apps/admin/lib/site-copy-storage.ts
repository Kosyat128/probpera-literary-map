export type SiteCopyValues = {
  ru: Record<string, string>;
  en: Record<string, string>;
};

export type SiteCopyRow = {
  key: string;
  ru: string;
  en: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storedLocale(value: unknown) {
  const result: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(objectValue(value))) {
    if (typeof candidate === "string" && candidate.trim()) {
      result[key] = candidate.trim();
    }
  }
  return result;
}

export function readSiteCopyValues(value: unknown): SiteCopyValues {
  const copy = objectValue(value);
  return {
    ru: storedLocale(copy.ru),
    en: storedLocale(copy.en),
  };
}

export function mergeSiteCopyRows(
  current: SiteCopyValues,
  rows: readonly SiteCopyRow[],
  interfaceMirrorByKey: ReadonlyMap<string, string> = new Map()
): SiteCopyValues {
  const ru = { ...current.ru };
  const en = { ...current.en };
  for (const row of rows) {
    const targetKeys = [row.key];
    const interfaceMirror = interfaceMirrorByKey.get(row.key);
    if (interfaceMirror) targetKeys.push(interfaceMirror);
    for (const targetKey of targetKeys) {
      if (row.ru) ru[targetKey] = row.ru;
      else delete ru[targetKey];
      if (row.en) en[targetKey] = row.en;
      else delete en[targetKey];
    }
  }
  return { ru, en };
}

/**
 * Inline editing currently changes only the Russian interface copy. Keep the
 * independently curated English value intact instead of treating an omitted
 * locale as an explicit deletion.
 */
export function mergeInlineRussianSiteCopy(
  current: SiteCopyValues,
  key: string,
  value: string
): SiteCopyValues {
  return mergeSiteCopyRows(current, [
    { key, ru: value, en: current.en[key] || "" },
  ]);
}

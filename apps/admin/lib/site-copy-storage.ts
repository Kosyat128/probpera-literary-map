import { normalizeShortHyphens } from "./short-hyphens";

export type SiteCopyValues = {
  ru: Record<string, string>;
  en: Record<string, string>;
};

export type SiteCopyRow = {
  key: string;
  ru: string;
  en: string;
};

const MAX_SITE_COPY_KEY_LENGTH = 1_200;
const forbiddenKeySegment = /(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/iu;

function safeStorageKey(value: string) {
  const key = normalizeShortHyphens(value).trim();
  return key &&
    key.length <= MAX_SITE_COPY_KEY_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(key) &&
    !forbiddenKeySegment.test(key)
    ? key
    : null;
}

function localeMap(value: Record<string, string>) {
  const result = new Map<string, string>();
  for (const [rawKey, candidate] of Object.entries(value)) {
    const key = safeStorageKey(rawKey);
    if (key) result.set(key, candidate);
  }
  return result;
}

function localeRecord(value: ReadonlyMap<string, string>) {
  return Object.fromEntries(value) as Record<string, string>;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storedLocale(value: unknown) {
  const result = new Map<string, string>();
  for (const [rawKey, candidate] of Object.entries(objectValue(value))) {
    const key = safeStorageKey(rawKey);
    if (typeof candidate === "string" && candidate.trim()) {
      if (!key) continue;
      result.set(key, normalizeShortHyphens(
        candidate.trim()
      ));
    }
  }
  return localeRecord(result);
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
  const ru = localeMap(current.ru);
  const en = localeMap(current.en);
  for (const row of rows) {
    const targetKeys = [row.key];
    const interfaceMirror = interfaceMirrorByKey.get(row.key);
    if (interfaceMirror) targetKeys.push(interfaceMirror);
    for (const rawTargetKey of targetKeys) {
      const targetKey = safeStorageKey(rawTargetKey);
      if (!targetKey) throw new Error("Invalid site-copy storage key.");
      if (row.ru) ru.set(targetKey, row.ru);
      else ru.delete(targetKey);
      if (row.en) en.set(targetKey, row.en);
      else en.delete(targetKey);
    }
  }
  return { ru: localeRecord(ru), en: localeRecord(en) };
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
  const currentEnglish = localeMap(current.en).get(key) || "";
  return mergeSiteCopyRows(current, [
    { key, ru: value, en: currentEnglish },
  ]);
}

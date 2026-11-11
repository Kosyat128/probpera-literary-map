import { translationSourceHash } from "./auto-translate-site-copy";
import { readSiteCopyValues } from "./site-copy-storage";
import { validateSiteCopyTranslationParameters } from "./site-copy-parameters";

export type SiteCopyTranslationItem = { key: string; text: string };
export type SiteCopyTranslationSourceItem = SiteCopyTranslationItem & { sourceHash: string };
export type SiteCopyTranslationOwnership = "absent" | "machine" | "manual" | "invalid";

const sourceHashPattern = /^[a-f0-9]{64}$/u;
const forbiddenKeySegment = /(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/iu;

export class SiteCopyTranslationContractError extends Error {
  constructor() {
    super("Site-copy translation data is unavailable or ambiguous");
    this.name = "SiteCopyTranslationContractError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!record(value)) throw new SiteCopyTranslationContractError();
  return value;
}

function maps(settings: unknown) {
  if (!record(settings) || settings.systemKey !== "site-copy-overrides") {
    throw new SiteCopyTranslationContractError();
  }
  const copy = optionalRecord(settings.siteCopy);
  const premium = optionalRecord(settings.premiumTranslation);
  return { settings, ru: optionalRecord(copy.ru), en: optionalRecord(copy.en),
    machine: optionalRecord(premium.siteCopyEn) };
}

export function validSiteCopyTranslationKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 1_200 &&
    key.trim() === key && !/[\u0000-\u001f\u007f]/u.test(key) && !forbiddenKeySegment.test(key);
}

export function inspectSiteCopyTranslationOwnership(
  settings: unknown,
  key: string
): SiteCopyTranslationOwnership {
  try {
    const value = maps(settings);
    if (!validSiteCopyTranslationKey(key)) return "invalid";
    const englishPresent = Object.hasOwn(value.en, key);
    const entry = value.machine[key];
    const machineOwned = record(entry) && typeof entry.sourceHash === "string" &&
      sourceHashPattern.test(entry.sourceHash);
    // A present authored value, including an explicit blank or malformed value,
    // never becomes permission to generate merely because a reader omitted it.
    if (englishPresent && !machineOwned) return "manual";
    if (englishPresent && typeof value.en[key] !== "string") return "invalid";
    if (Object.hasOwn(value.machine, key) && !record(entry)) return "invalid";
    return englishPresent ? "machine" : "absent";
  } catch {
    return "invalid";
  }
}

export async function siteCopyTranslationSource(settings: unknown): Promise<{
  settings: Record<string, unknown>;
  items: SiteCopyTranslationSourceItem[];
  manual: number;
  current: number;
}> {
  const value = maps(settings);
  const projected = readSiteCopyValues(value.settings.siteCopy);
  for (const [rawLocale, projectedLocale] of [[value.ru, projected.ru], [value.en, projected.en]]) {
    for (const [key, text] of Object.entries(rawLocale)) {
      if (!validSiteCopyTranslationKey(key) || (typeof text === "string" && text.trim() &&
          !Object.hasOwn(projectedLocale, key))) {
        throw new SiteCopyTranslationContractError();
      }
    }
  }
  const items: SiteCopyTranslationSourceItem[] = [];
  let manual = 0;
  let current = 0;
  for (const [key, rawText] of Object.entries(value.ru)) {
    if (typeof rawText !== "string") {
      throw new SiteCopyTranslationContractError();
    }
    if (!rawText.trim()) continue;
    const text = projected.ru[key];
    if (!text || text.length > 4_000) throw new SiteCopyTranslationContractError();
    const ownership = inspectSiteCopyTranslationOwnership(settings, key);
    if (ownership === "invalid") throw new SiteCopyTranslationContractError();
    if (ownership === "manual") { manual += 1; continue; }
    const sourceHash = await translationSourceHash({ key, text });
    const entry = value.machine[key];
    const english = projected.en[key];
    if (ownership === "machine" && record(entry) && entry.sourceHash === sourceHash &&
        typeof english === "string" && english.length > 0 && english.length <= 4_000 &&
        !/\p{Script=Cyrillic}/u.test(english)) {
      current += 1;
      continue;
    }
    items.push({ key, text, sourceHash });
  }
  return { settings: value.settings, items, manual, current };
}

export function validateSiteCopyTranslationCandidate(
  sourceItems: readonly SiteCopyTranslationSourceItem[],
  payload: unknown
): { items: SiteCopyTranslationItem[] } {
  if (!record(payload) || Object.keys(payload).length !== 1 || !Array.isArray(payload.items) ||
      sourceItems.length < 1 || sourceItems.length > 50 || payload.items.length !== sourceItems.length ||
      new Set(sourceItems.map(item => item.key)).size !== sourceItems.length) {
    throw new SiteCopyTranslationContractError();
  }
  const items = payload.items.map((item: unknown, index: number) => {
    const source = sourceItems[index];
    if (!record(item) || Object.keys(item).length !== 2 || !Object.hasOwn(item, "key") ||
        !Object.hasOwn(item, "text") || !validSiteCopyTranslationKey(item.key) || item.key !== source.key ||
        typeof item.text !== "string" || !item.text.trim() || item.text.length > 4_000 ||
        /\p{Script=Cyrillic}/u.test(item.text) || !sourceHashPattern.test(source.sourceHash)) {
      throw new SiteCopyTranslationContractError();
    }
    validateSiteCopyTranslationParameters(source, item.text);
    return { key: item.key, text: item.text };
  });
  return { items };
}

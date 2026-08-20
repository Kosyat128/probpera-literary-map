export const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function localeCopy(value) {
  const result = {};
  for (const [key, candidate] of Object.entries(objectValue(value))) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (normalized) result[key] = normalized;
  }
  return result;
}

export function isSiteCopySystemBlock(block) {
  return objectValue(block?.settings).systemKey === SITE_COPY_SYSTEM_KEY;
}

export function normalizeHomepageEditorialCopy(block) {
  const settings = objectValue(block?.settings);
  if (
    settings.coreSectionKey !== "book-month" ||
    settings.eyebrow !== "Выбор энциклопедии"
  ) {
    return block;
  }
  return {
    ...block,
    settings: {
      ...settings,
      eyebrow: "Выбор редакции",
    },
  };
}

export function extractSiteCopyFromHomepageBlocks(blocks) {
  const systemBlocks = blocks
    .filter(isSiteCopySystemBlock)
    .sort((first, second) =>
      String(second.updated_at || "").localeCompare(
        String(first.updated_at || "")
      )
    );
  const settings = objectValue(systemBlocks[0]?.settings);
  const storedCopy = objectValue(settings.siteCopy);

  return {
    homepageBlocks: blocks
      .filter((block) => !isSiteCopySystemBlock(block))
      .map(normalizeHomepageEditorialCopy),
    siteCopy: {
      ru: localeCopy(storedCopy.ru),
      en: localeCopy(storedCopy.en),
    },
  };
}

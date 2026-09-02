function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function definedEntries(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

export function groupPublishedWorkRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const workId = text(row?.work_id);
    if (!workId) continue;
    if (!grouped.has(workId)) grouped.set(workId, []);
    grouped.get(workId).push(row);
  }
  return grouped;
}

export function publishedWorkTranslations(workId, rowsByWorkId) {
  const translations = {};
  for (const row of rowsByWorkId.get(text(workId)) || []) {
    const locale = text(row.locale);
    if (locale !== "ru" && locale !== "en") continue;
    const metadata = object(row.metadata);
    translations[locale] = definedEntries({
      locale,
      title: row.title,
      description: row.description,
      sourceLanguage: row.source_language,
      status: row.editorial_status,
      sourceUrls: Array.isArray(row.source_urls) ? [...row.source_urls] : [],
      method: row.translation_method,
      reviewedAt: row.reviewed_at || undefined,
      titleEvidence: metadata.titleEvidence,
      descriptionProvenance: metadata.descriptionProvenance,
    });
  }
  return Object.keys(translations).length ? translations : undefined;
}

export function publishedWorkSources(workId, rowsByWorkId) {
  const sources = (rowsByWorkId.get(text(workId)) || []).map((row) => {
    const metadata = object(row.metadata);
    return definedEntries({
      provider: row.provider,
      authorityId: metadata.authorityId,
      authorityTier: metadata.authorityTier,
      country: metadata.country,
      market: metadata.market,
      language: metadata.language,
      recordKind: metadata.recordKind,
      recordId: metadata.recordId,
      url: row.source_url,
      fields: Array.isArray(row.field_names) ? [...row.field_names] : [],
      license: row.license_name || undefined,
      usage: row.usage,
      retrievedAt: row.retrieved_at,
    });
  });
  return sources.length ? sources : undefined;
}

export function publishedWorkMetadata(metadataValue) {
  const metadata = object(metadataValue);
  return definedEntries({
    localizedTitles: metadata.localizedTitles,
    canon: metadata.canon,
  });
}

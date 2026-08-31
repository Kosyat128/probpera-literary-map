function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

/**
 * Apply the biography portion of durable writer overrides to a previously
 * published snapshot. An explicit biographyTranslations property owns the
 * entire nested locale map, including the empty result: invalid/draft text
 * must clear an older public value instead of silently resurrecting it.
 */
export function applyPublishedWriterBiographyOverrides({
  snapshotOverrides,
  rows,
  normalizeBiographyTranslations,
}) {
  const result = { ...objectValue(snapshotOverrides) };
  for (const row of rows) {
    const fields = objectValue(row.fields);
    if (!Object.hasOwn(fields, "biographyTranslations")) continue;

    const key = `${row.country_id}:${row.writer_id}`;
    const existing = { ...objectValue(result[key]) };
    const biographies = normalizeBiographyTranslations(
      fields.biographyTranslations,
      { key, row, existing }
    );
    // Keep an explicit empty map as a durable publication tombstone. Removing
    // the nested property (or the whole override) would let the later shallow
    // CMS merge fall back to the checked-in static RU/EN profiles and resurrect
    // text that an editor deliberately moved out of a publishable state.
    existing.biographyTranslations = biographies;
    result[key] = existing;
  }
  return result;
}

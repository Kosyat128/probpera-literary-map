/** Build-selected bundled web presentation, never evidence of a paid license.
 * The historical name includes the local web UI in Android/iOS shells.
 * Native entries own their host bootstrap and never execute the PWA entry.
 */
export const isControlledWebEdition =
  typeof __LITERARY_PLANET_EDITION__ !== "undefined" &&
  (__LITERARY_PLANET_EDITION__ === "pwa" || __LITERARY_PLANET_EDITION__ === "native");

export const canonicalJournalOrigin = "https://probpera.ru";

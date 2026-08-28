const categoryRouteSlugs: Record<string, string> = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
  miscellaneous: "raznoe",
};

export function articleSectionSlug(categorySlug?: string | null) {
  return categoryRouteSlugs[categorySlug || ""] || "materialy";
}

export function articlePublicPath(slug: string, categorySlug?: string | null) {
  return `/stati/${articleSectionSlug(categorySlug)}/${slug}`;
}

export function articleCanonicalUrl(
  publicSiteUrl: string,
  slug: string,
  categorySlug?: string | null
) {
  return `${publicSiteUrl.replace(/\/+$/u, "")}${articlePublicPath(
    slug,
    categorySlug
  )}`;
}

function normalizedCanonicalUrl(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

export function initialEnglishCanonicalState(input: {
  persistedCanonical?: string | null;
  russianCanonical: string;
  generatedEnglishCanonical: string;
}) {
  const persistedCanonical = input.persistedCanonical?.trim() || "";
  const isLegacyRussianCanonical =
    Boolean(persistedCanonical) &&
    normalizedCanonicalUrl(persistedCanonical) ===
      normalizedCanonicalUrl(input.russianCanonical);
  const useGeneratedEnglishCanonical =
    !persistedCanonical || isLegacyRussianCanonical;

  return {
    canonicalUrl: useGeneratedEnglishCanonical
      ? input.generatedEnglishCanonical
      : persistedCanonical,
    isEdited: !useGeneratedEnglishCanonical,
  };
}

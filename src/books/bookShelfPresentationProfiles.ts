import type { WorkAudienceCategory } from "./bookArchiveFacets";

export type BookShelfEraClass =
  | "heritage"
  | "postwar"
  | "contemporary"
  | "undated";

export type BookShelfAudienceClass =
  | "children"
  | "young-adult"
  | "general";

export type BookShelfTreatment =
  | "classic-heritage"
  | "classic-library"
  | "postwar-literary"
  | "modern-bestseller"
  | "modern-literary"
  | "children-bright"
  | "children-soft"
  | "neutral-editorial"
  | "typographic-premium";

export type BookShelfVerifiedEditionMaterial =
  | "cloth"
  | "leather"
  | "paperback"
  | "board";

export type BookShelfPresentationProfileInput = Readonly<{
  bookKey: string;
  firstPublished?: number | null;
  audienceIds?: readonly WorkAudienceCategory[];
  hasRealCover: boolean;
  verifiedEditionMaterial?: BookShelfVerifiedEditionMaterial | null;
}>;

export type BookShelfPresentationProfile = Readonly<{
  eraClass: BookShelfEraClass;
  audienceClass: BookShelfAudienceClass;
  hasRealCover: boolean;
  verifiedEditionMaterial: BookShelfVerifiedEditionMaterial | null;
  treatment: BookShelfTreatment;
  /** Decorative renderer preset only; never presented as edition metadata. */
  materialPreset:
    | "heritage-cloth"
    | "library-cloth"
    | "matte-board"
    | "soft-touch"
    | "paper-grain";
  spinePreset: "ornate" | "ruled" | "minimal" | "playful";
  ornamentLevel: 0 | 1 | 2 | 3;
  paletteStrategy:
    | "cover-led"
    | "heritage-jewel"
    | "editorial-muted"
    | "contemporary-contrast"
    | "children-warm";
  contrastMode: "dark-on-light" | "light-on-dark" | "adaptive";
}>;

const stableHash = (value: string) => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const resolveEraClass = (
  firstPublished: number | null | undefined
): BookShelfEraClass => {
  if (!Number.isInteger(firstPublished) || !firstPublished) return "undated";
  if (firstPublished < 1946) return "heritage";
  if (firstPublished < 2000) return "postwar";
  return "contemporary";
};

const resolveAudienceClass = (
  audienceIds: readonly WorkAudienceCategory[] | undefined
): BookShelfAudienceClass => {
  if (audienceIds?.includes("children")) return "children";
  if (audienceIds?.includes("young-adult")) return "young-adult";
  return "general";
};

const resolveTreatment = (
  eraClass: BookShelfEraClass,
  audienceClass: BookShelfAudienceClass,
  hasRealCover: boolean,
  variant: number
): BookShelfTreatment => {
  if (audienceClass === "children") {
    return variant % 2 === 0 ? "children-bright" : "children-soft";
  }
  if (eraClass === "heritage") {
    return variant % 2 === 0 ? "classic-heritage" : "classic-library";
  }
  if (eraClass === "postwar") return "postwar-literary";
  if (eraClass === "contemporary") {
    return variant % 2 === 0 ? "modern-literary" : "modern-bestseller";
  }
  if (!hasRealCover) return "typographic-premium";
  return "neutral-editorial";
};

/**
 * Resolves a deterministic visual profile from verified archive fields only.
 * The result controls presentation, not bibliographic claims.
 */
export const resolveBookShelfPresentationProfile = ({
  bookKey,
  firstPublished,
  audienceIds,
  hasRealCover,
  verifiedEditionMaterial = null,
}: BookShelfPresentationProfileInput): BookShelfPresentationProfile => {
  const variant = stableHash(bookKey.trim() || "book");
  const eraClass = resolveEraClass(firstPublished);
  const audienceClass = resolveAudienceClass(audienceIds);
  const treatment = resolveTreatment(
    eraClass,
    audienceClass,
    hasRealCover,
    variant
  );

  if (audienceClass === "children") {
    return {
      eraClass,
      audienceClass,
      hasRealCover,
      verifiedEditionMaterial,
      treatment,
      materialPreset: "paper-grain",
      spinePreset: "playful",
      ornamentLevel: treatment === "children-bright" ? 2 : 1,
      paletteStrategy: hasRealCover ? "cover-led" : "children-warm",
      contrastMode: "adaptive",
    };
  }

  if (eraClass === "heritage") {
    return {
      eraClass,
      audienceClass,
      hasRealCover,
      verifiedEditionMaterial,
      treatment,
      materialPreset:
        verifiedEditionMaterial === "leather"
          ? "heritage-cloth"
          : "library-cloth",
      spinePreset: treatment === "classic-heritage" ? "ornate" : "ruled",
      ornamentLevel: treatment === "classic-heritage" ? 3 : 2,
      paletteStrategy: hasRealCover ? "cover-led" : "heritage-jewel",
      contrastMode: hasRealCover ? "adaptive" : "light-on-dark",
    };
  }

  if (eraClass === "postwar") {
    return {
      eraClass,
      audienceClass,
      hasRealCover,
      verifiedEditionMaterial,
      treatment,
      materialPreset: "matte-board",
      spinePreset: "ruled",
      ornamentLevel: 1,
      paletteStrategy: hasRealCover ? "cover-led" : "editorial-muted",
      contrastMode: "adaptive",
    };
  }

  return {
    eraClass,
    audienceClass,
    hasRealCover,
    verifiedEditionMaterial,
    treatment,
    materialPreset: hasRealCover ? "soft-touch" : "matte-board",
    spinePreset: "minimal",
    ornamentLevel: treatment === "typographic-premium" ? 1 : 0,
    paletteStrategy: hasRealCover ? "cover-led" : "contemporary-contrast",
    contrastMode: "adaptive",
  };
};

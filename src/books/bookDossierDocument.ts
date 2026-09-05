import type { WorkLocale } from "../data/countries/types";

export const BOOK_DOSSIER_SCHEMA_VERSION = 2 as const;
export const BOOK_DOSSIER_DATA_VERSION = "book-dossier-v2" as const;
export const BOOK_DOSSIER_LIMITS = Object.freeze({
  CORE: Object.freeze({ minimum: 4, maximum: 7 }),
  ENRICHED: Object.freeze({ minimum: 7, maximum: 12 }),
  SIGNATURE: Object.freeze({ minimum: 10, maximum: 18 }),
});
export const BOOK_DOSSIER_STATIC_POLICY = Object.freeze({
  contentMode: "DOSSIER_ONLY" as const,
  hostedFullText: false,
  quotes: false,
  thirdPartyMedia: false,
  downloads: false,
});

export const bookDossierProfiles = ["ROMAN", "SHORT_STORY", "STORY_COLLECTION", "POETRY", "DRAMA", "NONFICTION", "ESSAY", "MEMOIR", "BIOGRAPHY", "CHILDREN", "FOLKLORE", "SACRED", "HISTORICAL_TEXT"] as const;
export type BookDossierProfile = (typeof bookDossierProfiles)[number];
export type BookDossierTier = keyof typeof BOOK_DOSSIER_LIMITS;
export type BookDossierReadingMode = "BEFORE_READING" | "DURING_READING" | "AFTER_READING";
export type BookDossierSpoiler = "NONE" | "LIGHT" | "MAJOR" | "ENDING";
export const bookDossierTemplates = ["title", "contents", "passport", "essay", "key-points", "timeline", "characters", "relationships", "themes", "related-articles", "sources", "legal-reading", "colophon"] as const;
export type BookDossierTemplate = (typeof bookDossierTemplates)[number];
export type BookDossierStatus = "DRAFT" | "FACT_REVIEW" | "RIGHTS_REVIEW" | "EDITORIAL_REVIEW" | "DESIGN_REVIEW" | "ACCESSIBILITY_REVIEW" | "READY" | "PUBLISHED" | "RE_REVIEW_REQUIRED" | "BLOCKED" | "ARCHIVED";
export type BookDossierReviewStage = "facts" | "rights" | "editorial" | "design" | "accessibility" | "final";
export type BookDossierDesignProof = Readonly<{
  version: "book-dossier-design-v1";
  contentChecksum: string;
  fontVersion: string;
  layoutVersion: string;
  measuredAt: string;
  method: "CANVAS_LOCAL_FONTS";
  variantPages: readonly Readonly<{ id: string; pageCount: number }>[];
}>;
export type BookDossierHumanReview = Readonly<{
  stage: BookDossierReviewStage;
  actorId: string;
  actorKind: "HUMAN";
  reviewedAt: string;
  dossierVersion: string;
  contentChecksum: string;
  decision: "APPROVED" | "CHANGES_REQUIRED";
  designProof?: BookDossierDesignProof;
}>;

export type BookDossierRightsClass = "EDITORIAL_OWNED" | "FACTUAL_METADATA" | "PUBLIC_DOMAIN_VERIFIED" | "OPEN_LICENSE_VERIFIED" | "LICENSED_VERIFIED" | "EXTERNAL_LINK_ONLY" | "BLOCKED";
export type BookDossierRightsEnvelope = Readonly<{
  id: string;
  classification: BookDossierRightsClass;
  contentType: "editorial" | "metadata" | "external-link" | "quote" | "media" | "full-text";
  author: string;
  rightsBasis: string;
  rightsHolder: string;
  sourceIds: readonly string[];
  territories: readonly string[];
  allowedSurfaces: readonly ("HTML" | "3D" | "INDEX" | "DOWNLOAD" | "OFFLINE")[];
  allow3D: boolean;
  allowHTML: boolean;
  allowIndexing: boolean;
  allowDownload: boolean;
  allowOfflineCache: boolean;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  recheckAt: string;
  attribution: string;
  evidenceIds: readonly string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewKind: "HUMAN" | "UNREVIEWED";
  contentChecksum: string;
  originalWork: string;
  originalAuthor: string;
  sourceLanguage: string;
  translation?: Readonly<{
    id: string;
    translator: string;
    publication: string;
    rightsBasis: string;
    evidenceIds: readonly string[];
    approvedTextChecksum: string;
    reviewedBy: string | null;
    reviewedAt: string | null;
  }>;
}>;

export type BookDossierSource = Readonly<{
  id: string;
  provider: string;
  title: string;
  url: string;
  kind: "editorial" | "library" | "publisher" | "rightsholder" | "reference";
  reviewedAt: string | null;
  reviewedBy: string | null;
  attribution: string;
}>;
export type BookDossierItem = Readonly<{
  id: string;
  label: string;
  text?: string;
  value?: string;
  href?: string;
  sourceIds: readonly string[];
  spoiler: BookDossierSpoiler;
  fromId?: string;
  toId?: string;
}>;
export type BookDossierArticleReuse = Readonly<{
  reuseInBookDossier: true;
  articleId: string;
  sourceBlockId: string;
  sourceVersion: string;
  approvedExcerpt: string;
  checksum: string;
  approvedBy: string;
  approvedAt: string;
}>;
export type BookDossierBlockKind = "metadata" | "editorial" | "key-points" | "timeline" | "characters" | "relationships" | "themes" | "related-articles" | "sources" | "legal-links" | "colophon" | "quote" | "media" | "full-text";
export type BookDossierBlock = Readonly<{
  id: string;
  sectionId: string;
  kind: BookDossierBlockKind;
  title: string;
  paragraphs: readonly string[];
  items: readonly BookDossierItem[];
  sourceIds: readonly string[];
  rightsId: string;
  spoiler: BookDossierSpoiler;
  readingModes: readonly BookDossierReadingMode[];
  availableAfterItemId?: string;
  translationId?: string;
  articleReuse?: BookDossierArticleReuse;
}>;
export type BookDossierSection = Readonly<{
  id: string;
  title: string;
  template: BookDossierTemplate;
  purpose: "identity" | "why-read" | "description" | "passport" | "journal" | "provenance" | "legal-reading" | "context" | "analysis" | "navigation" | "colophon";
  spoiler: BookDossierSpoiler;
  blockIds: readonly string[];
}>;

/** Private CMS input. Never serialize drafts, rights envelopes or review actors publicly. */
export type BookDossierDraft = Readonly<{
  schemaVersion: 2;
  bookKey: string;
  locale: WorkLocale;
  dossierVersion: string;
  title: string;
  writer: string;
  profile: BookDossierProfile;
  tier: BookDossierTier;
  requiredLocales: readonly WorkLocale[];
  translationReadyLocales: readonly WorkLocale[];
  sections: readonly BookDossierSection[];
  blocks: readonly BookDossierBlock[];
  sources: readonly BookDossierSource[];
  rights: readonly BookDossierRightsEnvelope[];
}>;
export type BookDossierAuditEvent = Readonly<{
  id: string;
  actorId: string;
  at: string;
  action: "CREATE" | "EDIT" | "REVIEW" | "PUBLISH" | "REVOKE" | "ARCHIVE";
  reason: string;
  previousChecksum: string | null;
  contentChecksum: string;
}>;
export type BookDossierRecord = Readonly<{
  draft: BookDossierDraft;
  status: BookDossierStatus;
  revision: number;
  contentChecksum: string;
  reviews: readonly BookDossierHumanReview[];
  audit: readonly BookDossierAuditEvent[];
}>;

export type BookDossierSemanticAnchor = Readonly<{
  sectionId: string;
  blockId: string;
  itemId?: string;
  dossierVersion: string;
  locale: WorkLocale;
  readingMode: BookDossierReadingMode;
}>;
export type BookDossierPublicSource = Readonly<{
  id: string;
  provider: string;
  title: string;
  sourceUrl: string;
  usageLabel: string;
  reviewedAt?: string;
  attribution?: string;
}>;
export type BookDossierPublicBlock = Readonly<{
  id: string;
  sectionId: string;
  kind: Exclude<BookDossierBlockKind, "quote" | "media" | "full-text">;
  title: string;
  paragraphs: readonly string[];
  items: readonly BookDossierItem[];
  sources: readonly BookDossierPublicSource[];
  anchor: BookDossierSemanticAnchor;
}>;
export type BookDossierPage = Readonly<{
  id: string;
  index: number;
  sectionId: string;
  template: BookDossierTemplate;
  anchor: BookDossierSemanticAnchor;
  eyebrow: string;
  title: string;
  rows: readonly Readonly<{ id: string; kind: string; label: string; value: string }>[];
  paragraphs: readonly string[];
  sources: readonly BookDossierPublicSource[];
  blocks: readonly BookDossierPublicBlock[];
}>;
/** The sole public payload shared by DOM, pagination and 3D rendering. */
export type BookDossierProgressStep = Readonly<{ id: string; label: string }>;
export type BookDossierDocumentV2 = Readonly<{
  schemaVersion: 2;
  bookKey: string;
  locale: WorkLocale;
  dossierVersion: string;
  profile: BookDossierProfile | null;
  tier: BookDossierTier | null;
  themeVersion: string;
  pageDataVersion: string;
  cacheKey: string;
  contentMode: "DOSSIER_ONLY";
  readingMode: BookDossierReadingMode;
  /** Short live lease for approved CMS payloads. Catalogue fallback has no lease. */
  validUntil?: string;
  /** Safe ordered reading checkpoints; the selected prefix remains private client state. */
  progressSteps?: readonly BookDossierProgressStep[];
  pages: readonly BookDossierPage[];
  contents: readonly Readonly<{ id: string; title: string; anchor: BookDossierSemanticAnchor }>[];
}>;
export type BookDossierIssue = Readonly<{ code: string; path: string }>;

/** Derived data candidates only. These contracts confer no editorial approval. */
export type ContentLocale = "ru" | "en";
export type ContentField = "name" | "biography" | "title" | "description";
export type ContentEntityRef =
  | { kind: "country"; countryId: string }
  | { kind: "writer"; countryId: string; writerId: string }
  | { kind: "work"; countryId: string; writerId: string; workId: string };

export type ContentSourceHashContract = "writer-biography-review-v1" | "utf8-sha256" | null;
export type ContentPublicationBasis =
  | "canonical-name-candidate"
  | "evidenced-title-candidate"
  | "authored-public-prose"
  | "reviewed-source-bound-prose";

export type ContentCandidateUnit = {
  id: string;
  entityRef: ContentEntityRef;
  field: ContentField;
  locale: ContentLocale;
  text: string;
  contentHash: string;
  /** Current observation; never written back as a historical review binding. */
  observedRuSourceHash: string | null;
  /** Copied from an existing review only; missing evidence stays missing. */
  reviewedRuSourceHash: string | null;
  sourceHashContract: ContentSourceHashContract;
  observedTargetHash?: string;
  reviewTargetHash?: string;
  dependencyIds: string[];
  publicationBasis: ContentPublicationBasis;
};

export type HeldContentUnit = {
  id: string;
  entityRef: ContentEntityRef;
  field: ContentField;
  locale: ContentLocale;
  /** Stable diagnostics only. Held text never enters a downloadable file. */
  reasons: string[];
};

export type ContentCandidateSnapshot = {
  schemaVersion: 1;
  contract: "literary-planet-content-candidate-v1";
  sourceCommit: string;
  requiredLocales: ["ru", "en"];
  namespace: "adult";
  units: ContentCandidateUnit[];
  held: HeldContentUnit[];
  releaseReady: false;
};

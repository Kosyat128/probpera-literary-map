import type { WorkProfile } from "../types";
import { isPublishableGeneratedBook } from "../../bookQuality";
import generatedBooks from "./books.generated.json";
import reviewedBooks from "./books.reviewed.json";

type GeneratedBooksPayload = {
  generatedAt: string;
  targetArchiveSize: number;
  source: string;
  works: Record<string, WorkProfile[]>;
};

export type ReviewedBooksPayload = {
  generatedAt: string;
  sourceManifestFingerprint: string;
  source: string;
  works: Record<string, WorkProfile[]>;
};

const payload = generatedBooks as GeneratedBooksPayload;
const reviewedPayload = reviewedBooks as ReviewedBooksPayload;

export const generatedBookDraftCount = Object.values(payload.works).reduce(
  (total, works) =>
    total +
    works.filter((work) => (work.editorial?.status || "draft") === "draft")
      .length,
  0
);

export const generatedPublishedBookCount = Object.values(
  reviewedPayload.works
).reduce(
  (total, works) => total + works.filter(isPublishableGeneratedBook).length,
  0
);

/** Keeps legacy candidates available to audits and the editorial queue. */
export function rawGeneratedBooksForWriter(
  countryId: string,
  writerId: string
) {
  const writerKey = `${countryId}:${writerId}`;
  return (payload.works[writerKey] || []).map((work) => ({
    ...work,
    editorial: { ...work.editorial, status: "draft" as const },
  }));
}

/** Validated overlays generated only from zero-issue curated batches. */
export function reviewedBooksForWriter(countryId: string, writerId: string) {
  return reviewedPayload.works[`${countryId}:${writerId}`] || [];
}

/** Keeps both reviewed overlays and raw candidates available to the archive. */
export function generatedBooksForWriter(countryId: string, writerId: string) {
  return [
    ...reviewedBooksForWriter(countryId, writerId),
    ...rawGeneratedBooksForWriter(countryId, writerId),
  ];
}

/** Visitor-facing callers must use this reviewed bilingual subset. */
export function generatedPublishedBooksForWriter(
  countryId: string,
  writerId: string
) {
  return reviewedBooksForWriter(countryId, writerId).filter(
    isPublishableGeneratedBook
  );
}

import type { WorkProfile } from "../types";
import generatedBooks from "./books.generated.json";

type GeneratedBooksPayload = {
  generatedAt: string;
  targetArchiveSize: number;
  source: string;
  works: Record<string, WorkProfile[]>;
};

const payload = generatedBooks as GeneratedBooksPayload;

export const generatedBookDraftCount = Object.values(payload.works).reduce(
  (total, works) => total + works.length,
  0
);

/** Candidates stay in countries/generated and are joined only by the archive. */
export function generatedBooksForWriter(countryId: string, writerId: string) {
  return (payload.works[`${countryId}:${writerId}`] || []).map((work) => ({
    ...work,
    editorial: { status: "draft" as const },
  }));
}

import reviewOverlay from "./generated/writerBiographyFactReviewCorrections.generated.json";
import type { Country } from "./types";

const corrections = new Map<string, string>(
  Object.entries(reviewOverlay.corrections)
);

/**
 * Applies only proven text corrections. Unchanged reviews never duplicate the
 * legacy prose in the browser bundle, and editorial evidence remains in the
 * build-time reports rather than becoming a public status marker.
 */
export function mergeWriterBiographyFactReviews(
  countries: Country[]
): Country[] {
  if (corrections.size === 0) return countries;
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const text = corrections.get(`${country.id}:${writer.id}`);
      return text ? { ...writer, bio: text } : writer;
    }),
  }));
}

export const writerBiographyFactReviewCounts = {
  reviewed: reviewOverlay.reviewedCount,
  corrected: reviewOverlay.correctedCount,
} as const;

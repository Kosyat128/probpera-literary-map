import type { BookArchiveEntry } from "../data/bookArchive";
import type { BookArchiveQueuePresentation } from "../data/bookArchiveQueue";
import type { Country } from "../data/countries";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";

export type BookArchiveRuntime = {
  buildBookArchive: (countries: Country[]) => BookArchiveEntry[];
  coverArtworkSrcSet: (book: BookArchiveEntry) => string | undefined;
  isEditorialCover: (book: BookArchiveEntry) => boolean;
  isCoverArtworkDisplayAllowed: (book: BookArchiveEntry) => boolean;
  presentBookArchiveEntry: (
    book: BookArchiveEntry,
    language: InterfaceLanguage
  ) => BookArchiveQueuePresentation;
};

let runtimePromise: Promise<BookArchiveRuntime> | null = null;

/** The only production entry point that evaluates the full book graph. */
export function loadBookArchiveRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = Promise.all([
    import("../data/bookArchive"),
    import("../data/bookArchiveQueue"),
  ])
    .then(([archive, queue]) => ({
      buildBookArchive: archive.buildBookArchive,
      coverArtworkSrcSet: archive.coverArtworkSrcSet,
      isEditorialCover: archive.isEditorialCover,
      isCoverArtworkDisplayAllowed: archive.isCoverArtworkDisplayAllowed,
      presentBookArchiveEntry: queue.presentBookArchiveEntry,
    }))
    .catch((error) => {
      runtimePromise = null;
      throw error;
    });
  return runtimePromise;
}

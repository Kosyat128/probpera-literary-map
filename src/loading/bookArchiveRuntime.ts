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
let primaryFailed = false;
function retryBookArchive() {
  const retryModules = import.meta.glob<typeof import("../planet/books")>(
    "../planet/books.ts",
    { query: { stage5Load: "retry" } }
  );
  return retryModules["../planet/books.ts"]();
}

/** The only production entry point that evaluates the full book graph. */
export function loadBookArchiveRuntime(explicitRetry = false) {
  if (runtimePromise) return runtimePromise;
  // A failed facade URL may remain cached by the browser. One compiled retry
  // facade shares the canonical data dependencies; it never retries itself.
  const load = explicitRetry && primaryFailed
    ? retryBookArchive
    : () => import("../planet/books");
  runtimePromise = load()
    .then((archive) => ({
      buildBookArchive: archive.buildBookArchive,
      coverArtworkSrcSet: archive.coverArtworkSrcSet,
      isEditorialCover: archive.isEditorialCover,
      isCoverArtworkDisplayAllowed: archive.isCoverArtworkDisplayAllowed,
      presentBookArchiveEntry: archive.presentBookArchiveEntry,
    }))
    .catch((error) => {
      primaryFailed = true;
      runtimePromise = null;
      throw error;
    });
  return runtimePromise;
}

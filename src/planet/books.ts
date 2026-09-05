/**
 * Full book domain entry for demand-loaded consumers only. Reuse the existing
 * relation keys, evidence gates and public-target lookup; do not create a
 * second archive, index or platform-specific identity scheme here.
 */
export {
  bookArchiveKey,
  buildBookArchive,
  buildPublicBookArchive,
  coverArtworkSrcSet,
  getPublicWriterWorkTitles,
  getWriterWorkTitles,
  isCoverArtworkDisplayAllowed,
  isCoverDisplayAllowed,
  isEditorialCover,
  resolveBookArchiveAuthorTargets,
  resolveBookArchivePublicTarget,
} from "../data/bookArchive";
export {
  bookArchiveQueueItem,
  classifyBookArchiveQueue,
  presentBookArchiveEntry,
  presentBookArchiveQueueItem,
} from "../data/bookArchiveQueue";
export { isPublicBook } from "../data/bookQuality";
export { cmsWriterKey } from "../data/cms/editorialOverrides";
export type { BookArchiveEntry, BuildBookArchiveOptions } from "./types";

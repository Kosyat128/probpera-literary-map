import {
  authorities,
  registryVersion,
} from "../../data/book-canon-source-registry.json";
import { localizedBookTitleEvidenceIssues } from "./bookEvidence";
import { isPublicBook } from "./bookQuality";
import type { WorkLocale, WorkProfile } from "./countries/types";

const titleEvidenceContext = {
  canonRegistry: { authorities, registryVersion },
};

/**
 * A published title in the other locale is a search alias for the same work,
 * never a replacement for its visible localized title. Recheck current evidence
 * so a changed title or withdrawn publication cannot retain an accepted alias.
 * Legacy alternate titles and author credits have separate evidence boundaries.
 */
export function getEvidenceBackedOppositeLocaleBookTitleAliases(
  work: WorkProfile,
  locale: WorkLocale
): string[] {
  if (!isPublicBook(work)) return [];
  const oppositeLocale = locale === "ru" ? "en" : "ru";
  const title = work.translations?.[oppositeLocale]?.title.trim();
  if (!title || title === work.translations?.[locale]?.title.trim()) return [];
  if (
    localizedBookTitleEvidenceIssues(work, oppositeLocale, titleEvidenceContext)
      .length > 0
  ) {
    return [];
  }
  return [title];
}

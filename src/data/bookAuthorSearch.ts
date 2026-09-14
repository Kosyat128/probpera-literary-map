import {
  authorities,
  registryVersion,
} from "../../data/book-canon-source-registry.json";
import { writerSearchNames } from "../utils/writerSearchLabel";
import type { BookArchiveEntry } from "./bookArchive";
import { localizedBookTitleEvidenceIssues } from "./bookEvidence";
import { isPublicBook } from "./bookQuality";
import type { Country, WorkLocale, WriterProfile } from "./countries/types";

const noNames: readonly string[] = Object.freeze([]);
const titleEvidenceContext = { canonRegistry: { authorities, registryVersion } };

function uniqueNames(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value)))];
}

/**
 * Hidden search fields only. Call once per current public-country snapshot and
 * locale, then reuse for every book. This is a lookup over that same catalog,
 * not an alias registry or a source of visitor-facing names/translations.
 *
 * Never consult an archive entry's embedded writer: it may predate quarantine.
 * Ambiguous IDs fail closed. The two canonical name fields are passed unchanged
 * to the existing search engine, which owns deterministic transliteration.
 */
export function createBookAuthorSearchResolver(
  countries: readonly Country[],
  locale: WorkLocale
): (book: BookArchiveEntry) => readonly string[] {
  const byCountry = new Map<string, Map<string, readonly string[]> | null>();
  for (const country of countries) {
    if (byCountry.has(country.id)) {
      byCountry.set(country.id, null);
      continue;
    }
    const byWriter = new Map<string, readonly string[]>();
    for (const writer of country.writers) {
      byWriter.set(
        writer.id,
        byWriter.has(writer.id) ? noNames : writerSearchNames(writer, locale)
      );
    }
    byCountry.set(country.id, byWriter);
  }

  const linkedNames = (countryId: string, writerId: string) =>
    byCountry.get(countryId)?.get(writerId) || noNames;

  return book => {
    if (
      !isPublicBook(book) ||
      localizedBookTitleEvidenceIssues(book, locale, titleEvidenceContext).length
    ) {
      return noNames;
    }

    if (!book.authorship) return linkedNames(book.countryId, book.writerId);

    const { kind, authors } = book.authorship;
    // Do not turn a routing owner or uncertain attribution into a factual
    // author match. Existing visible authorship and labels remain untouched.
    if (kind === "anonymous" || kind === "traditional" || kind === "disputed") {
      return noNames;
    }

    const names: string[] = [];
    for (const author of authors) {
      if (author.attribution && author.attribution !== "credited") continue;
      if (author.countryId && author.writerId) {
        const currentNames = linkedNames(author.countryId, author.writerId);
        // A removed or language-ineligible profile cannot be revived using
        // its stored credit, even when the book itself remains public.
        if (!currentNames.length) continue;
        names.push(...currentNames);
      } else {
        // Literal credits have no inferred profile or ID-derived spelling.
        // isPublicBook above validates the explicit bilingual credit record.
        const creditProfile: WriterProfile = {
          id: "",
          name: author.creditNames?.ru,
          fullName: author.creditNames?.en,
        };
        names.push(...writerSearchNames(creditProfile, locale));
      }
    }
    return uniqueNames(names);
  };
}

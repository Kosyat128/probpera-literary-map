/** One explicit navigation intent; IDs come from the public canonical corpus. */
export type BookArchiveAuthorRequest = Readonly<{
  id: number;
  countryId: string;
  writerId: string;
}>;

export type BookArchiveAuthorRequestResult = "applied" | "no-books" | "filtered-empty" | "invalid";

/** Current rendered collection view, independent of any completed request. */
export type BookArchiveAuthorView = Readonly<{
  authorKey: string | null;
  hasVisibleBooks: boolean;
  settled: boolean;
}>;

type PublicAuthorCatalog = readonly Readonly<{
  id: string;
  writers: readonly Readonly<{ id: string }>[];
}>[];

export type ResolvedBookArchiveAuthorRequest =
  | Readonly<{ status: "ready"; request: BookArchiveAuthorRequest; authorKey: string }>
  | Readonly<{ status: "invalid" | "no-books" }>;

const canonicalSegment = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,191}$/u;

/** The complete archive's author index includes canonical coauthors. A display
 * name, current shelf or translated label is never authority for this lookup. */
export function resolveBookArchiveAuthorRequest(
  value: BookArchiveAuthorRequest,
  countries: PublicAuthorCatalog,
  authors: ReadonlyMap<string, readonly number[]>,
): ResolvedBookArchiveAuthorRequest {
  if (!value || !Number.isSafeInteger(value.id) || value.id < 1
    || typeof value.countryId !== "string" || !canonicalSegment.test(value.countryId)
    || typeof value.writerId !== "string" || !canonicalSegment.test(value.writerId)) {
    return Object.freeze({ status: "invalid" });
  }
  const matches = countries.filter(country => country.id === value.countryId);
  if (matches.length !== 1 || matches[0].writers.filter(writer => writer.id === value.writerId).length !== 1) {
    return Object.freeze({ status: "invalid" });
  }
  const authorKey = `${value.countryId}:${value.writerId}`;
  if (!authors.get(authorKey)?.length) return Object.freeze({ status: "no-books" });
  return Object.freeze({ status: "ready", authorKey,
    request: Object.freeze({ id: value.id, countryId: value.countryId, writerId: value.writerId }) });
}

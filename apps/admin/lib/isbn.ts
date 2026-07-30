export type IsbnEditionCandidate = {
  isbn10: string | null;
  isbn13: string | null;
  title: string;
  subtitle: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  publicationYear: number | null;
  language: string;
  pageCount: number | null;
  googleBooksUrl: string | null;
  openLibraryUrl: string;
  coverUrl: string | null;
};

export function normalizeIsbn(value: string) {
  return value.toUpperCase().replace(/[^0-9X]/g, "");
}

export function isValidIsbn(value: string) {
  const isbn = normalizeIsbn(value);

  if (/^\d{13}$/.test(isbn)) {
    const weighted = isbn
      .slice(0, 12)
      .split("")
      .reduce(
        (sum, digit, index) =>
          sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
        0
      );
    return (10 - (weighted % 10)) % 10 === Number(isbn[12]);
  }

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const weighted = isbn.split("").reduce((sum, digit, index) => {
      const valueAtPosition = digit === "X" ? 10 : Number(digit);
      return sum + valueAtPosition * (10 - index);
    }, 0);
    return weighted % 11 === 0;
  }

  return false;
}

function exactIdentifiers(
  identifiers: Array<{ type?: string; identifier?: string }> | undefined,
  requestedIsbn: string
) {
  return (identifiers || []).some(
    ({ identifier }) => normalizeIsbn(identifier || "") === requestedIsbn
  );
}

export async function lookupEditionByIsbn(
  input: string
): Promise<IsbnEditionCandidate | null> {
  const isbn = normalizeIsbn(input);
  if (!isValidIsbn(isbn)) return null;

  const endpoint = new URL("https://www.googleapis.com/books/v1/volumes");
  endpoint.searchParams.set("q", `isbn:${isbn}`);
  endpoint.searchParams.set("maxResults", "10");
  endpoint.searchParams.set("projection", "full");
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    items?: Array<{
      id: string;
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        language?: string;
        pageCount?: number;
        infoLink?: string;
        industryIdentifiers?: Array<{
          type?: string;
          identifier?: string;
        }>;
      };
    }>;
  };
  const exactMatch = (payload.items || []).find((item) =>
    exactIdentifiers(item.volumeInfo?.industryIdentifiers, isbn)
  );
  if (!exactMatch?.volumeInfo?.title) return null;

  const identifiers = exactMatch.volumeInfo.industryIdentifiers || [];
  const isbn10 =
    identifiers.find((identifier) => identifier.type === "ISBN_10")
      ?.identifier || null;
  const isbn13 =
    identifiers.find((identifier) => identifier.type === "ISBN_13")
      ?.identifier || null;
  const openLibraryIsbn = normalizeIsbn(isbn13 || isbn10 || isbn);
  const openLibraryUrl = `https://openlibrary.org/isbn/${openLibraryIsbn}`;
  const coverCandidate =
    `https://covers.openlibrary.org/b/isbn/${openLibraryIsbn}-L.jpg?default=false`;
  const coverResponse = await fetch(coverCandidate, {
    method: "HEAD",
    next: { revalidate: 86_400 },
  }).catch(() => null);
  const publishedDate = exactMatch.volumeInfo.publishedDate || "";
  const publicationYearMatch = publishedDate.match(/\d{4}/);

  return {
    isbn10: isbn10 ? normalizeIsbn(isbn10) : null,
    isbn13: isbn13 ? normalizeIsbn(isbn13) : null,
    title: exactMatch.volumeInfo.title,
    subtitle: exactMatch.volumeInfo.subtitle || "",
    authors: exactMatch.volumeInfo.authors || [],
    publisher: exactMatch.volumeInfo.publisher || "",
    publishedDate,
    publicationYear: publicationYearMatch
      ? Number(publicationYearMatch[0])
      : null,
    language: exactMatch.volumeInfo.language || "",
    pageCount: exactMatch.volumeInfo.pageCount || null,
    googleBooksUrl: exactMatch.volumeInfo.infoLink || null,
    openLibraryUrl,
    coverUrl: coverResponse?.ok ? coverCandidate : null,
  };
}

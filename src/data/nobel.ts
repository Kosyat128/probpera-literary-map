import type { Country, Writer } from "./countries";

const NOBEL_SIGNAL = /нобел|nobel/iu;
const YEAR_PATTERN = /\b(18|19|20)\d{2}\b/u;

function nobelSources(writer: Writer) {
  return [
    typeof writer.nobelPrize === "string" ? writer.nobelPrize : "",
    ...(writer.awards || []),
    // These fields are inspected only to derive a structured Nobel flag/year;
    // the prose itself is never rendered and remains behind the biography gate.
    writer.biography || "",
    writer.bio || "",
    writer.description || "",
  ].filter((value) => NOBEL_SIGNAL.test(value));
}

export function getNobelYear(writer: Writer): number | null {
  if (writer.nobelYear) return writer.nobelYear;

  for (const source of nobelSources(writer)) {
    const match = source.match(YEAR_PATTERN);
    if (match) return Number(match[0]);
  }

  return null;
}

export function isNobelLaureate(writer: Writer) {
  return Boolean(
    writer.nobel ||
      writer.isNobel ||
      writer.nobelYear ||
      writer.nobelPrize ||
      nobelSources(writer).length
  );
}

export type NobelLaureateEntry = {
  year: number;
  country: Country;
  writer: Writer;
};

export type CountryNobelLaureateEntry = {
  year: number | null;
  country: Country;
  writer: Writer;
};

function laureateIdentity(writer: Writer) {
  return (writer.name || writer.fullName || writer.id)
    .toLocaleLowerCase("ru-RU")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
}

export function collectNobelLaureates(countries: Country[]): NobelLaureateEntry[] {
  const unique = new Map<string, NobelLaureateEntry>();

  for (const country of countries) {
    for (const writer of country.writers) {
      const year = getNobelYear(writer);
      if (!year || !isNobelLaureate(writer)) continue;

      const key = `${year}:${laureateIdentity(writer)}`;
      if (!unique.has(key)) unique.set(key, { year, country, writer });
    }
  }

  return [...unique.values()].sort(
    (first, second) =>
      first.year - second.year ||
      (first.writer.name || first.writer.fullName || "").localeCompare(
        second.writer.name || second.writer.fullName || "",
        "ru"
      )
  );
}

export function collectCountryNobelLaureates(
  countries: Country[],
  countryId: string
): CountryNobelLaureateEntry[] {
  const country = countries.find((candidate) => candidate.id === countryId);
  if (!country) return [];

  return country.writers
    .filter(isNobelLaureate)
    .map((writer) => ({
      year: getNobelYear(writer),
      country,
      writer,
    }))
    .sort(
      (first, second) =>
        (first.year ?? Number.MAX_SAFE_INTEGER) -
          (second.year ?? Number.MAX_SAFE_INTEGER) ||
        (first.writer.name || first.writer.fullName || "").localeCompare(
          second.writer.name || second.writer.fullName || "",
          "ru"
        )
    );
}

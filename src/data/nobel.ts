import type { Country, Writer } from "./countries";
import { officialNobelLiteratureRecordForWriterId } from "./countries/nobelLiteratureRegistry";

const NOBEL_SIGNAL = /нобел|nobel/iu;

function legacyAwardSignals(writer: Writer) {
  return [
    typeof writer.nobelPrize === "string" ? writer.nobelPrize : "",
    ...(writer.awards || []),
  ].filter((value) => NOBEL_SIGNAL.test(value));
}

export function getNobelYear(writer: Writer): number | null {
  return (
    writer.nobelAward?.year ||
    writer.nobelYear ||
    officialNobelLiteratureRecordForWriterId(writer.id)?.year ||
    null
  );
}

export function isNobelLaureate(writer: Writer) {
  const year = getNobelYear(writer);
  return Boolean(
    year &&
      (writer.nobelAward?.category === "literature" ||
        writer.nobel === true ||
        writer.isNobel === true ||
        writer.nobelYear === year ||
        Boolean(writer.nobelPrize) ||
        legacyAwardSignals(writer).length > 0)
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
  if (writer.nobelAward?.laureateId) {
    return `official:${writer.nobelAward.laureateId}`;
  }
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

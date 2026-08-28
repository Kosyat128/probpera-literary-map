import type { Country, Writer } from "../data/countries";

function normalizedIdentityText(value?: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function writerBirthYear(writer: Writer) {
  return String(writer.birthDate || writer.birth || writer.years || "").match(
    /-?\d{3,4}/u
  )?.[0];
}

function lightweightWriterIdentity(writer: Writer, countryId: string) {
  const wikidataId = String(writer.wikidataId || "").trim();
  if (/^Q\d+$/u.test(wikidataId)) return `wikidata:${wikidataId}`;

  const name = normalizedIdentityText(writer.name || writer.fullName);
  if (name) return `person:${name}:${writerBirthYear(writer) || "unknown"}`;
  return `record:${countryId}:${writer.id}`;
}

/**
 * Above-the-fold counters must not pull in the full book graph. This preserves
 * the canonical country/person deduplication while deliberately omitting work
 * enumeration, which belongs to the deferred Book Archive runtime.
 */
export function calculateLightweightArchiveOverview(countries: Country[]) {
  const writerKeys = new Set<string>();
  for (const country of countries) {
    for (const writer of country.writers) {
      writerKeys.add(lightweightWriterIdentity(writer, country.id));
    }
  }
  return {
    countries: new Set(countries.map((country) => country.id)).size,
    uniqueWriters: writerKeys.size,
  };
}

import { getWriterWorkTitles } from "./bookArchive";
import type { Country, WriterProfile } from "./countries/types";

function normalizeText(value?: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function birthYear(writer: WriterProfile) {
  return String(writer.birthDate || writer.birth || writer.years || "").match(
    /-?\d{3,4}/u
  )?.[0];
}

/**
 * Один автор может быть связан с несколькими странами или повторно добавлен
 * редакционным дополнением. Статистика считает человека, а не строки связей.
 */
export function writerIdentity(writer: WriterProfile, countryId = "") {
  const wikidataId =
    typeof writer.wikidataId === "string" ? writer.wikidataId.trim() : "";
  if (/^Q\d+$/u.test(wikidataId)) return `wikidata:${wikidataId}`;

  const name = normalizeText(writer.name || writer.fullName);
  const year = birthYear(writer);
  if (name) return `person:${name}:${year || "unknown"}`;

  return `record:${countryId}:${writer.id}`;
}

export function workIdentity(
  writer: WriterProfile,
  title: string,
  countryId = ""
) {
  return `${writerIdentity(writer, countryId)}:work:${normalizeText(title)}`;
}

export type ArchiveStatistics = {
  countries: number;
  writerRecords: number;
  uniqueWriters: number;
  workRecords: number;
  uniqueWorks: number;
};

export function calculateArchiveStatistics(
  countries: Country[]
): ArchiveStatistics {
  const writerKeys = new Set<string>();
  const workKeys = new Set<string>();
  let writerRecords = 0;
  let workRecords = 0;

  for (const country of countries) {
    for (const writer of country.writers) {
      writerRecords += 1;
      writerKeys.add(writerIdentity(writer, country.id));

      for (const title of getWriterWorkTitles(writer)) {
        workRecords += 1;
        const normalizedTitle = normalizeText(title);
        if (normalizedTitle) {
          workKeys.add(workIdentity(writer, title, country.id));
        }
      }
    }
  }

  return {
    countries: new Set(countries.map((country) => country.id)).size,
    writerRecords,
    uniqueWriters: writerKeys.size,
    workRecords,
    uniqueWorks: workKeys.size,
  };
}

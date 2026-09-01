import type { Country, WriterProfile } from "./types";
import { selectWriterBiography } from "../writerBiography";

export type EditorialAuditSummary = {
  totalWriters: number;
  verifiedWriters: number;
  sourcedWriters: number;
  portraitedWriters: number;
  expandedBiographies: number;
  russianBiographiesReady: number;
  russianBiographiesVerified: number;
  russianBiographiesWithheld: number;
  englishBiographiesReady: number;
  englishBiographiesReviewed: number;
  englishBiographiesVerified: number;
  englishBiographiesWithheld: number;
  recordsNeedingReview: number;
};

function biographyOf(writer: WriterProfile) {
  return writer.biography || writer.bio || writer.description || "";
}

function isExpandedProfile(writer: WriterProfile) {
  return (
    biographyOf(writer).trim().length >= 260 &&
    Boolean(writer.works && writer.works.length >= 3) &&
    Boolean(writer.birthDate || writer.birth) &&
    Boolean(writer.deathDate || writer.death || /-$/.test(writer.years || ""))
  );
}

/**
 * Редакционная проверка читает существующий архив стран и ничего не дублирует.
 * Статус `verified` выставляется вручную только после проверки указанных источников.
 */
export function auditCountryArchive(countries: Country[]): EditorialAuditSummary {
  const writers = countries.flatMap((country) => country.writers);
  const verifiedWriters = writers.filter(
    (writer) =>
      writer.editorial?.status === "verified" &&
      Boolean(writer.editorial.sources?.length)
  ).length;

  const russianBiographies = writers
    .map((writer) => selectWriterBiography(writer, "ru"))
    .filter((profile) => profile !== null);
  const englishBiographies = writers
    .map((writer) => selectWriterBiography(writer, "en"))
    .filter((profile) => profile !== null);
  const russianBiographiesReady = russianBiographies.length;
  const englishBiographiesReady = englishBiographies.length;

  return {
    totalWriters: writers.length,
    verifiedWriters,
    sourcedWriters: writers.filter((writer) => Boolean(writer.editorial?.sources?.length))
      .length,
    portraitedWriters: writers.filter((writer) => Boolean(writer.portrait?.trim())).length,
    expandedBiographies: writers.filter(isExpandedProfile).length,
    russianBiographiesReady,
    russianBiographiesVerified: russianBiographies.filter(
      (profile) => profile.status === "verified"
    ).length,
    russianBiographiesWithheld: writers.length - russianBiographiesReady,
    englishBiographiesReady,
    englishBiographiesReviewed: englishBiographies.filter(
      (profile) => profile.status === "reviewed"
    ).length,
    englishBiographiesVerified: englishBiographies.filter(
      (profile) => profile.status === "verified"
    ).length,
    englishBiographiesWithheld: writers.length - englishBiographiesReady,
    recordsNeedingReview: writers.length - verifiedWriters,
  };
}

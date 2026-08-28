import type { Country } from "../types";
import generatedMetadata from "./metadata.generated.json";

export const generatedWriterDraftCount = generatedMetadata.draftCount;

export function mergeGeneratedWriters(countries: Country[]): Country[] {
  // Автоматическая выгрузка - только редакционная очередь. После ручной
  // проверки карточка переносится в основной файл страны и становится частью
  // публичной энциклопедии без второй параллельной базы.
  return countries;
}

import { countries, bookArchiveCountries } from "../../../src/data/countries/index";
import { buildPublicBookArchive, resolveBookArchivePublicTarget } from "../../../src/data/bookArchive";
import { selectBookText, selectWriterDisplayName } from "../../../src/data/bookLocalization";
import { selectCountryEnglishTranslation } from "../../../src/data/countryLocalization";
import type { JourneyDraftCatalog } from "./booky-journey-draft";

// Server-page provider. Client components receive only this serializable DTO,
// never the complete biographies, source records or editorial catalogue.
export function getBookyJourneyDraftCatalog(): JourneyDraftCatalog {
  const countryIds = new Set<string>();
  for (const country of countries) {
    if (countryIds.has(country.id)) throw new Error("Повторная страна в каноническом каталоге.");
    countryIds.add(country.id);
    const writerIds = new Set<string>();
    for (const writer of country.writers) {
      if (writerIds.has(writer.id)) throw new Error("Повторный писатель в каноническом каталоге.");
      writerIds.add(writer.id);
    }
  }

  const selected: JourneyDraftCatalog["countries"][number][] = [];
  const workIds = new Set<string>();
  for (const book of buildPublicBookArchive(bookArchiveCountries)) {
    const target = resolveBookArchivePublicTarget(countries, book);
    // Book cards can survive a writer quarantine. A draft path still needs a
    // genuine current public country -> writer -> work relationship.
    if (!target) continue;
    const key = JSON.stringify([book.countryId, book.writerId, book.id]);
    if (workIds.has(key)) throw new Error("Повторная книга в каноническом каталоге.");
    workIds.add(key);
    const ru = selectBookText(book, "ru").title;
    const en = selectBookText(book, "en").title;
    if (!ru || !en) throw new Error("У публичной книги отсутствует название RU/EN.");

    let country = selected.find((item) => item.id === target.country.id);
    if (!country) {
      const labelRu = target.country.name.trim();
      if (!labelRu) throw new Error("У страны отсутствует каноническое название.");
      country = {
        id: target.country.id,
        label: { ru: labelRu, en: selectCountryEnglishTranslation(target.country)?.fields.name?.trim() || "" },
        writers: [],
      };
      selected.push(country);
    }
    let writer = country.writers.find((item) => item.id === target.writer.id);
    if (!writer) {
      const labelRu = selectWriterDisplayName(target.writer, "ru", "");
      if (!labelRu) throw new Error("У писателя отсутствует каноническое имя.");
      writer = {
        id: target.writer.id,
        label: { ru: labelRu, en: selectWriterDisplayName(target.writer, "en", "") },
        works: [],
      };
      // These arrays belong to this provider, not the canonical source corpus.
      (country.writers as typeof writer[]).push(writer);
    }
    (writer.works as { id: string; label: { ru: string; en: string } }[]).push({ id: book.id, label: { ru, en } });
  }
  selected.sort((a, b) => a.label.ru.localeCompare(b.label.ru, "ru"));
  return { countries: selected };
}

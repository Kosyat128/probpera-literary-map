import { countries } from "../../../src/data/countries/index";
import { selectWriterDisplayName } from "../../../src/data/bookLocalization";
import { selectCountryEnglishTranslation } from "../../../src/data/countryLocalization";
import { getBookyJourneyDraftCatalog } from "./booky-journey-catalog";
import { pronunciationCatalogFromJourneyCatalog } from "./pronunciation-editor-state";

/** Public canonical country/writer IDs include those with no current public
 * book. Work references reuse the established public-target ownership guard.
 * Missing RU/EN labels remain ineligible, never guessed from another locale. */
export function getPronunciationDraftCatalog() {
  const works = getBookyJourneyDraftCatalog();
  return pronunciationCatalogFromJourneyCatalog({ countries: countries.map(country => ({
    id: country.id,
    label: { ru: country.name.trim(), en: selectCountryEnglishTranslation(country)?.fields.name?.trim() || "" },
    writers: country.writers.map(writer => ({
      id: writer.id,
      label: { ru: selectWriterDisplayName(writer, "ru", ""), en: selectWriterDisplayName(writer, "en", "") },
      works: works.countries.find(item => item.id === country.id)?.writers.find(item => item.id === writer.id)?.works ?? [],
    })),
  })) });
}

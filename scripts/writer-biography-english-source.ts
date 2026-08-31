import { editorialCatalogCountries } from "../src/data/countries/index";
import { selectWriterBiography } from "../src/data/writerBiography";

export const writerBiographyEnglishSource = editorialCatalogCountries.flatMap(
  (country) =>
    country.writers.map((writer) => ({
      key: `${country.id}:${writer.id}`,
      countryId: country.id,
      writerId: writer.id,
      writerName: String(writer.fullName || writer.name || writer.id).trim(),
      russian: selectWriterBiography(writer, "ru"),
    }))
);

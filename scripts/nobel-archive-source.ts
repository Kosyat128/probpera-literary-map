import { countries } from "../src/data/countries/index";
import {
  localNobelLiteratureWriterKeysByLaureateId,
  nobelLiteratureLaureateIdByWriterKey,
  officialNobelLiteratureSnapshot,
  previouslyUnstructuredNobelWriterKeys,
} from "../src/data/countries/nobelLiteratureRegistry";
import { collectNobelLaureates } from "../src/data/nobel";
import { legacyWriterBiography } from "../src/data/writerBiography";

export const nobelAuditCards = countries.flatMap((country) =>
  country.writers.map((writer) => ({
    key: `${country.id}:${writer.id}`,
    countryId: country.id,
    writer,
    biography: legacyWriterBiography(writer),
  }))
);

export const nobelArchiveLaureates = collectNobelLaureates(countries).map(
  ({ year, country, writer }) => ({
    year,
    key: `${country.id}:${writer.id}`,
    laureateId: writer.nobelAward?.laureateId || null,
  })
);

export {
  localNobelLiteratureWriterKeysByLaureateId,
  nobelLiteratureLaureateIdByWriterKey,
  officialNobelLiteratureSnapshot,
  previouslyUnstructuredNobelWriterKeys,
};

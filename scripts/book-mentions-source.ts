import { buildBookArchive } from "../src/data/bookArchive";
import { countries } from "../src/data/countries";

export const archive = buildBookArchive(countries).map(
  ({ country, writer, ...entry }) => entry
);

export const writers = countries.flatMap((country) =>
  country.writers.map((writer) => ({
    countryId: country.id,
    writerId: writer.id,
    writerName: writer.name || writer.fullName || "Автор",
  }))
);

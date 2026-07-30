import { buildBookArchive } from "../src/data/bookArchive";
import { countries } from "../src/data/countries";

export const archive = buildBookArchive(countries).map(
  ({ country, writer, ...entry }) => entry
);

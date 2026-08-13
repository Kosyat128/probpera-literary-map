import catalogSource from "./editorial-catalog.generated.json";

export type EditorialCatalogWriter = {
  id: string;
  label: string;
  fields: Record<string, unknown>;
};

export type EditorialCatalogCountry = {
  id: string;
  label: string;
  fields: Record<string, unknown>;
  writers: EditorialCatalogWriter[];
};

export const editorialCatalog = catalogSource as {
  version: number;
  countries: EditorialCatalogCountry[];
};

export function editorialCountry(countryId: string) {
  return editorialCatalog.countries.find((country) => country.id === countryId) || null;
}

export function editorialWriter(countryId: string, writerId: string) {
  return (
    editorialCountry(countryId)?.writers.find((writer) => writer.id === writerId) || null
  );
}

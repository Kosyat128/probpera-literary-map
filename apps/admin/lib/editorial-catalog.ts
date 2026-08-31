import {
  readAdminCatalogText,
  type AdminCatalogReadOptions,
} from "./admin-catalog-assets";
import { parseStoredWriterBiographyTranslations } from "./writer-biography-edit";

const EXPECTED_COUNTRY_COUNT = 200;
const EXPECTED_WRITER_COUNT = 1_684;

export type EditorialCatalogWriter = {
  id: string;
  label: string;
  fields: Record<string, unknown>;
};

export type EditorialCatalogCountry = {
  id: string;
  label: string;
  fields: Record<string, unknown>;
  writers: readonly EditorialCatalogWriter[];
};

export type EditorialCatalog = {
  version: number;
  countries: readonly EditorialCatalogCountry[];
};

let cachedEditorialCatalog: EditorialCatalog | null = null;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(
  value: unknown,
  field: string,
  maximumLength = 500
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maximumLength
  ) {
    throw new Error(`Editorial catalog has an invalid ${field}`);
  }
  return value;
}

export function parseEditorialCatalog(source: string): EditorialCatalog {
  const root = objectValue(JSON.parse(source));
  if (!root || root.version !== 1 || !Array.isArray(root.countries)) {
    throw new Error("Editorial catalog has an invalid root");
  }

  const countryIds = new Set<string>();
  const countries = root.countries.map((rawCountry) => {
    const country = objectValue(rawCountry);
    if (!country || !Array.isArray(country.writers)) {
      throw new Error("Editorial catalog has an invalid country");
    }
    const id = requiredText(country.id, "country id", 200);
    if (countryIds.has(id)) {
      throw new Error(`Editorial catalog has a duplicate country: ${id}`);
    }
    countryIds.add(id);

    const fields = objectValue(country.fields);
    if (!fields) {
      throw new Error(`Editorial catalog country has invalid fields: ${id}`);
    }
    const writerIds = new Set<string>();
    const writers = country.writers.map((rawWriter) => {
      const writer = objectValue(rawWriter);
      if (!writer) {
        throw new Error(`Editorial catalog has an invalid writer: ${id}`);
      }
      const writerId = requiredText(writer.id, "writer id", 200);
      if (writerIds.has(writerId)) {
        throw new Error(
          `Editorial catalog has a duplicate writer: ${id}/${writerId}`
        );
      }
      writerIds.add(writerId);
      const writerFields = objectValue(writer.fields);
      if (!writerFields) {
        throw new Error(
          `Editorial catalog writer has invalid fields: ${id}/${writerId}`
        );
      }
      const biographyTranslations = objectValue(
        writerFields.biographyTranslations
      );
      const biographies = parseStoredWriterBiographyTranslations(
        writerFields.biographyTranslations
      );
      if (!biographies.ru) {
        throw new Error(
          `Editorial catalog writer is missing structured RU: ${id}/${writerId}`
        );
      }
      if (
        biographyTranslations?.en !== undefined &&
        biographyTranslations.en !== null &&
        !biographies.en
      ) {
        throw new Error(
          `Editorial catalog writer has invalid structured EN: ${id}/${writerId}`
        );
      }
      return {
        id: writerId,
        label: requiredText(writer.label, "writer label"),
        fields: writerFields,
      };
    });
    return {
      id,
      label: requiredText(country.label, "country label"),
      fields,
      writers,
    };
  });

  if (countries.length !== EXPECTED_COUNTRY_COUNT) {
    throw new Error(
      `Editorial catalog has ${countries.length} countries; expected ${EXPECTED_COUNTRY_COUNT}`
    );
  }
  const writerCount = countries.reduce(
    (total, country) => total + country.writers.length,
    0
  );
  if (writerCount !== EXPECTED_WRITER_COUNT) {
    throw new Error(
      `Editorial catalog has ${writerCount} writers; expected ${EXPECTED_WRITER_COUNT}`
    );
  }
  return { version: 1, countries };
}

export async function loadEditorialCatalog(
  options?: AdminCatalogReadOptions
): Promise<EditorialCatalog> {
  if (options) {
    return parseEditorialCatalog(
      await readAdminCatalogText("editorial-catalog.json", options)
    );
  }
  if (cachedEditorialCatalog) {
    return cachedEditorialCatalog;
  }
  const catalog = parseEditorialCatalog(
    await readAdminCatalogText("editorial-catalog.json")
  );
  cachedEditorialCatalog = catalog;
  return catalog;
}

export function editorialCountry(
  catalog: EditorialCatalog,
  countryId: string
) {
  return catalog.countries.find((country) => country.id === countryId) ?? null;
}

export function editorialWriter(
  catalog: EditorialCatalog,
  countryId: string,
  writerId: string
) {
  return (
    editorialCountry(catalog, countryId)?.writers.find(
      (writer) => writer.id === writerId
    ) ?? null
  );
}

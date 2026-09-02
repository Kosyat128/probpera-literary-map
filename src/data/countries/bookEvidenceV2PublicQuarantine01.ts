import type { Country, WorkLocale, WorkProfile } from "./types";

export type BookEvidenceV2PublicQuarantine = {
  recordKey: string;
  status: "draft-quarantine";
  reason: string;
  unresolvedLocales: readonly WorkLocale[];
  sourceHoldBatch: string;
};

const spittelerRecordKey = "switzerland:carl_spitteler:olympian-spring";
const mommsenRecordKey = "germany:theodor_mommsen:history-of-rome";

/**
 * Evidence is deliberately retained for editorial research, while the card and
 * both display translations remain drafts until complete RU and EN
 * manifestations can be verified. A work-name gloss is not publication proof.
 */
export const bookEvidenceV2PublicQuarantine01 = Object.freeze<
  BookEvidenceV2PublicQuarantine[]
>([
  {
    recordKey: spittelerRecordKey,
    status: "draft-quarantine",
    reason:
      "Не установлены полные русская и английская манифестации эпоса: справочные формы «Олимпийская весна» и Olympian Spring не заменяют национальные библиографические записи изданий.",
    unresolvedLocales: ["ru", "en"],
    sourceHoldBatch: "book-evidence-v2-public-batch-06",
  },
  {
    recordKey: mommsenRecordKey,
    status: "draft-quarantine",
    reason:
      "Русские записи НЭБ и предполагаемый permalink РГБ восходят к одной MARC-записи РГБ, поэтому не образуют два независимых библиографических свидетельства; permalink РГБ также не удалось проверить напрямую.",
    unresolvedLocales: ["ru"],
    sourceHoldBatch: "book-evidence-v2-public-batch-07",
  },
]);

const quarantinedRecordKeys = new Set(
  bookEvidenceV2PublicQuarantine01.map((item) => item.recordKey)
);

function draftTranslation(work: WorkProfile, locale: WorkLocale) {
  const translation = work.translations?.[locale];
  return translation ? { ...translation, status: "draft" as const } : undefined;
}

export function applyBookEvidenceV2PublicQuarantine01Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  if (!quarantinedRecordKeys.has(recordKey)) return work;

  const ru = draftTranslation(work, "ru");
  const en = draftTranslation(work, "en");

  return {
    ...work,
    translations: {
      ...work.translations,
      ...(ru ? { ru } : {}),
      ...(en ? { en } : {}),
    },
    editorial: {
      ...work.editorial,
      status: "draft",
    },
  };
}

/** Applies the fail-closed quarantine immutably and asserts exact cardinality. */
export function applyBookEvidenceV2PublicQuarantine01(
  countries: Country[]
): Country[] {
  const seen = new Map(
    bookEvidenceV2PublicQuarantine01.map((item) => [item.recordKey, 0])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        if (!quarantinedRecordKeys.has(recordKey)) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2PublicQuarantine01Work(
          country.id,
          writer.id,
          work
        );
      }),
    })),
  }));

  const cardinalityErrors = [...seen.entries()].filter(
    ([, count]) => count !== 1
  );
  if (cardinalityErrors.length > 0) {
    throw new Error(
      `book-evidence-v2-public-quarantine-01-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }

  return result;
}

import type { Country, WorkLocale, WorkProfile } from "./types";

export type BookEvidenceV2LegacyVerifiedReauditSource = {
  url: string;
  provider: string;
  role: "ru-title" | "en-title" | "description" | "identity";
  outcome: "supports" | "partial" | "conflicts" | "unresolved";
  finding: string;
};

export type BookEvidenceV2LegacyVerifiedReauditHoldCode =
  | "ru-manifestation-unresolved"
  | "ru-independent-attestation-missing"
  | "work-expression-boundary-unresolved";

export type BookEvidenceV2LegacyVerifiedReauditHold = {
  recordKey: string;
  status: "fail-closed";
  code: BookEvidenceV2LegacyVerifiedReauditHoldCode;
  checkedAt: string;
  unresolvedLocales: readonly WorkLocale[];
  candidateRuTitle: string;
  verifiedEnTitle?: string;
  reason: string;
  sources: readonly BookEvidenceV2LegacyVerifiedReauditSource[];
  resolutionCriteria: readonly string[];
  descriptionDisposition: "not-published-until-title-and-entity-resolution";
};

export const bookEvidenceV2LegacyVerifiedReaudit01BatchId =
  "book-evidence-v2-legacy-verified-reaudit-01";

export const bookEvidenceV2LegacyVerifiedReaudit01RecordKeys = Object.freeze([
  "chile:pablo_neruda:twenty-love-poems",
  "egypt:naguib_mahfouz:cairo-trilogy",
  "egypt:naguib_mahfouz:midaq-alley",
  "egypt:naguib_mahfouz:the-thief-and-the-dogs",
  "india:rabindranath_tagore:gitanjali",
] as const);

/**
 * Strict Evidence V2 re-audit of five legacy `verified` records.
 *
 * The sources below record useful research, not a publication override. No
 * localized title or description is emitted while a title-manifestation or
 * Work/Expression gate remains unresolved.
 */
export const bookEvidenceV2LegacyVerifiedReaudit01Holds = Object.freeze<
  BookEvidenceV2LegacyVerifiedReauditHold[]
>([
  {
    recordKey: "chile:pablo_neruda:twenty-love-poems",
    status: "fail-closed",
    code: "ru-manifestation-unresolved",
    checkedAt: "2026-09-02",
    unresolvedLocales: ["ru"],
    candidateRuTitle:
      "Двадцать стихотворений о любви и одна песня отчаяния",
    verifiedEnTitle: "Twenty Love Poems and a Song of Despair",
    reason:
      "Точная русская заглавная форма и граница манифестации не подтверждены требуемыми независимыми записями НЭБ/РГБ либо официального российского издателя: запись включённого произведения в собрании сочинений не доказывает отдельное русское издание и не снимает разночтение заглавия. Английская манифестация подтверждена, но не заменяет отсутствующее русское доказательство.",
    sources: [
      {
        url: "https://lccn.loc.gov/2003067611",
        provider: "Library of Congress",
        role: "en-title",
        outcome: "supports",
        finding:
          "Библиографическая запись фиксирует англоязычное заглавие Twenty love poems and a song of despair и издание Penguin.",
      },
      {
        url: "https://www.penguinrandomhouse.com/books/773270/twenty-love-poems-and-a-song-of-despair-by-pablo-neruda-translated-by-w-s-merwin-introduction-by-cristina-garcia/",
        provider: "Penguin Random House",
        role: "en-title",
        outcome: "supports",
        finding:
          "Официальная карточка издателя подтверждает заглавие Twenty Love Poems and a Song of Despair.",
      },
      {
        url: "https://www.memoriachilena.gob.cl/602/w3-article-98108.html",
        provider: "Biblioteca Nacional de Chile - Memoria Chilena",
        role: "description",
        outcome: "supports",
        finding:
          "Национальная библиотека Чили документирует первое издание Nascimento 1924 года и исторический контекст сборника.",
      },
      {
        url: "https://cultura.fundacionneruda.org/2021/04/para-una-lectura-estilistica-de-los-veinte-poemas-de-amor/",
        provider: "Fundación Pablo Neruda",
        role: "description",
        outcome: "supports",
        finding:
          "Официальный фонд публикует стилистическое исследование сборника, пригодное для будущего самостоятельного синтеза.",
      },
    ],
    resolutionCriteria: [
      "Найти точную русскую манифестацию и две независимые официальные библиографические записи из разрешённых российских источников.",
      "Сверить по титульному листу написание русского заглавия и установить, является ли объект отдельным изданием или включённым произведением.",
      "После прохождения title gate подготовить самостоятельное русское описание по чилийским институциональным источникам и его точный английский перевод с SHA provenance.",
    ],
    descriptionDisposition:
      "not-published-until-title-and-entity-resolution",
  },
  {
    recordKey: "egypt:naguib_mahfouz:cairo-trilogy",
    status: "fail-closed",
    code: "ru-manifestation-unresolved",
    checkedAt: "2026-09-02",
    unresolvedLocales: ["ru"],
    candidateRuTitle: "Каирская трилогия",
    verifiedEnTitle: "The Cairo Trilogy",
    reason:
      "Не найдена официально каталогизированная русская манифестация единого издания под заглавием «Каирская трилогия»; справочная форма названия цикла и публикации отдельных романов не доказывают русское сводное издание. Английский однотомник подтверждён Library of Congress и издателем, однако Work/Manifestation для русской локали остаётся неустановленной.",
    sources: [
      {
        url: "https://lccn.loc.gov/2001277061",
        provider: "Library of Congress",
        role: "en-title",
        outcome: "supports",
        finding:
          "Запись подтверждает однотомное англоязычное издание The Cairo trilogy и состав из Palace Walk, Palace of Desire и Sugar Street.",
      },
      {
        url: "https://www.penguinrandomhouse.com/books/106192/the-cairo-trilogy-by-naguib-mahfouz-translated-by-william-maynard-hutchins-olive-e-kenny-lorne-mkenny-and-angele-botros-semaan-introduction-by-sabry-hafez/",
        provider: "Penguin Random House",
        role: "en-title",
        outcome: "supports",
        finding:
          "Официальная карточка издателя подтверждает заглавие The Cairo Trilogy и ISBN 9780375413315.",
      },
      {
        url: "https://aucpress.com/author/naguib-mahfouz/",
        provider: "The American University in Cairo Press",
        role: "identity",
        outcome: "supports",
        finding:
          "Египетское университетское издательство перечисляет произведения Махфуза и англоязычные издания частей трилогии.",
      },
      {
        url: "https://sis.gov.eg/en/egypt/egyptian-figures/naguib-mahfouz/",
        provider: "Egypt State Information Service",
        role: "description",
        outcome: "supports",
        finding:
          "Официальный египетский источник фиксирует Al-Thulatiya и даты 1956-1957 в библиографии писателя.",
      },
    ],
    resolutionCriteria: [
      "Подтвердить, что в России выходило единое издание трилогии, и зафиксировать точное заглавие по его титульному листу.",
      "Получить две независимые записи НЭБ/РГБ/РНБ либо официального российского издателя для одной и той же русской манифестации.",
      "Только после разрешения границы сводного издания подготовить двухъязычное описание с SHA provenance.",
    ],
    descriptionDisposition:
      "not-published-until-title-and-entity-resolution",
  },
  {
    recordKey: "egypt:naguib_mahfouz:midaq-alley",
    status: "fail-closed",
    code: "ru-manifestation-unresolved",
    checkedAt: "2026-09-02",
    unresolvedLocales: ["ru"],
    candidateRuTitle: "Переулок Мидак",
    verifiedEnTitle: "Midaq Alley",
    reason:
      "Форма «Переулок Мидак» не подтверждена записью реально изданной в России книги из НЭБ/РГБ/РНБ или карточкой официального российского издателя; встречающиеся неофициальные переводы и варианты транслитерации доказательством не являются. До обнаружения русской манифестации карточка не должна публиковаться как verified.",
    sources: [
      {
        url: "https://www.penguinrandomhouse.com/books/106179/midaq-alley-by-naguib-mahfouz/",
        provider: "Penguin Random House",
        role: "en-title",
        outcome: "supports",
        finding:
          "Официальная карточка издателя подтверждает заглавие Midaq Alley и ISBN 9780385264761.",
      },
      {
        url: "https://aucpress.com/wp-content/uploads/2024/04/Naguib-Mahfouz-Books-%E2%80%93-Abu-Dhabi-Book-Fair-2024-low-res.pdf",
        provider: "The American University in Cairo Press",
        role: "identity",
        outcome: "supports",
        finding:
          "Официальный каталог египетского университетского издательства фиксирует Midaq Alley в издательской программе Махфуза.",
      },
      {
        url: "https://sis.gov.eg/en/egypt/egyptian-figures/naguib-mahfouz/",
        provider: "Egypt State Information Service",
        role: "description",
        outcome: "supports",
        finding:
          "Официальная египетская библиография фиксирует арабское произведение Zuqaq al-Midaqq и 1947 год.",
      },
    ],
    resolutionCriteria: [
      "Найти русское печатное издание и подтвердить точное написание заглавия по титульному листу.",
      "Получить две независимые официальные российские записи одной манифестации; сетевые и любительские переводы исключить.",
      "После title gate подготовить самостоятельный синтез по египетским институциональным источникам и точный английский перевод с SHA provenance.",
    ],
    descriptionDisposition:
      "not-published-until-title-and-entity-resolution",
  },
  {
    recordKey: "egypt:naguib_mahfouz:the-thief-and-the-dogs",
    status: "fail-closed",
    code: "ru-independent-attestation-missing",
    checkedAt: "2026-09-02",
    unresolvedLocales: ["ru"],
    candidateRuTitle: "Вор и собаки",
    verifiedEnTitle: "The Thief and the Dogs",
    reason:
      "РГБ подтверждает русское издание «Вор и собаки» 1965 года, но для Evidence V2 это пока единственное независимое российское библиографическое свидетельство. Зеркало той же MARC-записи не считается вторым источником, поэтому карточка остаётся fail-closed до независимой записи РНБ/НЭБ либо официального издателя.",
    sources: [
      {
        url: "https://search.rsl.ru/ru/record/01006403702",
        provider: "Российская государственная библиотека",
        role: "ru-title",
        outcome: "partial",
        finding:
          "Запись РГБ подтверждает заглавие «Вор и собаки», перевод Е. Стефановой, издательство «Художественная литература», 1965 год и регистрационный номер 65-71928.",
      },
      {
        url: "https://lccn.loc.gov/89007892",
        provider: "Library of Congress",
        role: "en-title",
        outcome: "supports",
        finding:
          "Библиографическая запись подтверждает англоязычное заглавие The thief and the dogs и издание Doubleday 1989 года.",
      },
      {
        url: "https://www.penguinrandomhouse.com/books/106199/the-thief-and-the-dogs-by-naguib-mahfouz/",
        provider: "Penguin Random House",
        role: "en-title",
        outcome: "supports",
        finding:
          "Официальная карточка издателя подтверждает заглавие The Thief and the Dogs и ISBN 9780385264624.",
      },
      {
        url: "https://aucpress.com/9789774167041/",
        provider: "The American University in Cairo Press",
        role: "description",
        outcome: "supports",
        finding:
          "Официальное египетское университетское издательство описывает сюжетную основу, героя Саида и послереволюционный каирский контекст романа.",
      },
      {
        url: "https://sis.gov.eg/en/egypt/egyptian-figures/naguib-mahfouz/",
        provider: "Egypt State Information Service",
        role: "identity",
        outcome: "supports",
        finding:
          "Официальная египетская библиография фиксирует Al-Liss Wa-al-Kilab и 1961 год.",
      },
    ],
    resolutionCriteria: [
      "Найти вторую независимую официальную российскую запись именно издания 1965 года либо другой точно идентифицированной манифестации с тем же заглавием.",
      "Убедиться, что второе свидетельство не является зеркалом MARC-записи РГБ.",
      "После title gate подготовить 2-3-предложное русское описание по египетским официальным источникам и точный английский перевод с SHA provenance.",
    ],
    descriptionDisposition:
      "not-published-until-title-and-entity-resolution",
  },
  {
    recordKey: "india:rabindranath_tagore:gitanjali",
    status: "fail-closed",
    code: "work-expression-boundary-unresolved",
    checkedAt: "2026-09-02",
    unresolvedLocales: ["ru", "en"],
    candidateRuTitle: "Гитанджали",
    reason:
      "Текущая карточка обозначает бенгальский сборник 1910 года из 157 стихотворений, тогда как Gitanjali (Song Offerings) - авторская англоязычная композиция 1912 года из 103 текстов, отобранных из нескольких бенгальских книг. Русские переводы с английской композиции нельзя автоматически считать манифестациями того же объекта; до раздельного моделирования Work/Expression/Aggregate точные RU/EN заглавия и описание публиковать нельзя.",
    sources: [
      {
        url: "https://static.macmillan.com/static/macmillan/the-macmillan-story/9781250223296_The_Macmillan_Story.pdf",
        provider: "Macmillan",
        role: "identity",
        outcome: "partial",
        finding:
          "Официальная издательская история документирует публикацию английской Gitanjali, но сама по себе не разрешает тождество с бенгальским сборником 1910 года.",
      },
      {
        url: "https://www.visvabharati.ac.in/ENGLISH.html",
        provider: "Visva-Bharati University",
        role: "identity",
        outcome: "supports",
        finding:
          "Университет, основанный Тагором, описывает Gitanjali (Song Offerings), London, The India Society, 1912 как авторскую подборку из Gitanjali, Naivedya, Kheya, Gitimalya и других книг.",
      },
      {
        url: "https://www.hcicolombo.gov.in/pdf/Tagore.pdf",
        provider: "High Commission of India in Colombo",
        role: "identity",
        outcome: "supports",
        finding:
          "Официальное издание индийской дипломатической миссии прямо различает 157 стихотворений бенгальской книги и 103 стихотворения авторской английской подборки.",
      },
    ],
    resolutionCriteria: [
      "Разделить бенгальский сборник 1910 года и английскую авторскую композицию 1912 года на корректные библиографические сущности либо формально описать отношение Aggregate/Expression.",
      "Для каждой публикуемой сущности найти две независимые официальные записи точных русской и английской манифестаций.",
      "Только после разрешения идентичности создать отдельные 2-3-предложные описания и RU→EN перевод с SHA provenance.",
    ],
    descriptionDisposition:
      "not-published-until-title-and-entity-resolution",
  },
]);

export const bookEvidenceV2LegacyVerifiedReaudit01AcceptedRecordKeys =
  Object.freeze([] as const);

export const bookEvidenceV2LegacyVerifiedReaudit01Counts = Object.freeze({
  reviewed: bookEvidenceV2LegacyVerifiedReaudit01RecordKeys.length,
  accepted: bookEvidenceV2LegacyVerifiedReaudit01AcceptedRecordKeys.length,
  held: bookEvidenceV2LegacyVerifiedReaudit01Holds.length,
});

export const bookEvidenceV2LegacyVerifiedReaudit01Urls = Object.freeze(
  Array.from(
    new Set(
      bookEvidenceV2LegacyVerifiedReaudit01Holds.flatMap((hold) =>
        hold.sources.map((source) => source.url)
      )
    )
  )
);

const heldRecordKeys = new Set<string>(
  bookEvidenceV2LegacyVerifiedReaudit01RecordKeys
);
const holdByRecordKey = new Map(
  bookEvidenceV2LegacyVerifiedReaudit01Holds.map((hold) => [
    hold.recordKey,
    hold,
  ])
);

function draftTranslation(work: WorkProfile, locale: WorkLocale) {
  const translation = work.translations?.[locale];
  return translation ? { ...translation, status: "draft" as const } : undefined;
}

/**
 * Downgrades only the five audited legacy records. `bookArchive.ts` applies
 * this as its final publication guard, after every positive Evidence overlay.
 */
export function applyBookEvidenceV2LegacyVerifiedReaudit01Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  if (!heldRecordKeys.has(recordKey)) return work;
  const hold = holdByRecordKey.get(recordKey);
  if (!hold) {
    throw new Error(`book-evidence-v2-legacy-reaudit-hold-missing:${recordKey}`);
  }

  const ru = draftTranslation(work, "ru");
  const en = draftTranslation(work, "en");
  const translations =
    ru || en
      ? {
          ...work.translations,
          ...(ru ? { ru } : {}),
          ...(en ? { en } : {}),
        }
      : work.translations;

  return {
    ...work,
    ...(translations ? { translations } : {}),
    editorial: {
      ...work.editorial,
      status: "draft",
      reviewedAt: "2026-09-02",
    },
    evidenceV2Hold: hold,
  } as WorkProfile;
}

/** Applies the detached fail-closed re-audit and asserts exact cardinality. */
export function applyBookEvidenceV2LegacyVerifiedReaudit01(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2LegacyVerifiedReaudit01RecordKeys.map((recordKey) => [
      recordKey,
      0,
    ])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        if (!heldRecordKeys.has(recordKey)) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2LegacyVerifiedReaudit01Work(
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
      `${bookEvidenceV2LegacyVerifiedReaudit01BatchId}-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }

  return result;
}

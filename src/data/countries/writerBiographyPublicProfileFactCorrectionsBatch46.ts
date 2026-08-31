import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch46 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-30";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

function correction(
  countryId: string,
  writerId: string,
  patch: Partial<WriterProfile>,
  evidence: ReturnType<typeof sources>,
  note: string
): WriterPublicProfileFactCorrectionBatch46 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch46 = [
  correction(
    "romania",
    "ion_luca_caragiale",
    {
      "birthPlace": "Хайманале, Румыния"
    },
    sources(
      ["Muzeul Național al Literaturii Române", "https://mnlr.ro/en/i-l-caragiale-omul-care-simtea-enorm-si-vedea-monstruos/"],
      ["Academia Română", "https://academiaromana.ro/fnsa/doc2018/CatalogOpereFundamentale2018.pdf"],
    ),
    "Субъективное ранжирование удалено. Ошибочное место рождения в профиле («Химпина») исправлено на документированное селение Хайманале."
  ),
  correction(
    "russia",
    "esenin",
    {
      "birthDate": "1895-10-03"
    },
    sources(
      ["Государственный музей-заповедник С. А. Есенина", "https://www.museum-esenin.ru/esenin/biografiya"],
      ["Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/history/1303814"],
      ["Государственный музей-заповедник С. А. Есенина - каталог произведений", "https://www.museum-esenin.ru/esenin/poehmy"],
      ["Государственный музей-заповедник С. А. Есенина - электронное собрание", "https://www.museum-esenin.ru/esenin/stihotvoreniya/1924/pismo-k-zhenshchine"],
    ),
    "Субъективное ранжирование и обобщение тематики удалены. Профильная дата 1895-09-21 дана по старому стилю; для единого ISO-поля исправлена на соответствующую дату нового стиля - 1895-10-03."
  ),
  correction(
    "russia",
    "kantemir",
    {
      "years": "1708/1709-1744",
      "birthDate": "",
      "birthPlace": "",
      "deathDate": "1744-04-11"
    },
    sources(
      ["Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/Great_Russia/cultural_XVIII/Kantemir"],
      ["Большая российская энциклопедия", "https://old.bigenc.ru/domestic_history/text/3794404"],
    ),
    "Историографическое ранжирование заменено проверяемыми ролями, годом смерти, числом сатир и названием первой из них. Из-за прямого расхождения источников рождение указано в профиле диапазоном 1708/1709 без ложной точности даты и места; дата смерти нормализована по новому стилю."
  ),
  correction(
    "russia",
    "karamzin",
    {
      "years": "1765/1766-1826",
      "birthDate": ""
    },
    sources(
      ["Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/Great_Russia/outstanding_scientists_XIX/Karamzin"],
      ["Культура.РФ", "https://www.culture.ru/persons/8196/nikolai-karamzin"],
      ["Большая российская энциклопедия", "https://bigenc.ru/c/karamzin-nikolai-mikhailovich-cd8c60"],
    ),
    "Субъективное ранжирование заменено видами деятельности, годом смерти и двумя произведениями. БРЭ указывает 1765 или 1766 год и отмечает отсутствие метрической записи, поэтому точная дата рождения снята, а годы профиля отражают диапазон."
  ),
  correction(
    "russia",
    "kirill-turovsky",
    {
      "years": "",
      "birthDate": "",
      "deathDate": ""
    },
    sources(
      ["Большая российская энциклопедия", "https://old.bigenc.ru/literature/text/2066913"],
      ["Православная энциклопедия", "https://www.pravenc.ru/text/1840435.html"],
      ["Институт русской литературы РАН (Пушкинский Дом)", "https://pushkinskijdom.ru/zhurnal-russkaya-literatura/zhurnal-russkaya-literatura-2021-2/literaturnye-istochniki-slova-na-fominu-nedelyu-kirilla-turovskogo/"],
    ),
    "Субъективное ранжирование удалено, а состав наследия сформулирован с оговоркой об атрибуционных спорах. БРЭ считает год рождения неизвестным и смерть предшествующей 1182 году, тогда как Православная энциклопедия аргументирует деятельность после 1183 года; поэтому недостоверные структурные годы и даты очищены."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch46[];

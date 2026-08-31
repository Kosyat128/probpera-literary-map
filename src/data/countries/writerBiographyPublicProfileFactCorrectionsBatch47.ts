import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch47 = {
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
): WriterPublicProfileFactCorrectionBatch47 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch47 = [
  correction(
    "russia",
    "trediakovsky",
    {
      "years": "1703-1768",
      "birthDate": "1703-03-05",
      "deathDate": "1768-08-17"
    },
    sources(
      ["Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/Great_Russia/cultural_XVIII/Trediakovsky"],
      ["Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A2%D1%80%D0%B5%D0%B4%D0%B8%D0%B0%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9_%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D0%B8%D0%B9_%D0%9A%D0%B8%D1%80%D0%B8%D0%BB%D0%BB%D0%BE%D0%B2%D0%B8%D1%87"],
    ),
    "Исправлен ошибочный год смерти 1769 на 1768 и субъективное ранжирование заменено конкретным трактатом. Даты профиля приведены к новому стилю: БРЭ даёт 22 февраля/5 марта 1703 года и 6/17 августа 1768 года; Президентская библиотека независимо подтверждает 1703-1768."
  ),
  correction(
    "rwanda",
    "benjamin_sehene",
    {
      "years": ""
    },
    sources(
      ["UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf"],
      ["University of St Andrews", "https://research-portal.st-andrews.ac.uk/en/publications/benjamin-sehene-vs-father-wenceslas-munyeshyaka-the-fictional-tri/"],
    ),
    "Неподтверждённая формула о канадской национальной принадлежности заменена документированными литературными ролями и произведением. Открытый интервал жизни очищен из-за спорных сообщений о смерти, не подтверждённых двумя авторитетными источниками."
  ),
  correction(
    "saint_lucia",
    "john_robert_lee",
    {
      "birthDate": "1948"
    },
    sources(
      ["The University of the West Indies - Caribbean Literary Journal", "https://journals.sta.uwi.edu/ojs/index.php/clj/article/download/8862/7284/14112"],
      ["Brinkerhoff Poetry Foundation", "https://www.brinkerhoffpoetry.org/poets/john-robert-lee"],
    ),
    "Общие тематические оценки заменены годом рождения, профессиями и библиографическими фактами; искусственная точная дата 1948-01-01 сокращена до подтверждённого года."
  ),
  correction(
    "samoa",
    "lani_wendt_young",
    {
      "years": "1973-",
      "birthDate": "1973"
    },
    sources(
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/young-lani-wendt"],
      ["University of Auckland", "https://www.auckland.ac.nz/assets/about-us/the-university/official-publications/uninews/2010/uoa_news_issue_20_2010.pdf"],
    ),
    "Субъективная оценка заметности удалена. Авторитетная биография указывает 1973, а не 1968 год рождения; точный день не установлен, поэтому birthDate сокращён до доказанного года."
  ),
  correction(
    "samoa",
    "selina_tusitala_marsh",
    {
      "birthDate": "1971"
    },
    sources(
      ["University of Auckland", "https://www.auckland.ac.nz/en/research/about-our-research/pacific-research/dr-selina-tusitala-marsh.html"],
      ["Poetry Archive", "https://poetryarchive.org/poet/selina-tusitala-marsh/"],
    ),
    "Тематическая интерпретация заменена годом рождения, документированным происхождением, профессиями и названиями книг; конфликтующая точная дата сокращена до подтверждённого года."
  ),
  correction(
    "samoa",
    "sia_figiel",
    {
      "birthDate": "1967"
    },
    sources(
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/figiel-sia"],
      ["University of Hawaiʻi Press", "https://uhpress.hawaii.edu/title/pouliuli-2/"],
    ),
    "Субъективная оценка известности и тематическая интерпретация заменены годом рождения, романом и документированным переводом. Искусственная точная дата 1967-01-01 сокращена до подтверждённого года."
  ),
  correction(
    "samoa",
    "tusiata_avia",
    {
      "years": "1966-",
      "birthDate": "1966"
    },
    sources(
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/avia-tusiata"],
      ["National Library of New Zealand", "https://natlib.govt.nz/records/51564895"],
    ),
    "Тематическое обобщение заменено проверяемыми ролями и книгами. Национальные источники указывают 1966, а не 1969 год рождения; точный день не установлен."
  ),
  correction(
    "senegal",
    "birago_diop",
    {
      "name": "Бираго Диоп"
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11900243p"],
      ["Université Cheikh Anta Diop de Dakar - Revue d’Études Africaines", "https://rea.ucad.sn/index.php/rea/article/download/16/15/61"],
    ),
    "Общее утверждение об известности конкретизировано профессиями и двумя книгами; написание имени приведено к форме «Бираго». Текущие даты профиля подтверждены BnF."
  ),
  correction(
    "senegal",
    "boubacar_boris_diop",
    {
      "name": "Бубакар Борис Диоп"
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119002441"],
      ["University of Oklahoma", "https://www.ou.edu/insideou/articles/2022/october/senegalese-writer-boubacar-boris-diop-to-headline-2022-neustadt-festival.html"],
    ),
    "Расплывчатая роль «интеллектуал» заменена документированными литературными занятиями и двумя произведениями; русская передача имени нормализована."
  ),
  correction(
    "senegal",
    "fatou_diome",
    {
      "birthDate": "1968"
    },
    sources(
      ["Bibliothèque nationale de France", "https://data.bnf.fr/ark%3A/12148/cb136132003"],
      ["Université de Strasbourg", "https://prix-louiseweiss2015.unistra.fr/index577b.html?id=22284"],
    ),
    "Краткое исходное описание дополнено годом рождения и тремя документированными книгами; искусственная точная дата 1968-01-01 сокращена до подтверждённого года."
  ),
  correction(
    "senegal",
    "felwine_sarr",
    {
      "name": "Фелвин Сарр",
      "birthDate": "1972-09-11",
      "birthPlace": "Ниодиор, Сенегал"
    },
    sources(
      ["Duke University - Forum for Scholars and Publics", "https://fsp.duke.edu/speakers/felwine-sarr/"],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb475687112"],
      ["Réseau français des instituts d’études avancées", "https://rfiea.fr/sites/default/files/newsletters/rfiea-fellows-annuaire2018_web.pdf"],
    ),
    "Расплывчатая роль «интеллектуал» заменена документированными профессиями, университетской должностью и книгами. Исправлены дата рождения с 12 на 11 сентября 1972 года и ошибочное место рождения «Нгай» на Ниодиор."
  ),
  correction(
    "senegal",
    "ken_bugul",
    {
      "name": "Кен Бугул",
      "years": "",
      "birthDate": "",
      "birthPlace": ""
    },
    sources(
      ["University of Iowa - International Writing Program", "https://iwp.uiowa.edu/writers/2006-resident/ken-bugul"],
      ["Harvard University Center for African Studies", "https://africa.harvard.edu/event/panel-african-literatures-bridging-languages-places-and-times"],
    ),
    "Общее утверждение об известности заменено документированными настоящим именем, характером псевдонима и двумя романами. Спорные дата и место рождения очищены, русское написание псевдонима исправлено."
  ),
  correction(
    "serbia",
    "dositej_obradovic",
    {
      "years": "1739/1742-1811",
      "birthDate": "",
      "deathDate": ""
    },
    sources(
      ["National Museum of Serbia - Museum of Vuk and Dositej", "https://www.narodnimuzej.rs/about-museum/locations-of-the-national-museum/museum-of-vuk-and-dositej/?lang=en"],
      ["Serbian Academy of Sciences and Arts - Virtual Museum", "https://www.mi.sanu.ac.rs/muzej.beograd/d/eng/sad/znaml_21.htm"],
    ),
    "Общая оценочная формула заменена государственным постом, участием в создании Великой школы и произведением. Национальный музей приводит варианты 1739/1742, поэтому профильный год рождения и неустойчивая точная дата смерти очищены, а интервал лет передаёт разночтение."
  ),
  correction(
    "serbia",
    "laza_kostic",
    {
      "birthDate": "1841-02-12",
      "deathPlace": "Вена"
    },
    sources(
      ["Serbian Academy of Sciences and Arts", "https://www.sanu.ac.rs/en/member/kostic-laza/"],
      ["National Library of Serbia - DOI Serbia", "https://doiserbia.nb.rs/Article.aspx?id=0350-66732288051V"],
      ["National Library of Serbia - DOI Serbia", "https://doiserbia.nb.rs/Article.aspx?id=1450-98140808151M"],
    ),
    "Исходные роли подтверждены и дополнены двумя произведениями. САНУ приводит рождение 31 января/12 февраля 1841 года; для профиля выбран новый стиль 12 февраля. Дата смерти в карточке 9 декабря соответствует новому стилю для указанного САНУ 26 ноября 1910 года."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch47[];

import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch51 = {
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
): WriterPublicProfileFactCorrectionBatch51 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch51 = [
  correction(
    "sri_lanka",
    "romesh_gunesekera",
    {
      "birthDate": "1954"
    },
    sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/romesh-gunesekera"],
      ["South Asian Britain, University of Bristol", "https://southasianbritain.org/people/romesh-gunesekera/"],
    ),
    "Оценочная заметность заменена гражданско-биографической формулировкой и проверяемым результатом премии; искусственная дата 1 января сокращена до года."
  ),
  correction(
    "sri_lanka",
    "shobasakthi",
    {
      "years": "1967-",
      "birthDate": "1967"
    },
    sources(
      ["Musée national des arts asiatiques — Guimet", "https://www.guimet.fr/sites/default/files/2026-06/cp_9e-prix_emile-guimet-de-litterature-asiatique.pdf"],
      ["University of Alberta — Canadian Review of Comparative Literature", "https://journals.library.ualberta.ca/crcl/index.php/crcl/article/download/29970/21629"],
    ),
    "Установлено настоящее имя; неверные 1964 год и искусственная дата 1 января исправлены на подтверждённый 1967 год."
  ),
  correction(
    "sudan",
    "hammour_ziada",
    {
      "birthPlace": "",
      "works": [
        "The Longing of the Dervish"
      ]
    },
    sources(
      ["American University in Cairo Press", "https://aucpress.com/author/hammour-ziada/"],
      ["International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/Hammour-Ziada-nadwa2016"],
    ),
    "Добавлены проверяемые произведение и премиальные факты; место рождения очищено, поскольку авторитетные источники расходятся между Хартумом и Омдурманом."
  ),
  correction(
    "sudan",
    "mohammed_al_fayturi",
    {
      "years": "",
      "birthDate": ""
    },
    sources(
      ["Al Arabi, National Council for Culture, Arts and Letters of Kuwait", "https://alarabi.nccal.gov.kw/Home/Article/19193"],
      ["Université d'Alger 2 — ASJP", "https://asjp.cerist.dz/en/downArticle/20/18/1/286668"],
      ["Al Arabi, National Council for Culture, Arts and Letters of Kuwait", "https://alarabi.nccal.gov.kw/Home/Article/17027"],
    ),
    "Оценочное ранжирование заменено произведениями; точная дата рождения и диапазон лет очищены, поскольку институциональные источники расходятся между 1930 и 1936 годами."
  ),
  correction(
    "sudan",
    "taj_el_sir",
    {
      "name": "Амир Тадж ас-Сир",
      "fullName": "Amir Taj al-Sir",
      "years": "1960-",
      "birthDate": "1960",
      "works": [
        "Охотник за личинками"
      ]
    },
    sources(
      ["International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/amir-tag-elsir"],
      ["University of Rochester — Three Percent", "https://www.rochester.edu/College/translation/threepercent/2010/12/09/2011-arab-booker-shortlist/"],
    ),
    "Карточка идентифицирована как профиль Amir Taj al-Sir: исправлены имя и год рождения 1965→1960; неподтверждённое произведение «Реки и деревья» не перенесено."
  ),
  correction(
    "sudan",
    "tayeb_salih",
    {
      "birthDate": "1929",
      "birthPlace": ""
    },
    sources(
      ["Loyola University Maryland", "https://www.loyola.edu/department/language-learning-center/resources/black-history-month.html"],
      ["University of Texas at Austin", "https://www.laits.utexas.edu/doherty/salih.html"],
    ),
    "Субъективное ранжирование заменено произведениями и местами работы; точный день рождения сокращён до года, а место рождения очищено из-за расхождения Кармаколь/Мерави в университетских источниках."
  ),
  correction(
    "suriname",
    "cynthia_mccleod",
    {
      "works": [
        "Hoe duur was de suiker?",
        "De vrije negerin Elisabeth"
      ]
    },
    sources(
      ["Digitale Bibliotheek voor de Nederlandse Letteren", "https://www.dbnl.org/tekst/bork001schr01_01/bork001schr01_01_0739.php"],
      ["Elisabeth Samson House Foundation", "https://www.elisabethsamsonhuis.org/over-de-stichting/"],
    ),
    "Субъективная известность заменена направлением исследований и датированным дебютным романом; русская передача фамилии уточнена в тексте."
  ),
  correction(
    "suriname",
    "dobru",
    {
      "name": "Добру (Робин Эвалд Равелес)",
      "birthDate": "1935",
      "deathDate": "1983"
    },
    sources(
      ["Literatuurmuseum", "https://literatuurmuseum.nl/nl/ontdek-online/literatuurlab/online-exposities/surinaamse-schrijvers/de-weg-naar-een-onafhankelijke-literatuur"],
      ["Digitale Bibliotheek voor de Nederlandse Letteren", "https://www.dbnl.org/arch/kris001leze10_01/pag/kris001leze10_01.pdf"],
    ),
    "Субъективная значимость заменена именем, языками и произведением; ошибочные точные даты сокращены до подтверждённых годов."
  ),
  correction(
    "sweden",
    "esaias_tegner",
    {
      "birthPlace": "Кюркеруд, Швеция"
    },
    sources(
      ["Litteraturbanken", "https://litteraturbanken.se/ljudochbild/forfattare/tegnere/"],
      ["Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/ledamotsregister/esaias-tegn%C3%A9r"],
    ),
    "Широкая классификация «эпохи романтизма» заменена должностями и датированным произведением; место рождения уточнено с ошибочного Кюркхульта на Кюркеруд."
  ),
  correction(
    "sweden",
    "kerstin_ekman",
    {
      "birthPlace": "Рисинге, Эстергётланд, Швеция"
    },
    sources(
      ["Nordic Council", "https://www.norden.org/en/nominee/1994-kerstin-ekman-sweden-handelser-vid-vatten"],
      ["Swedish Arts Council", "https://www.kulturradet.se/globalassets/start/swedish-literature-exchange/swedish-bookshelf/swedish-contemporary-fiction/swedish-contemporary-fiction-2022_tg.pdf"],
      ["Albert Bonniers Förlag", "https://www.albertbonniersforlag.se/forfattare/5378/kerstin-ekman/"],
    ),
    "Общая характеристика заменена датированным дебютом и премией; ошибочное место рождения Фалун исправлено на подтверждённое Рисинге."
  ),
  correction(
    "sweden",
    "stieg_larsson",
    {
      "years": "1954-2004",
      "birthDate": "1954-08-15",
      "deathDate": "2004-11-09"
    },
    sources(
      ["Stieg Larsson Foundation", "https://www.stieglarssonfoundation.se/who-was-stieg-larsson/who-was-stieg-larsson/"],
      ["LIBRIS, National Library of Sweden", "https://libris.kb.se/bib/18267333"],
    ),
    "Добавлены отсутствовавшие даты и уточнено, что популярное русское название первого романа не является буквальным переводом шведского заглавия."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch51[];

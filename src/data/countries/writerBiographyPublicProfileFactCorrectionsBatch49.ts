import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch49 = {
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
): WriterPublicProfileFactCorrectionBatch49 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch49 = [
  correction(
    "south_africa",
    "mandla_langa",
    {
      "birthPlace": ""
    },
    sources(
      ["South African History Online", "https://sahistory.org.za/people/mandla-langa"],
      ["The Presidency of South Africa", "https://www.thepresidency.gov.za/appointment-new-advisory-council-members"],
    ),
    "Журналистская роль в исходнике не сделана центральной: формулировка приведена к подтверждённым литературным жанрам и произведениям. Место рождения очищено из-за внутреннего расхождения в справке SAHO между Стэнгером и Дурбаном."
  ),
  correction(
    "south_africa",
    "marlene_van_niekerk",
    {
      "works": [
        "Triomf",
        "Agaat",
        "Memorandum"
      ]
    },
    sources(
      ["Tilburg University", "https://www.tilburguniversity.edu/nl/over/historie-en-academisch-erfgoed/eredoctoraten/marlene-niekerk"],
      ["The Presidency of South Africa", "https://www.thepresidency.gov.za/sites/default/files/2022-07/National%20Orders%20Booklet%202011_0.pdf"],
    ),
    "Субъективное ранжирование удалено; добавлены документированные язык, академическая работа и произведения. Неподтверждённое название «Тристан» в профиле заменено официально перечисленными книгами."
  ),
  correction(
    "south_africa",
    "olive_schreiner",
    {
      "birthPlace": "Виттеберген близ Хершела, Восточная Капская провинция, ЮАР"
    },
    sources(
      ["South African History Online", "https://sahistory.org.za/people/olive-schreiner"],
      ["University of Wisconsin-Madison", "https://dept.english.wisc.edu/amcclintock/schreiner.htm"],
    ),
    "Недоказанное первенство в современной литературе заменено подтверждёнными ролями и произведением. Место рождения в профиле исправлено с Винбурга на Виттеберген."
  ),
  correction(
    "south_africa",
    "sindiwe_magona",
    {
      "birthPlace": "Гунгулулу, Восточная Капская провинция, ЮАР"
    },
    sources(
      ["South African History Online", "https://sahistory.org.za/people/sindiwe-magona"],
      ["The Presidency of South Africa", "https://www.thepresidency.gov.za/sites/default/files/2022-07/National%20Orders%20Booklet%202011_0.pdf"],
    ),
    "Тематика исходной справки заменена проверяемыми занятиями и произведениями. Место рождения в профиле исправлено с Умтаты на деревню Гунгулулу."
  ),
  correction(
    "south_africa",
    "zakes_mda",
    {
      "name": "Закес Мда"
    },
    sources(
      ["South African History Online", "https://sahistory.org.za/people/zanemvula-kizito-mda"],
      ["Ohio University", "https://www.ohio.edu/cas/ping-institute/humanities-park/writers-storytellers"],
    ),
    "Субъективное ранжирование среди современных авторов удалено; добавлены документированные занятия и произведения, а ошибочное русское имя «Зукесва Мда» исправлено."
  ),
  correction(
    "south_africa",
    "zoe_wicomb",
    {
      "years": "1948-2025",
      "birthDate": "1948-11-23",
      "deathDate": "2025-10-13",
      "birthPlace": "Бизуотер, Западная Капская провинция, ЮАР",
      "deathPlace": "Глазго, Шотландия"
    },
    sources(
      ["University of the Western Cape", "https://www.uwc.ac.za/news-and-announcements/news/remembering-zoe-wicomb"],
      ["SOAS University of London Research Online", "https://soas-repository.worktribe.com/OutputFile/424058"],
      ["Daily Maverick", "https://www.dailymaverick.co.za/article/2025-10-20-farewell-zoe-wicomb-the-vivid-voyager-who-wrote-sa-into-the-world/"],
    ),
    "Тематическое описание заменено проверяемыми занятиями и книгами; учтена смерть в 2025 году. В профиле исправлены устаревшие годы, дата смерти и ошибочное место рождения Порт-Элизабет."
  ),
  correction(
    "south_korea",
    "han_yong_un",
    {
      "birthPlace": "Хонсон, провинция Южный Чхунчхон, Корея"
    },
    sources(
      ["Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0061853"],
      ["Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200657"],
    ),
    "Исходная характеристика конкретизирована псевдонимом и датированным сборником. Ошибочный Хончхон в профиле заменён подтверждённым Хонсоном."
  ),
  correction(
    "south_korea",
    "il_yeon",
    {
      "name": "Ирён"
    },
    sources(
      ["Korea Heritage Service", "https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1111103060200&pageNo=1_1_1_1"],
      ["UNESCO Memory of the World Committee for Asia and the Pacific", "https://www.mowcapunesco.org/wp-content/uploads/Korea-Samguk-yusa-4.pdf"],
    ),
    "Исправлена передача имени и дефис; оценка «один из важнейших» заменена описанием состава и исторического содержания источника."
  ),
  correction(
    "south_korea",
    "kim_aeran",
    {
      "works": [
        "Run, Daddy, Run",
        "My Brilliant Life"
      ]
    },
    sources(
      ["Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200072"],
      ["Macmillan", "https://us.macmillan.com/books/9781250750563/mybrilliantlife/"],
    ),
    "Субъективное поколенческое ранжирование заменено жанрами и произведениями. Неидентифицированное название «Моя дорогая мишень» в профиле заменено подтверждённым романом My Brilliant Life."
  ),
  correction(
    "south_korea",
    "kim_hun",
    {
      "awards": [
        "Литературная премия Тонъин (2001)"
      ]
    },
    sources(
      ["Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/originalworks/102716"],
      ["Shinchosha", "https://www.shinchosha.co.jp/writer/1323/"],
    ),
    "Оценочное ранжирование удалено; добавлены документированные профессии, произведение и премия. Дублирующие названия одной премии в профиле сведены к одной нормализованной записи."
  ),
  correction(
    "south_korea",
    "kim_so_wol",
    {
      "name": "Ким Соволь"
    },
    sources(
      ["Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0009535"],
      ["Cultural Heritage Administration of Korea", "https://english.cha.go.kr/chaen/search/selectGeneralSearchDetail.do?canAsset=&canceled=&ccebAsno=04700300&ccebCtcd=&ccebKdcd=&ccebPcd1=&enCcebAsdt=&endNum=&mn=EN_02_02&pageIndex=444&region=&sCcebCtcd=31&sCcebKdcd=79&searchWrd=&stCcebAsdt=&startNum="],
    ),
    "Субъективное ранжирование удалено; добавлены настоящее имя, проверяемый библиографический факт и связь поэтики с народной песней, русское имя приведено к цельному написанию «Ким Соволь»."
  ),
  correction(
    "south_korea",
    "ko_un",
    {
      "awards": [
        "Griffin Trust for Excellence in Poetry - Lifetime Recognition Award (2008)"
      ]
    },
    sources(
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/ko-un-56d207070306a"],
      ["Griffin Poetry Prize", "https://griffinpoetryprize.com/lifetime-recognition/2008/"],
    ),
    "Оценочная известность и расплывчатое упоминание номинаций заменены проверяемым произведением. В профиле уточнено, что признание Griffin Trust 2008 года было пожизненной наградой, а не конкурсной Griffin Poetry Prize."
  ),
  correction(
    "south_korea",
    "park_min_gyu",
    {
      "works": [
        "The Sammi Superstars' Last Fan Club",
        "Castella",
        "Pavane for a Dead Princess"
      ]
    },
    sources(
      ["Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200600"],
      ["Dalkey Archive Press", "https://dalkeyarchive.store/products/pavane-for-a-dead-princess"],
    ),
    "Оценочное описание стиля заменено произведениями. Неподтверждённые названия «Самурайские хроники», «Кафка в Корее» и «Смерть супергероя» в профиле заменены документированной библиографией."
  ),
  correction(
    "south_korea",
    "yi_kwangsu",
    {
      "birthPlace": "Чонджу, провинция Северный Пхёнан, Корея"
    },
    sources(
      ["Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200097"],
      ["Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0043688"],
    ),
    "Категорическое первенство романа заменено осторожной формулировкой; добавлена существенная и подтверждённая сложность политической биографии. Ошибочный Пхеньян в профиле заменён Чонджу."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch49[];

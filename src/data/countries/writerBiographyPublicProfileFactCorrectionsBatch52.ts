import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch52 = {
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
): WriterPublicProfileFactCorrectionBatch52 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch52 = [
  correction(
    "syria",
    "hanna_mina",
    {
      "works": [
        "Blue Lamps",
        "The Sail and the Storm"
      ]
    },
    sources(
      ["Banipal", "https://www.banipal.co.uk/contributors/1215/hanna-mina-1924%E2%80%932018/"],
      ["Larousse", "https://www.larousse.fr/encyclopedie/litterature/Hanna_Mina/175358"],
    ),
    "Оценочная формула об «основателе» романа исключена. Исходное русское название «Конец одного человека» не подтверждается как точное название произведения Мины; в профиль внесены два независимо документированных романа."
  ),
  correction(
    "syria",
    "salim_barakat",
    {
      "name": "Салим Баракат",
      "birthPlace": "Камышлы, Сирия"
    },
    sources(
      ["Banipal", "https://www.banipal.co.uk/contributors/118/Salim%20Barakat/"],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/salim-barakat"],
    ),
    "Исправлено место рождения: источники называют Камышлы, а не Кобани; русское написание имени унифицировано с текстом карточки."
  ),
  correction(
    "taiwan",
    "li_ang",
    {
      "works": [
        "Жена мясника"
      ]
    },
    sources(
      ["Massachusetts Institute of Technology", "https://web.mit.edu/ccw/li-ang/biography.shtml"],
      ["National Chung Hsing University", "https://taiwan.nchu.edu.tw/content.php?a=%E9%A7%90%E6%A0%A1%E4%BD%9C%E5%AE%B6&b=%E7%B3%BB%E6%89%80%E6%88%90%E5%93%A1&c=ut&id=50d652d4-bc15-4b9d-9b54-f4e52c8fd393"],
    ),
    "Заменено ошибочное название произведения в профиле; дата 7 апреля подтверждается институциональными биографиями и оставлена."
  ),
  correction(
    "taiwan",
    "pai_hsien_yung",
    {
      "works": [
        "Тайбэйцы",
        "Хрустальные мальчики"
      ]
    },
    sources(
      ["University of California, Santa Barbara", "https://www.eastasian.ucsb.edu/people/emeritus/kenneth-hsien-yung-pai/"],
      ["Chinese University of Hong Kong", "https://www.cpr.cuhk.edu.hk/resources/press/pdf/4d5a2312c72bd.pdf"],
    ),
    "Убрана ранжирующая оценка и исправлены названия произведений в профиле."
  ),
  correction(
    "taiwan",
    "wang_wenxing",
    {
      "birthDate": "1939-11-04"
    },
    sources(
      ["National Culture and Arts Foundation", "https://www.ncafroc.org.tw/artist_detail.html?id=1264"],
      ["National Taiwan University Library", "https://www.lib.ntu.edu.tw/events/2024_WangWenHsing/"],
    ),
    "Исправлена дата рождения: две тайваньские институции указывают 4 ноября 1939 года, а не 24 марта."
  ),
  correction(
    "taiwan",
    "wu_ming_yi",
    {
      "works": [
        "Человек с фасеточными глазами",
        "Похищенный велосипед"
      ]
    },
    sources(
      ["Books from Taiwan", "https://booksfromtaiwan.moc.gov.tw/authors_info.php?id=68"],
      ["National Dong Hwa University", "https://sys.ndhu.edu.tw/RD/TeacherTreasury/TList.aspx?tcher=10129"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/books/221242/the-man-with-the-compound-eyes-by-wu-ming-yi/"],
    ),
    "Привязанная ко времени общая формула заменена проверяемыми сведениями о профессии и книгах; оценочные характеристики и ранжирование не используются."
  ),
  correction(
    "taiwan",
    "zhong_lihe",
    {
      "birthDate": "1915-12-15"
    },
    sources(
      ["Ministry of Culture, Taiwan", "https://www.moc.gov.tw/en/News_Content2.aspx?n=506&s=18407&sms=10737"],
      ["National Central Library, Taiwan", "https://manu.ncl.edu.tw/nclmanuscripth/author/AQ/170602/auth_life.html"],
      ["Chinese University of Hong Kong", "https://www.cuhk.edu.hk/renditions/authors/zhonglh.html"],
    ),
    "Оценочное слово «классик» заменено проверяемой характеристикой литературного контекста и музея. Исправлена дата рождения: национальные библиотечные записи указывают 15 декабря 1915 года, а не 6 ноября."
  ),
  correction(
    "tajikistan",
    "abulqasim_lahuti",
    {
      "birthDate": "1887-10-12"
    },
    sources(
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/lahuti-abul-qasem/"],
      ["UNESCO Silk Roads Programme", "https://en.unesco.org/silkroad/sites/default/files/knowledge-bank-article/vol_VI%20silk%20road_literature%20in%20persian%20and%20other%20indo%20iranian%20languages.pdf"],
    ),
    "Исправлена дата рождения с 12 декабря на 12 октября 1887 года; национально-литературная атрибуция сформулирована без упрощения биографии эмигранта."
  ),
  correction(
    "tajikistan",
    "bozor_sobir",
    {
      "birthPlace": "Суфиён, Файзабадский район, Таджикистан",
      "deathPlace": "Сиэтл, США"
    },
    sources(
      ["Radio Free Europe/Radio Liberty", "https://www.rferl.org/a/tajikistan-bozor-sobir-poet-former-opposition-figure-dies-at-79/29204740.html"],
      ["Asia-Plus", "https://asiaplustj.info/en/news/tajikistan/society/20180501/tajik-prominent-poet-bozor-sobir-dies"],
    ),
    "Нейтрализована оценка; уточнены место рождения и место смерти по независимым новостным биографиям."
  ),
  correction(
    "tajikistan",
    "muhammadjon_shakuri",
    {
      "name": "Мухаммаджон Шакури"
    },
    sources(
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/shokurov-mohammadjan/"],
      ["National Library of Tajikistan", "https://old.kmt.tj/node/829"],
    ),
    "В источниках встречается расхождение 1925/1926; текст использует дату академической Iranica и не усиливает точность далее месяца, уже указанного в профиле."
  ),
  correction(
    "tajikistan",
    "rudaki",
    {
      "birthDate": "0858",
      "deathDate": "0941"
    },
    sources(
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/rudaki/"],
      ["United Nations", "https://www.un.org/sg/en/content/sg/speeches/2008-06-18/remarks-commemoration-ceremony-1150th-anniversary-birth-rudaki"],
    ),
    "Искусственные даты 1 января удалены: источники дают приблизительный год рождения и год смерти, без дня и месяца."
  ),
  correction(
    "tajikistan",
    "sattor_tursun",
    {
      "years": "1946-2023",
      "deathDate": "2023-06-05",
      "birthPlace": "Байсунский район, Узбекистан",
      "deathPlace": "Душанбе, Таджикистан"
    },
    sources(
      ["Radio Free Europe/Radio Liberty", "https://www.azattyqasia.org/a/32446425.html"],
      ["Khovar National Information Agency", "https://khovar.tj/rus/2026/02/pomnit-i-chtit-ego-budut-vsegda/"],
    ),
    "Карточка ошибочно представляла автора живым; добавлены год и дата смерти, а общее место рождения уточнено."
  ),
  correction(
    "tanzania",
    "abdulrazak_gurnah",
    {
      "birthDate": "1948"
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2021/bio-bibliography/"],
      ["University of Kent", "https://www.kent.ac.uk/english/people/200/gurnah-abdulraz"],
    ),
    "Оставлен подтверждённый год рождения без неподтверждённой источниками дня-месяца; гражданская и культурная биография сформулирована без сведения автора к одной стране."
  ),
  correction(
    "tanzania",
    "ebrahim_hussein",
    {
      "name": "Эбрахим Хусейн",
      "birthDate": "1943",
      "birthPlace": "",
      "works": [
        "Kinjeketile"
      ]
    },
    sources(
      ["Kenyatta University", "https://ir-library.ku.ac.ke/server/api/core/bitstreams/d9135aa8-b42b-4959-92c5-886618310943/content"],
      ["African Union Library", "https://library.au.int/ebrahim-hussein-th%C3%A9%C3%A2tre-swahili-et-nationalisme-tanzanien-26"],
      ["White Rose eTheses, University of Leeds", "https://etheses.whiterose.ac.uk/id/eprint/26094/1/289801.pdf"],
    ),
    "Исправлено русское имя и удалено искусственное 1 января: надёжные источники подтверждают только 1943 год. Место рождения не утверждается: биографические источники расходятся между Линди и Килвой, поэтому поле очищено."
  ),
  correction(
    "tanzania",
    "euphrase_kezilahabi",
    {
      "name": "Эфрас Кезилахаби"
    },
    sources(
      ["Poetry Translation Centre", "https://www.poetrytranslation.org/poet/euphrase-kezilahabi/"],
      ["University of Bayreuth", "https://www.afrikanistik.uni-bayreuth.de/en/Fol03---Team/Fol01---Former-Staff/Roberto-Gaudioso/index.php"],
    ),
    "Снята оценка «один из крупнейших»; русское имя приведено к закрепившейся форме «Эфрас Кезилахаби», добавлены проверяемые профессии и место работы."
  ),
  correction(
    "tanzania",
    "muhammed_said_abdulla",
    {
      "deathDate": "1991",
      "works": [
        "Mzimu wa Watu wa Kale"
      ]
    },
    sources(
      ["Université de Lorraine", "https://ecritures.univ-lorraine.fr/sites/default/files/users/documents/livres/lmc_afr_06_livre_entier.pdf"],
      ["Open University of Tanzania", "https://repository.out.ac.tz/2912/1/TASNIFU%20YA%20RAHMA%20MOHAMED%20SAID.pdf"],
    ),
    "Точная дата смерти 1 марта не получила согласованного подтверждения, поэтому сохранён только год 1991; в академических материалах встречается также ошибочный 1992 год."
  ),
  correction(
    "tanzania",
    "said_ahmed_mohamed",
    {
      "name": "Саид Ахмед Мохамед"
    },
    sources(
      ["University of Bayreuth", "https://www.afrikanistik.uni-bayreuth.de/en/Fol03---Team/Fol01---Former-Staff/Prof_Dr_Said-Khamis/index.php"],
      ["University of Dodoma", "https://repository.udom.ac.tz/server/api/core/bitstreams/aa7a9a90-7ebe-4953-85d9-bff37d4fa929/content"],
    ),
    "Сведения исходной биографии сведены к независимо подтверждённым фактам; точная дата рождения сохранена как подтверждённая академической публикацией."
  ),
  correction(
    "tanzania",
    "shaaban_robert",
    {
      "works": [
        "Kusadikika"
      ]
    },
    sources(
      ["University of Kansas Libraries", "https://exhibits.lib.ku.edu/exhibits/show/swahili/swahililiterature/shaabanrobert"],
      ["Store norske leksikon", "https://snl.no/Shaaban_Robert"],
    ),
    "Оценочное слово «классик» заменено жанровой справкой; дата 1 января в данном случае подтверждается справочными источниками и не очищалась автоматически."
  ),
  correction(
    "thailand",
    "chart_korbjitti",
    {
      "works": [
        "Приговор",
        "Время"
      ]
    },
    sources(
      ["Words Without Borders", "https://wordswithoutborders.org/contributors/view/chart-korbjitti/"],
      ["Asphalte éditions", "https://asphalte-editions.com/gens/chart-korbjitti/"],
    ),
    "Ранжирующая оценка заменена конкретными произведениями и наградами; англоязычные названия в профиле переведены."
  ),
  correction(
    "thailand",
    "kukrit_pramoj",
    {
      "works": [
        "Четыре царствования",
        "Много жизней"
      ]
    },
    sources(
      ["Fukuoka Prize", "https://fukuoka-prize.org/en/laureates/detail/24036b38-8b85-450c-8c06-1ff885c6f6b5"],
      ["L’Asiathèque", "https://www.asiatheque.com/en/contributor/kukrit-pramoj"],
    ),
    "Убрано субъективное ранжирование романа; литературная и политическая деятельность подтверждены институциональной премией и издателем."
  ),
  correction(
    "thailand",
    "kulap_saipradit",
    {
      "name": "Кулап Сайпрадит (Сибурапа)",
      "works": [
        "За картиной",
        "Человек, достойный своего имени"
      ]
    },
    sources(
      ["Suan Sunandha Rajabhat University Library", "https://library.ssru.ac.th/en/news/view/s31036501"],
      ["University of Hamburg", "https://www.aai.uni-hamburg.de/en/soa/studium/fuer-studieninteressierte/schwerpunkte/schwerpunkt-thaiistik/thaiistik/seminare-thai/seminar-8--novel.html"],
    ),
    "Разведены настоящее имя и псевдоним; сохранён 1905 год, подтверждаемый тайской библиотекой и университетским источником, вопреки встречающемуся 1906 году."
  ),
  correction(
    "thailand",
    "pira_sudham",
    {
      "birthDate": "1942",
      "birthPlace": "Напо, провинция Бурирам, Таиланд"
    },
    sources(
      ["Éditions Picquier", "https://www.editions-picquier.com/auteur/pira-sudham/"],
      ["British Club Bangkok", "https://www.britishclubbangkok.org/wp-content/uploads/2021/10/05-1989.pdf"],
    ),
    "Искусственное 1 января заменено подтверждённым годом; место рождения уточнено с региона Исан до деревни и провинции."
  ),
  correction(
    "thailand",
    "saneh_sangsuk",
    {
      "name": "Санэ Сангсук",
      "birthDate": "1957",
      "birthPlace": "Провинция Пхетчабури, Таиланд"
    },
    sources(
      ["Department of Cultural Promotion, Thailand", "https://book.culture.go.th/artist/artist2561/files/downloads/01%E0%B8%A8%E0%B8%B4%E0%B8%A5%E0%B8%9B%E0%B8%B4%E0%B8%99%E0%B9%81%E0%B8%AB%E0%B9%88%E0%B8%87%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4%202561%20S%20.pdf"],
      ["Éditions Jentayu", "https://editions-jentayu.fr/saneh-sangsuk/"],
    ),
    "Точный день рождения очищен как неподтверждённый использованными источниками; добавлены псевдоним, провинция и официальное звание."
  ),
  correction(
    "timor_leste",
    "fernando_sylvan",
    {
      "deathDate": "1993-12-25",
      "deathPlace": "Кашкайш, Португалия"
    },
    sources(
      ["Instituto Camões", "https://cvc.instituto-camoes.pt/oceanoculturas/eng/09.html"],
      ["Oxford Academic", "https://academic.oup.com/liverpool-scholarship-online/book/17417/chapter/174913494"],
    ),
    "Исправлена дата смерти с 21 на 25 декабря 1993 года; национальная атрибуция оставлена через место рождения и язык."
  ),
  correction(
    "timor_leste",
    "francisco_borja_da_costa",
    {
      "birthPlace": "Фату-Белак, Фату-Берлиу, Восточный Тимор",
      "deathPlace": "Дили, Восточный Тимор",
      "works": [
        "Pátria"
      ]
    },
    sources(
      ["Government of Timor-Leste", "https://timor-leste.gov.tl/?lang=en&p=10810&print=1"],
      ["Ministry of Justice of Timor-Leste", "https://www.mj.gov.tl/jornal/public/docs/2014/serie_1/SERIE_I_NO_36.pdf"],
    ),
    "Исправлено место рождения: официальный источник называет Фату-Белак, а не Дили; дата смерти 7 декабря сохранена вопреки распространённой ошибке 8 декабря."
  ),
  correction(
    "timor_leste",
    "luis_cardoso",
    {
      "birthDate": "1958",
      "birthPlace": "Кайлако, Бобонару, Восточный Тимор"
    },
    sources(
      ["Tatoli", "https://pt.tatoli.tl/2023/08/18/o-meu-pais-tem-uma-literatura-oral-extraordinaria-luis-cardoso-condecorado-com-colar-da-ordem-de-timor-leste/"],
      ["And Other Stories", "https://www.andotherstories.org/authors/luis-cardoso/"],
    ),
    "Источники расходятся между 6, 7 и 8 декабря, поэтому дата очищена до 1958 года; место рождения исправлено с Кайколи на Кайлако."
  ),
  correction(
    "tonga",
    "epeli_hauofa",
    {
      "name": "Эпели Хауʻофа",
      "birthDate": "1939",
      "birthPlace": "Папуа — Новая Гвинея"
    },
    sources(
      ["University of the South Pacific", "https://www.usp.ac.fj/news/remembering-the-legacy-of-the-late-epeli-hauofa/"],
      ["University of New England", "https://rune.une.edu.au/web/handle/1959.11/7688"],
    ),
    "Убрано оценочное ранжирование и очищен неподтверждённый точный день рождения; исправлена типографика имени и географического названия."
  ),
  correction(
    "trinidad_and_tobago",
    "earl_lovelace",
    {
      "fullName": "Earl Wilbert Lovelace",
      "birthPlace": "Токо, Тринидад и Тобаго",
      "works": [
        "Дракон не может танцевать",
        "Соль"
      ]
    },
    sources(
      ["University of the West Indies Press", "https://www.uwipress.com/9789766406899/earl-lovelace/"],
      ["Black Plays Archive", "https://www.blackplaysarchive.org.uk/playwrights/earl-lovelace/"],
    ),
    "Снято субъективное ранжирование; уточнены полное имя и место рождения, а неподтверждённое русское название второго произведения заменено."
  ),
  correction(
    "trinidad_and_tobago",
    "samuel_selvon",
    {
      "name": "Сэм Селвон",
      "fullName": "Samuel Dickson Selvon",
      "deathDate": "1994-04-16",
      "deathPlace": "Пиарко, Тринидад и Тобаго"
    },
    sources(
      ["University of the West Indies", "https://www.uwi.edu/vcinstallation/programme.pdf"],
      ["Routledge Encyclopedia of Modernism", "https://www.rem.routledge.com/articles/selvon-samuel-1923-1994-1"],
    ),
    "Исправлены дата и место смерти: не 15 апреля в Калгари, а 16 апреля 1994 года в Пиарко; добавлено полное имя."
  ),
  correction(
    "trinidad_and_tobago",
    "vs_naipaul",
    {
      "fullName": "Sir Vidiadhar Surajprasad Naipaul",
      "works": [
        "Дом для мистера Бисваса",
        "В свободном государстве",
        "Излучина реки",
        "Загадка прибытия"
      ]
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/laureate/747?from=NobelPress.org"],
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/vs-naipaul"],
    ),
    "Оценочное ранжирование заменено происхождением, жанрами и официально подтверждёнными наградами; заполнено полное имя."
  ),
  correction(
    "tunisia",
    "abdelwahab_meddeb",
    {
      "deathPlace": "Париж, Франция"
    },
    sources(
      ["Le Monde", "https://www.lemonde.fr/disparitions/article/2014/11/06/mort-de-l-essayiste-et-romancier-abdelwahab-meddeb-1946-2014_4519799_3382.html"],
      ["Institut du monde arabe", "https://www.imarabe.org/fr/agenda/festivals/hommage-abdelwahab-meddeb"],
    ),
    "Дата смерти 5 ноября подтверждена современным сообщением Le Monde и сохранена; распространённая дата 6 ноября относится к ошибочной вторичной передаче."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch52[];

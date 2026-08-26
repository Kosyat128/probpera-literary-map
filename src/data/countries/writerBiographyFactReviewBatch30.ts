export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH30_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 30";

export type WriterBiographyFactReviewDecision = "unchanged" | "corrected" | "held";
export type WriterBiographyClaimVerdict = "supported" | "corrected" | "not-established";

export interface WriterBiographyClaimEvidence {
  readonly provider: string;
  readonly url: string;
  readonly checkedAt: string;
  readonly findingRu: string;
}

export interface WriterBiographyFactReviewClaim {
  readonly textRu: string;
  readonly verdict: WriterBiographyClaimVerdict;
  readonly evidence: readonly WriterBiographyClaimEvidence[];
}

export interface WriterBiographyFactReviewRecord {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly WriterBiographyFactReviewClaim[];
  readonly reviewer: string;
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH30_REVIEWER;
const checkedAt = "2026-08-09";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const seeds = [
  {
    key: "germany:hartmann_von_aue",
    originalSha256: "1e8dc845dd1e7790e9347c540be6ec3437812ed896f48c0ec4fb486f0dadbe30",
    reviewedTextRu: "Гартман фон Ауэ (ок. 1160 - начало XIII века) - средневерхненемецкий поэт и рыцарь. Он написал куртуазные романы «Эрек» и «Ивейн», а также поэмы «Григорий» и «Бедный Генрих».",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/sfz26217.html", "Национальный биографический справочник датирует рождение примерно 1160 годом, а смерть - началом XIII века; он также подтверждает статус рыцаря и поэта и авторство четырёх названных произведений."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118546228", "Национальная библиотека Германии независимо фиксирует личность Гартмана фон Ауэ, его литературную деятельность и связанные с ним произведения."],
    ],
    decision: "corrected",
    notes: "Общее и спорное «один из основателей» заменено конкретными биографическими данными и произведениями; неподтверждённая поздняя граница жизни не указывается. Identity queue: Q75852 согласуется с институциональными источниками; shared country files не изменялись.",
  },
  {
    key: "germany:heinrich_boell",
    originalSha256: "ab4810dc739f5735501b279cbf6564c48fc286a41e9dfdb68d5b6b5086503a61",
    reviewedTextRu: "Генрих Бёлль (1917-1985) - немецкий писатель и публицист. В 1972 году он получил Нобелевскую премию по литературе; среди его произведений - «Глазами клоуна» и «Потерянная честь Катарины Блюм».",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1972/boll/facts/", "Официальная страница премии подтверждает годы жизни, немецкую писательскую деятельность, премию 1972 года и библиографию Бёлля."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/dbo015059.html", "Немецкий национальный справочник независимо подтверждает биографию, публицистику и авторство названных произведений."],
    ],
    decision: "corrected",
    notes: "Непроверяемый суперлатив о месте в послевоенной литературе заменён фактами о премии и произведениях. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:heinrich_heine",
    originalSha256: "fbb2d791218c15b2eb428134964c8a12f4cc76af179df6a49bf0ced41e6ace1e",
    reviewedTextRu: "Генрих Гейне (1797-1856) - немецкий поэт, прозаик и публицист, автор «Книги песен» и поэмы «Германия. Зимняя сказка».",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/sfz68461.html", "Национальный справочник подтверждает годы жизни, литературные роли и авторство «Книги песен» и «Германии. Зимней сказки»."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118548018", "Национальная библиотека Германии независимо фиксирует личность, годы жизни и произведения Генриха Гейне."],
    ],
    decision: "corrected",
    notes: "Суперлатив и широкая классификация заменены нейтральными ролями и произведениями. Deutsche Biographie указывает 1797/98 как историческую неопределённость; карточечный 1797 не менялся.",
  },
  {
    key: "germany:heinrich_von_kleist",
    originalSha256: "446442e8cc12184c4b174e40884bc9e738b7cb73f79246f53c6fa12c07e5ad97",
    reviewedTextRu: "Генрих фон Клейст (1777-1811) - немецкий драматург и прозаик. Он написал пьесы «Разбитый кувшин» и «Пентесилея», а также новеллу «Михаэль Кольхаас».",
    evidence: [
      ["Kleist-Museum", "https://www.kleist-museum.de/heinrich-von-kleist", "Профильный государственный музей подтверждает годы жизни Клейста, его работу драматурга и прозаика и авторство названных произведений."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118563076.html", "Немецкий национальный биографический ресурс независимо подтверждает биографические даты, литературные роли и библиографию Клейста."],
    ],
    decision: "corrected",
    notes: "Оценочная формула о значительности и спорная периодизация заменены документируемыми ролями и произведениями.",
  },
  {
    key: "germany:hermann_hesse",
    originalSha256: "22a850eba667906c37e9e731b3654f48e10adbc327a6de219220250584160b15",
    reviewedTextRu: "Немецко-швейцарский писатель и поэт, лауреат Нобелевской премии по литературе 1946 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1946/hesse/facts/", "Официальная страница подтверждает писательскую и поэтическую деятельность Гессе и Нобелевскую премию 1946 года."],
      ["Deutsches Historisches Museum", "https://www.dhm.de/lemo/biografie/hermann-hesse", "Немецкий исторический музей независимо подтверждает немецко-швейцарскую биографию, литературные роли и годы жизни Гессе."],
    ],
    decision: "unchanged",
    notes: "Все утверждения исходного короткого текста подтверждены двумя независимыми официальными источниками; текст сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:herta_mueller",
    originalSha256: "89e98302b40310b3ee5e8104bb2731f6279d4fb1f46fb9a74266c5a5bb077f19",
    reviewedTextRu: "Немецкая писательница румынского происхождения, лауреат Нобелевской премии по литературе 2009 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/2009/muller/facts/", "Официальный источник подтверждает рождение Герты Мюллер в Румынии, её немецкоязычную писательскую деятельность и премию 2009 года."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd119053071.html", "Немецкий национальный справочник независимо подтверждает происхождение, литературную профессию и биографические сведения Мюллер."],
    ],
    decision: "unchanged",
    notes: "Исходный короткий текст фактологически точен и сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:johann_gottfried_herder",
    originalSha256: "c09b0f550eaa6592e431148f6ff0f731cfd0ddfb4b0cd15d010fa8d68efb7703",
    reviewedTextRu: "Немецкий философ, писатель и литературный теоретик, оказавший влияние на развитие немецкого романтизма.",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/sfz31807.html", "Национальный справочник подтверждает деятельность Гердера как философа, писателя и теоретика литературы."],
      ["Klassik Stiftung Weimar", "https://www.klassik-stiftung.de/assets/Dokumente/Bildung/Materialien/Lehrerhefte/KSW-Lehrer-Reformation_web.pdf", "Образовательный материал фонда документирует идеи Гердера и их влияние на последующую немецкую литературу, включая романтизм."],
    ],
    decision: "unchanged",
    notes: "Конкретные роли и влияние, заявленные в исходном тексте, подтверждены; текст сохранён дословно.",
  },
  {
    key: "germany:johann_wolfgang_goethe",
    originalSha256: "8be414a42941da89f47a792b4a88e73bec1f869ca8ccd2ee5ebd8d4b74a741d8",
    reviewedTextRu: "Иоганн Вольфганг Гёте (1749-1832) - немецкий поэт, драматург, прозаик и государственный деятель. Он написал трагедию «Фауст» и роман «Страдания юного Вертера».",
    evidence: [
      ["Klassik Stiftung Weimar", "https://www.klassik-stiftung.de/ihr-besuch/goethe-verwandlung-der-welt/", "Государственный культурный фонд подтверждает годы жизни, многожанровую деятельность Гёте, государственную службу и названные произведения."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118540238", "Национальная библиотека Германии независимо фиксирует биографию, литературные роли и библиографию Гёте."],
    ],
    decision: "corrected",
    notes: "Субъективные «величайший» и «один из основателей мировой классики» заменены проверяемыми ролями и произведениями.",
  },
  {
    key: "germany:lessing",
    originalSha256: "c3e9a7d1687a90e6255d201af732d5c18a8e842372c693fd09bec6652cfde9ed",
    reviewedTextRu: "Готхольд Эфраим Лессинг (1729-1781) - немецкий драматург, критик и мыслитель эпохи Просвещения. Среди его пьес - «Минна фон Барнхельм» и «Натан Мудрый».",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118572121.html", "Национальный справочник подтверждает годы жизни Лессинга, его деятельность драматурга, критика и мыслителя и авторство названных пьес."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118572121", "Национальная библиотека Германии независимо фиксирует биографию и библиографию Лессинга."],
    ],
    decision: "corrected",
    notes: "Недоказуемое «один из основателей» заменено точными ролями эпохи Просвещения и двумя пьесами.",
  },
  {
    key: "germany:martin_luther",
    originalSha256: "63958eab5001500194a44b0a7c73384ce44b0db0143e59033152a8d2b9440b33",
    reviewedTextRu: "Немецкий богослов, переводчик и писатель, сыгравший важную роль в развитии немецкого литературного языка.",
    evidence: [
      ["LutherMuseen", "https://www.luthermuseen.de/en/node/507", "Музейный ресурс подтверждает богословскую и переводческую деятельность Лютера и значение его перевода Библии для немецкого языка."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118575449.html", "Национальный справочник независимо подтверждает биографию, богословские труды, переводы и обширную письменную деятельность Лютера."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного текста подтверждены; формулировка сохранена дословно.",
  },
  {
    key: "germany:patrick_suskind",
    originalSha256: "b7ace7cd4efc0925966fdd93881b7a493f2d5ba2503e8234d97d1a993b53b59f",
    reviewedTextRu: "Патрик Зюскинд (род. 1949) - немецкий писатель и сценарист, автор романа «Парфюмер. История одного убийцы» и пьесы «Контрабас».",
    evidence: [
      ["Diogenes Verlag", "https://www.diogenes.ch/foreign-rights/authors.html?detail=6dcc7e85-da28-472d-ae90-96bd9b99f777", "Официальный издательский профиль подтверждает год рождения, профессии Зюскинда и авторство романа и пьесы."],
      ["Deutsche Nationalbibliothek", "https://portal.dnb.de/opac.htm?query=Patrick+S%C3%BCskind&method=simpleSearch", "Каталог национальной библиотеки независимо фиксирует личность Зюскинда и записи обоих произведений под его авторством."],
    ],
    decision: "corrected",
    notes: "Оценочная известность заменена годом рождения, профессиональными ролями и двумя произведениями.",
  },
  {
    key: "germany:paul_heyse",
    originalSha256: "8439e6ed4f7ea70f45924aefc0200063064af2283a3d8c1ac6ddf20a40522764",
    reviewedTextRu: "Пауль Хейзе (1830-1914) - немецкий прозаик, поэт, драматург и переводчик итальянской литературы. В 1910 году он получил Нобелевскую премию по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1910/heyse/facts/", "Официальная страница подтверждает годы жизни, литературные жанры, переводческую деятельность Хейзе и премию 1910 года."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118550772.html", "Немецкий национальный справочник независимо подтверждает биографию, жанровые роли и переводы Хейзе с итальянского."],
    ],
    decision: "corrected",
    notes: "Оценочное «мастер психологической новеллы» и широкая культурная интерпретация заменены документируемыми ролями и премией. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:robert_musil",
    originalSha256: "f1cddec028a79242c902e387639ed1a57f8a70f19f14e8a6904ab45c1fb412da",
    reviewedTextRu: "Роберт Музиль (1880-1942) - австрийский писатель и драматург. Он написал роман «Человек без свойств» и повесть «Душевные смуты воспитанника Тёрлеса».",
    evidence: [
      ["Robert-Musil-Literatur-Museum", "https://www.musilmuseum.at/robert-musil/", "Профильный музей подтверждает годы жизни, литературную деятельность Музиля и авторство двух названных произведений."],
      ["Österreichische Nationalbibliothek", "https://search.onb.ac.at/primo-explore/search?query=any,contains,Robert%20Musil&vid=ONB", "Каталог Австрийской национальной библиотеки независимо фиксирует личность Музиля и библиографические записи его произведений."],
    ],
    decision: "corrected",
    notes: "Суперлатив о модернизме заменён произведениями. Cross-country duplicate: точная личность уже представлена ключом austria:robert_musil в Batch11; shared country files не изменялись.",
  },
  {
    key: "germany:rudolf_eucken",
    originalSha256: "b1a3bc2e9391a5f3a573e559f15e7fc6fccbb5fb898e87998541c8fca68ec087",
    reviewedTextRu: "Рудольф Кристоф Эйкен (1846-1926) - немецкий философ, профессор Йенского университета. В 1908 году он получил Нобелевскую премию по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1908/eucken/facts/", "Официальная страница подтверждает годы жизни, философскую и университетскую деятельность Эйкена и премию 1908 года."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118682555.html", "Национальный биографический справочник независимо подтверждает философскую карьеру Эйкена и его профессорскую работу в Йене."],
    ],
    decision: "corrected",
    notes: "Интерпретация философской системы заменена проверяемыми должностью и премией. Источники расходятся на один день в дате смерти: Nobel Prize - 1926-09-14, Deutsche Biographie - 1926-09-15; исправление shared date без дополнительного приоритета не рекомендуется.",
  },
  {
    key: "germany:sebastian_brant",
    originalSha256: "31eb0ad11905c2dff9a29afe685ca1880858fcbc578585b4ab01994757c35d6b",
    reviewedTextRu: "Себастьян Брант (1458-1521) - немецкий гуманист, поэт и публицист. Он написал сатирическую поэму «Корабль дураков».",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118514474.html", "Национальный справочник подтверждает рождение в 1458 году, литературные роли Бранта и авторство «Корабля дураков»."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118514474", "Национальная библиотека независимо фиксирует личность, годы жизни и библиографию Бранта."],
    ],
    decision: "corrected",
    notes: "Расплывчатое «знаменитая» заменено точным жанром и названием. Identity queue: Q60351 согласуется. Date recommendation: заменить карточечный birthDate 1457 на 1458; shared country files не изменялись.",
  },
  {
    key: "germany:stefan_zweig",
    originalSha256: "fc267eeb50367004507078f10259009a13ce3732d999ac2184c61d326dd5aa3a",
    reviewedTextRu: "Стефан Цвейг (1881-1942) - австрийский писатель, драматург и биограф. Среди его произведений - «Шахматная новелла» и биография «Мария Стюарт».",
    evidence: [
      ["Stefan Zweig Zentrum Salzburg", "https://stefan-zweig-zentrum.at/stefan-zweig/leben-werke", "Профильный центр подтверждает годы жизни, жанровые роли Цвейга и авторство названных произведений."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118637479.html", "Национальный справочник независимо подтверждает биографию и библиографию Стефана Цвейга."],
    ],
    decision: "corrected",
    notes: "Недоказуемая популярность заменена жанровыми ролями и произведениями. Cross-country duplicate: та же личность представлена ключом austria:stefan_zweig в Batch11; shared country files не изменялись.",
  },
  {
    key: "germany:theodor_fontane",
    originalSha256: "ca5a0df30ae0c46ddeb9dec97fd5f07240f033d9193054c2e0857ed5e32a6697",
    reviewedTextRu: "Теодор Фонтане (1819-1898) - немецкий писатель и поэт, связанный с реализмом XIX века. Он написал романы «Эффи Брист» и «Шах фон Вутенов».",
    evidence: [
      ["Theodor Fontane Gesellschaft", "https://fontane-gesellschaft.de/chronik/", "Профильное общество подтверждает годы жизни, литературную деятельность и хронологию основных романов Фонтане."],
      ["Theodor-Fontane-Archiv, Universität Potsdam", "https://www.fontanearchiv.de/fontane-briefdatenbank", "Университетский архив независимо связывает Фонтане с романами «Эффи Брист» и «Шах фон Вутенов» и документирует его литературную работу."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён нейтральной литературно-исторической связью и двумя романами.",
  },
  {
    key: "germany:theodor_mommsen",
    originalSha256: "b7f4dd9752c43ed898b85ef13b46715fdeca5ae2944b95fb93d5f921583511c7",
    reviewedTextRu: "Теодор Моммзен (1817-1903) - немецкий историк античности и правовед, автор многотомной «Римской истории». В 1902 году он получил Нобелевскую премию по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1902/mommsen/facts/", "Официальная страница подтверждает годы жизни, исторические труды Моммзена, «Римскую историю» и премию 1902 года."],
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118583425.html", "Национальный справочник независимо подтверждает работу Моммзена как историка и правоведа и его многотомную «Римскую историю»."],
    ],
    decision: "corrected",
    notes: "Интерпретация влияния заменена авторством труда и официально подтверждённой премией. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:thomas_mann",
    originalSha256: "fcb4921f47ebc23d3cf44b8cc4e42411b774d3ae21771f661cf706484e3ec2e3",
    reviewedTextRu: "Томас Манн (1875-1955) - немецкий писатель и эссеист, автор романов «Будденброки» и «Волшебная гора». В 1929 году он получил Нобелевскую премию по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1929/mann/facts/", "Официальная страница подтверждает годы жизни, писательскую деятельность, «Будденброков» и премию 1929 года."],
      ["S. Fischer Verlage - Thomas Mann", "https://www.thomasmann.de/werk", "Официальный сайт издателя независимо подтверждает авторство «Будденброков», «Волшебной горы» и эссеистическое наследие Манна."],
    ],
    decision: "corrected",
    notes: "Суперлатив о романистах XX века заменён двумя произведениями и премией. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "germany:walther_von_der_vogelweide",
    originalSha256: "d14feed079e9ecf7e18423c82e747025cbfe9e267083fba1a54f1c8c923dfa92",
    reviewedTextRu: "Вальтер фон дер Фогельвейде (ок. 1170 - ок. 1230) - средневерхненемецкий лирический поэт и автор песен миннезанга. Его произведения сохранились в средневековых песенных рукописях.",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/sfz84442.html", "Национальный справочник подтверждает примерные годы жизни, лирическую деятельность и принадлежность Вальтера к миннезангу."],
      ["Deutsche Nationalbibliothek", "https://d-nb.info/gnd/118628976", "Национальная библиотека независимо фиксирует личность поэта, его произведения и рукописную традицию."],
    ],
    decision: "corrected",
    notes: "Два суперлатива заменены жанровой характеристикой и сведением о сохранности текстов. Identity queue: Q44385 согласуется; shared country files не изменялись.",
  },
  {
    key: "germany:wolfram_von_eschenbach",
    originalSha256: "29be1258db6ada0992f8155b0dc0326db6288a3613566406910b4721ad3fa8b0",
    reviewedTextRu: "Вольфрам фон Эшенбах (ок. 1170 - ок. 1220) - средневерхненемецкий поэт. Он написал рыцарский роман «Парцифаль» и поэму «Виллехальм».",
    evidence: [
      ["Deutsche Biographie", "https://www.deutsche-biographie.de/sfz98512.html", "Национальный справочник подтверждает примерные годы жизни Вольфрама, его поэтическую деятельность и авторство «Парцифаля» и «Виллехальма»."],
      ["Universitätsbibliothek Heidelberg", "https://digi.ub.uni-heidelberg.de/diglit/cpg339i", "Университетская библиотека независимо атрибутирует Вольфраму рукопись «Парцифаля» и документирует традицию произведения."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён точной языковой и жанровой характеристикой. Identity queue: Q18821 согласуется; shared country files не изменялись.",
  },
  {
    key: "ghana:ama_ata_aidoo",
    originalSha256: "d96a7155fc64a08a24a6ee14126674208cacb1d98244ec655a3fc431c9a7e074",
    reviewedTextRu: "Ама Ата Айду - ганская писательница, драматург и поэт. Она написала пьесу «Дилемма призрака» и роман «Перемены».",
    evidence: [
      ["University of Ghana", "https://ar.ug.edu.gh/ama-atta-aidoo", "Университетский ресурс подтверждает ганскую принадлежность, жанровые роли и авторство «Дилеммы призрака» и «Перемен»."],
      ["Bloomsbury Publishing", "https://www.bloomsbury.com/CA/author/ama-ata-aidoo/", "Независимый издательский профиль подтверждает литературные роли Айду и библиографию её пьес и прозы."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён ролями и произведениями. Источники расходятся в годе рождения: University of Ghana указывает 1942, Bloomsbury - 1943; поэтому год в тексте не приводится и shared date не меняется.",
  },
  {
    key: "ghana:ayi_kwei_armah",
    originalSha256: "cb5ddad2699e63aa9c51a2a0f95cf36f8d67fdce3b6c7d7e9dde8e600ac1f59d",
    reviewedTextRu: "Айи Квей Арма (род. 1939) - ганский романист и эссеист. Он написал романы «Прекрасные ещё не родились» и «Две тысячи сезонов», посвящённые жизни и истории Африки.",
    evidence: [
      ["University of Cape Coast - Kente", "https://journal.ucc.edu.gh/index.php/kente/article/view/111", "Университетское исследование подтверждает личность Армы, его романную прозу и африканскую историческую проблематику произведений."],
      ["Indiana University Library Catalog", "https://iucat.iu.edu/iue/3810017", "Университетский каталог независимо фиксирует авторство романа «Прекрасные ещё не родились» и его библиографические данные."],
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Ayi+Kwei+Armah&searchCode=GKEY%5E*&searchType=0&recCount=25", "Каталог Библиотеки Конгресса независимо подтверждает год рождения, профессию и библиографию, включая «Две тысячи сезонов»."],
    ],
    decision: "corrected",
    notes: "Оценочная известность заменена точными ролями, годом рождения и двумя романами.",
  },
  {
    key: "ghana:joseph_casely_hayford",
    originalSha256: "1f83c4c41da05ac8c0b42e3c6ccb4bee3c11222b5b987b861a6b2d83fdcbdce3",
    reviewedTextRu: "Джозеф Эфраим Кейсли-Хейфорд (1866-1930) - писатель, журналист, юрист и политический деятель Золотого Берега. Он написал роман «Ethiopia Unbound», опубликованный в 1911 году.",
    evidence: [
      ["Inner Temple", "https://www.innertemple.org.uk/celebrating-diversity-at-the-bar/joseph-ephraim-casely-hayford/", "Профессиональный архив подтверждает полное имя, годы жизни, юридическую, политическую и литературную деятельность и авторство романа."],
      ["University of Ghana Repository", "https://ugspace.ug.edu.gh/bitstreams/7aadd045-ffa2-4c3b-84f1-6ce21d73d895/download", "Университетское исследование независимо подтверждает роли Хейфорда, годы жизни и публикацию «Ethiopia Unbound» в 1911 году."],
      ["Encyclopaedia Africana", "https://encyclopaediaafricana.com/hayford-j-e-casely/", "Институциональная энциклопедия подтверждает биографию, политическую деятельность и точную дату смерти 11 августа 1930 года."],
    ],
    decision: "corrected",
    notes: "Текст конкретизирован, русское имя приведено к форме «Джозеф Эфраим Кейсли-Хейфорд». Карточечные 1866-05-24 и 1930-01-15 не соответствуют этой личности: Inner Temple указывает 1866-09-29 и годы жизни 1866-1930, Encyclopaedia Africana - 1866-09-28 и точную дату смерти 1930-08-11. Рекомендация: deathDate 1930-08-11, а день рождения оставить на ручное разрешение; shared country files не изменялись.",
  },
  {
    key: "ghana:kofi_awoonor",
    originalSha256: "682aa16b4c0d0b442480f8441b23a7929b19a77f6b1c2e717d8ea051913813fd",
    reviewedTextRu: "Ганский поэт и писатель, сочетавший традиции народа эве с современной литературой.",
    evidence: [
      ["Library of Congress", "https://www.loc.gov/item/n50035144/kofi-awoonor/", "Национальная библиотека США подтверждает ганскую принадлежность Авонора, его работу поэта и писателя и связь творчества с традицией эве."],
      ["INFLIBNET Centre", "https://ebooks.inflibnet.ac.in/engp06/chapter/kofi-awoonor/", "Межуниверситетский библиотечный центр Индии независимо подтверждает литературные роли Авонора и соединение устной традиции эве с современной поэзией."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного короткого текста подтверждены двумя независимыми институциональными источниками; текст сохранён дословно.",
  },
  {
    key: "ghana:martin_egblewogbe",
    originalSha256: "4a5c5a5c6334658538452f2d99e80b854a5154b825641c763d82a7649b1dcc60",
    reviewedTextRu: "Мартин Эгбевогбе - ганский автор рассказов и сооснователь Writers Project of Ghana. Среди его книг - сборники «Mr Happy and the Hammer of God and Other Stories» и «The Waiting».",
    evidence: [
      ["Writers Project of Ghana", "https://www.writersprojectghana.com/megblewogbe/", "Официальный профиль организации подтверждает литературную деятельность Эгбевогбе, его роль сооснователя и первый названный сборник."],
      ["Cambridge University Press", "https://www.cambridge.org/core/books/decolonizing-the-english-literary-curriculum/against-ethnography/B3D295B83E9DE2EEE9F559DA4E34568B", "Университетское издательство независимо подтверждает ганскую писательскую деятельность Эгбевогбе и его библиографию."],
      ["CiNii Books", "https://ci.nii.ac.jp/ncid/BD00490608", "Японский университетский каталог независимо фиксирует Эгбевогбе как автора сборника «The Waiting»."],
    ],
    decision: "corrected",
    notes: "Расплывчатая жанровая формула заменена конкретной организационной ролью и двумя книгами. Карточечная дата 1975-01-01 выглядит годовым заполнителем: источники подтверждают только 1975 год; shared date не менялась.",
  },
  {
    key: "ghana:nii_ayikwei_parkes",
    originalSha256: "6b11e05ed23b2c5c3a9f9594a8d9c46d1204e05f001f41604a976ee802fbb8f0",
    reviewedTextRu: "Нии Айквей Паркс - ганско-британский писатель, поэт и редактор. Он написал роман «Tail of the Blue Bird» и поэтический сборник «The Makings of You».",
    evidence: [
      ["Peepal Tree Press", "https://www.peepaltreepress.com/authors/nii-ayikwei-parkes", "Издательский профиль подтверждает ганско-британскую биографию, литературные роли и авторство романа и поэтического сборника."],
      ["Nii Ayikwei Parkes - official site", "https://niiparkes.com/open/profile/cv/?aid=235&sa=0", "Официальная авторская биография независимо подтверждает работу писателя, поэта и редактора и перечисляет названные книги."],
    ],
    decision: "corrected",
    notes: "Общее определение заменено точными ролями и произведениями. Date queue: карточечное 1974-01-01 и кандидат 1974-04-01 не подтверждены двумя институциональными источниками; точный день остаётся unresolved, shared country files не изменялись.",
  },
  {
    key: "greece:andreas_kalvos",
    originalSha256: "b8d9078a00cbcd74af604d1bd7c0a9a71cd61eedb0c7708ab1f3b6d6e8096b32",
    reviewedTextRu: "Андреас Калвос (1792-1869) - греческий поэт, родившийся на Закинфе. Его сборники «Лира» и «Новые оды» вышли в 1824 и 1826 годах.",
    evidence: [
      ["Capodistrias Museum", "https://www.capodistriasmuseum.gr/en/persons/andreas-kalvos/", "Государственный музей подтверждает рождение Калвоса на Закинфе в апреле 1792 года, смерть в 1869 году и публикацию обоих сборников."],
      ["Ionian University - POLYSEMi", "https://polysemi.di.ionio.gr/index.php/2019/08/29/andreas-kalvos-2/", "Университетский проект независимо подтверждает биографию поэта, апрель 1792 года и даты выхода «Лиры» и «Новых од»."],
    ],
    decision: "corrected",
    notes: "Лаконичный текст дополнен точными произведениями. Оба институциональных источника указывают только апрель 1792 года, поэтому карточечное 1792-05-01 следует заменить на месяц 1792-04 без выдуманного дня; shared country files не изменялись.",
  },
  {
    key: "greece:dionysios_solomos",
    originalSha256: "d24a4741ab73dbf9bb47fd6c56321cce02c8455be0220bc229eb96e64c36d0ee",
    reviewedTextRu: "Национальный поэт Греции, автор текста государственного гимна.",
    evidence: [
      ["Presidency of the Hellenic Republic", "https://www.presidency.gr/en/presidency/the-national-anthem/", "Официальная страница президента подтверждает, что государственный гимн основан на написанном Дионисиосом Соломосом «Гимне свободе»."],
      ["Municipality of Thessaloniki", "https://thessaloniki.gr/dionysios-solomos/?lang=en", "Муниципальный культурный ресурс независимо называет Соломоса национальным поэтом Греции и автором текста гимна."],
    ],
    decision: "unchanged",
    notes: "Оба конкретных утверждения исходного текста подтверждены официальными греческими источниками; текст сохранён дословно.",
  },
  {
    key: "greece:giannis_ritsos",
    originalSha256: "a6b8a6974a9d2089968ce4f35300d0fcccd1a16681d4329753b8a3088eb51094",
    reviewedTextRu: "Яннис Рицос (1909-1990) - греческий поэт. Среди его произведений - поэмы «Эпитафий» и «Ромьосини».",
    evidence: [
      ["Yannis Ritsos Museum", "https://www.ritsosmuseum.gr/en/biography/", "Профильный музей подтверждает годы жизни, поэтическую деятельность и авторство «Эпитафия» и «Ромьосини»."],
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Yannis+Ritsos&searchCode=GKEY%5E*&searchType=0&recCount=25", "Национальный библиотечный каталог независимо подтверждает личность, годы жизни и библиографические записи произведений Рицоса."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён произведениями. Музей указывает рождение 1/14 мая 1909 года по старому/новому стилю; карточечное 1909-05-01 следует показывать календарно осмысленно, а не автоматически заменять без общей политики дат.",
  },
  {
    key: "greece:giorgos_seferis",
    originalSha256: "530e828ade6ea90c12bd115756c0185455c7911a7a44d99cfb4f963bcfc2882d",
    reviewedTextRu: "Греческий поэт, лауреат Нобелевской премии по литературе 1963 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1963/seferis/facts/", "Официальная страница подтверждает греческую поэтическую деятельность Сефериса и премию 1963 года."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/george-seferis", "Независимая литературная организация подтверждает его греческую принадлежность, профессию поэта и Нобелевскую премию."],
    ],
    decision: "unchanged",
    notes: "Все утверждения исходного короткого текста подтверждены; текст сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "greece:homer",
    originalSha256: "1dc8637013371dc61260d3435f54c5b1ef1b46effab4a6c03e2425ec892d469e",
    reviewedTextRu: "Древнегреческий поэт, которому традиционно приписываются эпические поэмы «Илиада» и «Одиссея».",
    evidence: [
      ["British Museum", "https://www.britishmuseum.org/blog/who-was-homer", "Национальный музей подтверждает традиционную атрибуцию Гомеру «Илиады» и «Одиссеи» и подчёркивает неопределённость исторической личности."],
      ["University College London", "https://www.ucl.ac.uk/arts-humanities/classics/events/classical-play/past-productions/2021-homers-odyssey/2021-homers-odyssey-study-guide", "Университетский материал независимо описывает Гомера как традиционно считающегося автором двух древнегреческих эпических поэм."],
    ],
    decision: "unchanged",
    notes: "Осторожная атрибуция исходного текста полностью соответствует академическим источникам; текст сохранён дословно.",
  },
  {
    key: "greece:nikos_kazantzakis",
    originalSha256: "4b5bffdbcbb28a7da10686818d8fb5c18652646d8bca3bdcc4e2efcd29a06da7",
    reviewedTextRu: "Никос Казандзакис (1883-1957) - греческий писатель, драматург и эссеист. Он написал романы «Грек Зорба» и «Последнее искушение Христа».",
    evidence: [
      ["Nikos Kazantzakis Estate", "https://www.nikoskazantzakisestate.org/nikos-kazantzakis", "Официальный архив наследия подтверждает годы жизни, литературные роли Казандзакиса и авторство двух романов."],
      ["Historical Museum of Crete", "https://www.historical-museum.gr/en/collections/nikos-kazantzakis", "Исторический музей Крита независимо подтверждает биографию, многожанровую деятельность и названные произведения."],
    ],
    decision: "corrected",
    notes: "Единоличный суперлатив заменён точными ролями и двумя произведениями.",
  },
  {
    key: "greece:odysseas_elytis",
    originalSha256: "ef14e8f3ac6519b86d8bb7893ec3dc8a6ed9be740ad8aca215c502d826a3d289",
    reviewedTextRu: "Греческий поэт, лауреат Нобелевской премии по литературе 1979 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1979/elytis/biographical/", "Официальная биография подтверждает греческую поэтическую деятельность Элитиса и Нобелевскую премию 1979 года."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/odysseus-elytis", "Независимая литературная организация подтверждает профессию, национальную принадлежность и премию Элитиса."],
    ],
    decision: "unchanged",
    notes: "Исходный короткий текст фактологически точен и сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "greece:sappho",
    originalSha256: "f604df9c37035c1ce19614a563a345dd4b280cc7514636806092d9a9d4bc6338",
    reviewedTextRu: "Сапфо - древнегреческая лирическая поэтесса с острова Лесбос, жившая около конца VII - начала VI века до н. э. Её поэзия сохранилась преимущественно во фрагментах.",
    evidence: [
      ["Cambridge University Press", "https://www.cambridge.org/highereducation/books/sappho/6AA37FEF8D846985479CF107B2E6CD16", "Академическое издательство подтверждает происхождение Сапфо с Лесбоса, примерный исторический период и лирический характер сохранившихся фрагментов."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/sappho", "Независимая литературная организация подтверждает древнегреческую лирическую деятельность Сапфо и преимущественно фрагментарную сохранность её поэзии."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён датировкой, местом и характеристикой сохранности корпуса.",
  },
  {
    key: "grenada:george_brizan",
    originalSha256: "f04b132cd30ac4230ff7ee01c366f06b0c94ab6deefd3424620149c460f59711",
    reviewedTextRu: "Джордж Игнатиус Бризан (1942-2012) - гренадский историк, педагог и политик. В 1995 году он занимал пост премьер-министра Гренады.",
    evidence: [
      ["CARICOM", "https://caricom.org/caricom-remembers-rt-hon-george-brizan/", "Официальный межгосударственный некролог подтверждает годы жизни, педагогическую и политическую деятельность Бризана и его работу премьер-министром."],
      ["Parliament of Grenada", "https://grenadaparliament.gd/prime-ministers/", "Официальный сайт парламента независимо подтверждает пребывание Джорджа Бризана на посту премьер-министра в 1995 году."],
      ["National Democratic Congress of Grenada", "https://www.ndcgrenada.org/past-leaders/", "Официальная биографическая страница партии подтверждает полное имя, дату рождения 31 октября 1942 года и профессиональные роли Бризана."],
    ],
    decision: "corrected",
    notes: "Непроверяемая оценка интеллектуального значения заменена должностями и периодом премьерства. Карточечные 1942-01-01 и 2012-01-01 являются годовыми заполнителями; birthDate рекомендуется 1942-10-31, deathDate требует отдельной фиксации точного дня в shared data.",
  },
  {
    key: "grenada:julian_fedon",
    originalSha256: "4e3c3dc34b3d1543ca11665e2a2571808aecb2a877b4e7ef8b0aa986c881ea5b",
    reviewedTextRu: "Идентичность современного гренадского автора по имени Джулиан Федон не установлена: институциональные источники связывают это имя с Жюльеном Федоном, руководителем восстания 1795-1796 годов, а не с писателем XX века.",
    evidence: [
      ["University of the West Indies", "https://www.mona.uwi.edu/marcom/uwinotebook/entry/801", "Университетский материал идентифицирует Жюльена Федона как руководителя гренадского восстания 1795-1796 годов, а не современного автора."],
      ["University of Glasgow", "https://theses.gla.ac.uk/81764/", "Университетское исследование независимо документирует исторического Жюльена Федона и не подтверждает личность писателя с карточечным годом 1940."],
    ],
    decision: "held",
    notes: "Identity не установлена; карточка, вероятно, смешивает исторического Жюльена Федона с вымышленным современным автором. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "guatemala:augusto_monterroso",
    originalSha256: "ebc4e601517211763475ae630473588ad15d1911efa9f7ad8c4a24e156dda6ff",
    reviewedTextRu: "Аугусто Монтерросо (1921-2003) - гватемальский писатель, родившийся в Гондурасе и живший в Мексике. Он писал рассказы, эссе и басни; среди его книг - «Полное собрание сочинений (и другие рассказы)» и «Чёрная овца и прочие басни».",
    evidence: [
      ["Instituto Cervantes", "https://cvc.cervantes.es/actcult/monterroso/biografia.htm", "Институт Сервантеса подтверждает годы жизни, рождение в Гондурасе, гватемальскую идентичность, жизнь в Мексике, жанры и названные книги."],
      ["Universidad Nacional Autónoma de México", "https://boletinbnm.iib.unam.mx/index.php/BBNM/article/download/231/447/1022", "Национальный университет Мексики независимо подтверждает биографический маршрут Монтерросо, его жанры и библиографию."],
    ],
    decision: "corrected",
    notes: "Оценки стиля заменены проверяемыми биографическими сведениями, жанрами и произведениями.",
  },
  {
    key: "guatemala:enrique_gomez_carrillo",
    originalSha256: "85a502c4366dcea17a663185ac3376f675da7626f2c6f01f74c3913b3806334c",
    reviewedTextRu: "Энрике Гомес Каррильо (1873-1927) - гватемальский писатель, журналист, литературный критик и дипломат. Он публиковал хроники о европейской литературной и культурной жизни.",
    evidence: [
      ["Ministerio de Cultura y Deportes de Guatemala", "https://mcd.gob.gt/wp-content/uploads/2022/05/6-Enrique-Go%E2%95%A0umez-Carrillo-El-despertar-del-alma-Lecturas-Bicentenarias.pdf", "Издание министерства культуры подтверждает годы жизни, национальность, литературную, журналистскую, критическую и дипломатическую деятельность Каррильо и его хроники."],
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Enrique+Gomez+Carrillo&searchCode=GKEY%5E*&searchType=0&recCount=25", "Каталог национальной библиотеки независимо фиксирует личность, годы жизни, профессии и корпус хроник Гомеса Каррильо."],
    ],
    decision: "corrected",
    notes: "Суперлатив о модернизме и широкая оценка влияния заменены профессиональными ролями и документированным жанром хроники.",
  },
  {
    key: "guatemala:francisco_alejandro_mendez",
    originalSha256: "1cc9e3ac40fe63b8efcca2e1bb165dad7ee49d8e1bfd4e945fdd68118f7d1bbb",
    reviewedTextRu: "Франсиско Алехандро Мендес (1964-2026) - гватемальский писатель, журналист, литературный критик и преподаватель. В 2017 году он получил Национальную литературную премию имени Мигеля Анхеля Астуриаса.",
    evidence: [
      ["Academia Guatemalteca de la Lengua", "https://agl.org.gt/academicos/francisco-alejandro-mendez-castaneda/", "Национальная языковая академия подтверждает годы жизни, литературную, журналистскую, критическую и преподавательскую деятельность Мендеса."],
      ["Diario de Centro América", "https://dca.gob.gt/noticias-guatemala-diario-centro-america/francisco-alejandro-mendez-recibe-el-premio-nacional-de-literatura/", "Официальная государственная газета независимо подтверждает профессиональные роли и получение национальной премии в 2017 году."],
      ["Prensa Libre", "https://www.prensalibre.com/vida/escenario/fallece-francisco-alejandro-mendez-premio-nacional-de-literatura-2017/", "Национальная газета подтверждает смерть Франсиско Алехандро Мендеса 28 марта 2026 года и его премию."],
    ],
    decision: "corrected",
    notes: "Расплывчатые тематические оценки заменены ролями и наградой. Date recommendation: добавить deathDate 2026-03-28; shared country files не изменялись.",
  },
] satisfies readonly ReviewSeed[];

function finalizeReviewRecord(seed: ReviewSeed): WriterBiographyFactReviewRecord {
  const verdict: WriterBiographyClaimVerdict =
    seed.decision === "held"
      ? "not-established"
      : seed.decision === "unchanged"
        ? "supported"
        : "corrected";

  return {
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
    claims: [{
      textRu: seed.reviewedTextRu,
      verdict,
      evidence: seed.evidence.map(([provider, url, findingRu]) => ({
        provider,
        url,
        checkedAt,
        findingRu,
      })),
    }],
    reviewer,
    decision: seed.decision,
    notes: seed.notes,
  };
}

export const writerBiographyFactReviewBatch30: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);

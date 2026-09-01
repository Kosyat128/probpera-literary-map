export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH15_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 15";

export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimVerdict =
  | "supported"
  | "corrected"
  | "not-established";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH15_REVIEWER;
const checkedAt = "2026-08-09";

function evidence(
  provider: string,
  url: string,
  findingRu: string,
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

const writerBiographyFactReviewBatch15Base: readonly Omit<
  WriterBiographyFactReviewRecord,
  "applicableTextRu"
>[] = [
  {
    key: "burundi:jean_pierre_hatungimana",
    originalSha256:
      "cedf743b5e7ddf717a5a7eccd4c965b1391b30e2c483a826f4e782f5be3b370d",
    reviewedTextRu:
      "Личность Жан-Пьера Хатунгиманы как бурундийского писателя не установлена по доступным авторитетным каталогам.",
    claims: [
      {
        textRu:
          "Надёжно связать имя Жан-Пьера Хатунгиманы с заявленной карточкой бурундийского писателя не удалось.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Library of Congress Online Catalog",
            "https://catalog.loc.gov/vwebv/search?searchArg=Jean-Pierre+Hatungimana&searchCode=GKEY%5E*&searchType=0&recCount=25",
            "Поиск по точному имени не выявил авторитетной библиографической записи, которую можно однозначно связать с заявленным бурундийским писателем.",
          ),
          evidence(
            "WorldCat - OCLC",
            "https://search.worldcat.org/search?q=%22Jean-Pierre%20Hatungimana%22%20Burundi",
            "Поиск имени вместе со страной не выявил изданий или authority identity, подтверждающих исходную карточку.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held: отсутствие совпадений в двух независимых каталогах не доказывает несуществование автора, поэтому исходный текст не заменяется догадкой и не применяется публично. Identity registry: not-mapped. Рекомендация по датам - убрать неподтверждённый birthDate 1963 до установления личности. Shared country files не изменялись.",
  },
  {
    key: "burundi:roland_rugero",
    originalSha256:
      "ceabe13be8c72591495a3638f3c24a4924c3de54271eb02f3ae81a8b19a9c9f3",
    reviewedTextRu:
      "Бурундийский писатель и журналист, автор романов «Les Oniriques» и «Baho!». В 2009 году получил бронзовую медаль литературного конкурса Игр Франкофонии.",
    claims: [
      {
        textRu:
          "Ролан Ружеро - бурундийский писатель и журналист, автор романов «Les Oniriques» и «Baho!», бронзовый призёр литературного конкурса Игр Франкофонии 2009 года.",
        verdict: "corrected",
        evidence: [
          evidence(
            "International Writing Program - University of Iowa",
            "https://iwp.uiowa.edu/writers/2013-resident/rugero-roland",
            "Университетский профиль называет Ружеро бурундийским прозаиком и журналистом и перечисляет романы Les Oniriques и Baho.",
          ),
          evidence(
            "Éditions Vents d'ailleurs",
            "https://www.ventsdailleurs.com/index.php/les-auteurs/item/roland-rugero",
            "Профиль издателя подтверждает авторство двух романов, журналистскую работу и рождение 22 февраля 1986 года.",
          ),
          evidence(
            "Jeux de la Francophonie - OIF",
            "https://www.jeux.francophonie.org/sites/default/files/public/CV/cv_roland_rugero.pdf",
            "Официальная справка Игр Франкофонии фиксирует бронзовую медаль литературного конкурса 2009 года и библиографию автора.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Неподтверждённая сравнительная оценка заметности снята и заменена конкретными произведениями и наградой. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1986 до 1986-02-22. Shared country files не изменялись.",
  },
  {
    key: "cambodia:ang_duong",
    originalSha256:
      "4b838cd15e4e9b3d520981bb48481f904ba401f03f0ac5897d34d77138790a76",
    reviewedTextRu:
      "Король Камбоджи Анг Дуонг - автор кхмерской стихотворной повести «Ка Кей». В середине XIX века он поддерживал восстановление кхмерской буддийской литературы.",
    claims: [
      {
        textRu:
          "Анг Дуонг был королём Камбоджи, написал кхмерскую повесть «Ка Кей» и поддерживал восстановление буддийской письменной культуры.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Office of the Council of Ministers of Cambodia",
            "https://pressocm.gov.kh/en/archives/60114",
            "Официальный материал правительства Камбоджи связывает короля Анг Дуонга с авторством истории Ka Key.",
          ),
          evidence(
            "Cambridge University Press",
            "https://www.cambridge.org/core/product/identifier/CBO9789814519076A034/type/BOOK_PART",
            "Академическая глава подтверждает правление Анг Дуонга и его поддержку восстановления кхмерской буддийской литературы и переводов.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Расплывчатая формулировка заменена конкретным литературным произведением и документированной культурной деятельностью. Identity audit corroborated. Рекомендация - сохранить годовые birthDate 1796 и deathDate 1860: выбранные главные источники не дают достаточной опоры для искусственной точности дня и месяца. Shared country files не изменялись.",
  },
  {
    key: "cambodia:nou_hach",
    originalSha256:
      "d85f402a627beb25e8e191db0c334bf68b015f8b6a0a6d06b9964b2b57202c9d",
    reviewedTextRu:
      "Камбоджийский писатель, автор романов «Увядший цветок» (Phka Srapoun) и «Гирлянда сердца» (Mealea Doung Chet).",
    claims: [
      {
        textRu:
          "Ноу Хач - камбоджийский писатель, автор романов Phka Srapoun и Mealea Doung Chet.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Center for Khmer Studies Library",
            "https://library.khmerstudies.org/bib/8993",
            "Институциональный каталог фиксирует Ноу Хача как автора романа Phka Srapoun, известного по английскому названию Wilted Flower.",
          ),
          evidence(
            "Words Without Borders",
            "https://wordswithoutborders.org/read/article/2015-11/cambodia-from-angkor-to-year-zero/",
            "Литературная некоммерческая организация относит Wilted Flower Ноу Хача к ранним камбоджийским романам, сохраняющим читательское значение.",
          ),
          evidence(
            "Center for Khmer Studies Library",
            "https://library.khmerstudies.org/bib/5494",
            "Каталог Центра кхмерских исследований подтверждает авторскую связь Ноу Хача с Mealea Doung Chet.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочный ранг «классик» заменён проверяемой библиографией. Identity audit corroborated. Рекомендация - оставить birthDate 1916 и deathDate 1975 на уровне годов; точные дни выбранными источниками не установлены. Shared country files не изменялись.",
  },
  {
    key: "cambodia:soth_polin",
    originalSha256:
      "b6410c0981895123b8182a57673b90fa1c18865499ff321f9c5f05064f87586a",
    reviewedTextRu:
      "Камбоджийский писатель и журналист, автор романов «Бессмысленная жизнь» и «Анархист». В конце 1960-х годов основал газету и издательство Nokor Thom.",
    claims: [
      {
        textRu:
          "Сот Полин - камбоджийский писатель и журналист, автор романов A Meaningless Life и The Anarchist и основатель газеты и издательства Nokor Thom.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Words Without Borders",
            "https://wordswithoutborders.org/contributors/view/soth-polin/",
            "Профиль автора подтверждает рождение в Камбодже в 1943 году, романы A Meaningless Life и The Anarchist и основание Nokor Thom.",
          ),
          evidence(
            "Center for Khmer Studies",
            "https://khmerstudies.org/wp-content/uploads/2021/06/modern-short-story3-en.pdf",
            "Институциональное издание представляет Сот Полина как камбоджийского журналиста и романиста, называет дебютный роман и его издательскую деятельность.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценка заметности заменена ролями, произведениями и издательской деятельностью. Identity audit corroborated. Рекомендация - сохранить годовой birthDate 1943: оба источника подтверждают год, но не дают дня и месяца. Shared country files не изменялись.",
  },
  {
    key: "cameroon:calixthe_beyala",
    originalSha256:
      "d32b0ae9a9bcba7800102b27407546dba860fd7d9c382872c57238a31b3b79e7",
    reviewedTextRu:
      "Камерунская франкоязычная писательница, автор романов «Assèze l’Africaine» и «Les Honneurs perdus». Роман «Les Honneurs perdus» получил Большую премию Французской академии в 1996 году.",
    claims: [
      {
        textRu:
          "Каликст Бейяла - родившаяся в Камеруне франкоязычная писательница; её роман Les Honneurs perdus получил Большую премию Французской академии в 1996 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Hachette",
            "https://www.hachette.fr/auteur/calixthe-beyala/",
            "Профиль издателя подтверждает рождение в Камеруне в 1961 году, романы Assèze l’Africaine и Les Honneurs perdus и литературные награды.",
          ),
          evidence(
            "Académie française",
            "https://www.academie-francaise.fr/calixthe-beyala",
            "Официальная страница Академии фиксирует оба романа и Большую премию за Les Honneurs perdus в 1996 году.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=12072936",
            "Национальный каталог подтверждает авторство Бейялы и год рождения 1961.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценка известности снята и заменена конкретными романами и наградой. Identity audit corroborated. Доказанная рекомендация - заменить чрезмерно точный birthDate 1961-10-26 на годовой 1961: Hachette и BnF подтверждают год, но не этот день и месяц. Shared country files не изменялись.",
  },
  {
    key: "cameroon:emmanuel_dongala",
    originalSha256:
      "f59b33e5c4594662437e23c28978f72553682d26e5c3674de2479b5af8a5b050",
    reviewedTextRu:
      "Эмманюэль Донгала - писатель и химик из Республики Конго; его привязка к Камеруну не подтверждается авторитетными источниками.",
    claims: [
      {
        textRu:
          "Эмманюэль Донгала связан с Республикой Конго, а не с Камеруном; камерунская карточка является межстрановым дублем.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Bard College",
            "https://www.bard.edu/news/releases/pr/fstory.php?id=9599",
            "Университетский профиль называет Донгалу романистом из Республики Конго и профессором химии.",
          ),
          evidence(
            "Bard College Human Rights Project",
            "https://hrp.bard.edu/emmanuel-dongala-billy-kahora-and-nnedi-okorafor/",
            "Институциональная биография характеризует Эмманюэля Бундзеки Донгалу как конголезского химика и романиста и перечисляет его книги.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://data.bnf.fr/fr/ark%3A/12148/cb165745777.pdf",
            "Национальная библиотека связывает Эмманюэля Донгалу с романом Un fusil dans la main, un poème dans la poche и подтверждает авторскую идентичность.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held: identity established, but country association is false. Canonical duplicate exists as republic_of_congo:emmanuel_dongala; применять текст к Cameroon нельзя. Рекомендация - удалить или перенаправить камерунский дубль, сохранив year-level birthDate 1941 только в канонической карточке. Shared country files не изменялись.",
  },
  {
    key: "cameroon:etienne_goyemide",
    originalSha256:
      "c349a04de5899b004dd0ef07492906037fb127ccc23bc601838fa4d916b5eebd",
    reviewedTextRu:
      "Этьен Гойемиде - писатель и драматург из Центральноафриканской Республики; его привязка к Камеруну не подтверждается авторитетными источниками.",
    claims: [
      {
        textRu:
          "Этьен Гойемиде связан с Центральноафриканской Республикой, а не с Камеруном; камерунская карточка является межстрановым дублем.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Africultures",
            "https://africultures.com/personnes/?no=3527",
            "Профиль указывает Центральноафриканскую Республику, роли писателя и драматурга, годы жизни 1942-1997 и библиографию.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb37399180n",
            "Национальный каталог подтверждает авторство Étienne Goyémidé, годы 1942-1997 и роман Le dernier survivant de la caravane.",
          ),
          evidence(
            "Les Francophonies",
            "https://www.lesfrancophonies.fr/IMG/pdf/plaquette-25ans-2.pdf",
            "Архив фестиваля относит Этьена Гойемиде к Центральноафриканской Республике.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held: identity established, but country association is false. Canonical duplicate exists as central_african_republic:etienne_goyemide; применять текст к Cameroon нельзя. Доказанная рекомендация для канонической карточки - birthDate 1942-01-22 и deathDate 1997-03-17 по двум профильным записям; камерунский дубль удалить или перенаправить. Shared country files не изменялись.",
  },
  {
    key: "cameroon:ferdinand_oyono",
    originalSha256:
      "139be8e5e12dc9eae79e165271d202d7534a9150f1ffd39d89b14d82c5cd67d7",
    reviewedTextRu:
      "Камерунский писатель и дипломат, автор романов «Une vie de boy», «Le Vieux Nègre et la Médaille» и «Chemin d’Europe».",
    claims: [
      {
        textRu:
          "Фердинанд Ойоно был камерунским писателем и дипломатом, автором трёх опубликованных романов.",
        verdict: "corrected",
        evidence: [
          evidence(
            "United Nations",
            "https://www.un.org/sg/en/content/former-secretary-general/statements/2010-06-10/secretary-generals-remarks-the-republic-of-cameroon-national-assembly-delivered",
            "Генеральный секретарь ООН назвал Ойоно бывшим министром, писателем и бывшим постоянным представителем Камеруна при ООН и зафиксировал смерть 10 июня 2010 года.",
          ),
          evidence(
            "United Nations Digital Library",
            "https://digitallibrary.un.org/record/3808623?ln=en",
            "Биографическая запись ООН подтверждает дипломатическую идентичность Фердинанда Леопольда Ойоно и его руководство Исполнительным советом ЮНИСЕФ.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://data.bnf.fr/en/see_all_activities/12170141/page1",
            "Национальная библиотека подтверждает годы жизни 1929-2010 и перечисляет роман Une vie de boy (1956) в библиографии Ойоно.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочный ранг «классик» заменён конкретной библиографией; писательская и дипломатическая роли сохранены. Identity audit corroborated. Рекомендация - сохранить birthDate 1929-09-14 и deathDate 2010-06-10: даты согласуются с авторитетными биографическими и дипломатическими записями. Shared country files не изменялись.",
  },
  {
    key: "cameroon:jean_roger_essomba",
    originalSha256:
      "b1b264d79a19971ffa0848aaf2e614a832c318bb9a7431d1a9618a86e6d37c04",
    reviewedTextRu:
      "Камерунский писатель и издатель, автор романов «Le Dernier Gardien de l’arbre» и «Le Paradis du Nord».",
    claims: [
      {
        textRu:
          "Жан-Роже Эссомба - родившийся в Камеруне писатель и издатель, автор нескольких романов.",
        verdict: "corrected",
        evidence: [
          evidence(
            "EJR Éditions",
            "https://www.ejreditions.com/auteurs",
            "Профиль издательства указывает рождение Ж.-Р. Эссомбы в Камеруне в 1962 году, авторство романов и его работу в издательском деле.",
          ),
          evidence(
            "Africultures",
            "https://africultures.com/la-plume-de-jean-roger-essomba/",
            "Профиль подтверждает рождение в Камеруне в 1962 году, девять романов и последующую работу в литературе и издательстве.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Общая тавтологичная формула заменена конкретными ролями и произведениями. Identity audit identity-discrepant: речь идёт о Jean-Roger Essomba, а не Jean-Roger Essombe Edimo. Доказанная рекомендация - заменить ошибочный birthDate 1950 на годовой 1962. Shared country files не изменялись.",
  },
  {
    key: "cameroon:leonora_miano",
    originalSha256:
      "ed9c1b741aa8fc5d06067441b542c96a2b0c859b2cc406307f4c4f572b10cb56",
    reviewedTextRu:
      "Франкоязычная писательница камерунского происхождения.",
    claims: [
      {
        textRu:
          "Леонора Миано - франкоязычная писательница, родившаяся в Камеруне.",
        verdict: "supported",
        evidence: [
          evidence(
            "University of Chicago Press",
            "https://press.uchicago.edu/ucp/books/author/M/L/au27417094.html",
            "Университетское издательство называет Миано автором художественной и документальной прозы и подтверждает рождение в Камеруне в 1973 году.",
          ),
          evidence(
            "Éditions du Seuil",
            "https://www.seuil.com/ouvrage/l-oppose-de-la-blancheur-leonora-miano/9782021540710",
            "Издатель представляет Леонору Миано как романиста, драматурга и эссеиста и перечисляет её франкоязычные произведения и награды.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходная нейтральная формулировка подтверждена двумя издательскими институциями. Identity audit corroborated. Рекомендация - сохранить birthDate 1973-03-12; год и личность подтверждены, расхождений не обнаружено. Shared country files не изменялись.",
  },
  {
    key: "cameroon:patrice_nganang",
    originalSha256:
      "f83ae329c6fb095423e2f57cc617e9b5dc8f9d78d0868ed6ab67c06b34c51335",
    reviewedTextRu: "Камерунский писатель и литературовед.",
    claims: [
      {
        textRu:
          "Патрис Нгананг - родившийся в Камеруне писатель и исследователь литературы и культуры.",
        verdict: "supported",
        evidence: [
          evidence(
            "Farrar, Straus and Giroux - Macmillan",
            "https://us.macmillan.com/author/patricenganang/",
            "Профиль издателя подтверждает камерунское происхождение и работу Нгананга как романиста, поэта и эссеиста.",
          ),
          evidence(
            "Stony Brook University",
            "https://www.stonybrook.edu/africana-studies/people/indvidfacpage/nganang.html",
            "Университетский профиль фиксирует научную работу Нгананга по постколониальной африканской литературе, театру и культуре и его писательскую деятельность.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Обе исходные роли подтверждены без оценочного ранжирования. Identity audit corroborated. Рекомендация - сохранить годовой birthDate 1970: точный день не нужен для биографии и не подтверждён обоими главными источниками. Shared country files не изменялись.",
  },
  {
    key: "cameroon:paul_dakeyo",
    originalSha256:
      "72359c2a5fd7d35768191e2ef3dc01709cb9ee1c45dd2ddb93d09509b9feb6be",
    reviewedTextRu: "Камерунский поэт и издатель.",
    claims: [
      {
        textRu: "Поль Дакейо - камерунский поэт и издатель.",
        verdict: "supported",
        evidence: [
          evidence(
            "Africultures",
            "https://africultures.com/personnes/?no=6704",
            "Профиль прямо называет Поля Дакейо камерунским поэтом и издателем.",
          ),
          evidence(
            "Revue Possibles - Université de Montréal",
            "https://revuepossibles.ojs.umontreal.ca/index.php/revuepossibles/article/download/738/1105/2276",
            "Университетское издание подтверждает роли поэта и издателя, рождение 18 февраля 1948 года и основание Éditions Silex.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Краткий исходный текст полностью подтверждён. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1948 до 1948-02-18. Shared country files не изменялись.",
  },
  {
    key: "cameroon:rene_philombe",
    originalSha256:
      "43843f116b1bfc3ebbbce7a54fdbbaef71c2f7a601a1c80c664f878ff42594e6",
    reviewedTextRu:
      "Камерунский писатель, поэт и общественный деятель.",
    claims: [
      {
        textRu:
          "Рене Филомб был камерунским писателем и поэтом и участвовал в организации литературной и общественной жизни страны.",
        verdict: "supported",
        evidence: [
          evidence(
            "University of Western Australia - Peuples Noirs Peuples Africains archive",
            "https://mongobeti.arts.uwa.edu.au/issues/pnpa51/pnpa51_05.html",
            "Университетский архив документирует прозу, поэзию, драматургию Филомба, его издательскую работу и руководство Ассоциацией поэтов и писателей Камеруна.",
          ),
          evidence(
            "Académie française",
            "https://www.academie-francaise.fr/rene-philombe",
            "Официальная страница фиксирует литературную премию Рене Филомбу за совокупность произведений и связь с Ассоциацией камерунских поэтов.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://data.bnf.fr/fr/see_all_activities/11887262/page1",
            "Национальная библиотека подтверждает авторскую идентичность, годы жизни 1930-2001 и корпус произведений.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходные роли подтверждены литературным корпусом и организационной деятельностью. Identity audit corroborated. Рекомендация - сохранить birthDate 1930-11-13 и deathDate 2001-10-25; годы подтверждены институционально, а текущая точность не конфликтует с identity mapping. Shared country files не изменялись.",
  },
  {
    key: "cameroon:werewere_liking",
    originalSha256:
      "30c70b66aef217081a397f672bf9deaa67c9ccc2c9fdfa60c0dfd4595ed45d4a",
    reviewedTextRu:
      "Камерунская писательница, поэтесса и драматург.",
    claims: [
      {
        textRu:
          "Веревер Ликинг - родившаяся в Камеруне писательница, поэтесса и драматург.",
        verdict: "supported",
        evidence: [
          evidence(
            "University of Western Australia",
            "https://aflit.arts.uwa.edu.au/WerewereLikingEng.html",
            "Университетский профиль подтверждает рождение в Камеруне в 1950 году и произведения Ликинг в прозе, поэзии и драматургии.",
          ),
          evidence(
            "Africultures",
            "https://africultures.com/personnes/?no=3646",
            "Профиль подтверждает рождение 1 мая 1950 года в Камеруне и роли писательницы и драматурга наряду с театральной работой.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходный текст полностью подтверждён и не содержит сравнительной оценки. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1950 до 1950-05-01. Shared country files не изменялись.",
  },
  {
    key: "canada:chris_hadfield",
    originalSha256:
      "00cf4ba4178ab86fa79e19dc00c1a9d53c974f540af40de369b2e41af0e6e50c",
    reviewedTextRu:
      "Канадский астронавт, инженер и лётчик-испытатель, совершивший три космических полёта. Автор книг «Руководство астронавта по жизни на Земле» и «Ты здесь: вокруг света за 92 минуты».",
    claims: [
      {
        textRu:
          "Крис Хэдфилд - канадский астронавт, инженер и лётчик-испытатель, совершивший три космических полёта и опубликовавший документальные книги о космосе.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Canadian Space Agency",
            "https://www.csa-asc.gc.ca/eng/astronauts/canadian/retired/bio-chris-hadfield.asp",
            "Официальная биография подтверждает инженерную и лётно-испытательную подготовку, космические миссии и начало авторской карьеры с An Astronaut's Guide to Life on Earth.",
          ),
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/authors/187799/chris-hadfield/",
            "Профиль издателя подтверждает три космических полёта и книги An Astronaut's Guide to Life on Earth и You Are Here.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Интерпретация тем книг заменена проверяемыми биографическими и библиографическими фактами. Identity source - articleReferencedBooks; identity established directly. Рекомендация - сохранить birthDate 1959-08-29: расхождений не обнаружено. Shared country files не изменялись.",
  },
  {
    key: "canada:margaret_laurence",
    originalSha256:
      "3db1b8d9439b336114c96ec0c258b50b8ee4d0a7413c8421c3fbdda172ca9c66",
    reviewedTextRu:
      "Канадская писательница, автор романов «Каменный ангел» (The Stone Angel) и «Прорицатели» (The Diviners).",
    claims: [
      {
        textRu:
          "Маргарет Лоренс была канадской писательницей и написала романы The Stone Angel и The Diviners.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Government of Canada",
            "https://www.canada.ca/en/women-gender-equality/commemorations-celebrations/women-impact/arts/margaret-laurence.html",
            "Официальная биография называет Лоренс канадским романистом и рассматривает The Stone Angel и The Diviners.",
          ),
          evidence(
            "McMaster University Archives",
            "https://archives.mcmaster.ca/index.php/margaret-laurence-fonds",
            "Архивный фонд подтверждает даты 18 июля 1926 - 5 января 1987 года, авторскую идентичность и библиографию романов.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Сравнительный статус и обобщённая интерпретация тем заменены конкретными произведениями. Identity audit corroborated. Рекомендация - сохранить birthDate 1926-07-18 и deathDate 1987-01-05: обе даты прямо подтверждены университетским архивом. Shared country files не изменялись.",
  },
  {
    key: "canada:miriam_toews",
    originalSha256:
      "51336d7c31f00797ce160551c4ad2d4138463e415d919c66c07a42c849dfbadf",
    reviewedTextRu:
      "Канадская писательница, автор романов «A Complicated Kindness», «All My Puny Sorrows» и «Women Talking». Роман «A Complicated Kindness» получил Премию генерал-губернатора Канады за художественную прозу.",
    claims: [
      {
        textRu:
          "Мириам Тейвз - канадская писательница, автор A Complicated Kindness, All My Puny Sorrows и Women Talking; A Complicated Kindness получил Премию генерал-губернатора за художественную прозу.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/authors/2246932/miriam-toews/",
            "Профиль издателя перечисляет три романа и подтверждает Премию генерал-губернатора за художественную прозу.",
          ),
          evidence(
            "Writers' Trust of Canada",
            "https://www.writerstrust.com/authors/miriam-toews?book=a-complicated-kindness",
            "Канадская литературная организация подтверждает библиографию Тейвз, Премию генерал-губернатора и другие награды.",
          ),
          evidence(
            "Canada Council for the Arts",
            "https://canadacouncil.ca/-/media/Files/CCA/Research/2014/10/03/2004-2005/2004-05-MBProvProfile20042005EN.pdf",
            "Официальный отчёт фиксирует награждение Мириам Тейвз за A Complicated Kindness в 2004-2005 годах.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Широкая тематическая интерпретация заменена конкретными произведениями и наградой. Identity audit corroborated. Рекомендация - сохранить birthDate 1964-05-21: расхождений identity/date audit не выявил. Shared country files не изменялись.",
  },
  {
    key: "canada:yann_martel",
    originalSha256:
      "8ab4a79fe2d57175fa97019755d0a2c2d1032be09b48a25fc4351822605e6420",
    reviewedTextRu:
      "Канадский писатель, автор романа «Жизнь Пи», удостоенного Букеровской премии в 2002 году.",
    claims: [
      {
        textRu:
          "Янн Мартел - канадский писатель; его роман Life of Pi получил Букеровскую премию в 2002 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/books/life-of-pi",
            "Официальная страница премии подтверждает авторство Янна Мартела и победу Life of Pi в 2002 году.",
          ),
          evidence(
            "Library and Archives Canada",
            "https://recherche-collection-search.bac-lac.gc.ca/eng/home/record?app=fonandcol&idnumber=3721039",
            "Национальный архив называет Мартела канадским романистом и новеллистом, подтверждает дату рождения 25 июня 1963 года и премию за Life of Pi.",
          ),
          evidence(
            "Official website of Yann Martel",
            "https://www.yannmartel.com/about",
            "Авторская биография подтверждает канадскую литературную идентичность, библиографию и Букеровскую премию за Life of Pi.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Недоказанный сравнительный ранг и лишняя семейная характеристика сняты; сохранены авторство и награда. Identity audit corroborated. Рекомендация - сохранить birthDate 1963-06-25: точная дата подтверждена Library and Archives Canada. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:manuel_de_novas",
    originalSha256:
      "ebdb70c62b7d86d7b70a4414ce2e6f140636dc5146520d2bc3de0c1ac3e3bcf2",
    reviewedTextRu:
      "Кабовердианский поэт и композитор, автор морн и коладейр о повседневной жизни и общественных темах Кабо-Верде.",
    claims: [
      {
        textRu:
          "Мануэл де Новаш был кабовердианским поэтом и композитором, писавшим морны и коладейры о повседневной жизни и общественных явлениях.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Government of Cabo Verde - Ministry of Culture",
            "https://www.governo.cv/ministerio-da-cultura-manifesta-pesar-e-consternacao-pela-morte-de-manuel-dnovas/",
            "Официальный некролог описывает поэтическую, лирическую и музыкальную работу Мануэла д’Новаша и его сатирическое изображение повседневности Кабо-Верде.",
          ),
          evidence(
            "Inforpress - Agência Cabo-verdiana de Notícias",
            "https://inforpress.cv/en/maneldnovasrecebetributoemlisboaparamarcaros15anossobreoseufalecimento",
            "Государственное информационное агентство называет его кабовердианским поэтом и композитором, связывает его с морной и коладейрой и подтверждает годы 1938-2009.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценка известности заменена конкретными ролями, жанрами и тематикой. Identity audit corroborated. Рекомендация - сохранить birthDate 1938-02-24 и deathDate 2009-09-28; официальный некролог и государственная хроника не выявляют конфликта идентичности, а дата смерти соответствует дню поминальной годовщины. Shared country files не изменялись.",
  },
];

function finalizeReviewRecord(
  record: Omit<WriterBiographyFactReviewRecord, "applicableTextRu">,
): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch15: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch15Base.map(finalizeReviewRecord);

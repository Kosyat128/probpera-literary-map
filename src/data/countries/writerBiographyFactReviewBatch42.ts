export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH42_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 42";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH42_REVIEWER;
const checkedAt = "2026-08-20";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

function e(provider: string, url: string, findingRu: string): EvidenceSeed {
  return [provider, url, findingRu];
}

const seeds = [
  {
    key: "new_zealand:keri_hulme",
    originalSha256: "525bde5c146c753ca4595bde762571b92cf0ca3f182417fc02b90bb6e39a099f",
    reviewedTextRu: "Кери Хьюм (1947–2021) — новозеландская писательница и поэтесса. Её роман «The Bone People» получил Букеровскую премию 1985 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/keri-hulme", "Официальный архив премии подтверждает профессию, годы жизни, роман The Bone People и награду 1985 года."),
      e("National Library of New Zealand", "https://natlib.govt.nz/records/22396605", "Национальная библиотека Новой Зеландии независимо подтверждает годы, жанры, авторство романа и Букеровскую премию."),
    ],
    decision: "corrected",
    notes: "Тематическое обобщение заменено датами, литературными ролями и конкретным премированным романом.",
  },
  {
    key: "new_zealand:loyd_jones",
    originalSha256: "dcd2098e8db95baad0d67a637626c4a3cfa9411a0d456279211f08442e5952e2",
    reviewedTextRu: "Ллойд Джонс — новозеландский романист, родившийся в Лоуэр-Хатте. Его роман «Mister Pip» получил Commonwealth Writers’ Prize и вошёл в шорт-лист Букеровской премии 2007 года.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/jones-lloyd", "Национальная писательская организация подтверждает рождение в Лоуэр-Хатте, литературную деятельность и библиографию Джонса."),
      e("Massey University Press", "https://www.masseypress.ac.nz/authors/lloyd-jones/", "Университетское издательство подтверждает Mister Pip, Commonwealth Writers’ Prize и шорт-лист Букеровской премии."),
    ],
    decision: "corrected",
    notes: "Исправлено ошибочное место рождения; оценочная формула заменена книгой и документированными премиальными результатами.",
  },
  {
    key: "new_zealand:patricia_grace",
    originalSha256: "edc5d69f6bdfb4ea265a77fce31dc47d4b8be4eae48280a14569de505e1013ed",
    reviewedTextRu: "Патриция Грейс — новозеландская писательница маори, автор романов «Potiki», «Cousins» и «Tu». В 2008 году она получила Neustadt International Prize for Literature.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/grace-patricia", "Национальная писательская организация подтверждает идентичность, маорийское происхождение и названные романы."),
      e("Neustadt International Prize for Literature", "https://www.neustadtprize.org/2008-neustadt-prize-laureate-patricia-grace/", "Официальный архив премии подтверждает присуждение награды Патриции Грейс в 2008 году."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено авторской идентичностью, тремя романами и официальной премией.",
  },
  {
    key: "new_zealand:robin_hyde",
    originalSha256: "7e5bc32bb9c9918c8a5ad78221a39815682d2ecd62b4ce9ae8f756b037bf87a0",
    reviewedTextRu: "Робин Хайд (Ирис Гайвер Уилкинсон, 1906–1939) — новозеландская поэтесса, прозаик и журналист. Среди её романов — «The Godwits Fly» и «Wednesday’s Children».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/4h41/hyde-robin", "Национальный биографический словарь подтверждает настоящее имя, годы, профессии и романы Робин Хайд."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/hyde-robin", "Национальная писательская организация независимо подтверждает биографию и библиографию Хайд."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена настоящим именем, годами, профессиями и двумя романами.",
  },
  {
    key: "new_zealand:steven_baker",
    originalSha256: "7eb278d42b2707d7916c77ab4624206f96795b5335a9966787a42bf5ea9ee036",
    reviewedTextRu: "Карточка с идентификатором Steven Baker объединяет имя Стивена Бейкера с полным именем и книгами Стивена Роджера Фишера. Источники каталогизируют «A History of Writing» и «A History of Language» за Фишером, поэтому личность карточки не установлена.",
    evidence: [
      e("WorldCat", "https://search.worldcat.org/title/A-history-of-writing/oclc/230764598", "Международный библиотечный каталог атрибутирует A History of Writing Стивену Роджеру Фишеру, а не Steven Baker."),
      e("National Library of New Zealand", "https://natlib.govt.nz/records/40930778", "Национальная библиотека Новой Зеландии связывает заявленную библиографию с авторитетной записью Steven Roger Fischer."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин из-за конфликта идентификатора, отображаемого имени, полного имени и библиографии.",
  },
  {
    key: "new_zealand:witi_ihimaera",
    originalSha256: "e0aa59efe01f15450de32668c93de4b75b9c4b2a7b2624799250bf953f012240",
    reviewedTextRu: "Вити Ихимаэра — новозеландский писатель маори, редактор, эссеист, драматург и критик. Его роман «Tangi» вышел в 1973 году; среди других книг — «The Whale Rider».",
    evidence: [
      e("Massey University Press", "https://www.masseypress.ac.nz/authors/witi-ihimaera/", "Университетское издательство подтверждает литературные роли Ихимаэры и библиографию, включая Tangi и The Whale Rider."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/ihimaera-witi", "Национальная писательская организация независимо подтверждает маорийскую идентичность, жанры и произведения автора."),
    ],
    decision: "corrected",
    notes: "Широкая оценка влияния заменена документированными ролями и двумя произведениями.",
  },
  {
    key: "nicaragua:ernesto_cardenal",
    originalSha256: "9571343018009c74429f97059d9189fec7d97853cd650ace5ec8672585d8dd1a",
    reviewedTextRu: "Эрнесто Карденаль (1925–2020) — никарагуанский поэт и католический священник. Среди его книг — «Salmos» и «Cántico cósmico».",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/item/n79058833/ernesto-cardenal-nicaragua-1925/", "Библиотека Конгресса подтверждает идентичность, год рождения, никарагуанскую связь и библиографию Карденаля."),
      e("Northwestern University Press", "https://nupress.northwestern.edu/9781880684931/cosmic-canticle/", "Университетское издательство подтверждает годы жизни, роли поэта и священника и книгу Cosmic Canticle."),
    ],
    decision: "corrected",
    notes: "Суперлатив и тематическая интерпретация заменены годами, профессиями и двумя книгами в оригинальном написании.",
  },
  {
    key: "nicaragua:gioconda_belli",
    originalSha256: "588d2db2aac9039a00b605021ced5210bd70cd4ad285a098f332748a197b4809",
    reviewedTextRu: "Джоконда Белли — никарагуанская поэтесса и романистка. Среди её книг — роман «La mujer habitada» и поэтический сборник «El ojo de la mujer».",
    evidence: [
      e("Instituto Cervantes", "https://cvc.cervantes.es/benengeli/25/biografias_en.htm", "Институт Сервантеса подтверждает литературную идентичность Джоконды Белли и её основные произведения."),
      e("Secretaría de Cultura de México", "https://www.gob.mx/cultura/prensa/gioconda-belli-obtiene-el-premio-internacional-carlos-fuentes-a-la-creacion-literaria-en-el-idioma-espanol-2025", "Официальное учреждение культуры Мексики подтверждает профессии, никарагуанское происхождение и библиографию Белли."),
    ],
    decision: "corrected",
    notes: "Оценочная и тематическая формулы заменены профессиями и двумя конкретными книгами.",
  },
  {
    key: "nicaragua:ruben_dario",
    originalSha256: "fa3287e7ec91e9b7e87d1980588231855ee2b912feddbdc32b658f67ea093607",
    reviewedTextRu: "Рубен Дарио (Феликс Рубен Гарсиа Сармьенто, 1867–1916) — никарагуанский поэт, журналист и дипломат. Среди его книг — «Azul…», «Prosas profanas y otros poemas» и «Cantos de vida y esperanza».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/servicios/informacion-bibliografica/muestras-bibliograficas/dario_ruben_1867-1916/", "Национальная библиотека Испании подтверждает полное имя, годы и библиографию Рубена Дарио."),
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/dario_ruben.htm", "Институт Сервантеса независимо подтверждает биографию, профессии и три названные книги."),
    ],
    decision: "corrected",
    notes: "Широкое историческое ранжирование заменено полным именем, профессиями и проверенной библиографией.",
  },
  {
    key: "nicaragua:sergio_ramirez",
    originalSha256: "f427c80e3ded42f3bed5f5e6b9409fa2b19a980d736a3c709f67c8d19ee93bb7",
    reviewedTextRu: "Серхио Рамирес — никарагуанский романист, новеллист, эссеист и журналист. Он получил Премию Сервантеса 2017 года; среди его романов — «Margarita, está linda la mar».",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/ramirez_sergio.htm", "Институт Сервантеса подтверждает профессии Рамиреса, его библиографию и литературные награды."),
      e("Real Academia Española", "https://www.rae.es/sites/default/files/180423_NP_Entrega_Premio_Cervantes_a_Sergio_Ramirez.pdf", "Официальное сообщение о вручении подтверждает присуждение Серхио Рамиресу Премии Сервантеса 2017 года."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена жанровыми ролями, конкретным романом и официальной премией.",
  },
  {
    key: "niger:abdoulaye_mamani",
    originalSha256: "633618a77fa2f16200f0a2203b1717492b4a9704fe086c5342d75c1796e1823f",
    reviewedTextRu: "Абдулае Мамани (1932–1993) — нигерский писатель и поэт, автор исторического романа «Sarraounia».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?index=TOUS3&numNotice=34227375&typeNotice=C", "Каталог BnF подтверждает авторитетную запись Абдулае Мамани, годы 1932–1993 и роман Sarraounia."),
      e("WorldCat", "https://search.worldcat.org/title/Sarraounia/oclc/1130985466", "Международный библиотечный каталог независимо подтверждает авторство романа Sarraounia."),
    ],
    decision: "corrected",
    notes: "Исправлен ошибочный год рождения 1939 на 1932; литературные роли и роман сохранены в проверяемой форме.",
  },
  {
    key: "niger:boubou_hama",
    originalSha256: "8faf68a7c169947ae01d19089972cbb9e28803fd4e3b2094db70b0329321e89e",
    reviewedTextRu: "Бубу Хама (1906–1982) — нигерский писатель, историк и политический деятель. Среди его книг — «Contes et légendes du Niger» и «Izé-Gani».",
    evidence: [
      e("Académie des sciences d’outre-mer", "https://academieoutremer.fr/academiciens/?aId=862", "Академический биографический справочник подтверждает годы, профессии и публикации Бубу Хама."),
      e("Centre Culturel Franco-Nigérien Jean Rouch", "https://pmb.ccnigerien.org/opac_css/index.php?id=617&lvl=author_see", "Нигерский библиотечный каталог независимо подтверждает авторскую идентичность и названные книги."),
    ],
    decision: "corrected",
    notes: "Суперлатив и неподтверждённая роль философа заменены документированными профессиями и двумя книгами.",
  },
  {
    key: "niger:ibrahim_adam",
    originalSha256: "d080f38c3e0b5c7dd9bf9c4ebe9b584ce315fe74e7c89952a71030c5b8388476",
    reviewedTextRu: "Личность «Ибрахим Адам» как нигерского писателя 1952 года рождения не установлена: общее имя не связано с уникальной авторитетной записью или атрибутируемым произведением.",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Ibrahim+Adam+Niger&critereRecherche=0&depart=0", "Поиск BnF не устанавливает единую авторскую личность, совпадающую со страной, годом и профессиями карточки."),
      e("WorldCat", "https://search.worldcat.org/search?q=%22Ibrahim+Adam%22+Niger", "Международный библиотечный каталог не связывает точное имя с заявленной нигерской литературной идентичностью и произведением."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин: слишком общее имя и отсутствие атрибутируемой библиографии не позволяют установить личность.",
  },
  {
    key: "niger:mariama_hima",
    originalSha256: "f70f8029d4ad82b15e4a144010ddf6ac65d176a3f98d6494a320f772e001772f",
    reviewedTextRu: "Мариама Хима (род. 1951) — нигерская кинорежиссёр-документалист, этнолог, антрополог и дипломат. BnF также каталогизирует её как автора книги «Sagesse africaine : proverbes».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb131962985", "Авторитетная запись BnF подтверждает дату рождения, профессии и авторство Sagesse africaine : proverbes."),
      e("African Film Festival New York", "https://africanfilmny.org/directors/mariama-hima/", "Профиль фестивального архива независимо подтверждает нигерскую идентичность, документальное кино и этнологическую работу Химы."),
    ],
    decision: "corrected",
    notes: "Исправлен год рождения 1957 на 1951; общая литературная характеристика заменена установленными профессиями и каталогизированной книгой.",
  },
  {
    key: "nigeria:ben_okri",
    originalSha256: "39dbd6dbad1580a96b8a5b64c77414f2dd4f73b9ae232203956be815e42cd694",
    reviewedTextRu: "Бен Окри — нигерийский романист, поэт и драматург. Его роман «The Famished Road» получил Букеровскую премию 1991 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/the-famished-road", "Официальный архив премии подтверждает авторство The Famished Road и победу романа в 1991 году."),
      e("Bloomsbury", "https://www.bloomsbury.com/UK/author/ben-okri/", "Издательский профиль независимо подтверждает нигерийскую идентичность Окри, его жанры и библиографию."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная справка дополнена документированными литературными ролями и оригинальным названием романа.",
  },
  {
    key: "nigeria:buchi_emecheta",
    originalSha256: "eab068be9bd3b824ea25c1284de8496727309f88df1234db2df855187e380528",
    reviewedTextRu: "Бучи Эмечета (1944–2017) — родившаяся в Нигерии писательница, работавшая в Великобритании. Среди её романов — «Second-Class Citizen» и «The Slave Girl».",
    evidence: [
      e("Bloomsbury", "https://www.bloomsbury.com/uk/author/buchi-emecheta/", "Издательский профиль подтверждает годы, нигерийское происхождение, британскую карьеру и названные романы."),
      e("Goldsmiths, University of London / Oxford Dictionary of National Biography", "https://research.gold.ac.uk/id/eprint/31482/1/OxfordDNB%20B%20Emecheta.pdf", "Университетская копия биографической статьи независимо подтверждает жизненный путь и библиографию Эмечеты."),
    ],
    decision: "corrected",
    notes: "Тематическое обобщение заменено годами, транснациональной биографией и двумя романами.",
  },
  {
    key: "nigeria:chimamanda_adichie",
    originalSha256: "ab8c2d7ffbc773506e9e01d3c13329ed6af5c8cc5e46e3e61f47740c45cb893f",
    reviewedTextRu: "Чимаманда Нгози Адичи — нигерийская писательница, автор романов «Purple Hibiscus», «Half of a Yellow Sun» и «Americanah». В 2008 году она получила стипендию MacArthur Fellowship.",
    evidence: [
      e("Chimamanda Ngozi Adichie", "https://www.chimamanda.com/about/", "Официальный авторский профиль подтверждает нигерийскую идентичность и три названных романа."),
      e("MacArthur Foundation", "https://www.macfound.org/media/files/ar2008.pdf", "Официальный годовой отчёт фонда подтверждает присуждение Адичи MacArthur Fellowship в 2008 году."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён тремя произведениями и документированной стипендией.",
  },
  {
    key: "nigeria:chinua_achebe",
    originalSha256: "8f4289ba1351f17054d3db90c584182ca63141e380bffd93593d4f99f82de4c4",
    reviewedTextRu: "Чинуа Ачебе (1930–2013) — нигерийский романист, поэт, эссеист и литературный критик. Он написал романы «Things Fall Apart» и «Arrow of God».",
    evidence: [
      e("Brown University", "https://archive2.news.brown.edu/2007-2015/articles/2013/03/achebe.html", "Университетский мемориальный профиль подтверждает годы, нигерийскую идентичность, жанры и Things Fall Apart."),
      e("Bard College", "https://alums.bard.edu/news/remembrances/chinua-achebe-1930-2013", "Колледж независимо подтверждает биографию Ачебе и его романы, включая Arrow of God."),
    ],
    decision: "corrected",
    notes: "Субъективная формула об основательстве заменена годами, литературными ролями и двумя романами.",
  },
  {
    key: "nigeria:christopher_okigbo",
    originalSha256: "819c532791c88a6bb8eb86c471a3a3036e209651c18a0166d8da4ba166fed1cd",
    reviewedTextRu: "Кристофер Окигбо (1932–1967) — нигерийский поэт. Среди его поэтических циклов и сборников — «Heavensgate», «Limits» и «Labyrinths».",
    evidence: [
      e("Harry Ransom Center, The University of Texas at Austin", "https://research.hrc.utexas.edu/fasearch/pdf/01310.pdf", "Архивный путеводитель подтверждает годы, профессию и библиографию Кристофера Окигбо."),
      e("Cambridge University Press", "https://www.cambridge.org/core/books/christopher-okigbo-193067/2654FD507580946F54CC5B8665BFC9DA", "Университетское издание независимо подтверждает годы и корпус произведений поэта."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён годами, профессией и тремя библиографически установленными названиями.",
  },
  {
    key: "nigeria:d_o_fagunwa",
    originalSha256: "5b973b2ff2d4836e420c61ada35b6ca27122df76ddc910d43279f9243fee9640",
    reviewedTextRu: "Дэниел Олорунфеми Фагунва (1903–1963) — нигерийский писатель, создававший романы на языке йоруба. Его первый роман — «Ògbójú Ọdẹ nínú Igbó Irúnmalẹ̀».",
    evidence: [
      e("University of Ibadan Repository", "https://repository.ui.edu.ng/server/api/core/bitstreams/535dce3a-1a97-4ed9-a435-5e0f306dd45b/content", "Статья Dictionary of African Biography подтверждает годы, имя Дэниел Олорунфеми Фагунва, язык и биографию автора."),
      e("University of Warsaw", "https://omc.obta.al.uw.edu.pl/myth-survey/creator/877", "Университетская база независимо подтверждает авторскую идентичность, полное имя и библиографию."),
    ],
    decision: "corrected",
    notes: "Полное имя исправлено и дополнено; оценочная формула заменена языком письма и оригинальным названием дебютного романа.",
  },
  {
    key: "nigeria:flora_nwapa",
    originalSha256: "73c36d0ee39f2e9192c429edd8b3ff58a3a5e8a99b216da44ffa9822da3bc575",
    reviewedTextRu: "Флора Нвапа (1931–1993) — нигерийская романистка, поэтесса и издательница. Её дебютный роман «Efuru» вышел в 1966 году; позднее она основала издательство Tana Press.",
    evidence: [
      e("Bloomsbury", "https://www.bloomsbury.com/UK/author/flora-nwapa/", "Издательский профиль подтверждает годы, нигерийскую идентичность и роман Efuru."),
      e("Oxford Academic", "https://academic.oup.com/edited-volume/61663/chapter-abstract/553364942", "Академическая публикация независимо подтверждает литературную и издательскую деятельность Нвапы, включая Tana Press."),
    ],
    decision: "corrected",
    notes: "Непроверяемая формула о первенстве заменена годами, профессиями, дебютным романом и издательской работой.",
  },
  {
    key: "nigeria:helon_habila",
    originalSha256: "fcd807294b3b30b7cd634017f059f5169ea05bd86ec795d55f846016c764404b",
    reviewedTextRu: "Хелон Хабила — нигерийский романист и профессор творческого письма. Среди его книг — «Waiting for an Angel», «Measuring Time» и «Oil on Water»; в 2001 году он получил Caine Prize.",
    evidence: [
      e("George Mason University", "https://cheusecenter.gmu.edu/residencies/cheusecentereventswriters/writers?profile_id=2164", "Университетский профиль подтверждает нигерийскую идентичность, профессорскую работу и библиографию Хабилы."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/266626/helon-habila/", "Независимый издательский профиль подтверждает три названные книги и работу Хабилы в области творческого письма."),
      e("The Caine Prize for African Writing", "https://static1.squarespace.com/static/565c3d39e4b027c789ba5b70/t/66586138c2cb205f80258769/1717068102051/Caine%2BPrize%2Bannual%2Breport%2B2019.pdf", "Официальный годовой отчёт Caine Prize указывает Хелона Хабилу среди победителей из Нигерии с годом награждения 2001."),
    ],
    decision: "corrected",
    notes: "Общая характеристика уточнена должностью, тремя книгами и документированной премией.",
  },
  {
    key: "nigeria:teju_cole",
    originalSha256: "40826b1d7861808c30e6b8c7f7e941af8fc6b2aaee7823db20ae5ad17ee3df5a",
    reviewedTextRu: "Теджу Коул (род. 1975 в Каламазу, штат Мичиган) — писатель, эссеист и фотограф, выросший в Лагосе. Он написал книги «Open City» и «Every Day Is for the Thief».",
    evidence: [
      e("Harvard Graduate School of Design", "https://www.gsd.harvard.edu/2019/05/teju-cole-on-the-unpredictability-and-potential-of-the-city-once-you-give-up-insisting-on-stereotypes-you-can-really-start-to-see/", "Гарвардский профиль подтверждает рождение в Каламазу в 1975 году, взросление в Лагосе и творческие роли Коула."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/91688/teju-cole/", "Издательский профиль независимо подтверждает американское рождение, нигерийскую биографическую связь и названные книги."),
    ],
    decision: "corrected",
    notes: "Исправлено ошибочное место рождения Калабар на Каламазу; добавлены биографическая связь с Лагосом и две книги.",
  },
  {
    key: "nigeria:wole_soyinka",
    originalSha256: "c6c54f2fb5982565e15e180c963771837c83b92a38e8e6aa1927724197e633f4",
    reviewedTextRu: "Воле Шойинка — нигерийский драматург, поэт, романист и эссеист. В 1986 году он получил Нобелевскую премию по литературе; среди его пьес — «Death and the King’s Horseman».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1986/soyinka/biographical/", "Официальная нобелевская биография подтверждает нигерийскую идентичность, жанры и премию 1986 года."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/2268746/wole-soyinka/", "Издательский профиль независимо подтверждает литературные роли и пьесу Death and the King’s Horseman."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная справка дополнена документированными жанрами и конкретной пьесой.",
  },
  {
    key: "niue:john_pule",
    originalSha256: "fecf52d25d4088260d89ceaac7792a8f5d17b2b8d150d14fe7c4a3ccdcbc4e45",
    reviewedTextRu: "Джон Пухиатау Пуле (род. 1962 в деревне Лику на Ниуэ) — художник, поэт и романист. Он написал книги «The Shark That Ate the Sun» и «Burn My Head in Heaven».",
    evidence: [
      e("Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/john-pule", "Национальный художественный фонд подтверждает год и деревню рождения, творческие роли и произведения Джона Пуле."),
      e("University of Auckland Art Collection", "https://artcollection.auckland.ac.nz/essay/69166", "Университетская коллекция независимо подтверждает ниуэанское происхождение и литературно-художественную деятельность Пуле."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения Алофи на Лику; неподтверждённый точный день сведен к году, а оценка заменена ролями и двумя книгами.",
  },
  {
    key: "north_korea:choe_myong_ik",
    originalSha256: "220b3b9b09232ef3b80adcb59739b03f0e24a0aa084e833e39cd77f399088782",
    reviewedTextRu: "Чхве Мён Ик (род. в Пхеньяне в 1903 году) — корейский писатель, известный модернистской психологической прозой. Его рассказы собраны в английском издании «Patterns of the Heart and Other Stories».",
    evidence: [
      e("Columbia University Press", "https://cup.columbia.edu/book/patterns-of-the-heart-and-other-stories/9780231202718/", "Университетское издательство подтверждает рождение в Пхеньяне в 1903 году, модернистскую прозу и состав сборника; дату смерти считает неизвестной."),
      e("Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0057291", "Национальная корееведческая энциклопедия независимо подтверждает писательскую идентичность, год рождения и литературную деятельность Чхве."),
    ],
    decision: "corrected",
    notes: "Неподтверждённый год смерти удалён; место и год рождения, направление прозы и проверенное издание сформулированы осторожно.",
  },
  {
    key: "north_korea:han_sorya",
    originalSha256: "d048b4391efb5e96bfa2537177a8781f34375ec7769d07ad4c33fea40a319a7a",
    reviewedTextRu: "Хан Соря (1900–1976) — корейский писатель и литературный администратор, игравший заметную роль в ранней литературной системе КНДР.",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Koreas_litteratur", "Национальная энциклопедия Норвегии подтверждает форму имени, годы 1900–1976 и место Хан Соря в литературе КНДР."),
      e("University of Toronto Press Distribution", "https://utpdistribution.com/9780939657841/han-sorya-and-north-korean-literature/", "Университетское издание подтверждает ключевую литературную и административную роль Хан Соря в ранней КНДР."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён годами и документированной литературно-административной ролью; неподтверждённые произведения в публичной карточке удаляются.",
  },
  {
    key: "north_korea:paek_nam_nyong",
    originalSha256: "11d73987ff961e926859014db0d2ea9acfcec1290c5a653066bdc1157ea37960",
    reviewedTextRu: "Пэк Нам Рён (род. 1949) — северокорейский романист. Его роман «Friend», впервые изданный в КНДР в 1988 году, вышел на английском языке в 2020 году.",
    evidence: [
      e("Columbia University Press", "https://cup.columbia.edu/book/friend/9780231195614/", "Университетское издательство подтверждает автора, название и английское издание романа Friend в 2020 году."),
      e("Store norske leksikon", "https://snl.no/Koreas_litteratur", "Национальная энциклопедия Норвегии независимо подтверждает год рождения, исходное издание 1988 года и международные публикации романа."),
    ],
    decision: "corrected",
    notes: "Общая характеристика заменена годом рождения, профессией и прослеживаемой историей публикации конкретного романа.",
  },
  {
    key: "north_korea:ri_ki_yong",
    originalSha256: "5e3c71e0b480a7a7d31945419a9c0f513fcdebdce0e840d1c890715c0addd55c",
    reviewedTextRu: "Ли Ги Ён (1895–1984) — корейский романист, связанный с пролетарской и крестьянской литературой, а после 1945 года — с литературной системой КНДР. Среди его романов — «Gohyang» («Hometown») и «Ttang» («Land»).",
    evidence: [
      e("LTI Korea Digital Library of Korean Literature", "https://library.ltikorea.or.kr/writer/200282", "Государственный литературный институт подтверждает годы, профессию, литературное направление и роман Gohyang."),
      e("Oxford Academic / University of Hawaiʻi Press", "https://academic.oup.com/hawaii-scholarship-online/book/22072/chapter-abstract/182176344", "Академическая глава независимо подтверждает годы 1895–1984, роль в северокорейской литературе и романы Homeland и Land."),
    ],
    decision: "corrected",
    notes: "Точные дни рождения и смерти сведены к подтверждённым годам; общая оценка заменена литературным контекстом и двумя романами.",
  },
  {
    key: "north_macedonia:blazhe_koneski",
    originalSha256: "49a4fc91498d708cd8873e0105c414fba7e60c98d4612b9bcb7dccbb5f913525",
    reviewedTextRu: "Блаже Конески (1921–1993) — македонский поэт, филолог и университетский профессор. Он участвовал в кодификации македонского литературного языка и подготовке его грамматики и словаря.",
    evidence: [
      e("Macedonian Academy of Sciences and Arts", "https://koneski.manu.edu.mk/", "Официальный академический ресурс подтверждает годы, научно-литературную деятельность и вклад Конески в кодификацию языка."),
      e("Hrvatska enciklopedija", "https://www.enciklopedija.hr/clanak/koneski-blaze", "Национальная энциклопедия независимо подтверждает биографию, профессии и языковедческие работы Конески."),
    ],
    decision: "corrected",
    notes: "Трёхфразовый интерпретационный текст сокращён до двух проверяемых предложений о профессиях и кодификационной работе.",
  },
  {
    key: "north_macedonia:kocho_racin",
    originalSha256: "4a023669074dcc29bb4dd5f62f2d4ead7c18be61b9ab382a91d2e1b00244e24f",
    reviewedTextRu: "Кочо Рацин (1908–1943) — македонский поэт и прозаик. Его поэтический сборник «Бели мугри» вышел в 1939 году.",
    evidence: [
      e("Treccani", "https://www.treccani.it/enciclopedia/koco-racin/", "Итальянская национальная энциклопедия подтверждает годы, литературные роли и сборник Рацина."),
      e("Hrvatska enciklopedija", "https://enciklopedija.hr/clanak/racin-koco", "Хорватская национальная энциклопедия независимо подтверждает биографию и издание Beli mugri в 1939 году."),
    ],
    decision: "corrected",
    notes: "Формула об основательстве и интерпретация тем заменены годами, профессиями и датированным сборником.",
  },
  {
    key: "norway:aksel_sandemose",
    originalSha256: "dd2cb1753df33670bba8f6737b8a57d76ea42afd7ab521c4200c87d33adf5a93",
    reviewedTextRu: "Аксель Сандемусе (1899–1965) — родившийся в Дании писатель, с 1930 года живший в Норвегии. В романе «En flyktning krysser sitt spor» он сформулировал правила вымышленного города Янте.",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Aksel_Sandemose", "Национальная энциклопедия подтверждает годы, датское рождение, норвежскую карьеру и связь романа с законом Янте."),
      e("WorldCat", "https://search.worldcat.org/title/flyktning-krysser-sitt-spor-fortelling-om-en-morders-barndom-1933-utgaven/oclc/173484460", "Международный библиотечный каталог независимо подтверждает авторство и оригинальное название романа."),
    ],
    decision: "corrected",
    notes: "Расплывчатая национальная и психологическая характеристика заменена биографическим переходом и конкретным романом.",
  },
  {
    key: "norway:alexander_kielland",
    originalSha256: "bb74bf659bafb39c7004d0b967e9c1a5d915f5c9a7d48b462f7c565fe84b7848",
    reviewedTextRu: "Александр Ланге Хьелланн (1849–1906) — норвежский писатель реалистического направления. Он написал романы «Garman & Worse», «Skipper Worse» и «Gift».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Alexander_Kielland", "Национальная энциклопедия подтверждает полное имя, годы, реалистическое направление и названные романы."),
      e("Gyldendal", "https://www.gyldendal.no/forfattere/alexander-l-kielland", "Норвежское издательство независимо подтверждает имя, годы, литературную деятельность и библиографию Хьелланна."),
    ],
    decision: "corrected",
    notes: "Каноническое ранжирование заменено полным именем, годами, направлением и тремя романами.",
  },
  {
    key: "norway:amalie_skram",
    originalSha256: "24a2d4f583fdce88bfc075a74baeb147ce73e43b446409e7f702a1efb1160e1e",
    reviewedTextRu: "Амали Скрам (1846–1905) — норвежская писательница, работавшая в русле натурализма. Её романный цикл «Hellemyrsfolket» состоит из четырёх книг; среди других романов — «Constance Ring» и «Forrådt».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Amalie_Skram", "Национальная энциклопедия подтверждает годы, натуралистическое направление, цикл Hellemyrsfolket и названные романы."),
      e("Gyldendal", "https://www.gyldendal.no/forfattere/amalie-skram", "Норвежское издательство независимо подтверждает годы, натурализм, четырёхчастный цикл Hellemyrsfolket и названные романы."),
    ],
    decision: "corrected",
    notes: "Однофразовая жанровая справка дополнена годами и проверенной библиографией.",
  },
  {
    key: "norway:bjornstjerne_bjornson",
    originalSha256: "c53fcc30c06aea2828ad78de73206e38a0825e1cae8f694fdfeb66de2403d2e3",
    reviewedTextRu: "Бьёрнстьерне Бьёрнсон (1832–1910) — норвежский писатель, драматург, поэт и журналист. Он написал «Synnøve Solbakken» и текст гимна «Ja, vi elsker dette landet», а в 1903 году получил Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/themes/bjornson/", "Официальный нобелевский профиль подтверждает годы, литературные роли, Synnøve Solbakken и премию 1903 года."),
      e("Store norske leksikon", "https://snl.no/Bj%C3%B8rnstjerne_Bj%C3%B8rnson", "Национальная энциклопедия независимо подтверждает биографию, жанры и авторство текста норвежского гимна."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная формула дополнена профессиями и двумя конкретными произведениями.",
  },
  {
    key: "norway:camilla_collett",
    originalSha256: "5eb6b1a2d71730e00b1b324606257e8d54f4c8087f40910881776536f6876965",
    reviewedTextRu: "Камилла Коллетт (1813–1895) — норвежская писательница и деятельница движения за права женщин. Она написала роман «Amtmandens Døttre» и автобиографическую книгу «I de lange Nætter».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Camilla_Collett", "Национальная энциклопедия подтверждает годы, литературную и общественную деятельность и основные книги Коллетт."),
      e("Gyldendal", "https://www.gyldendal.no/forfattere/camilla-collett", "Норвежское издательство независимо подтверждает годы, писательскую деятельность и библиографию Коллетт, включая два названных произведения."),
    ],
    decision: "corrected",
    notes: "Широкая формула о реализме заменена годами, общественной ролью и двумя произведениями.",
  },
  {
    key: "norway:erlend_loe",
    originalSha256: "3d7a5fcd36e575b935d1b4c01c80373bebe38dbddc7f2a8be78f764cf42524aa",
    reviewedTextRu: "Эрленд Лу (род. 1969) — норвежский писатель, переводчик и сценарист. Он написал романы «Tatt av kvinnen», «Naiv. Super» и «Doppler».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Erlend_Loe", "Национальная энциклопедия подтверждает год рождения, профессии и три названных романа Лу."),
      e("Albert Bonniers Förlag", "https://www.albertbonniersforlag.se/forfattare/14129/", "Издательский профиль независимо подтверждает авторскую идентичность, Naiv. Super и библиографию Лу."),
    ],
    decision: "corrected",
    notes: "Оценка стиля заменена годом, литературно-сценарными ролями и тремя оригинальными названиями романов.",
  },
  {
    key: "norway:henrik_ibsen",
    originalSha256: "fbaaac26da59b8fe98211d705e91f53a3170349ca5304962a982b0a364bece25",
    reviewedTextRu: "Генрик Ибсен (1828–1906) — норвежский драматург и поэт. Он написал пьесы «Et dukkehjem», «Gengangere» и «Hedda Gabler», а также драматическую поэму «Peer Gynt».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Henrik_Ibsen", "Национальная энциклопедия подтверждает годы, литературные роли и основные произведения Ибсена."),
      e("University of Oslo, Henrik Ibsen’s Writings", "https://www.ibsen.uio.no/VERK_Du.xhtml", "Критическое академическое издание подтверждает авторство и историю публикации Et dukkehjem; каталог проекта содержит корпус пьес Ибсена."),
    ],
    decision: "corrected",
    notes: "Широкая формула об основательстве современной драмы заменена годами, профессиями и четырьмя произведениями.",
  },
  {
    key: "norway:jo_nesbo",
    originalSha256: "8e94b97654e2227876588163cd6969e48694df992e35ddab9c5acc1df67d9c87",
    reviewedTextRu: "Ю Несбё (род. 1960) — норвежский писатель и музыкант. Он создал цикл детективных романов о Харри Холе; среди его самостоятельных книг — «Hodejegerne» и «Sønnen».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Jo_Nesb%C3%B8", "Национальная энциклопедия подтверждает год рождения, профессии, цикл о Харри Холе и другие книги Несбё."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/68917/jo-nesbo/", "Издательский профиль независимо подтверждает авторскую идентичность, серию Harry Hole, Headhunters и The Son."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён годом, профессиями, серией и двумя самостоятельными романами.",
  },
  {
    key: "norway:jon_fosse",
    originalSha256: "2b7dd27742177af4cc40cec07ef63e48e22c11cf748ff9df05a079f5011d588e",
    reviewedTextRu: "Юн Фоссе (род. 1959) — норвежский драматург, прозаик, поэт и эссеист, пишущий на нюнорске. Он создал «Septologien» и пьесу «Nokon kjem til å komme»; в 2023 году получил Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2023/bio-bibliography/", "Официальная биобиблиография подтверждает год рождения, жанры, нюнорск, произведения и Нобелевскую премию 2023 года."),
      e("Bloomsbury", "https://www.bloomsbury.com/UK/author/jon-fosse/", "Издательский профиль независимо подтверждает литературную идентичность Фоссе, его жанры, библиографию и нобелевский статус."),
    ],
    decision: "corrected",
    notes: "Интерпретация поэтики заменена годом, языком, жанрами, двумя произведениями и официальной премией.",
  },
] as const satisfies readonly ReviewSeed[];

export const writerBiographyFactReviewBatch42: readonly WriterBiographyFactReviewRecord[] =
  seeds.map((seed) => ({
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
    claims: [
      {
        textRu: seed.reviewedTextRu,
        verdict: seed.decision === "held" ? "not-established" : "corrected",
        evidence: seed.evidence.map(([provider, url, findingRu]) => ({
          provider,
          url,
          checkedAt,
          findingRu,
        })),
      },
    ],
    reviewer,
    decision: seed.decision,
    notes: seed.notes,
  }));

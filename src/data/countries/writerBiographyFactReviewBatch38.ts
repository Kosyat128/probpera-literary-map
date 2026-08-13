export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH38_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 38";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH38_REVIEWER;
const checkedAt = "2026-08-13";

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
    key: "lithuania:maironis",
    originalSha256: "7bd1a36379d211032e3cdfb8fe92e2bc3227d7c801629e377847e6dac95778f1",
    reviewedTextRu: "Майронис, настоящее имя Йонас Мачюлис (1862–1932), — литовский поэт, католический священник и деятель национального возрождения. Его сборник «Pavasario balsai» («Весенние голоса») многократно переиздавался и связан с формированием литовской лирики рубежа XIX–XX веков.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/maironis/", "Энциклопедия подтверждает имя Йонас Мачюлис, даты 2 ноября 1862 — 28 июня 1932, священническую и поэтическую деятельность и сборник Pavasario balsai."],
      ["Библиотека Конгресса США", "https://id.loc.gov/authorities/names/n50034352.html", "Авторитетная запись связывает псевдоним Maironis с Йонасом Мачюлисом и литовской литературной деятельностью."],
    ],
    decision: "corrected",
    notes: "Оценочный суперлатив заменён ролями и произведением; профильная дата рождения по старому стилю исправляется на современную календарную дату 2 ноября.",
  },
  {
    key: "lithuania:ricardas_gavelis",
    originalSha256: "9a39dbd32f509be4a7042c999c5cf77fa9cf0e711dca8356915c64cd2f9d5834",
    reviewedTextRu: "Ричардас Гавялис (1950–2002) — литовский прозаик, драматург и публицист, по образованию физик. В романах «Vilniaus pokeris» («Вильнюсский покер») и «Vilniaus džiazas» город Вильнюс становится пространством анализа советской и постсоветской жизни.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/ricardas-gavelis/", "Энциклопедия подтверждает даты, образование физика, работу в прозе и драматургии и библиографию Гавялиса."],
      ["Vilnius Review", "https://vilniusreview.com/reviews/ricardas-gavelis-and-his-memoirs-exposing-life-in-soviet-phantasmagoria/", "Литовский литературный журнал рассматривает Vilnius Poker и Vilnius Jazz как ключевые городские романы автора."],
    ],
    decision: "corrected",
    notes: "Рекламная оценка заменена проверяемыми жанрами, образованием и двумя романами.",
  },
  {
    key: "lithuania:ruta_sepetys",
    originalSha256: "a5cf534da12045a96b2d0539d4a6719ca336c950137e412ec59822c64e307fdf",
    reviewedTextRu: "Рута Сепетис (род. 1967) — американская писательница литовского происхождения, работающая в жанре исторической прозы для молодых читателей. Её романы «Between Shades of Gray», «Salt to the Sea» и «I Must Betray You» обращаются к депортациям, военным беженцам и диктатуре в Восточной Европе.",
    evidence: [
      ["Ruta Sepetys — официальный сайт", "https://rutasepetys.com/about/", "Официальная биография подтверждает литовское происхождение, американскую литературную карьеру и перечень исторических романов."],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/244050/ruta-sepetys/", "Издательский профиль подтверждает жанр исторической прозы для молодых читателей и библиографию автора."],
    ],
    decision: "corrected",
    notes: "Общая формула заменена конкретным жанром, книгами и историческими темами.",
  },
  {
    key: "lithuania:tomas_venclova",
    originalSha256: "45450f7a0221589dfe07dbd12ea520f2bddcd00bd64660dfdeebf645a427c1e5",
    reviewedTextRu: "Томас Венцлова (род. 1937) — литовский поэт, эссеист, переводчик и литературовед, преподавший славянские литературы в Йельском университете. Его поэзия и эссе связаны с опытом изгнания, исторической памятью Вильнюса и диалогом литовской, польской и русской культур.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/tomas-venclova/", "Энциклопедия подтверждает дату и место рождения, жанры, эмиграцию и академическую работу Венцловы."],
      ["Vilnius Review", "https://vilniusreview.com/interviews/whatever-else-speak-an-interview-with-tomas-venclova/", "Литературное интервью документирует поэтическую, переводческую и эссеистическую работу автора и его связь с Вильнюсом."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён литературными и академическими ролями и тематическим контекстом.",
  },
  {
    key: "lithuania:vincas_kreve",
    originalSha256: "565b7b7d326df641e23c5f80186d224f2dd65f17cdc81082491dbae950b4cdd4",
    reviewedTextRu: "Винцас Креве-Мицкявичюс (1882–1954) — литовский прозаик, драматург, фольклорист и литературовед. В драме «Šarūnas» и сборнике «Dainavos šalies senų žmonių padavimai» он обращался к литовским преданиям, истории и устной традиции.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/vincas-kreve/", "Энциклопедия подтверждает даты, жанры, научную работу и произведения Šarūnas и Dainavos šalies senų žmonių padavimai."],
      ["Библиотека Конгресса США", "https://id.loc.gov/authorities/names/n50009109.html", "Авторитетная запись идентифицирует Vincas Krėvė-Mickevičius, годы жизни и литовскую литературную библиографию."],
    ],
    decision: "corrected",
    notes: "Краткая заглушка расширена проверяемыми ролями, произведениями и тематикой.",
  },
  {
    key: "lithuania:vincas_putinas",
    originalSha256: "9caf99e3d0650661e48e247446745fb5794bc47f7a8088ee8f45a485d8e9e754",
    reviewedTextRu: "Винцас Миколайтис-Путинас (1893–1967) — литовский поэт, прозаик, драматург и литературовед. Его психологический роман «Altorių šešėly» («В тени алтарей») рассказывает о конфликте призвания, священнической службы и личной свободы.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/vincas-mykolaitis-putinas/", "Энциклопедия подтверждает даты, жанры, академическую работу и содержание романа Altorių šešėly."],
      ["Библиотека Конгресса США", "https://id.loc.gov/authorities/names/n50039791.html", "Авторитетная запись связывает псевдоним Putinas с Винцасом Миколайтисом и его литературными произведениями."],
    ],
    decision: "corrected",
    notes: "Общая жанровая строка заменена точной справкой о романе и литературоведческой работе.",
  },
  {
    key: "lithuania:zemaite",
    originalSha256: "9fd05827bf4a7559248029eea082b360fe0247390077b7d042edc1a74e9f6bb2",
    reviewedTextRu: "Жемайте, настоящее имя Юлия Бенюшевичюте-Жимантене (1845–1921), — литовская писательница, создававшая реалистические рассказы и пьесы. В цикле «Laimė nutekėjimo» она описывала повседневность и социальные отношения литовской деревни конца XIX века.",
    evidence: [
      ["Visuotinė lietuvių enciklopedija", "https://www.vle.lt/straipsnis/zemaite/", "Энциклопедия подтверждает настоящее имя, даты, реалистическую прозу и цикл Laimė nutekėjimo."],
      ["Библиотека Конгресса США", "https://id.loc.gov/authorities/names/n50030520.html", "Авторитетная запись идентифицирует Žemaitė как псевдоним Юлии Жимантене и фиксирует годы жизни и библиографию."],
    ],
    decision: "corrected",
    notes: "Два суперлатива заменены настоящим именем, жанрами, циклом и социальной тематикой.",
  },
  {
    key: "luxembourg:anise_koltz",
    originalSha256: "abfcc9d156297e4b35fd4b399b240b9901e8ea4e4bad23ac21d2fec0bdd78931",
    reviewedTextRu: "Аниз Кольц (1928–2023) — люксембургская поэтесса и переводчица, писавшая сначала по-немецки, а затем преимущественно по-французски. Она основала поэтические встречи «Journées littéraires de Mondorf», а среди её книг — «Le mur du son» и «Somnambule du jour».",
    evidence: [
      ["Centre national de littérature Luxembourg", "https://www.autorenlexikon.lu/page/author/488/4889/DEU/index.html", "Национальный литературный центр подтверждает даты, языки творчества, организацию встреч в Мондорфе и библиографию Кольц."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Koltz%2C+Anise%22", "Библиотечный каталог подтверждает авторскую идентичность и издания Le mur du son и Somnambule du jour."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён языковой биографией, литературной инициативой и названиями книг.",
  },
  {
    key: "luxembourg:edmond_de_la_fontaine",
    originalSha256: "250fcf8876b6c91d593ae9d030b8753d607e0731ea00baea234706bcf0195f97",
    reviewedTextRu: "Эдмон де ла Фонтен (1823–1891), публиковавшийся под псевдонимом Дикс, — люксембургский драматург, поэт и этнограф. Его пьесы «De Scholtscheîn» и «D’Mumm Séis» входят в ранний корпус светской литературы на люксембургском языке.",
    evidence: [
      ["Centre national de littérature Luxembourg", "https://www.autorenlexikon.lu/page/author/492/4927/DEU/index.html", "Национальный литературный центр подтверждает даты, псевдоним Dicks, жанры и библиографию де ла Фонтена."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22La+Fontaine%2C+Edmond+de%22", "Каталог фиксирует авторскую идентичность и издания произведений на люксембургском языке."],
    ],
    decision: "corrected",
    notes: "Справка дополнена этнографической работой и контекстом двух подтверждённых пьес.",
  },
  {
    key: "luxembourg:guy_helminger",
    originalSha256: "c9ae4bbf964995398cee8562065b0fcf74e1efb2a4f6ad143c32350b069616dd",
    reviewedTextRu: "Ги Хельмингер (род. 1963) — люксембургский писатель и драматург немецкого языка, живущий в Кёльне. Он пишет романы, рассказы, пьесы и поэзию; в его библиографии представлены «Die Ruhe der Schlange» и «Neubrasilien».",
    evidence: [
      ["Centre national de littérature Luxembourg", "https://www.autorenlexikon.lu/page/author/490/4909/DEU/index.html", "Национальный литературный центр подтверждает рождение 20 января 1963 года, жизнь в Кёльне, жанры и библиографию Хельмингера."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Helminger%2C+Guy%22", "Каталог подтверждает авторскую форму имени и книги Die Ruhe der Schlange и Neubrasilien."],
    ],
    decision: "corrected",
    notes: "Русское имя нормализовано с «Хеллингер» на «Хельмингер», а год рождения уточняется до полной даты в профиле.",
  },
  {
    key: "luxembourg:jean_portante",
    originalSha256: "8b90a0f903795d335131d67163fe4dc33903dbb64c183bc964c367cc26517e06",
    reviewedTextRu: "Жан Портанте (род. 1950) — люксембургский франкоязычный поэт, прозаик, переводчик и литературный организатор итальянского происхождения. Среди его книг — роман «Mrs Haroy ou la mémoire de la baleine» и поэтический сборник «L’étrange langue».",
    evidence: [
      ["Centre national de littérature Luxembourg", "https://www.autorenlexikon.lu/page/author/475/4757/FRE/index.html", "Национальный литературный центр подтверждает дату рождения, итальянское происхождение, жанры, переводческую работу и библиографию Портанте."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Portante%2C+Jean%22", "Каталог подтверждает авторскую идентичность и издания Mrs Haroy ou la mémoire de la baleine и L’étrange langue."],
    ],
    decision: "corrected",
    notes: "Краткая заглушка дополнена языком, происхождением и двумя проверенными произведениями.",
  },
  {
    key: "luxembourg:michel_rodange",
    originalSha256: "642823dd26a248e4937808917f0fcaadde9202288f4a9d9f5214b4655043b718",
    reviewedTextRu: "Мишель Роданж (1827–1876) — люксембургский поэт, известный сатирической эпической поэмой «Renert oder de Fuuss am Frack an a Maansgréisst». Переложив сюжет о Рейнеке-лисе на люксембургский язык, он создал панораму общественной и политической жизни страны XIX века.",
    evidence: [
      ["Centre national de littérature Luxembourg", "https://www.autorenlexikon.lu/page/author/442/4428/DEU/index.html", "Национальный литературный центр подтверждает даты, поэтическую деятельность и публикацию Renert в 1872 году."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Michel+Rodange%22+Renert", "Библиотечный каталог подтверждает авторство и многочисленные издания поэмы Renert."],
    ],
    decision: "corrected",
    notes: "Неопределённая формула «национальный эпос» заменена названием, жанром, источником сюжета и сатирическим контекстом.",
  },
  {
    key: "macau:hou_chio_jan",
    originalSha256: "30de385210930a0e26d8e21fb4c88f57f30fd9460c0b054d29041b724528af7f",
    reviewedTextRu: "Авторитетные каталоги не устанавливают литературную личность Hou Chio Jan, которой карточка приписывает Макао, 1950 год рождения и китайскоязычные поэзию и прозу. До появления однозначной национальной или библиотечной записи эти сведения и карточка не публикуются.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Hou+Chio+Jan%22", "Поиск точной формы имени не обнаруживает однозначной авторской записи с приписанными карточке датой, страной и произведениями."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Hou%20Chio%20Jan%22", "В авторитетном файле не найдено однозначного соответствия заявленной литературной личности."],
    ],
    decision: "held",
    notes: "Личность, дата и библиография не установлены; запись помещена в карантин без попытки угадать китайское написание имени.",
  },
  {
    key: "macau:hou_jingming",
    originalSha256: "073c2031d82a9fcf7ab88142b224f31da0cee1338fff1f6956034d170178a4e7",
    reviewedTextRu: "Авторитетные каталоги не устанавливают писателя Макао Hou Jingming с указанными в карточке 1955 годом рождения, эссеистикой и прозой. Имя пересекается с другими людьми и не должно связываться с литературной биографией без исходного написания и библиографии.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Hou+Jingming%22", "Поиск точной формы имени не даёт однозначного библиографического соответствия заявленному писателю Макао."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Hou%20Jingming%22", "Авторитетный файл не устанавливает заявленную литературную идентичность, дату и страну."],
    ],
    decision: "held",
    notes: "Запись удержана: высок риск смешения с однофамильцами и с автором Яо Цзинмином.",
  },
  {
    key: "madagascar:charlotte_rafe­nomanjato",
    originalSha256: "108f364df028e00d2c16bf1da87074c74ecb095ac6e441e4f3137f0c9a9f6c68",
    reviewedTextRu: "Шарлотта-Аррисоа Рафеномананджато (1936–2008) — малагасийская писательница и драматург, писавшая по-французски. Её произведения включают роман «Pétales de sortilège», пьесу «Le prix de la paix» и сборник рассказов «Le cinquième sceau».",
    evidence: [
      ["University of Western Australia — African Literature", "https://aflit.arts.uwa.edu.au/Rafenomanjatoeng.html", "Академический справочник подтверждает полное имя, годы, малагасийскую идентичность, жанры и библиографию."],
      ["Words Without Borders", "https://wordswithoutborders.org/contributors/view/charlotte-arrisoa-rafenomanjato/", "Литературный профиль подтверждает франкоязычную писательскую деятельность и основные произведения Рафеномананджато."],
    ],
    decision: "corrected",
    notes: "Общая заглушка заменена полным именем, жанрами и произведениями; невидимый мягкий перенос в id оставлен как зафиксированный ключ исходных данных.",
  },
  {
    key: "madagascar:elie_charles_abraham",
    originalSha256: "16c67ec3cb9ab136badb0bd9d67c2538ff2918d4e9930b68b79ebd64bb457247",
    reviewedTextRu: "Авторитетные каталоги не устанавливают однозначную литературную личность Élie-Charles Abraham с заявленными карточкой годами 1919–2005 и малагасийской прозой. Разрозненные вторичные упоминания расходятся даже в годе смерти, поэтому биография остаётся неопубликованной.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Elie-Charles+Abraham%22", "Каталог не даёт однозначной авторской записи, связывающей точное имя с заявленными датами и произведениями."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Elie-Charles%20Abraham%22", "В авторитетном файле не установлено соответствие заявленной малагасийской литературной личности."],
    ],
    decision: "held",
    notes: "Из-за неустановленной библиографии и противоречивых годов запись помещена в карантин.",
  },
  {
    key: "madagascar:flavien_ranaivo",
    originalSha256: "226c12ae649b1d0df19bb3e45b1f3920b67c387c38cba3b1991cc51c576ec2d0",
    reviewedTextRu: "Флавьен Ранаиво (1914–1999) — малагасийский поэт, писавший по-французски и работавший журналистом и переводчиком. Его сборники «L’ombre et le vent», «Mes chansons de toujours» и «Le retour au bercail» используют образы и формы малагасийской устной поэзии.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11921117h", "Авторитетная запись подтверждает даты 13 мая 1914 — 20 декабря 1999, места рождения и смерти и библиографию Ранаиво."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Ranaivo%2C+Flavien%22", "Каталог подтверждает авторскую идентичность и издания трёх названных поэтических сборников."],
    ],
    decision: "corrected",
    notes: "Оценочное прилагательное заменено языком, профессиями и конкретной библиографией; профиль получает точные даты и места.",
  },
  {
    key: "madagascar:jacques_rabemananjara",
    originalSha256: "4e1f5d6794c3af1e0a57562034f9914b10aad8d68938b67c10f3e10b1ec7fa3d",
    reviewedTextRu: "Жак Рабеманандзара (1913–2005) — малагасийский поэт, драматург и политический деятель, писавший по-французски и связанный с движением негритюда. Его книги «Antsa», «Lamba» и пьеса «Les dieux malgaches» соединяют антиколониальную историю с малагасийской культурой.",
    evidence: [
      ["Académie française", "https://www.academie-francaise.fr/jacques-rabemananjara", "Академия подтверждает даты, малагасийскую политическую и литературную деятельность и присуждённые автору литературные премии."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Jacques+Rabemananjara&critereRecherche=0&depart=0&facetteModifiee=ok", "Каталог подтверждает авторскую идентичность и издания Antsa, Lamba и Les dieux malgaches."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён литературными и политическими ролями, движением и проверенными произведениями.",
  },
  {
    key: "madagascar:jean_francois_samlong",
    originalSha256: "ac592fac04994d8a8f08bc190e518298e9a13aed3ddad48a6a0192b6976cf3fd",
    reviewedTextRu: "Жан-Франсуа Самлон — франкоязычный писатель с острова Реюньон, родившийся в 1949 году в Сент-Мари, а не на Мадагаскаре в 1951 году. Карточка смешивает его подтверждённую реюньонскую биографию с другой страной и потому не публикуется в разделе Мадагаскара.",
    evidence: [
      ["Jean-François Samlong — официальный сайт", "https://jfsamlong.re/", "Официальная биография указывает рождение в 1949 году в Сент-Мари на Реюньоне и перечисляет книги автора."],
      ["Éditions Grasset", "https://www.grasset.fr/auteur/jean-francois-samlong/", "Издательский профиль подтверждает реюньонскую идентичность, литературную карьеру и библиографию Самлона."],
    ],
    decision: "held",
    notes: "Установлен межстрановой конфликт: автоматически переносить карточку нельзя без редакционного решения о дублях и структуре Реюньона.",
  },
  {
    key: "madagascar:jean_joseph_rabearivelo",
    originalSha256: "26f634e13f7e326e5f44bb4d2e6deda0b850628227722202ca3efcd9b18393b5",
    reviewedTextRu: "Жан-Жозеф Рабеаривело (1901–1937) — малагасийский поэт, прозаик, драматург и переводчик, писавший на французском и малагасийском языках. Сборники «Presque-Songes» и «Traduit de la nuit» соединяют европейские модернистские формы с малагасийскими образами и традициями.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12021877w", "Авторитетная запись подтверждает даты 4 марта 1901 — 23 июня 1937, Антананариву и библиографию Рабеаривело."],
      ["Encyclopædia Britannica", "https://www.britannica.com/biography/Jean-Joseph-Rabearivelo", "Энциклопедия подтверждает малагасийскую поэтическую идентичность, двуязычие, модернистские связи и основные сборники."],
    ],
    decision: "corrected",
    notes: "Два суперлатива заменены жанрами, языками и конкретными сборниками; профильные даты уточняются.",
  },
  {
    key: "madagascar:jean_luc_raharimanana",
    originalSha256: "42f2b484ada5c1a239b00d2df63b952a1157a6eee8e778db2487737cbad249e1",
    reviewedTextRu: "Жан-Люк Рахариманана (род. 1967) — малагасийский франкоязычный писатель, поэт, драматург и театральный режиссёр. В книгах «Nour, 1947», «Za» и «Revenir» он обращается к колониальной истории, политическому насилию, изгнанию и памяти.",
    evidence: [
      ["La Marelle", "https://www.la-marelle.org/en-creation/auteurs-autrices/1609-jean-luc-raharimanana.html", "Литературная резиденция подтверждает рождение в 1967 году в Антананариву, жанры и библиографию автора."],
      ["And Other Stories", "https://www.andotherstories.org/authors/jean-luc-raharimanana/", "Издательский профиль подтверждает малагасийскую идентичность, франкоязычную прозу, театр и книги Nour, 1947, Za и Revenir."],
    ],
    decision: "corrected",
    notes: "Краткая заглушка расширена проверяемыми жанрами, произведениями и темами.",
  },
  {
    key: "madagascar:michele_rakotoson",
    originalSha256: "ce0acd40befb4fd8f318f8263606ea6af5bbb156bd9d8736f6c6be76163bf852",
    reviewedTextRu: "Мишель Ракотосон (род. 1948) — малагасийская франкоязычная писательница, драматург, журналистка и культурная деятельница, родившаяся в Антананариву. Среди её книг — «Le bain des reliques», «Lalana» и «Elle, au printemps», посвящённые истории, миграции и общественной жизни Мадагаскара.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=12012965", "Каталог подтверждает авторскую идентичность, год рождения и библиографию Ракотосон."],
      ["University of Western Australia — African Literature", "https://aflit.arts.uwa.edu.au/RakotosonMicheleEng.html", "Академический справочник подтверждает рождение в Антананариву, жанры, журналистскую работу и основные книги."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён ролями, точным местом рождения, книгами и темами.",
  },
  {
    key: "madagascar:nirina_lua",
    originalSha256: "5a85f9804daee9bf9286d0abf04a5431a224a475cd453219237b9f388d653a15",
    reviewedTextRu: "Авторитетные каталоги не устанавливают малагасийскую поэтессу Nirina Lua с годами 1936–2015 и указанной в карточке франкоязычной деятельностью. Имя и русская форма «Нирина Луйз» также не согласуются, поэтому запись остаётся в карантине до появления первичного источника.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Nirina+Lua%22", "Точный поиск не обнаруживает однозначной авторской записи с заявленной биографией и библиографией."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Nirina%20Lua%22", "Авторитетный файл не устанавливает заявленную личность, годы и литературную роль."],
    ],
    decision: "held",
    notes: "Личность и произведения не установлены; конфликт форм имени повышает риск вымышленной или смешанной записи.",
  },
  {
    key: "madagascar:regis_rajemisa_raolison",
    originalSha256: "d134988d0bc49890260d079c7b8c8d6934404a1c6f11f77f2c021c3827220ae5",
    reviewedTextRu: "Режис Радземиса-Раулизон (1913–1990) — малагасийский писатель, поэт, педагог и исследователь малагасийского языка. Он подготовил исторические и языковые труды, включая «Rakibolana malagasy», а также поэтические и прозаические произведения на малагасийском языке.",
    evidence: [
      ["Bibliothèque nationale de France", "https://data.bnf.fr/fr/ark%3A/12148/cb12147192w", "Авторитетная запись подтверждает форму имени Régis Rajemisa-Raolison, годы 1913–1990 и библиографию."],
      ["Catalogue collectif de France", "https://ccfr.bnf.fr/portailccfr/ark%3A/16871/0016934243", "Сводный каталог подтверждает авторство словаря Rakibolana malagasy и малагасийскую языковедческую работу."],
    ],
    decision: "corrected",
    notes: "Год смерти 1997 исправлен на 1990; русское имя и библиография уточнены по французским библиотечным записям.",
  },
  {
    key: "malawi:frank_chipasula",
    originalSha256: "ac07610b6be63a5459a4c22a09d6127d4cdd0c328d4094cb3bcf695853c3bdba",
    reviewedTextRu: "Фрэнк Мкалавиле Чипасула (род. 1949) — малавийский поэт, редактор и автор прозы, много лет работавший в университетах США. Его сборники «Visions and Reflections», «O Earth, Wait for Me» и «Whispers in the Wings» обращаются к изгнанию, цензуре и политическому насилию.",
    evidence: [
      ["Southern Illinois University", "https://faculty.siu.edu/profiles/a-c/chipasula-frank.php", "Университетский профиль подтверждает полное имя, рождение 16 октября 1949 года, малавийское происхождение и литературно-редакторскую работу."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/frank-chipasula", "Профиль подтверждает поэтические сборники, редакторскую работу и темы изгнания и цензуры."],
    ],
    decision: "corrected",
    notes: "Справка дополнена полным именем, полной датой рождения, прозой, книгами и темами.",
  },
  {
    key: "malawi:jack_mapanje",
    originalSha256: "02c271f004543096a6b38570b73561df991be65445954ac3b2738bf600cb84ed",
    reviewedTextRu: "Джек Мапанье (род. 1944) — малавийский поэт, лингвист и преподаватель, заключённый без предъявления обвинения в 1987–1991 годах. В сборниках «Of Chameleons and Gods» и «The Chattering Wagtails of Mikuyu Prison» он пишет о власти, тюрьме, изгнании и устной традиции Малави.",
    evidence: [
      ["Newcastle University Special Collections", "https://specialcollections.ncl.ac.uk/permalink/34222", "Архив университета подтверждает 1944 год рождения, малавийскую поэтическую и академическую карьеру, заключение и состав личного фонда."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/jack-mapanje", "Профиль подтверждает книги, заключение 1987–1991 годов и темы политической власти и устной традиции."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён биографией заключения, академической ролью, книгами и темами; точный день рождения не утверждается.",
  },
  {
    key: "malawi:legson_kayira",
    originalSha256: "52ec59762a4b2ee18c472e1ca2c80197aecdfa74a19a5ce1d9002027e5b92d6a",
    reviewedTextRu: "Легсон Кайира (ок. 1942–2012) — малавийский писатель, получивший образование в США после пешего путешествия из Ньясаленда. Автобиография «I Will Try» рассказывает об этом пути, а романы «The Detainee» и «Jingala» исследуют перемены в африканских обществах.",
    evidence: [
      ["Skagit Valley College Hall of Fame", "https://www.skagit.edu/hall-of-fame/inductees.html", "Колледж подтверждает биографический путь Кайиры из Ньясаленда, обучение и авторство I Will Try."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Kayira%2C+Legson%22", "Каталог подтверждает авторскую идентичность и издания I Will Try, The Detainee и Jingala; записи расходятся в точности года рождения."],
    ],
    decision: "corrected",
    notes: "День 10 мая был выбран самим автором и не является архивно установленной датой; профиль сокращается до приблизительного года.",
  },
  {
    key: "malawi:paul_tiyambe_zeleza",
    originalSha256: "ae84ae3b9557f1cf1be5b094894ddc6bf6fe592fc00f8aaecc449998bfdac46c",
    reviewedTextRu: "Пол Тиямбе Зелеза (род. 1955) — малавийский историк, эссеист, писатель и университетский руководитель, родившийся в Солсбери в Южной Родезии. Его сборник рассказов «The Joys of Exile» и роман «Smouldering Charcoal» посвящены миграции, политике и общественным переменам в Африке.",
    evidence: [
      ["Howard University", "https://profiles.howard.edu/paul-tiyambe-zeleza", "Университетский профиль подтверждает малавийскую идентичность, научную и административную карьеру и литературные публикации."],
      ["United States International University–Africa", "https://www.usiu.ac.ke/1813/gratitude-reflections-landmark-birthday", "Автобиографическая университетская публикация подтверждает рождение 25 мая 1955 года в Солсбери и жизненный путь Зелезы."],
    ],
    decision: "corrected",
    notes: "Общее место рождения «Малави» исправляется на Солсбери; добавляются полная дата, университетская роль и второй художественный текст.",
  },
  {
    key: "malawi:steve_chimombo",
    originalSha256: "5d8226430d821ca17735b2b27a6c76eab1df1b5668f45a37ad95495508a9f377",
    reviewedTextRu: "Стив Бернард Майлз Чимомбо (1945–2015) — малавийский поэт, прозаик, драматург, детский писатель и исследователь устной культуры. Его книги «Napolo and the Python», «The Basket Girl» и «Malawian Oral Literature» соединяют художественную работу с изучением мифологии и устной традиции.",
    evidence: [
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/steve-chimombo", "Профиль подтверждает полное имя, годы, рождение в Зомбе, жанры и библиографию Чимомбо."],
      ["WorldCat", "https://search.worldcat.org/fr/title/malawian-oral-literature-the-aesthetics-of-indigenous-arts/oclc/23532988", "Каталог подтверждает полное имя автора и издание Malawian Oral Literature Университетом Малави в 1988 году."],
    ],
    decision: "corrected",
    notes: "Краткая жанровая строка расширена полным именем, детской литературой, научной ролью и произведениями.",
  },
  {
    key: "malaysia:abdul_samad_said",
    originalSha256: "0c4ccb20c8ca3f251d4fd3e95abb579b1a8d31f7bfec46450cb359b737ed6e81",
    reviewedTextRu: "Абдул Самад Саид (род. 1935) — малайзийский писатель, поэт, драматург и журналист, удостоенный звания Sasterawan Negara в 1985 году. Его романы «Salina» и «Hujan Pagi» описывают послевоенную городскую жизнь, бедность и социальные изменения в Малайзии.",
    evidence: [
      ["Dewan Bahasa dan Pustaka", "https://dbp.gov.my/wajah-iii/", "Национальное языковое и литературное учреждение подтверждает биографию, жанры и основные произведения Абдула Самада Саида."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Samad+Said%2C+A.%22", "Каталог подтверждает авторскую идентичность и издания Salina и Hujan Pagi."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён жанрами, датированным государственным званием, произведениями и темами.",
  },
  {
    key: "malaysia:kemala",
    originalSha256: "d6edc72f89cc0925818e4224de7abe7e0afd163be6b10012d39b74491c22aa70",
    reviewedTextRu: "Кемала, настоящее имя Ахмад Камал Абдуллах (1941–2021), — малайзийский поэт, драматург и литературный критик. Его сборники «Mim», «‘Ayn» и «Timbang Terima» связаны с суфийской образностью и современной малайской поэзией; в 2011 году он получил звание Sasterawan Negara.",
    evidence: [
      ["Dewan Bahasa dan Pustaka", "https://dewansastera.jendeladbp.my/2021/10/31/2264/", "Официальное литературное издание DBP подтверждает настоящее имя Ahmad Kamal Abdullah, даты 30 января 1941 — 27 октября 2021 и литературную карьеру."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Kemala%2C+1941-2021%22", "Каталог подтверждает псевдоним Kemala, авторскую идентичность и поэтическую библиографию."],
    ],
    decision: "corrected",
    notes: "Карточка содержала чужое полное имя, неверные дату и место рождения и не учитывала смерть; идентичность и профиль исправляются.",
  },
  {
    key: "malaysia:shahnon_ahmad",
    originalSha256: "2d1b37cc541d99585fd858e0745dad31c12cb178e88e2497e09b8e21394dff43",
    reviewedTextRu: "Шахнон Ахмад (1933–2017) — малайзийский романист, эссеист и литературовед, получивший звание Sasterawan Negara в 1982 году. В романах «Ranjau Sepanjang Jalan» и «Srengenge» он изображал сельское общество, труд земледельцев и социальные конфликты.",
    evidence: [
      ["Universiti Sains Malaysia", "https://news.usm.my/index.php/english-news/5476-national-laureate-shahnon-ahmad-passed-away-a-big-loss-to-usm", "Университет подтверждает даты, профессорскую работу, национальное звание и литературную деятельность Шахнона Ахмада."],
      ["Dewan Bahasa dan Pustaka", "https://dbpniagastg.dbp.gov.my/Inventori/Detail_Inventori?i=MTIyMzE%3D", "Каталог национального издательства подтверждает авторскую библиографию, включая Ranjau Sepanjang Jalan."],
    ],
    decision: "corrected",
    notes: "Оценка заменена жанрами, датой государственного признания, романами и тематикой.",
  },
  {
    key: "malaysia:tan_twan_eng",
    originalSha256: "ac087fad808adca9a7ff373ccb3baaaf78e2071e93484a3372e8a20947f7b9d8",
    reviewedTextRu: "Тан Тван Энг — малайзийский англоязычный романист, родившийся в Пинанге и ранее работавший юристом. Его романы «The Gift of Rain», «The Garden of Evening Mists» и «The House of Doors» были отмечены номинациями Букеровской и Международной Букеровской премий.",
    evidence: [
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/twan-eng-tan", "Официальный профиль премии подтверждает рождение в Пинанге, юридическую карьеру, три романа и их премиальную историю, но не сообщает точный день рождения."],
      ["British Council Literature", "https://literature.britishcouncil.org/writer/tan-twan-eng", "Профиль подтверждает малайзийскую англоязычную прозу, юридическое образование и библиографию автора."],
    ],
    decision: "corrected",
    notes: "Техническая дата 1 января удаляется: авторитетные профили не подтверждают точный день; рекламная формула заменена книгами и конкретными номинациями.",
  },
  {
    key: "maldives:abdulla_sodiq",
    originalSha256: "19cc7e6b2abd1fc68521b6610a1afbea1c9a3ff7c5ca6c92078ec7fe5c57002a",
    reviewedTextRu: "Абдулла Содик (род. ок. 1935) — мальдивский автор и исследователь языка дивехи, известный также как Содик Бейбе. Он публиковал языковые и литературные работы, а в 2019 году получил национальную премию за вклад в сохранение и развитие дивехи.",
    evidence: [
      ["SunOnline International", "https://english.sun.mv/94453", "Мальдивское издание сообщает, что в январе 2025 года Абдулле Содику исполнилось 90 лет, и описывает его многолетнюю языковую и литературную работу."],
      ["Maldives National University Repository", "https://saruna.mnu.edu.mv/items/46fe73c3-d96a-4151-803c-86bb204fefb9", "Национальный университет каталогизирует авторскую работу Абдуллы Содика на языке дивехи и подтверждает литературно-языковедческую идентичность."],
    ],
    decision: "corrected",
    notes: "Год 1946 противоречит возрасту в актуальном мальдивском источнике; безопасно указывается приблизительный 1935 год без вымышленного дня.",
  },
  {
    key: "maldives:amin_jameel",
    originalSha256: "7725bd322b2297848460a61d6029c9fe0373e50739dee4e68f912fff019a107d",
    reviewedTextRu: "Авторитетные каталоги не устанавливают мальдивского писателя Amin Jameel с датами 1923–2008, языковедческой ролью и указанными карточкой общими названиями работ. Без формы имени на дивехи и атрибутируемой библиографии запись нельзя отличить от одноимённых людей.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Amin+Jameel%22+Maldives", "Поиск не устанавливает однозначную авторскую запись, соответствующую датам, стране и литературным ролям карточки."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Amin%20Jameel%22%20Maldives", "Авторитетный файл не подтверждает заявленную мальдивскую литературную идентичность и библиографию."],
    ],
    decision: "held",
    notes: "Точные даты и роли не имеют проверяемой опоры; запись помещена в карантин.",
  },
  {
    key: "maldives:muhammad_jameel_didi",
    originalSha256: "9e78fd0c29b86ed885397197e428a8f4f9bcbb01604a7017dc8ae4f8c9014a01",
    reviewedTextRu: "Мухаммад Джамиль Диди (1915–1989) — мальдивский поэт, учёный и государственный деятель, писавший на языке дивехи. Он создал слова действующего государственного гимна Мальдив «Gaumii salaam» и участвовал в развитии школьного образования и литературы страны.",
    evidence: [
      ["Maldives National University Repository", "https://saruna.mnu.edu.mv/bitstreams/b5fa6d10-f16d-40ec-a0e2-cbbf4f52f74e/download", "Университетское энциклопедическое издание подтверждает годы, литературную и образовательную деятельность и авторство текста гимна."],
      ["Maldives Royal Family", "https://maldivesroyalfamily.com/maldives_anthem.shtml", "Исторический справочный проект подтверждает, что слова Gaumii salaam написал Muhammad Jameel Didi, и описывает историю гимна."],
    ],
    decision: "corrected",
    notes: "Суперлатив и абстрактный вклад заменены конкретными ролями и проверяемым авторством текста гимна.",
  },
  {
    key: "mali:adame_ba_konare",
    originalSha256: "6cb6afd0663d1d337200e144ae95054fc80460237e23eef9c3d72d5dc438abcb",
    reviewedTextRu: "Адама Ба Конаре (род. 1947) — малийская историк, писательница и общественная деятельница, родившаяся в Сегу. Она публиковала исследования по истории женщин и государства Мали, а также роман «Le Wassa ou les secrets d’une reine».",
    evidence: [
      ["Institut des Sciences Humaines du Mali", "https://www.ish-mali.ml/ish-web/storage/app/public/fichiers/a9tuwbTz6BoJJIRHG1GgcIlpk4xuc68PQGOMmBqS.pdf", "Малийское академическое издание подтверждает рождение в Сегу, историческую работу и библиографию Адамы Ба Конаре."],
      ["University of Western Australia — African Literature", "https://aflit.arts.uwa.edu.au/BaKonareAdameEng.html", "Академический профиль подтверждает 1947 год, писательскую и историческую деятельность и роман Le Wassa."],
    ],
    decision: "corrected",
    notes: "Профильное место рождения Бамако исправляется на Сегу; общая формула дополнена предметом исследований и романом.",
  },
  {
    key: "mali:amadou_hampate_ba",
    originalSha256: "42f0195cc9d8fd6639ea5656f6df993b6b075ec57148ce025b185da78159f3da",
    reviewedTextRu: "Амаду Хампате Ба (1901–1991) — малийский писатель, этнолог, историк и собиратель устных традиций Западной Африки. Его книги «L’Étrange Destin de Wangrin» и «Amkoullel, l’enfant peul» соединяют повествование, историческую память и документирование фульбе и других культур региона.",
    evidence: [
      ["UNESCO", "https://www.unesco.org/en/memory-world/amadou-hampate-ba/guardian-african-heritage", "ЮНЕСКО подтверждает годы, малийскую идентичность, работу по сохранению устного наследия и участие в международных культурных программах."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Amadou+Hampate+Ba&critereRecherche=0&depart=0&facetteModifiee=ok", "Каталог подтверждает авторскую идентичность и издания L’Étrange Destin de Wangrin и Amkoullel, l’enfant peul."],
    ],
    decision: "corrected",
    notes: "Справка уточняет этнологическую роль и корректирует библиографию: «Дающий слово» заменён на документированные названия.",
  },
  {
    key: "mali:fily_dabo_sissoko",
    originalSha256: "229c865b42418ce88989d371f338c1bc3bf6aa6c0d4b74630bd0cefef867af1f",
    reviewedTextRu: "Фили Дабо Сиссоко (1900–1964) — малийский писатель, поэт, этнограф и политический деятель, писавший по-французски. Он публиковал поэзию, эссе и исследования культуры, включая «La passion de Djimé» и «Sagesse noire», и умер в заключении в Кидале.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12174728b", "Авторитетная запись подтверждает даты 15 мая 1900 — 30 июня 1964, места, литературные роли и библиографию Сиссоко."],
      ["Assemblée nationale française", "https://www2.assemblee-nationale.fr/sycomore/fiche/6862", "Парламентская биография подтверждает политическую идентичность Фили Дабо Сиссоко и основные этапы его жизни до заключения."],
    ],
    decision: "corrected",
    notes: "Расплывчатая первенствующая оценка заменена жанрами, книгами и биографическим контекстом; профиль получает точные даты и места.",
  },
  {
    key: "mali:massa_makan_diabate",
    originalSha256: "003c4e62ec055471cea6faecaa8f2dab794e9390e847eb8a16685eb960fd723a",
    reviewedTextRu: "Масса Макан Диабате (1938–1988) — малийский писатель, драматург и исследователь устной традиции, происходивший из семьи гриотов. В трилогии о Куте — «Le lieutenant de Kouta», «Le coiffeur de Kouta» и «Le boucher de Kouta» — он сатирически описывал общественные перемены после независимости.",
    evidence: [
      ["Bibliothèque nationale de France", "https://data.bnf.fr/temp-work/d12cdff6e1e499d6c9979e176e9405c6/", "Национальная библиотека связывает Диабате с малийской литературой, устной традицией и исследованиями его произведений."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Diabate%2C+Massa+Makan%22", "Каталог подтверждает годы, авторскую идентичность и издания трёх романов цикла о Куте."],
    ],
    decision: "corrected",
    notes: "Общая строка заменена происхождением из семьи гриотов, драматургией, полной трилогией и её социальной тематикой.",
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

export const writerBiographyFactReviewBatch38: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);

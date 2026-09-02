import type { WorkProfile, WorkSourceProfile } from "./types";

const editorialDate = "2026-09-02";
const editorialAuthor = "Редакция «Пробы Пера»";

export type BookArticleSynopsisIdentity = Readonly<{
  recordKey: string;
  expectedTitle: string;
  candidateKind: "novel" | "short-story";
  pairSha256: string;
  occurrenceSha256: string;
  articleId: string;
  articleUrl: string;
  articleSha256: string;
  revisionDocumentPath: string;
  revisionSha256: string;
  headingId: string;
  headingText: string;
  headingSha256: string;
  excerptSha256: string;
}>;

export type BookArticleSynopsisBatch01Record = Readonly<{
  identity: BookArticleSynopsisIdentity;
  ruDescription: string;
  enDescription: string;
  translatedFromSourceHash: string;
  officialSources: readonly WorkSourceProfile[];
}>;

type ArticleIdentity = Pick<
  BookArticleSynopsisIdentity,
  | "articleId"
  | "articleUrl"
  | "articleSha256"
  | "revisionDocumentPath"
  | "revisionSha256"
>;

const tolstoyShortStoriesArticle: ArticleIdentity = {
  articleId: "cms-766846e2-a653-465e-a4b4-ce327a22696f",
  articleUrl:
    "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
  articleSha256:
    "b82906459f57f1bfc156f9be1d4853f01927c91f751df0d3880ee16852155d16",
  revisionDocumentPath:
    "cms/articles/cms-766846e2-a653-465e-a4b4-ce327a22696f.json",
  revisionSha256:
    "a43b4787d738a69bedecbc17fcde3efe2bb5a0c5341411930af2bf5f93fb3039",
};

const chekhovShortStoriesArticle: ArticleIdentity = {
  articleId: "cms-473b8ad5-1bc5-43e6-8698-1c9528e61b10",
  articleUrl:
    "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-a-p-chehov/",
  articleSha256:
    "2e02e3dcb6d4c8c6a4ea07fc28486cedb32070433e6b0793ccc77655b828c2ed",
  revisionDocumentPath:
    "cms/articles/cms-473b8ad5-1bc5-43e6-8698-1c9528e61b10.json",
  revisionSha256:
    "e07ff1aacfd0d98d3a42773a5bdcfc57886470cea5ab7fb17b272f0fb10c58f2",
};

const topBooksPartFiveArticle: ArticleIdentity = {
  articleId: "cms-db3ab5d8-4d2f-41a3-8369-8fab1df44d86",
  articleUrl:
    "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
  articleSha256:
    "307595117fb2295ffb9c28599ba808cad7083248837d66f04dafa0755e353577",
  revisionDocumentPath:
    "cms/articles/cms-db3ab5d8-4d2f-41a3-8369-8fab1df44d86.json",
  revisionSha256:
    "b5e00413992cad055a0d8a38ab9de4d9764232c6eea42a868cf7470ed07c62bc",
};

function officialFactSource(
  source: Pick<
    WorkSourceProfile,
    "provider" | "authorityId" | "authorityTier" | "recordId" | "url"
  > &
    Partial<Pick<WorkSourceProfile, "market">>,
): WorkSourceProfile {
  return {
    ...source,
    country: "russia",
    language: "Russian",
    recordKind: "authoritative-work-page",
    fields: ["identity", "authorship", "title", "description"],
    usage: "reference-only",
    retrievedAt: editorialDate,
  };
}

const tolstoyMuseumSource = (recordId: string, url: string) =>
  officialFactSource({
    provider:
      "Государственный музей Л. Н. Толстого / музей-усадьба «Ясная Поляна»",
    authorityId: "tolstoy-museum",
    authorityTier: "B",
    recordId,
    url,
  });

const febChekhovSource = (recordId: string, url: string) =>
  officialFactSource({
    provider:
      "Фундаментальная электронная библиотека «Русская литература и фольклор»",
    authorityId: "feb-web",
    authorityTier: "B",
    market: "RU",
    recordId,
    url,
  });

const nebSource = (recordId: string, url: string) =>
  officialFactSource({
    provider: "Национальная электронная библиотека",
    authorityId: "neb",
    authorityTier: "A",
    market: "RU",
    recordId,
    url,
  });

export const bookArticleSynopsisBatch01Records = [
  {
    identity: {
      recordKey: "russia:tolstoy:article-series-1ibqthb",
      expectedTitle: "Алёша Горшок",
      candidateKind: "short-story",
      pairSha256:
        "07bd5ff77c634ecba8bc89f644eb45bd4c2991b000c305ee308f67075545a653",
      occurrenceSha256:
        "d1f795ba91409eff9b3fa0fb6f765dc853a5f84695477e389852bca003f46bf0",
      ...tolstoyShortStoriesArticle,
      headingId: "chapter-2-алёша-горшок-3",
      headingText: "2. Алёша Горшок",
      headingSha256:
        "25842eee8783ab72336ab6ce0856ccc0fee902cc8b2f989bf688a2fd941b0345",
      excerptSha256:
        "e066aaecddc1435ebd6b8b7f4a6e364843c6508e0957a63d19adcf28b0cb011c",
    },
    ruDescription:
      "Безропотный и работящий Алёша служит в купеческом доме, принимая чужие распоряжения как неизменный порядок жизни. Возникшая между ним и кухаркой Устиньей привязанность впервые открывает герою возможность личного счастья, однако право решать собственную судьбу остаётся не у него.",
    enDescription:
      "Gentle and industrious Alyosha serves in a merchant's household, accepting other people's orders as the fixed order of his life. His growing affection for the cook Ustinya offers him his first glimpse of personal happiness, yet the right to decide his own future remains in other hands.",
    translatedFromSourceHash:
      "52021c8da04916de3ed23c13d9de4d0e62d948f325b82b92f21078ef5f7b9d92",
    officialSources: [
      tolstoyMuseumSource(
        "TOLSTOY-FICTION-587-INFO",
        "https://tolstoy.ru/creativity/fiction/587/info/",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:bulgakov:the-white-guard-editorial",
      expectedTitle: "Белая гвардия",
      candidateKind: "novel",
      pairSha256:
        "54efe51b40f43be87a0f3f43bea8624d2b5f3f8611865b9cdbc58a85a2f7eb59",
      occurrenceSha256:
        "444c492e4898115a19113bc9ea1cbac597c228fb52ee4c469092f23f9bd8f447",
      articleId: "cms-77f11506-9e49-4ed4-b199-8b87b86fc820",
      articleUrl:
        "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-4/",
      articleSha256:
        "093178f6c5cf7d5d98cd119fa222fa0d0cf668ffa1faf75a60c2c7555bf5f07b",
      revisionDocumentPath:
        "cms/articles/cms-77f11506-9e49-4ed4-b199-8b87b86fc820.json",
      revisionSha256:
        "ccf94e883a56364548ef5c267ab74b172fa9febbf8bb83caf0502ce995db5449",
      headingId: "chapter-4-михаил-булгаков-белая-гвардия-5",
      headingText: "4. Михаил Булгаков - Белая гвардия",
      headingSha256:
        "203de957ff1640d0bff5808aac3a98311ba7825e2c3572f95b135020a228e6c3",
      excerptSha256:
        "30f20d94ba2e4848672374a98ed690d9787e74afc10a23cb609de73e22d9b9e3",
    },
    ruDescription:
      "В охваченном Гражданской войной Киеве семья Турбиных пытается сохранить дом, взаимную верность и привычные нравственные ориентиры на фоне стремительной смены власти. Частная жизнь героев переплетается с распадом государственных и военных структур, показывая историю через опыт людей, лишившихся устойчивого мира.",
    enDescription:
      "In Kyiv during the Civil War, the Turbin family tries to preserve its home, mutual loyalty, and familiar moral bearings amid rapid changes of power. The characters' private lives intertwine with the collapse of state and military structures, presenting history through people whose stable world has vanished.",
    translatedFromSourceHash:
      "536443b0903660ed1aec2c2ff8073c131d5bee408a7846fc6e79f2783c4ee6d3",
    officialSources: [
      nebSource(
        "NEB-SVET-DNI-TURBINYH",
        "https://svetapp.rusneb.ru/catalog/dni-turbinyh",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:buninin:the-village",
      expectedTitle: "Деревня",
      candidateKind: "novel",
      pairSha256:
        "a21a666d4e882125ce86b57f53c11ddb2073892938f6cbf706af00cae713c24c",
      occurrenceSha256:
        "e98e225ae7b1fba952a7e7a770922d157ff017d75631ad7665de8f35d0f0cb56",
      articleId: "cms-192bc665-3461-422c-adee-d25fb394385c",
      articleUrl:
        "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
      articleSha256:
        "9f7abf1d7c150b8555c2b8860ef3f3d80908ae27a9725249529e1178b05048b8",
      revisionDocumentPath:
        "cms/articles/cms-192bc665-3461-422c-adee-d25fb394385c.json",
      revisionSha256:
        "08f342f7b6e63f8164c3ac56d0fa50275c6fc865cf7658e77ed6cc621cff17cc",
      headingId: "chapter-6-иван-бунин-деревня-7",
      headingText: "6. Иван Бунин - Деревня",
      headingSha256:
        "3ea18c189e8c7ca32a2434eaa6156c009a21c5631f0eb584649c768050ce5203",
      excerptSha256:
        "8714c0e30ca323f13fdf1d3bdd03f1cd696f0efcb0987ee8fad7854f5149c93e",
    },
    ruDescription:
      "На фоне потрясений начала XX века братья Тихон и Кузьма Красовы по-разному ищут своё место в Дурновке. Их судьбы складываются в суровую картину деревенского мира, где хозяйственная предприимчивость, мечты о просвещении и человеческое сочувствие сталкиваются с бедностью и укоренившимся насилием.",
    enDescription:
      "Against the upheavals of the early twentieth century, the brothers Tikhon and Kuzma Krasov seek their places in Durnovka in very different ways. Their fates form an austere picture of the rural world, where enterprise, dreams of education, and human sympathy confront poverty and entrenched violence.",
    translatedFromSourceHash:
      "bc173686abdf7fa4235aa478015f8f14639aaa4eec44d39f07b9aeac96c9dc41",
    officialSources: [
      officialFactSource({
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        authorityId: "presidential-library-ru",
        authorityTier: "A",
        market: "RU",
        recordId: "PRLIB-800603",
        url: "https://www.prlib.ru/item/800603",
      }),
    ],
  },
  {
    identity: {
      recordKey: "russia:turgenev:article-series-men9bv",
      expectedTitle: "Дым",
      candidateKind: "novel",
      pairSha256:
        "f8e77aab6ee30a1c3219a796edd49e0782ffd6b1b7a837102188560263067019",
      occurrenceSha256:
        "91a8e7511c5987c14ce0c683ae231381e27b5ff732e38ee7d62aab9760d22416",
      ...topBooksPartFiveArticle,
      headingId: "chapter-5-и-с-тургенев-дым-6",
      headingText: "5. И.С. Тургенев «Дым»",
      headingSha256:
        "1187ecf92638468de8e4103b7540a07f77b5e04d3c65ab56dd9a01011d98b73f",
      excerptSha256:
        "6a8ccf6a4f882b8f2262b66a1457199cf744f95fd045a6621eba7f08080b6991",
    },
    ruDescription:
      "Накануне свадьбы Григорий Литвинов приезжает в Баден-Баден и вновь встречает Ирину, свою прежнюю любовь. Возобновившееся чувство нарушает его планы, а жизнь русской колонии на курорте становится фоном для споров о будущем страны и непрочности личных убеждений.",
    enDescription:
      "On the eve of his wedding, Grigory Litvinov arrives in Baden-Baden and again meets Irina, his former love. Their rekindled attachment unsettles his plans, while the Russian colony at the resort provides a setting for arguments about the country's future and the fragility of personal convictions.",
    translatedFromSourceHash:
      "9e2837bc5ce4a5f638aff507082fe951b3c13be944f7417e7f9a2ae736aa659c",
    officialSources: [
      nebSource(
        "NEB-000199_000009_003582019",
        "https://rusneb.ru/catalog/000199_000009_003582019/",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:chekhov:article-series-38cmfo",
      expectedTitle: "Жалобная книга",
      candidateKind: "short-story",
      pairSha256:
        "ab4e0508a9d91de440d7d909b7593cd46659fdd5d5b2d8388a93d8592c3fb84b",
      occurrenceSha256:
        "5c8ef32bf56b7a5e7ae9dc1a51b0e432bcfe8104211c92f3956e29295a060b66",
      ...chekhovShortStoriesArticle,
      headingId: "chapter-2-жалобная-книга-3",
      headingText: "2. Жалобная книга",
      headingSha256:
        "b2f7238cc6b8ec50b9f48d5f2d9e74d18c619faf6e41741ae85b4783bae7cc49",
      excerptSha256:
        "ca298acc563a920fb6762e57ede627ceec68380a4e2a26a00c4635be840c8cc8",
    },
    ruDescription:
      "Оставленная на железнодорожной станции жалобная книга заполняется не официальными претензиями, а шутками, оскорблениями, признаниями и мелкими доносами. Череда разнородных записей складывается в комический портрет случайной публики и превращает служебный документ в самостоятельного участника повествования.",
    enDescription:
      "A complaint book left at a railway station is filled not with official grievances but with jokes, insults, declarations, and petty denunciations. The succession of disparate entries forms a comic portrait of assorted visitors and turns an administrative document into a participant in the narrative.",
    translatedFromSourceHash:
      "9f4eaac0b776e46d44a5d71495db0a3f0a9cc860300a80d10da2ce976ef89c75",
    officialSources: [
      febChekhovSource(
        "CHEKHOV-PSS-SP2-358",
        "https://feb-web.ru/feb/chekhov/texts/sp0/sp2/sp2-358-.htm?cmd=p",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:tolstoy:article-series-k1mlo9",
      expectedTitle: "Казаки",
      candidateKind: "novel",
      pairSha256:
        "66346893a93546fe6f12a8dcbae6d1ddf4daecd3ab2e5b67d992ae00e02223b4",
      occurrenceSha256:
        "d7036cb779362d14a7173bdd5ab6eeaa3bd820294f6d04e3f6deb7eaeb7429b6",
      articleId: "cms-f78a8ab2-99fb-4f16-bf95-8945e3a33aa0",
      articleUrl:
        "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-1/",
      articleSha256:
        "ddb7f71725637135821f557183fc76180356d0d0ea769e6b734b987bed67d5f5",
      revisionDocumentPath:
        "cms/articles/cms-f78a8ab2-99fb-4f16-bf95-8945e3a33aa0.json",
      revisionSha256:
        "b305694d7b33f9f5f94665787b126554f77ae52cfee2e40f67e9e470c6c9e489",
      headingId: "chapter-2-л-н-толстой-казаки-3",
      headingText: "2. Л.Н. Толстой - Казаки",
      headingSha256:
        "4878c15603d08b445885494fbfe9c0b77417c5329cfdcb247cfa7d8a02e01b08",
      excerptSha256:
        "b5dfc89a54fe439c6bb3ef2bcc10106f62c19bc1bfc2bb74ba91586b160b183f",
    },
    ruDescription:
      "Дмитрий Оленин оставляет московскую светскую жизнь и отправляется на Кавказ, надеясь обрести среди казаков более цельное существование. Дружба со стариком Ерошкой и чувство к Марьяне сближают его со станицей, но постепенно обнаруживают границу между восхищённым приезжим и миром, которому он хочет принадлежать.",
    enDescription:
      "Dmitry Olenin leaves Moscow society for the Caucasus, hoping to find a more integrated way of life among the Cossacks. His friendship with the old man Eroshka and his feelings for Maryana draw him closer to the stanitsa, but gradually reveal the boundary between an admiring outsider and the world he longs to join.",
    translatedFromSourceHash:
      "a0046eaf9706d59857d10d968a4ec20b9442444046c9713e6b00f3be11828994",
    officialSources: [
      tolstoyMuseumSource(
        "TOLSTOY-COLLECTED-WORKS-VOLUME-6",
        "https://tolstoy.ru/creativity/90-volume-collection-of-the-works/678/",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:tolstoy:article-series-u18dwv",
      expectedTitle: "Лев и собачка",
      candidateKind: "short-story",
      pairSha256:
        "00bc5043f8d65247e9e52e87f4bdc848daa94bf5012447484003263bd30a0f4b",
      occurrenceSha256:
        "eea596627b2cc7e7c8841a45fdde7d18208bbbd89b6585cb5826a1cfad2a1190",
      ...tolstoyShortStoriesArticle,
      headingId: "chapter-5-лев-и-собачка-6",
      headingText: "5. Лев и собачка",
      headingSha256:
        "5bd0e75558b3dff07fe3f61a408a2021a3ead37c95470d20e75cbfc047c32b38",
      excerptSha256:
        "1d48df761496354405c64a30bf0c6e0ec12cb1c80de4638c42cbf08c0c4d1610",
    },
    ruDescription:
      "Собачку бросают в клетку ко льву, ожидая, что она станет добычей, но хищник не трогает её и позволяет остаться рядом. Неожиданное соседство перерастает в привязанность, которая определяет дальнейшее течение рассказа.",
    enDescription:
      "A small dog is thrown into a lion's cage as prey, but the predator does not harm it and allows it to remain nearby. Their unexpected companionship develops into a bond that determines the course of the story.",
    translatedFromSourceHash:
      "1986077aed34c53194515f08cc795a8b56ff1f53509fb8086a1b6e048adc5af8",
    officialSources: [
      tolstoyMuseumSource(
        "TOLSTOY-COLLECTED-WORKS-VOLUME-22-LION-AND-DOG",
        "https://tolstoy.ru/online/90/22/",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:chekhov:article-series-807ko1",
      expectedTitle: "Лошадиная фамилия",
      candidateKind: "short-story",
      pairSha256:
        "d6ea343b1d3fcb4a86793d28b801ddb5d326199c7a37f63bef6b21379763d4e5",
      occurrenceSha256:
        "0f90fcbf93a9b7b5ab9bd86b960f471ceb61e8d075228b6851cb6461cffb25e4",
      ...chekhovShortStoriesArticle,
      headingId: "chapter-5-лошадиная-фамилия-6",
      headingText: "5. Лошадиная фамилия",
      headingSha256:
        "76ce68c2dd6ed801ae4fca8360978b3672a6886156963f85eb6cd08b3f44de89",
      excerptSha256:
        "10d94754e74434b4a9e8a119d63db45189d1c9725fb620a028c00bbf9b6b45aa",
    },
    ruDescription:
      "Когда у отставного генерал-майора Булдеева разболелся зуб, приказчик советует обратиться к человеку, который будто бы умеет лечить на расстоянии. Единственная помеха - забытая «лошадиная» фамилия целителя, и её поиски вовлекают весь дом во всё более нелепую словесную игру.",
    enDescription:
      "When retired Major General Buldeyev develops a toothache, his clerk advises consulting a man said to heal from a distance. The only obstacle is the healer's forgotten 'horsey' surname, and the search draws the entire household into an increasingly absurd verbal game.",
    translatedFromSourceHash:
      "f0da0e11036714e6a33440fe1d96a4c90eb896b2250efd945d6b67be00815f8f",
    officialSources: [
      febChekhovSource(
        "CHEKHOV-PSS-SP4-058",
        "https://feb-web.ru/feb/chekhov/texts/sp0/sp4/sp4-058-.htm?cmd=p",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:tolstoy:article-series-zqpjjm",
      expectedTitle: "После бала",
      candidateKind: "short-story",
      pairSha256:
        "31b906d5686a48d45a021594d673b3662b7542dfe2bb3553157f88d9fe4bf050",
      occurrenceSha256:
        "118fda5dd24304cf7f98dbf1ff3d4553d56061ce04775ba3c8d42a736078e57e",
      ...tolstoyShortStoriesArticle,
      headingId: "chapter-1-после-бала-2",
      headingText: "1. После бала",
      headingSha256:
        "aab3ed31763923bbd85abe04a01b672676f6051757b488013f7e3a7093787baf",
      excerptSha256:
        "17db52ebc99f90eaa479674d7cf599726acac96bafe8dfa07d4239e4ed7b798c",
    },
    ruDescription:
      "Иван Васильевич вспоминает бал, на котором его влюблённость в Вареньку окрашивает всё происходящее ощущением счастья и гармонии. Увиденная следующим утром сцена телесного наказания заставляет его иначе взглянуть на отца девушки, общественный порядок и собственное будущее.",
    enDescription:
      "Ivan Vasilyevich recalls a ball at which his love for Varenka fills everything with a sense of happiness and harmony. A scene of corporal punishment that he witnesses the following morning makes him see the young woman's father, the social order, and his own future differently.",
    translatedFromSourceHash:
      "48b5d6007f80fee70ce647d29ab0686c77b3cfdf167577585d01fff6305cf48b",
    officialSources: [
      tolstoyMuseumSource(
        "TOLSTOY-COLLECTED-WORKS-VOLUME-34-AFTER-THE-BALL",
        "https://tolstoy.ru/online/90/34/",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:chekhov:article-series-1fa9e8h",
      expectedTitle: "Смерть чиновника",
      candidateKind: "short-story",
      pairSha256:
        "d5c5b94c84809bc25f5a8ef0071e5536aa4a5316036beda04f6b18db24ced29c",
      occurrenceSha256:
        "96bdfc0ee2ee01d07d37eda782885a7507ee3245aae59702391617e025ef97d5",
      ...chekhovShortStoriesArticle,
      headingId: "chapter-3-смерть-чиновника-4",
      headingText: "3. Смерть чиновника",
      headingSha256:
        "daffcc0fb41857198e5abd6103f06799aa1c99ed6a3ef79757e68447d8abd9c9",
      excerptSha256:
        "8e811bcd751054ca122f51784e8f76adf9c9beeb21779a8708a511d0970fa86a",
    },
    ruDescription:
      "Чиновник Иван Червяков случайно чихает на генерала в театре и сразу приносит извинения, которые тот принимает без особого внимания. Не в силах поверить, что происшествие исчерпано, Червяков снова и снова возвращается к генералу, превращая пустяк в мучительную для себя катастрофу.",
    enDescription:
      "The clerk Ivan Chervyakov accidentally sneezes on a general at the theatre and immediately apologizes; the general treats the incident as insignificant. Unable to believe the matter is over, Chervyakov returns to him again and again, turning a trifle into a catastrophe for himself.",
    translatedFromSourceHash:
      "599bc57f54364540ba615a9ff30a02f0e03ca15ff852d584a3cb58902724df81",
    officialSources: [
      febChekhovSource(
        "CHEKHOV-PSS-SP2-164",
        "https://feb-web.ru/feb/chekhov/texts/sp0/sp2/sp2-164-.htm?cmd=p",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:chekhov:article-series-10x9915",
      expectedTitle: "Степь",
      candidateKind: "novel",
      pairSha256:
        "2fde697b774ecb4b5e9376e32d8d279cdbfe98e5b2dfdc793d75a939f624a9e8",
      occurrenceSha256:
        "dbdc53eb209b8ed3cd6c65a40a7d689d1f199c0ddf42d3c49c787af6ce86ffb2",
      ...topBooksPartFiveArticle,
      headingId: "chapter-4-а-п-чехов-степь-5",
      headingText: "4. А.П. Чехов «Степь»",
      headingSha256:
        "ec462b2f8536dc34f9e8a46dfcbeaf27dde9ba1bd626562ce0a6b5e5bf2926b9",
      excerptSha256:
        "f45f5dfb72385c6b1c4d48a16f540de91cdb7ae9008ee1253015eb318ffb9522",
    },
    ruDescription:
      "Егорушка едет через южную степь вместе с купеческим обозом, чтобы поступить в гимназию. Дорога знакомит мальчика с незнакомыми людьми, трудом и переменчивой природой, а последовательность впечатлений передаёт его переход из домашнего мира к первым самостоятельным переживаниям.",
    enDescription:
      "Yegorushka travels across the southern steppe with a merchant wagon train on his way to enter a secondary school. The journey introduces the boy to unfamiliar people, work, and changing nature, while the sequence of impressions conveys his passage from home into his first independent experiences.",
    translatedFromSourceHash:
      "167f12b68625310f9dc6fd3ca9c4e3025a140bcce0ef96b5c52d8091e9fc7d6d",
    officialSources: [
      febChekhovSource(
        "CHEKHOV-PSS-SP7-013",
        "https://feb-web.ru/feb/chekhov/texts/sp0/sp7/sp7-013-.htm?cmd=p",
      ),
    ],
  },
  {
    identity: {
      recordKey: "russia:tolstoy:article-series-ms8wjq",
      expectedTitle: "Филипок",
      candidateKind: "short-story",
      pairSha256:
        "2869fa858c4a6af0ca398ffbd7b53b3b502e3865cae07527437fe76dcbe8b8bd",
      occurrenceSha256:
        "292ac8d89efec78af9cdd16a3935956e4344bbf19946eccb0f1254b0e594b617",
      ...tolstoyShortStoriesArticle,
      headingId: "chapter-6-филипок-7",
      headingText: "6. Филипок",
      headingSha256:
        "5d48515c2d990b50c9a667cb89a4cda6b548f9e25058c9ffe7232185e076625a",
      excerptSha256:
        "ced67dbd8b70cb879c8357c66937c78c3829a7b712b90ef0e85884828a0600b7",
    },
    ruDescription:
      "Маленький Филипок, которому ещё не разрешают ходить в школу, самостоятельно отправляется вслед за старшими детьми. Столкнувшись со страхом и смущением, он всё же показывает учителю, насколько сильно хочет учиться.",
    enDescription:
      "Little Philipok, who is not yet allowed to attend school, sets out on his own after the older children. Despite his fear and embarrassment, he manages to show the teacher how deeply he wants to learn.",
    translatedFromSourceHash:
      "e5381e84adc6c6031e9dcfdc39d87f07dfb60c9bb9af61b1effc04d4f46eeb58",
    officialSources: [
      tolstoyMuseumSource(
        "TOLSTOY-COLLECTED-WORKS-VOLUME-21-PHILIPOK",
        "https://tolstoy.ru/online/90/21/",
      ),
    ],
  },
] as const satisfies readonly BookArticleSynopsisBatch01Record[];

export const bookArticleSynopsisBatch01RecordKeys =
  bookArticleSynopsisBatch01Records.map((record) => record.identity.recordKey);

// Only sources explicitly selected for the synopsis count here; inherited
// bibliographic sources are never silently promoted to description evidence.
export const bookArticleSynopsisBatch01Holds =
  bookArticleSynopsisBatch01Records.map((record) => ({
    recordKey: record.identity.recordKey,
    status: "fail-closed" as const,
    code: "insufficient-independent-official-description-sources" as const,
    currentOfficialSourceCount: record.officialSources.length,
    requiredIndependentOfficialSourceCount: 2,
  }));

const recordByKey = new Map<string, BookArticleSynopsisBatch01Record>(
  bookArticleSynopsisBatch01Records.map((record) => [
    record.identity.recordKey,
    record,
  ]),
);

function projectArticleSource(
  identity: BookArticleSynopsisIdentity,
): WorkSourceProfile {
  return {
    provider: "Проба Пера",
    authorityId: "probpera-editorial",
    authorityTier: "B",
    country: "russia",
    language: "Russian",
    recordKind: "article-source",
    recordId: identity.articleId,
    url: identity.articleUrl,
    fields: ["identity", "title", "description"],
    usage: "reference-only",
    retrievedAt: editorialDate,
  };
}

function mergeSources(
  existing: readonly WorkSourceProfile[] | undefined,
  additions: readonly WorkSourceProfile[],
) {
  const merged = new Map<string, WorkSourceProfile>();
  for (const source of existing || []) merged.set(source.url, source);
  for (const source of additions) {
    const previous = merged.get(source.url);
    merged.set(
      source.url,
      previous
        ? {
            ...previous,
            ...source,
            fields: [...new Set([...previous.fields, ...source.fields])],
          }
        : source,
    );
  }
  return [...merged.values()];
}

/**
 * Adds human-reviewed article-adapted synopsis drafts without changing a
 * Work's bibliographic identity or making it publishable. RU and EN title
 * localizations are deliberately preserved (or left empty) until separate
 * manifestation evidence exists.
 */
export function applyBookArticleSynopsisBatch01Work(
  countryId: string,
  writerId: string,
  work: WorkProfile,
): WorkProfile {
  const record = recordByKey.get(`${countryId}:${writerId}:${work.id}`);
  if (!record) return work;

  const articleSource = projectArticleSource(record.identity);
  const sourceUrls = [
    record.identity.articleUrl,
    ...record.officialSources.map((source) => source.url),
  ];

  return {
    ...work,
    description: record.ruDescription,
    sources: mergeSources(work.sources, [
      articleSource,
      ...record.officialSources,
    ]),
    translations: {
      ...work.translations,
      ru: {
        ...work.translations?.ru,
        locale: "ru",
        title: work.translations?.ru?.title || "",
        description: record.ruDescription,
        sourceLanguage: "Russian",
        status: "draft",
        sourceUrls,
        method: "editorial-original",
        reviewedAt: editorialDate,
        descriptionProvenance: {
          origin: "article-adapted",
          sourceLanguage: "Russian",
          sourceCountry: "russia",
          sourceUrls,
          sourceArticle: {
            articleId: record.identity.articleId,
            url: record.identity.articleUrl,
            revisionId: record.identity.revisionSha256,
            sourceHash: record.identity.articleSha256,
            excerptHash: record.identity.excerptSha256,
          },
          transformations: [
            "condensed",
            "deduplicated",
            "spoiler-limited",
            "style-edited",
          ],
          rights: {
            textOrigin: "project-owned-article",
            copiedSourceText: false,
          },
          author: editorialAuthor,
          createdAt: editorialDate,
          reviewedBy: editorialAuthor,
          reviewedAt: editorialDate,
        },
      },
      en: {
        ...work.translations?.en,
        locale: "en",
        title: work.translations?.en?.title || "",
        description: record.enDescription,
        sourceLanguage: "Russian",
        status: "draft",
        sourceUrls,
        method: "human-translation",
        reviewedAt: editorialDate,
        descriptionProvenance: {
          origin: "human-translation",
          sourceLanguage: "Russian",
          sourceCountry: "russia",
          sourceUrls,
          translatedFromLocale: "ru",
          translatedFromSourceHash: record.translatedFromSourceHash,
          rights: {
            textOrigin: "project-original",
            copiedSourceText: false,
          },
          author: editorialAuthor,
          createdAt: editorialDate,
          reviewedBy: editorialAuthor,
          reviewedAt: editorialDate,
        },
      },
    },
    editorial: { status: "draft" },
  };
}

export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH29_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 29";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH29_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

interface ReviewInput {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly decision: WriterBiographyFactReviewDecision;
  readonly evidence: readonly WriterBiographyClaimEvidence[];
  readonly notes?: string;
}

function evidence(
  provider: string,
  url: string,
  findingRu: string
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

function review(input: ReviewInput): ReviewBase {
  const verdict: WriterBiographyClaimVerdict =
    input.decision === "held"
      ? "not-established"
      : input.decision === "unchanged"
        ? "supported"
        : "corrected";
  const defaultNotes = input.decision === "unchanged"
    ? "Все конкретные утверждения исходного краткого текста подтверждены двумя независимыми институциональными источниками; текст сохранён дословно. Shared country files не изменялись."
    : "Оценочная или слишком общая формулировка заменена проверяемыми сведениями о роли и произведениях. Shared country files не изменялись.";
  return {
    key: input.key,
    originalSha256: input.originalSha256,
    reviewedTextRu: input.reviewedTextRu,
    claims: [{
      textRu: input.reviewedTextRu,
      verdict,
      evidence: input.evidence,
    }],
    reviewer,
    decision: input.decision,
    notes: input.notes ?? defaultNotes,
  };
}

const writerBiographyFactReviewBatch29Base = [
  review({
    key: "france:simone_de_beauvoir",
    originalSha256: "5be2ac40e0b889bf5ff71bfb410308302b7ad7fb11b5cba5f79b03e038c9b0f8",
    reviewedTextRu: "Французская писательница и философ, автор книги «Второй пол» и романа «Мандарины».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11890854p", "Авторитетная запись BnF определяет Симону де Бовуар как французскую писательницу и философа и связывает с ней «Второй пол» и «Мандарины»."),
      evidence("Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/archives/fall2022/entries/beauvoir/", "Академическая энциклопедия Стэнфордского университета независимо подтверждает философскую и писательскую деятельность де Бовуар и называет обе книги среди её основных работ."),
    ],
  }),
  review({
    key: "france:stendhal",
    originalSha256: "5f04810a4b5ebfa01bea2ed2e90be5595f3bc6183bfdd308ef4af83d72706755",
    reviewedTextRu: "Французский писатель, автор романов «Красное и чёрное» и «Пармская обитель».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119255047", "Авторитетная запись BnF фиксирует Стендаля как французского писателя и атрибутирует ему «Красное и чёрное» и «Пармскую обитель»."),
      evidence("Musée Stendhal de Grenoble", "https://musee-stendhal.bm-grenoble.fr/MUSEESTENDHAL/basicfilesdownload.ashx?itemGuid=2F323326-3A99-4279-9C45-9F35D7537D4D", "Официальный музей Стендаля независимо называет его писателем и указывает «Красное и чёрное» и «Пармскую обитель» среди его романов."),
    ],
  }),
  review({
    key: "france:sully_prudhomme",
    originalSha256: "c272426fb6cd26e3e5e65e6564e3c7199b00c7f81565b1b38907126d19edd779",
    reviewedTextRu: "Французский поэт и эссеист, первый лауреат Нобелевской премии по литературе (1901).",
    decision: "corrected",
    evidence: [
      evidence("The Nobel Prize", "https://www.nobelprize.org/prizes/literature/1901/prudhomme/facts/", "Официальная запись Нобелевской премии подтверждает, что Сюлли-Прюдом был французским поэтом и первым лауреатом премии по литературе в 1901 году."),
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/armand-prudhomme-dit-sully-prudhomme", "Биографическая страница Французской академии независимо подтверждает его поэтическую и эссеистическую деятельность и присуждение первой Нобелевской премии по литературе."),
    ],
  }),
  review({
    key: "france:victor_hugo",
    originalSha256: "8b134d3b5791d84dc0552a39c7c2fd6e1b98816083ba5da3e8daede2f82b5ab4",
    reviewedTextRu: "Французский поэт, прозаик и драматург, автор романов «Собор Парижской Богоматери» и «Отверженные».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb313699180.public", "Каталог BnF фиксирует литературные роли Виктора Гюго и атрибутирует ему оба названных романа."),
      evidence("Maisons de Victor Hugo - Paris Musées", "https://www.maisonsvictorhugo.paris.fr/en/paris/museum/find-out-more-about-victor-hugo/des-questions-sur-la-vie-de-victor-hugo", "Официальный музейный профиль независимо характеризует Гюго как поэта, романиста и драматурга и связывает с ним «Собор Парижской Богоматери» и «Отверженных»."),
    ],
  }),
  review({
    key: "france:voltaire",
    originalSha256: "3855577c5280a3b17e103fb4f394e149b11b42d22b749c60e72a10414afe42cc",
    reviewedTextRu: "Французский писатель, философ и историк эпохи Просвещения, автор философской повести «Кандид».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11928669t.public", "Авторитетная запись BnF подтверждает писательскую, философскую и историческую деятельность Вольтера и его авторство «Кандида»."),
      evidence("Voltaire Foundation, University of Oxford", "https://www.voltaire.ox.ac.uk/about-voltaire/", "Исследовательский центр Оксфордского университета независимо описывает Вольтера как автора и мыслителя Просвещения и относит «Кандида» к его произведениям."),
    ],
    notes: "Оценочный суперлатив заменён проверяемыми ролями и произведением. Отдельная дата-рекомендация не предлагается: авторитетные источники сохраняют разночтение между 1694-02-20 и 1694-11-21. Shared country files не изменялись.",
  }),
  review({
    key: "french_guiana:leon_gontran_damas",
    originalSha256: "c4ccb3bdeded262025007386d3dbe60cad7725a7b3c00c04068ebf547327bf07",
    reviewedTextRu: "Французско-гвианский поэт и эссеист, участник движения негритюда и автор сборника «Pigments».",
    decision: "corrected",
    evidence: [
      evidence("Assemblée nationale", "https://www.assemblee-nationale.fr/histoire/Damas.asp", "Официальная биография Национального собрания Франции подтверждает гвианское происхождение Дамаса, его поэтическую деятельность и участие в формировании негритюда."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11898508m", "Авторитетная запись BnF независимо называет Дамаса поэтом, связывает его с негритюдом и атрибутирует ему сборник «Pigments»."),
    ],
  }),
  review({
    key: "gabon:angele_rawiri",
    originalSha256: "9da07984327794ceaf4e6dc1b02acf989d919e4e34682f77cccc1cf3e7c170d8",
    reviewedTextRu: "Габонская писательница, автор романов «Elonga» и «Fureurs et cris de femmes».",
    decision: "corrected",
    evidence: [
      evidence("University of Western Australia - African Literature", "https://aflit.arts.uwa.edu.au/AMINARawiri.html", "Университетский справочник подтверждает габонское происхождение Анжель Равири и её авторство романов «Elonga» и «Fureurs et cris de femmes»."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/affiner.do?afficheRegroup=false&critereRecherche=&index=TOUS3&listeAffinages=FacNatDocIMP_aMON&motRecherche=&nbResultParPage=100&numNotice=34227375&triResultParPage=5&trouveDansFiltre=NoticePUB&typeNotice=C", "Каталог BnF независимо атрибутирует Равири оба названных романа и фиксирует её как автора текста."),
    ],
  }),
  review({
    key: "gabon:florentin_moussavou_nzigu",
    originalSha256: "eca23bcc5dd6950a03405e638f9f111fc37aa519a01b2565bc632a3cfa6730e8",
    reviewedTextRu: "Точная литературная личность «Флорентен Муссаву Нзигу» не установлена: официальные записи относятся к габонскому политику и деятелю образования Флорентену Муссаву.",
    decision: "held",
    evidence: [
      evidence("Journal officiel de la République gabonaise", "https://journal-officiel.ga/3241-0487-pr-pm/", "Официальный журнал Габона идентифицирует Флорентена Муссаву как государственного деятеля; литературная роль и форма имени Nzigu в записи не подтверждены."),
      evidence("CONFEMEN", "https://www.confemen.org/wp-content/uploads/2022/11/Actes-de-la-57-session-ministerielle-Gabon2016.pdf", "Межправительственная организация по образованию независимо фиксирует Флорентена Муссаву как министра образования Габона, но не как писателя и без компонента Nzigu."),
    ],
    notes: "Identity held: exact literary identity, фамилия Nzigu и указанная в карточке дата рождения 1965 не установлены. Источники подтверждают другого публичного деятеля с близким именем; автоматическое применение текста запрещено. Shared country files не изменялись.",
  }),
  review({
    key: "gabon:juste_auguste_kotto",
    originalSha256: "d18eb912f164b1a82575547869c0ba1f5a3fdf855d4e56677961705bea79d0ce",
    reviewedTextRu: "Литературная личность «Жюст-Огюст Котто» не установлена в авторитетных библиотечных каталогах.",
    decision: "held",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Juste-Auguste+Kotto&critereRecherche=0&depart=0&facetteModifiee=ok", "Точный поиск по каталогу BnF не выявляет авторитетной записи или произведений, позволяющих подтвердить указанного габонского поэта."),
      evidence("WorldCat", "https://search.worldcat.org/search?q=%22Juste-Auguste%20Kotto%22", "Независимый поиск в сводном библиотечном каталоге WorldCat также не даёт надёжной авторской записи для точного имени."),
    ],
    notes: "Identity held: точное имя, даты и литературная библиография не установлены двумя независимыми библиотечными каталогами. Автоматическое применение текста запрещено; требуется первичный габонский источник. Shared country files не изменялись.",
  }),
  review({
    key: "gabon:laurent_owondo",
    originalSha256: "a42b9d2ae14e8641139d2e8cff8637ae4a59f452de875c117b0ebc9b5a4d93c6",
    reviewedTextRu: "Габонский писатель и драматург, автор романа «Au bout du silence».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12478222c", "Авторитетная запись BnF подтверждает габонскую принадлежность, писательскую и драматургическую деятельность Лорана Овондо и его авторство «Au bout du silence»."),
      evidence("University of Western Australia - African Literature", "https://aflit.arts.uwa.edu.au/CountryGabonFR.html", "Университетский обзор литературы Габона независимо называет Овондо писателем и драматургом и связывает его с романом «Au bout du silence»."),
    ],
  }),
  review({
    key: "gabon:sylvie_ntsame",
    originalSha256: "21393b7b42d1a9250c635fe011f7374726f0cfee70f4fb93e5f4bfe5d681349a",
    reviewedTextRu: "Габонская писательница и издательница, автор романа «La Fille du Komo» и сборника сказок «Le soir autour du feu».",
    decision: "corrected",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb45122804t", "Каталог BnF фиксирует Сильви Нтсаме как габонского автора и атрибутирует ей «La Fille du Komo» и «Le soir autour du feu»."),
      evidence("University of Western Australia - African Literature", "https://aflit.arts.uwa.edu.au/NtsameSylvieEng.html", "Университетский профиль независимо подтверждает её писательскую и издательскую деятельность и называет оба произведения."),
    ],
  }),
  review({
    key: "gambia:baaba_jobarteh",
    originalSha256: "1beb4c7f0fee63fd1617e65fb424fb4d29ed3c7c1d2ed3c5c5ded5461f6e38c6",
    reviewedTextRu: "Литературная личность «Бааба Джобарте» не установлена: институциональные источники различают сенегальского музыканта Баабу Маала и гамбийскую музыкальную семью Джобарте.",
    decision: "held",
    evidence: [
      evidence("Goethe-Institut", "https://www.goethe.de/en/m/uun/pub/akt/21737439.html", "Институт Гёте идентифицирует Баабу Маала как сенегальского музыканта; литературная личность Baaba Jobarteh этим источником не подтверждается."),
      evidence("Library and Archives Canada", "https://www.collectionscanada.gc.ca/obj/thesescanada/vol2/002/MR64998.PDF", "Университетская работа в национальном репозитории описывает гамбийскую традицию гриотов Джобарте как музыкальную, не устанавливая писателя с точным именем Baaba Jobarteh."),
    ],
    notes: "Identity held: карточка, вероятно, соединяет имена разных представителей западноафриканской музыкальной традиции. Точная писательская идентичность и библиография не установлены; автоматическое применение текста запрещено. Shared country files не изменялись.",
  }),
  review({
    key: "gambia:lenrie_peters",
    originalSha256: "675d77b1e0d8fbb7930a8a1cfba07cfdd6e5f65b416d4baa429e4377f78a4444",
    reviewedTextRu: "Гамбийский поэт и прозаик, автор романа «The Second Round» и сборника «Satellites».",
    decision: "corrected",
    evidence: [
      evidence("Bloomsbury Publishing", "https://www.bloomsbury.com/UK/author/lenrie-peters/", "Издательский профиль подтверждает гамбийское происхождение Ленри Питерса, его работу в поэзии и прозе и авторство «The Second Round» и «Satellites»."),
      evidence("OpenEdition Journals", "https://journals.openedition.org/ces/9465", "Академическая публикация независимо характеризует Питерса как гамбийского поэта и романиста и рассматривает оба названных произведения."),
    ],
  }),
  review({
    key: "gambia:nana_grey_johnson",
    originalSha256: "7ffd30f8d8fd467669d07d5627a06dc75de7a11907d7a6561a9d4139936bc8e8",
    reviewedTextRu: "Гамбийский писатель и журналист, автор книг «The Magic Calabash» и «Edward Francis Small: Watchdog of The Gambia».",
    decision: "corrected",
    evidence: [
      evidence("University of The Gambia", "https://www.utg.edu.gm/7015-2/", "Университет Гамбии называет Нану Грея-Джонсона писателем и журналистом и приводит обе книги в его библиографии."),
      evidence("WorldCat", "https://search.worldcat.org/title/The-magic-calabash/oclc/45606984", "Сводный библиотечный каталог независимо атрибутирует Грею-Джонсону «The Magic Calabash»; связанные авторские записи подтверждают вторую документальную книгу."),
    ],
  }),
  review({
    key: "gambia:tijan_sallah",
    originalSha256: "180b43551fe293fa961e0bd505253733384f28a99b8eba11b1c43574287a52ec",
    reviewedTextRu: "Гамбийский поэт, прозаик и литературный критик, автор сборников «Kora Land» и «Dream Kingdom».",
    decision: "corrected",
    evidence: [
      evidence("World Bank", "https://blogs.worldbank.org/en/team/t/tijan-sallah", "Профиль Всемирного банка подтверждает гамбийское происхождение Тиджана Саллы, его работу как поэта, прозаика и критика и называет «Kora Land» и «Dream Kingdom»."),
      evidence("University of The Gambia", "https://www.utg.edu.gm/7015-2/", "Университет Гамбии независимо перечисляет литературные роли Саллы и оба названных поэтических сборника."),
    ],
  }),
  review({
    key: "georgia:aka_morchiladze",
    originalSha256: "510131fcf1ce75264f56ae6e3b3836996e8ade88c7d2ddc91e6d5a34ddcce55d",
    reviewedTextRu: "Грузинский писатель, публикующийся под псевдонимом Ака Морчиладзе; автор романа «Путешествие в Карабах».",
    decision: "corrected",
    evidence: [
      evidence("University of Georgia", "https://www.ug.edu.ge/en/honor/Ak%20Morchiladze%28GiorgiAkhvlediani%29", "Университет Грузии подтверждает, что Георгий Ахвледиани публикуется как Ака Морчиладзе, и связывает его с романом «Путешествие в Карабах»."),
      evidence("Sulakauri Publishing", "https://rights.sulakauri.ge/portfolio/aka-morchiladze/", "Грузинский издатель независимо подтверждает псевдоним, писательскую деятельность и авторство «Journey to Karabakh»."),
    ],
  }),
  review({
    key: "georgia:akaki_tsereteli",
    originalSha256: "edddf739c445fe1326674731bab1a851dac101a5fb5e411857b6e4adae464d7b",
    reviewedTextRu: "Грузинский поэт и прозаик, автор стихотворения «Сулико» и автобиографической книги «Пережитое».",
    decision: "corrected",
    evidence: [
      evidence("National Archives of Georgia", "https://www.archive.gov.ge/en/akaki-tsereteli-180-1", "Национальный архив Грузии документирует поэтическую и прозаическую деятельность Акакия Церетели и связывает его с «Сулико» и мемуарным произведением «Пережитое»."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb14142220c", "Авторитетная запись BnF независимо фиксирует Церетели как грузинского поэта и автора, а библиографические связи подтверждают названные произведения."),
    ],
  }),
  review({
    key: "georgia:galaktion_tabidze",
    originalSha256: "60420ecbaf51e01343c766a3b91e4d9640633abf87365cf0e84325e28c5ed421",
    reviewedTextRu: "Грузинский поэт; его первый сборник стихов вышел в 1914 году, а второй - в 1919 году.",
    decision: "corrected",
    evidence: [
      evidence("National Archives of Georgia", "https://www.archive.gov.ge/en/galaktioni-1", "Национальный архив Грузии называет Табидзе поэтом и документирует выход первого сборника в 1914 году и второго сборника в 1919 году."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb13522161t", "Авторитетная запись BnF независимо фиксирует Галактиона Табидзе как грузинского поэта и связывает с ним издания его поэтических сборников."),
    ],
    notes: "Date recommendation: карточка содержит birthDate 1892-11-17, однако метрическая запись Национального архива указывает 1891-11-05 по старому стилю, то есть 1891-11-17 по григорианскому календарю. Рекомендуется shared birthDate 1891-11-17 после отдельной интеграционной проверки; shared country files не изменялись.",
  }),
  review({
    key: "georgia:ilia_chavchavadze",
    originalSha256: "9934c27787b8df6622e5242e6dc4c4c5f8d45208354641af3665e89ddd230c2e",
    reviewedTextRu: "Грузинский писатель, поэт, публицист и общественный деятель.",
    decision: "corrected",
    evidence: [
      evidence("Georgia Travel - National Tourism Administration", "https://georgia.travel/ilia-chavchavadze-museum", "Официальный государственный портал характеризует Илью Чавчавадзе как грузинского писателя, поэта, публициста и общественного деятеля."),
      evidence("National Parliamentary Library of Georgia", "https://dspace.nplg.gov.ge/handle/1234/3771", "Национальная парламентская библиотека Грузии независимо документирует литературную, публицистическую и общественную деятельность Чавчавадзе."),
    ],
  }),
  review({
    key: "georgia:konstantine_gamsakhurdia",
    originalSha256: "a9a43d5f3ad1b39eb5c838abd89a8c04767334860607896714b39caeaee55886",
    reviewedTextRu: "Грузинский писатель, автор романа «Десница великого мастера».",
    decision: "corrected",
    evidence: [
      evidence("Georgian Encyclopedia", "https://www.georgianencyclopedia.ge/en/form_eng/606", "Научная редакция Грузинской энциклопедии определяет Константина Гамсахурдиа как писателя и атрибутирует ему роман «Десница великого мастера»."),
      evidence("WorldCat", "https://search.worldcat.org/pt/title/didostatis-konstantines-marjvena-romani/oclc/605966178", "Сводный библиотечный каталог независимо фиксирует Гамсахурдиа автором романа Didostatis Konstantines marjvena, известного по-русски как «Десница великого мастера»."),
    ],
  }),
  review({
    key: "georgia:nodar_dumbadze",
    originalSha256: "89dbc0231a25b3b83a3fd3c36c3b6ff4fd8e6770242a85bf975666b868fd2cb3",
    reviewedTextRu: "Грузинский писатель, автор романов «Я, бабушка, Илико и Илларион» и «Я вижу солнце».",
    decision: "corrected",
    evidence: [
      evidence("Georgian Encyclopedia", "https://georgianencyclopedia.ge/en/form_eng/674", "Научная редакция Грузинской энциклопедии определяет Нодара Думбадзе как писателя и перечисляет оба названных романа."),
      evidence("WorldCat", "https://search.worldcat.org/title/Me-Bebia-Iliko-da-Ilarioni-%3A-Me-vxedav-mzes-Mziani-ame/oclc/255926573", "Сводный библиотечный каталог независимо атрибутирует Думбадзе «Я, бабушка, Илико и Илларион» и «Я вижу солнце»."),
    ],
  }),
  review({
    key: "georgia:otar_chiladze",
    originalSha256: "fad12c02fc042e21215398060a446026fb92d547292daeb2262439e947805d0d",
    reviewedTextRu: "Грузинский поэт и прозаик, автор романа «Шёл по дороге человек».",
    decision: "corrected",
    evidence: [
      evidence("Writers' House of Georgia", "https://writershouse.ge/uploads/katalogi/BOOKS_FROM_GEORGIA_2020_gvadalakhara_27.09.21.pdf", "Каталог Дома писателей Грузии характеризует Отара Чиладзе как поэта и романиста и атрибутирует ему «A Man Was Going Down the Road»."),
      evidence("WorldCat", "https://search.worldcat.org/es/title/caminaba-un-hombre-novela/oclc/48297446?ht=edition&referer=di", "Сводный библиотечный каталог независимо фиксирует Чиладзе автором романа, издаваемого по-русски как «Шёл по дороге человек»."),
    ],
  }),
  review({
    key: "georgia:shota_rustaveli",
    originalSha256: "1a568e913764f9f10c42d176a40ae1cedb44ceda69708d0b563eaa165033b246",
    reviewedTextRu: "Грузинский придворный поэт рубежа XII-XIII веков, автор поэмы «Витязь в тигровой шкуре».",
    decision: "corrected",
    evidence: [
      evidence("Georgian Encyclopedia", "https://www.georgianencyclopedia.ge/en/form_eng/903", "Научная редакция Грузинской энциклопедии описывает Руставели как придворного поэта рубежа XII-XIII веков и автора «Витязя в тигровой шкуре»."),
      evidence("UNESCO Memory of the World", "https://www.unesco.org/en/memory-world/manuscript-collection-shota-rustavelis-poem-knight-panthers-skin", "ЮНЕСКО независимо атрибутирует Шоте Руставели поэму «Витязь в тигровой шкуре» и связывает её с грузинской средневековой традицией."),
    ],
    notes: "Identity recommendation: очередь QA указывает Q132984; энциклопедия Грузинской национальной академии наук и UNESCO подтверждают именно литературную личность Шоты Руставели и её связь с поэмой. Рекомендуется подтвердить Q132984 при интеграции; shared country files не изменялись.",
  }),
  review({
    key: "georgia:vazha_pshavela",
    originalSha256: "e4ab6bbd9a4b897fb443d8e92fad5d3598a3ff964fe1901ee776f5d9d1b4ca22",
    reviewedTextRu: "Грузинский поэт и прозаик, публиковавшийся под псевдонимом Важа-Пшавела; настоящее имя - Лука Разикашвили.",
    decision: "corrected",
    evidence: [
      evidence("National Archives of Georgia", "https://www.archive.gov.ge/en/vazha-fshavela-1", "Национальный архив Грузии подтверждает литературные роли Важи-Пшавелы и приводит его настоящее имя Лука Разикашвили."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb16836992d", "Авторитетная запись BnF независимо связывает псевдоним Важа-Пшавела с Лукой Разикашвили и фиксирует его как грузинского автора."),
    ],
  }),
  review({
    key: "germany:alfred_doblin",
    originalSha256: "833bdeb937a6a29bec926b1ed37a899b85356fcf14917b048a5b64b1999f2c8d",
    reviewedTextRu: "Немецкий писатель и врач, автор романа «Берлин Александрплац».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118526200.html", "Национальный биографический справочник Германии подтверждает врачебную и писательскую деятельность Альфреда Дёблина и его авторство «Берлин Александрплац»."),
      evidence("Berlin.de", "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/geschichte/persoenlichkeiten-und-gedenktafeln/artikel.125510.php", "Официальный портал Берлина независимо называет Дёблина врачом и писателем и связывает с ним роман «Berlin Alexanderplatz»."),
    ],
  }),
  review({
    key: "germany:andreas_gryphius",
    originalSha256: "a15f3250f52f239184d30253a516c9e3a0519240aa450a3cbae15aee2ef16dc6",
    reviewedTextRu: "Немецкий поэт и драматург эпохи барокко, автор сонетов и трагедии «Лев Армянин».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz24414.html", "Национальный биографический справочник характеризует Андреаса Грифиуса как поэта и драматурга немецкого барокко и перечисляет его сонеты и трагедию «Leo Armenius»."),
      evidence("Deutsche Digitale Bibliothek", "https://www.deutsche-digitale-bibliothek.de/item/C65XAODNXASNETD655RCNKSD5MFDN6OD", "Немецкая цифровая библиотека независимо атрибутирует Грифиусу трагедию «Leo Armenius»; связанные оцифрованные издания документируют его книги сонетов."),
    ],
  }),
  review({
    key: "germany:anna_seghers",
    originalSha256: "0d06e685f68207be4e7514e44edd37cfb8ea439675cc8c178aadcfa4bfd25284",
    reviewedTextRu: "Немецкая писательница, известная произведениями о фашизме, эмиграции и сопротивлении.",
    decision: "unchanged",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/pnd118612743.html", "Национальный биографический справочник подтверждает писательскую деятельность Анны Зегерс, её эмиграцию и устойчивую тематическую связь произведений с национал-социализмом и сопротивлением."),
      evidence("German Historical Museum", "https://www.dhm.de/lemo/biografie/anna-seghers", "Немецкий исторический музей независимо описывает её как писательницу эмиграции и документирует произведения о фашизме и антифашистском сопротивлении."),
    ],
  }),
  review({
    key: "germany:bernhard_schlink",
    originalSha256: "f9638d1e458fffb16943d4c1006490799c9021712e6b7b945f20b83dfc0f17aa",
    reviewedTextRu: "Немецкий писатель и юрист, автор современных романов о памяти и исторической ответственности.",
    decision: "unchanged",
    evidence: [
      evidence("Diogenes Verlag", "https://www.diogenes.ch/leser/autoren/s/bernhard-schlink.html", "Официальный издательский профиль подтверждает, что Бернхард Шлинк - немецкий юрист и писатель, чьи романы обращаются к памяти о национал-социалистическом прошлом и ответственности."),
      evidence("Rowohlt Theater Verlag", "https://www.rowohlt-theaterverlag.de/autor/bernhard-schlink-4308", "Независимый издательский профиль подтверждает юридическую и литературную деятельность Шлинка и тематическую связь его прозы с памятью и исторической ответственностью."),
    ],
  }),
  review({
    key: "germany:bertolt_brecht",
    originalSha256: "5d666fd3e0537ba3892c67f45d7dbc1455201cf17c5d202629e20bdde04bfbc7",
    reviewedTextRu: "Немецкий драматург, поэт и режиссёр, разработавший принципы эпического театра.",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/118514768.html", "Национальный биографический справочник подтверждает драматургическую, поэтическую и режиссёрскую деятельность Брехта и его работу над эпическим театром."),
      evidence("German Historical Museum", "https://www.dhm.de/lemo/biografie/bertolt-brecht", "Немецкий исторический музей независимо характеризует Брехта как драматурга, поэта и театрального деятеля и связывает его с развитием эпического театра."),
    ],
  }),
  review({
    key: "germany:christa_wolf",
    originalSha256: "f37e16f289f9834fbb7d6e10a75c01695aa699dcee6501b69f240e9068bfc1f3",
    reviewedTextRu: "Немецкая писательница и эссеист, автор повестей «Размышления о Кристе Т.» и «Кассандра».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118634666.html", "Национальный биографический справочник подтверждает писательскую и эссеистическую деятельность Кристы Вольф и атрибутирует ей «Размышления о Кристе Т.» и «Кассандру»."),
      evidence("Haus der Geschichte", "https://www.hdg.de/lemo/biografie/christa-wolf.html", "Фонд Дома истории ФРГ независимо называет Вольф писательницей и связывает её биографию с обоими произведениями."),
    ],
  }),
  review({
    key: "germany:christoph_martin_wieland",
    originalSha256: "ae6649e97a13142d49641b9c88bf7f4dea130d49a2898a7297f30dfd87572983",
    reviewedTextRu: "Немецкий писатель, поэт, переводчик и издатель эпохи Просвещения, автор поэмы «Оберон».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118632477.html?language=en", "Национальный биографический справочник фиксирует Виланда как писателя, поэта, переводчика и издателя эпохи Просвещения и атрибутирует ему «Оберона»."),
      evidence("Wieland-Museum Biberach", "https://wieland-museum.de/de/christoph-martin-wieland.html", "Официальный музей Виланда независимо подтверждает его литературные и издательские роли и авторство поэмы «Oberon»."),
    ],
  }),
  review({
    key: "germany:daniel_kehlmann",
    originalSha256: "f82cd07c11b5187f92b69b084f6d534fce19d3fd93dce9d0de1188dab394df18",
    reviewedTextRu: "Немецко-австрийский писатель, автор романа «Измеряя мир».",
    decision: "corrected",
    evidence: [
      evidence("Rowohlt Verlag", "https://www.rowohlt.de/verlag/rights/book/daniel-kehlmann-die-vermessung-der-welt-9783498035280", "Официальная издательская страница подтверждает немецко-австрийскую биографию Даниэля Кельмана и его авторство романа «Die Vermessung der Welt»."),
      evidence("Penguin Random House", "https://www.penguinrandomhouse.com/books/90945/measuring-the-world-by-daniel-kehlmann/", "Независимый издатель атрибутирует Кельману роман «Measuring the World» и характеризует его как немецкоязычного романиста австрийско-немецкого происхождения."),
    ],
  }),
  review({
    key: "germany:eduard_morike",
    originalSha256: "28e6b21b185b5a7ef837c09727ec28d770a70f3dc7fcb3bd56abb9f7ee72a415",
    reviewedTextRu: "Немецкий поэт и прозаик, автор романа «Художник Нольтен» и повести «Моцарт на пути в Прагу».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz64060.html", "Национальный биографический справочник подтверждает поэтическую и прозаическую деятельность Эдуарда Мёрике и атрибутирует ему «Художника Нольтена» и «Моцарта на пути в Прагу»."),
      evidence("Goethe-Institut", "https://www.goethe.de/lrn/prj/mlg/mad/mdj/de9038516.htm", "Институт Гёте независимо представляет Мёрике как немецкого поэта и прозаика и связывает его с «Моцартом на пути в Прагу»; библиографический профиль включает «Художника Нольтена»."),
    ],
  }),
  review({
    key: "germany:erich_maria_remarque",
    originalSha256: "8bce9bc59a4d1c70b3ed513fdfe16b7a3a8ba20bbebbd306c496cc5f8a2b3268",
    reviewedTextRu: "Немецкий писатель, автор романов «На Западном фронте без перемен» и «Три товарища».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz105266.html", "Национальный биографический справочник определяет Эриха Марию Ремарка как немецкого писателя и атрибутирует ему оба названных романа."),
      evidence("Erich Maria Remarque-Friedenszentrum Osnabrück", "https://www.remarque.de/de/der-mensch-remarque/biografie/", "Официальный исследовательский центр Ремарка независимо подтверждает его писательскую деятельность и авторство «На Западном фронте без перемен» и «Трёх товарищей»."),
    ],
  }),
  review({
    key: "germany:franz_kafka",
    originalSha256: "f01b17f086a0cf0dd4fa384403a33bac28022c1a6f6cd5d3f3baf44ce01f9128",
    reviewedTextRu: "Немецкоязычный писатель из Праги, автор повести «Превращение» и романа «Процесс».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz39467.html", "Национальный биографический справочник подтверждает пражское происхождение и немецкоязычное творчество Кафки и атрибутирует ему «Превращение» и «Процесс»."),
      evidence("Franz Kafka Museum Prague", "https://kafkamuseum.cz/en/biography", "Официальный музей Кафки независимо описывает его как немецкоязычного пражского писателя и связывает с обоими произведениями."),
    ],
  }),
  review({
    key: "germany:friedrich_schiller",
    originalSha256: "bf69ce61b5368cf6d1529ac76aa7296a5ee574a33fa5f63873dc7b9f43a05215",
    reviewedTextRu: "Немецкий поэт, драматург, философ и историк, автор пьес «Разбойники» и «Дон Карлос».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118607626.html", "Национальный биографический справочник фиксирует поэтическую, драматургическую, философскую и историческую деятельность Шиллера и атрибутирует ему обе пьесы."),
      evidence("Schillerhäuschen Dresden", "https://schiller-dresden.de/en/museum/about-us", "Официальный музей Шиллера независимо подтверждает его деятельность как поэта и драматурга; музейный контекст и каталог связывают его с «Разбойниками» и «Дон Карлосом»."),
    ],
  }),
  review({
    key: "germany:gerhart_hauptmann",
    originalSha256: "7fe1a2ab1efbae819e0b3328c268078f68110e0df3e1dbc34b150411bf68c820",
    reviewedTextRu: "Немецкий драматург и писатель, лауреат Нобелевской премии по литературе 1912 года.",
    decision: "unchanged",
    evidence: [
      evidence("The Nobel Prize", "https://www.nobelprize.org/prizes/literature/1912/hauptmann/facts/", "Официальная запись Нобелевской премии подтверждает, что Герхарт Гауптман был немецким драматургом и писателем и получил премию по литературе в 1912 году."),
      evidence("Gerhart Hauptmann Museum", "https://muzeum-dgh.pl/infokiosk-1/en-index/about-the-museum-and-the-exhibition/", "Официальный музейный профиль независимо подтверждает литературные роли Гауптмана и присуждение ему Нобелевской премии 1912 года."),
    ],
  }),
  review({
    key: "germany:grimmelshausen",
    originalSha256: "8e3b7ae4449d500c4476b601635bd7d258a55692e2fe46665cadb497dc3f97ab",
    reviewedTextRu: "Немецкий писатель эпохи барокко, автор романа «Симплициссимус».",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz23805.html", "Национальный биографический справочник определяет Гриммельсгаузена как немецкого писателя барокко и атрибутирует ему «Симплициссимус»."),
      evidence("Grimmelshausen 2026", "https://www.grimmelshausen2026.de/", "Официальный межмуниципальный памятный проект независимо связывает писателя эпохи барокко Гриммельсгаузена с романом «Der abenteuerliche Simplicissimus»."),
    ],
  }),
  review({
    key: "germany:guenter_grass",
    originalSha256: "7e03213179b34db11521130d6d7fc5fa0ac685f2d4e35cf976653dbe5f973e07",
    reviewedTextRu: "Немецкий писатель, поэт и художник, лауреат Нобелевской премии по литературе 1999 года.",
    decision: "unchanged",
    evidence: [
      evidence("The Nobel Prize", "https://www.nobelprize.org/prizes/literature/1999/grass/facts/", "Официальная запись Нобелевской премии подтверждает немецкую принадлежность Гюнтера Грасса, его литературную и художественную деятельность и премию 1999 года."),
      evidence("Günter Grass-Haus", "https://grass-house.com/home", "Официальный музей Гюнтера Грасса независимо характеризует его как писателя, поэта и визуального художника и подтверждает Нобелевскую премию по литературе 1999 года."),
    ],
  }),
  review({
    key: "germany:hans_sachs",
    originalSha256: "5b2532cb66d43f2f3ffd4a84cb689e902acc3d280e27a7be7e4d9817089a3d99",
    reviewedTextRu: "Немецкий поэт, драматург, мастерзингер и сапожник, работавший в Нюрнберге.",
    decision: "corrected",
    evidence: [
      evidence("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz77519.html", "Национальный биографический справочник подтверждает деятельность Ганса Сакса как поэта, драматурга, мастерзингера и сапожника в Нюрнберге."),
      evidence("City of Nuremberg", "https://www.nuernberg.de/internet/nuernbergkultur/hans_sachs_2026.html", "Официальный портал Нюрнберга независимо документирует его литературные роли, ремесло сапожника и связь с городом."),
    ],
  }),
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch29: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch29Base.map(finalizeReviewRecord);

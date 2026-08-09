export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH28_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 28";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH28_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

interface CorrectedRecordInput {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
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

function corrected(input: CorrectedRecordInput): ReviewBase {
  return {
    key: input.key,
    originalSha256: input.originalSha256,
    reviewedTextRu: input.reviewedTextRu,
    claims: [{
      textRu: input.reviewedTextRu,
      verdict: "corrected",
      evidence: input.evidence,
    }],
    reviewer,
    decision: "corrected",
    notes: input.notes ??
      "Расплывчатые и оценочные формулировки заменены проверяемыми сведениями о роли и произведениях. Shared country files не изменялись.",
  };
}

const writerBiographyFactReviewBatch28Base = [
  corrected({
    key: "france:balzac",
    originalSha256: "f6b605ec2374ced66e15b69714d29f4cc9ba4aa5d9060552548a0c64ea80edeb",
    reviewedTextRu: "Оноре де Бальзак — французский романист, драматург и литературный критик. Под общим названием «Человеческая комедия» он объединил десятки романов и повестей, включая «Отца Горио» и «Евгению Гранде».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/litterature/19e-siecle-1/c1c36ea9-6da6-43c6-b12e-ef774f4f4b79-realisme-et-naturalisme/personnalite/55eb0484-4ae6-4550-ab50-314eafc11fb0-honore-balzac", "Профиль BnF подтверждает литературные роли Бальзака, замысел «Человеческой комедии» и атрибуцию названных романов."),
      evidence("Paris Musées", "https://www.parismuseescollections.paris.fr/fr/expositions/balzac-et-les-artistes", "Муниципальное музейное объединение независимо связывает Бальзака с «Человеческой комедией» и документирует его писательскую деятельность."),
    ],
  }),
  corrected({
    key: "france:beaumarchais",
    originalSha256: "cf08eb82b2cb11a1a349980aaa6673a69679128c0d5b247ad8958690213071ef",
    reviewedTextRu: "Пьер-Огюстен Карон де Бомарше — французский драматург и публицист. Он написал связанные образом Фигаро комедии «Севильский цирюльник» и «Женитьба Фигаро»; позднее к ним присоединилась «Виновная мать».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://www.bnf.fr/fr/archives-de-beaumarchais", "Описание архива BnF подтверждает личность, литературную деятельность Бомарше и корпус произведений о Фигаро."),
      evidence("Comédie-Française", "https://www.comedie-francaise.fr/2007-2008/le-mariage-de-figaro-ou-la-folle-journee", "Материал национального театра независимо атрибутирует Бомарше «Женитьбу Фигаро» и помещает пьесу в связанный театральный цикл."),
    ],
  }),
  corrected({
    key: "france:boileau",
    originalSha256: "1118403575ba79f4822f5b68992144ee6a91af2fc4490445c2081dcf43a87be7",
    reviewedTextRu: "Никола Буало-Депрео — французский поэт и литературный критик XVII века, член Французской академии. В стихотворном трактате «Поэтическое искусство» он изложил принципы классицистической поэтики; к его произведениям также относятся «Сатиры» и «Налой».",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/nicolas-boileau-despreaux", "Академическая биография подтверждает членство Буало, его работу как поэта и критика и основные произведения."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb120405448", "Авторитетная запись BnF независимо подтверждает личность Буало-Депрео и атрибуцию его литературного корпуса."),
    ],
  }),
  corrected({
    key: "france:chateaubriand",
    originalSha256: "c55b95245a2c548f1621e5ffe39d4400b80c52033047b3b2fb2dbb1364412956",
    reviewedTextRu: "Франсуа-Рене де Шатобриан — французский писатель, публицист, дипломат и политический деятель. Он написал повести «Атала» и «Рене», трактат «Гений христианства» и мемуары «Замогильные записки».",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/francois-rene-de-chateaubriand", "Биография Академии подтверждает государственные и литературные роли Шатобриана и перечисленные произведения."),
      evidence("Maison de Chateaubriand — Département des Hauts-de-Seine", "https://vallee-aux-loups.hauts-de-seine.fr/la-maison-de-chateaubriand/histoire-du-domaine-chateaubriand/chateaubriand?showall=1", "Официальный музейный материал независимо документирует биографию Шатобриана и его основные книги."),
    ],
  }),
  corrected({
    key: "france:chretien_de_troyes",
    originalSha256: "fbfc99240c72b83cf96071a99f765c49dd19d65b06be51d7db5e9590dcfbe841",
    reviewedTextRu: "Кретьен де Труа — франкоязычный поэт второй половины XII века; достоверных сведений о его биографии сохранилось мало. Он написал рыцарские романы «Ивейн, или Рыцарь со львом», «Ланселот, или Рыцарь телеги» и незавершённый «Персеваль, или Повесть о Граале».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://cdn.essentiels.bnf.fr/uploads/media/attachment/20220321123022000000_quetesarthuriennes.pdf", "Материал BnF относит Кретьена ко второй половине XII века и подтверждает авторство артуровских романов, включая незавершённого «Персеваля»."),
      evidence("Yale University Press", "https://yalebooks.yale.edu/book/9780300133707/the-romances-of-chretien-de-troyes/", "Университетское издательство независимо перечисляет романы Кретьена и отмечает скудость надёжных биографических данных."),
    ],
    notes: "Identity-очередь Q4302 подтверждает Кретьена де Труа. Точные годы 1135–1185 документально не установлены: безопасна датировка второй половиной XII века; shared dates не изменялись.",
  }),
  corrected({
    key: "france:claude_simon",
    originalSha256: "6603fb553929122b285d63329c15139951cb36ec12c8ae169114ce0bfe7b0fad",
    reviewedTextRu: "Клод Симон — французский писатель, связанный с направлением «нового романа», лауреат Нобелевской премии по литературе 1985 года. Он написал романы «Дорога Фландрии», «История» и «Георгики».",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1985/simon/facts/", "Официальная Нобелевская запись подтверждает премию 1985 года, национальную принадлежность и библиографию Симона."),
      evidence("Les Éditions de Minuit", "https://leseditionsdeminuit.fr/unepage-historique-historique-1-1-0-1.html", "Издательский архив независимо связывает Клода Симона с «новым романом» и изданием названных произведений."),
    ],
  }),
  corrected({
    key: "france:corneille",
    originalSha256: "f0e573cdf3acf7005b33657f8649d21883ed2424cb80f760c3874e17b01889e3",
    reviewedTextRu: "Пьер Корнель — французский драматург XVII века, автор трагикомедии «Сид». К его трагедиям относятся «Гораций» и «Цинна».",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/pierre-corneille?wpmobileexternal=true", "Академическая биография подтверждает личность Корнеля, его драматургическую деятельность и названные пьесы."),
      evidence("Comédie-Française", "https://www.comedie-francaise.fr/en/2025-2026/le-cid", "Национальный театр независимо атрибутирует Корнелю «Сида» и документирует место пьесы в его театральном наследии."),
    ],
  }),
  corrected({
    key: "france:diderot",
    originalSha256: "fd20f0801ee6c4382113cf0c565ea59ee70b5d6070a4a65ad5f6a95967e6faf7",
    reviewedTextRu: "Дени Дидро — французский философ, писатель и художественный критик эпохи Просвещения. Вместе с Жаном Лероном д’Аламбером он редактировал «Энциклопедию»; среди его произведений — «Жак-фаталист и его хозяин» и «Племянник Рамо».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/focus/5f6a48ef-4e85-40d7-b752-0bb95cab434c-redacteurs-lencyclopedie", "BnF подтверждает редакторскую роль Дидро и д’Аламбера в истории «Энциклопедии» и литературную деятельность Дидро."),
      evidence("Ministère de la Culture", "https://www.culture.gouv.fr/regions/drac-grand-est/actu/an/2017/LABEL-Langres.-La-Maison-des-Lumieres-Denis-Diderot-labellisee-Maison-des-Illustres", "Материал Министерства культуры независимо описывает Дидро как философа, писателя и критика Просвещения и связывает его с «Энциклопедией»."),
    ],
  }),
  corrected({
    key: "france:emile_zola",
    originalSha256: "3da41b4135edb32a183404f1e94101d9921a902d7c6594583725087eeba9929c",
    reviewedTextRu: "Эмиль Золя — французский романист, журналист и литературный критик, развивавший принципы натурализма. Он создал двадцатитомный цикл «Ругон-Маккары» и в 1898 году опубликовал открытое письмо «Я обвиняю…!» в защиту Альфреда Дрейфуса.",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/litterature/19e-siecle-1/c1c36ea9-6da6-43c6-b12e-ef774f4f4b79-realisme-et-naturalisme/personnalite/849e1bc9-ba27-43ad-8899-4cc7eeae7303-emile-zola", "BnF подтверждает натуралистическую программу Золя, двадцать романов «Ругон-Маккаров» и его участие в деле Дрейфуса."),
      evidence("Maison Zola — Musée Dreyfus", "https://www.maisonzola-museedreyfus.com/maison-zola-musee-dreyfus/histoire-maison-emile-zola/", "Официальный музей независимо документирует писательскую и журналистскую деятельность Золя и публикацию «Я обвиняю…!»."),
    ],
  }),
  corrected({
    key: "france:flaubert",
    originalSha256: "6a168f1bf1a9e1893f59df5e51170c3cad1f4efe9aff1144435eb3fed8f2247a",
    reviewedTextRu: "Гюстав Флобер — французский романист и автор драматических произведений. Он написал романы «Госпожа Бовари», «Саламбо» и «Воспитание чувств».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/litterature/19e-siecle-1/c1c36ea9-6da6-43c6-b12e-ef774f4f4b79-realisme-et-naturalisme/personnalite/49113400-4be3-45eb-bd1a-95b712a84c99-gustave-flaubert", "Профиль BnF подтверждает литературную роль Флобера и атрибуцию трёх названных романов."),
      evidence("Université de Rouen Normandie — Centre Flaubert", "https://flaubert.univ-rouen.fr/", "Университетский исследовательский центр независимо документирует биографию, рукописи и библиографию Флобера."),
    ],
  }),
  corrected({
    key: "france:franck_thilliez",
    originalSha256: "c0b107b2e8f2eca32344f90a8079209a307d6003e6e0241cfde1715e9f44ae89",
    reviewedTextRu: "Франк Тилье — французский писатель и сценарист, автор детективных романов и триллеров. В его библиографию входят «Синдром E», «Пандемия» и «Норфервиль».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://www.bnf.fr/fr/mediatheque/franck-thilliez", "BnF подтверждает личность Тилье, его работу писателем и сценаристом и библиографию романов."),
      evidence("Simon & Schuster", "https://www.simonandschuster.com/authors/Franck-Thilliez/228575065", "Издательский профиль независимо описывает Тилье как французского автора триллеров и атрибутирует ему книги серии."),
    ],
    notes: "Identity-очередь Q779144 подтверждена институциональными источниками. Авторитетная запись BnF указывает birthDate 1973-10-15; рекомендация — сохранить эту дату. Shared country files не изменялись.",
  }),
  corrected({
    key: "france:francois_mauriac",
    originalSha256: "a63b33623f445f1e18cc92d901f8e1623fecc4bf1ad8b96a086dd2afdfe8f2f8",
    reviewedTextRu: "Франсуа Мориак — французский романист, драматург и журналист, избранный во Французскую академию в 1933 году. Он написал романы «Тереза Дескейру» и «Клубок змей» и получил Нобелевскую премию по литературе 1952 года.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1952/mauriac/facts/", "Официальная запись подтверждает премию 1952 года, литературные роли и произведения Мориака."),
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/francois-mauriac", "Академическая биография независимо подтверждает избрание в 1933 году и библиографию писателя."),
    ],
  }),
  corrected({
    key: "france:francois_rabelais",
    originalSha256: "f513b18ba8134443ff86e8bce91b43614451a90790689c419f70606665be8df1",
    reviewedTextRu: "Франсуа Рабле — французский писатель-гуманист эпохи Возрождения и врач. Он создал цикл о великанах Гаргантюа и Пантагрюэле, включающий «Пантагрюэля», «Гаргантюа», «Третью книгу» и «Четвёртую книгу».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/image/ba4a1b3b-ff25-4717-b0cc-3b4db4953ad1-gargantua-de-francois-rabelais", "BnF подтверждает авторство Рабле и место «Гаргантюа» в цикле о Гаргантюа и Пантагрюэле."),
      evidence("Musée Rabelais — Département d’Indre-et-Loire", "https://www.musee-rabelais.fr/", "Официальный музей независимо документирует Рабле как писателя-гуманиста и врача и представляет корпус книг цикла."),
    ],
    notes: "Identity-очередь Q131018 подтверждает Франсуа Рабле. Точный год рождения остаётся спорным в институциональных справках, поэтому рекомендация — не выводить его как установленную дату. Shared country files не изменялись.",
  }),
  corrected({
    key: "france:francois_villon",
    originalSha256: "f053fdb8d280bcaf3ba0c50a17016ed1f0268d7201b443bcbb3b0469cc803979",
    reviewedTextRu: "Франсуа Вийон — французский поэт XV века, чья биография после изгнания из Парижа в 1463 году документально не прослеживается. Его наследие включает «Малое завещание», «Большое завещание» и «Балладу повешенных».",
    evidence: [
      evidence("Poetry Foundation", "https://www.poetryfoundation.org/poets/francois-villon", "Биографическая справка подтверждает поэтическую деятельность Вийона, исчезновение документальных следов после 1463 года и названные произведения."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119284140", "Авторитетная запись BnF независимо подтверждает личность Вийона и атрибуцию его поэтического корпуса."),
    ],
  }),
  corrected({
    key: "france:frederic_mistral",
    originalSha256: "5602fb693e4a1c592e0ef346fe52eb77386bffaf515a13b363892522f586d97f",
    reviewedTextRu: "Фредерик Мистраль — провансальский поэт и лексикограф, писавший на окситанском языке и участвовавший в основании Фелибрижа. Он создал поэму «Мирей» и словарь «Сокровище Фелибрижа», а Нобелевскую премию 1904 года разделил с Хосе Эчегараем.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1904/mistral/facts/", "Официальная запись подтверждает премию 1904 года, разделённую с Эчегараем, язык и основные произведения Мистраля."),
      evidence("Félibrige", "https://www.felibrige.org/le-felibrige/", "Официальный ресурс объединения независимо подтверждает участие Мистраля в основании Фелибрижа и его работу для провансальского языка."),
    ],
  }),
  corrected({
    key: "france:george_sand",
    originalSha256: "275472df0102eeed0b96c0aa434a844913ddf9da04b167bbbb48d309dcfe9586",
    reviewedTextRu: "Жорж Санд — литературный псевдоним французской писательницы Амантины Авроры Люсиль Дюпен. Она впервые подписала этим именем роман «Индиана» в 1832 году; среди других её романов — «Консуэло» и «Мопра».",
    evidence: [
      evidence("Institut de France — George Sand", "https://georgesand.institutdefrance.fr/biographie/", "Официальный архив подтверждает настоящее имя, псевдоним, дату появления подписи George Sand и авторство романов."),
      evidence("Centre des monuments nationaux", "https://www.monuments-nationaux.fr/magazine/dossiers-thematiques/grands-personnages/qui-etait-george-sand", "Материал государственного учреждения независимо подтверждает личность Жорж Санд и её романное наследие."),
    ],
  }),
  corrected({
    key: "france:henri_barbusse",
    originalSha256: "6282508086d1331a1cc73a1ee6b292eb42976154038f99962175e9ce7af0012f",
    reviewedTextRu: "Анри Барбюс — французский писатель и журналист, добровольцем участвовавший в Первой мировой войне. Его основанный на фронтовом опыте роман «Огонь» вышел в 1916 году и получил Гонкуровскую премию.",
    evidence: [
      evidence("Bibliothèque nationale de France — Comité d’histoire", "https://comitehistoire.bnf.fr/dictionnaire-fonds/henri-barbusse", "BnF подтверждает биографию Барбюса, его фронтовую службу и создание романа «Огонь»."),
      evidence("Académie Goncourt", "https://www.academiegoncourt.com/tous-les-laureats-prix-goncourt", "Официальный список лауреатов независимо подтверждает присуждение Гонкуровской премии роману «Огонь» в 1916 году."),
    ],
  }),
  corrected({
    key: "france:henri_bergson",
    originalSha256: "a580abe2848c5cca1a88cd5aba99780d119e2157e41a2e26268122337e23835e",
    reviewedTextRu: "Анри Бергсон — французский философ, разработавший понятия длительности, интуиции и жизненного порыва. Он написал «Материю и память» и «Творческую эволюцию» и получил Нобелевскую премию по литературе 1927 года.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1927/bergson/bibliography/", "Официальная нобелевская библиография подтверждает премию 1927 года и авторство названных философских трудов."),
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/henri-bergson?election=12-02-1914&fauteuil=7", "Академическая биография независимо подтверждает философскую деятельность Бергсона и ключевые понятия его работ."),
    ],
  }),
  corrected({
    key: "france:jean_paul_sartre",
    originalSha256: "e60520da9b128bba1853cb1de238888abc0d4f1f3667356591da66cd8caffa17",
    reviewedTextRu: "Жан-Поль Сартр — французский философ, романист и драматург, связанный с экзистенциализмом. Он написал роман «Тошнота» и пьесу «За закрытыми дверями»; присуждённую ему Нобелевскую премию по литературе 1964 года он отказался принять.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1964/sartre/facts/", "Официальная запись подтверждает присуждение премии 1964 года, отказ Сартра и его литературную библиографию."),
      evidence("Bibliothèque nationale de France", "https://expositions.bnf.fr/sartre/grand/237.htm", "Выставочный архив BnF независимо документирует философскую и литературную деятельность Сартра и его произведения."),
    ],
  }),
  corrected({
    key: "france:joachim_du_bellay",
    originalSha256: "7f8fb9caf9193205e154eb12f486dfc615a391d0bb77525d1f0e3461486d77b6",
    reviewedTextRu: "Жоашен Дю Белле — французский поэт эпохи Возрождения и участник объединения «Плеяда». Он написал трактат «Защита и прославление французского языка» и поэтический сборник «Сожаления».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/extrait/dd23a9ae-96ac-4f4b-8eae-0582c77178fe-exhortation-francais-ecrire-en-leur-langue", "BnF связывает Дю Белле с «Плеядой» и трактатом о защите и развитии французского языка."),
      evidence("Northwestern University Press", "https://nupress.northwestern.edu/9780810119932/the-regrets/", "Университетское издательство независимо подтверждает авторство сборника «Сожаления» и ренессансный контекст поэта."),
    ],
  }),
  corrected({
    key: "france:jules_verne",
    originalSha256: "a4464867389089b8ef5cba893b545b9351d95a66511d0131d47ae4d8b9e2108b",
    reviewedTextRu: "Жюль Верн — французский писатель, создававший приключенческие романы о научных открытиях, путешествиях и технике. В цикл «Необыкновенные путешествия» входят «Путешествие к центру Земли», «Двадцать тысяч льё под водой» и «Вокруг света за восемьдесят дней».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://essentiels.bnf.fr/fr/litterature/19e-siecle-1/206ea0be-c9c7-411e-864f-6f2dd3c9b8bd-tous-auteurs-et-autrices-19e-siecle/personnalite/1973be87-7ccb-48b7-a2ff-0ab2704dd28c-jules-verne", "Профиль BnF подтверждает тематику прозы Верна, цикл «Необыкновенные путешествия» и названные романы."),
      evidence("Musée Jules Verne — Nantes Métropole", "https://julesverne.nantesmetropole.fr/en/biographical-highlights/", "Официальный музейный ресурс независимо документирует биографию Верна и публикацию его приключенческих романов."),
    ],
  }),
  corrected({
    key: "france:lafontaine",
    originalSha256: "b8a5f6b7de16c03074c3783baabd1fc46715a866917cc87abd481761b41ad9c3",
    reviewedTextRu: "Жан де Лафонтен — французский поэт XVII века, писавший басни, стихотворные сказки и драматические произведения. Его «Басни» публиковались несколькими сборниками и были объединены в двенадцать книг.",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/jean-de-la-fontaine", "Академическая биография подтверждает поэтические жанры Лафонтена и историю издания его «Басен»."),
      evidence("Ville de Château-Thierry — Musée Jean de La Fontaine", "https://www.chateau-thierry.fr/node/378", "Муниципальный музей независимо документирует личность Лафонтена и состав его литературного наследия."),
    ],
  }),
  corrected({
    key: "france:laurent_gounelle",
    originalSha256: "2c767ab48f19801ead769c471af743d47eac9fcac92211f521a8214243372e97",
    reviewedTextRu: "Лоран Гунель — французский писатель, автор романов, обращённых к темам личного выбора и самопознания. Его первый роман «Человек, который хотел быть счастливым» вышел в 2008 году; среди последующих книг — «Бог всегда путешествует инкогнито» и «День, когда я научился жить».",
    evidence: [
      evidence("Hachette", "https://www.hachette.fr/auteur/laurent-gounelle/", "Издательский профиль подтверждает личность Гунеля, тематику и библиографию его романов."),
      evidence("Éditions Anne Carrière", "https://anne-carriere.fr/livre/lhomme-qui-voulait-etre-heureux", "Первый издатель независимо подтверждает авторство и публикацию дебютного романа в 2008 году."),
    ],
  }),
  corrected({
    key: "france:louis_ferdinand_celine",
    originalSha256: "a5c6cdeda881339181238b18f0d579618c6efbb837e5eb374f9a19ec36bb0bda",
    reviewedTextRu: "Луи-Фердинанд Селин — псевдоним французского писателя и врача Луи-Фердинанда Детуша. Он написал романы «Путешествие на край ночи» и «Смерть в кредит», а в 1937 году опубликовал антисемитский памфлет «Безделицы для погрома».",
    evidence: [
      evidence("Éditions Gallimard", "https://tracts.gallimard.fr/collections/louis-ferdinand-celine", "Издательский архив подтверждает настоящее имя, псевдоним, медицинскую профессию и библиографию Селина."),
      evidence("CNRS — CELLF", "https://cellf.cnrs.fr/ouvrage/de-voyage-au-bout-de-la-nuit-a-bagatelles-pour-un-massacre-de-louis-ferdinand-celine/", "Университетско-академический ресурс независимо подтверждает переход от названного романа к антисемитскому памфлету 1937 года."),
    ],
  }),
  corrected({
    key: "france:marcel_proust",
    originalSha256: "e66e1ca5d24048be1ab4277afc1704d0f14dc8c9cbea39761288e4e3e33e74ac",
    reviewedTextRu: "Марсель Пруст — французский романист, эссеист и литературный критик. Его семитомный романный цикл «В поисках утраченного времени» публиковался с 1913 по 1927 год, причём последние три тома вышли посмертно.",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://www.bnf.fr/en/support-proust", "BnF подтверждает литературные роли Пруста, состав цикла и хронологию его публикации."),
      evidence("Musée d’Orsay", "https://www.musee-orsay.fr/en/ressources/artists-personalities-catalog/marcel-proust-207203", "Государственный музей независимо документирует биографию Пруста и «В поисках утраченного времени»."),
    ],
  }),
  corrected({
    key: "france:marie_de_france",
    originalSha256: "1e5d2099e80df8581ac0a6c418ea7d99c1d59bbead3eafd29780908f63a75c95",
    reviewedTextRu: "Мария Французская — имя, под которым известна франкоязычная поэтесса второй половины XII века; её точная личность не установлена. Ей принадлежат сборник «Лэ» и стихотворные «Басни», сохранившиеся в средневековых рукописях.",
    evidence: [
      evidence("British Library", "https://www.bl.uk/medieval-women/medieval-women-exhibition-large-print-guide.pdf", "Выставочный каталог Британской библиотеки подтверждает период, неустановленную личность и атрибуцию «Лэ» Марии Французской."),
      evidence("Cambridge University Press", "https://www.cambridge.org/core/books/cambridge-companion-to-medieval-womens-writing/marie-de-france/056FBA73E07927027456AAB4EFB71CB8", "Университетское издание независимо рассматривает Марию как франкоязычную поэтессу XII века и атрибутирует ей «Лэ» и «Басни»."),
    ],
  }),
  corrected({
    key: "france:maupassant",
    originalSha256: "fe16db3075fc94a274bf39ec020f1c1e6f6a0639451ef9295cb713b56770d420",
    reviewedTextRu: "Ги де Мопассан — французский писатель, работавший в жанрах рассказа, повести и романа. Он написал «Пышку», романы «Жизнь» и «Милый друг», а также повесть «Орля».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://data.bnf.fr/fr/documents-by-rdt/11915226/te/page1", "Каталог BnF подтверждает авторство Мопассана и атрибуцию названных произведений разных жанров."),
      evidence("Musée national Jean-Jacques Henner", "https://musee-henner.fr/agenda/evenement/conference-maupassant", "Материал государственного музея независимо описывает литературную деятельность и произведения Мопассана."),
    ],
  }),
  corrected({
    key: "france:michel_houellebecq",
    originalSha256: "db51b11434cf991f0531ff97163d88407b47cd2ae1303dce6c8c5c3e1dc22040",
    reviewedTextRu: "Мишель Уэльбек — французский романист, поэт и литературный критик. Он написал романы «Расширение пространства борьбы» и «Элементарные частицы», а «Карта и территория» получила Гонкуровскую премию 2010 года.",
    evidence: [
      evidence("Éditions Fayard", "https://www.fayard.fr/auteur/michel-houellebecq/", "Французский издатель подтверждает литературную деятельность Уэльбека и атрибуцию «Расширения пространства борьбы» и «Элементарных частиц»."),
      evidence("Macmillan Publishers", "https://us.macmillan.com/author/michelhouellebecq", "Независимый издательский профиль подтверждает личность автора и атрибуцию названных романов."),
      evidence("Académie Goncourt", "https://www.academiegoncourt.com/tous-les-laureats-prix-goncourt", "Официальный список лауреатов подтверждает премию 2010 года за роман «Карта и территория»."),
    ],
  }),
  corrected({
    key: "france:moliere",
    originalSha256: "0d114e8d878da67545a3f5cd3fda1b7a4f8bf83d96f73d9586b771b862ec6d5b",
    reviewedTextRu: "Мольер — сценическое имя французского драматурга, актёра и руководителя театральной труппы Жана-Батиста Поклена. Он написал комедии «Тартюф», «Мизантроп», «Скупой» и «Мнимый больной».",
    evidence: [
      evidence("Bibliothèque nationale de France — Gallica", "https://gallica.bnf.fr/selections/fr/html/litteratures/moliere-vie-et-mort-de-jean-baptiste-poquelin-dit-moliere", "BnF подтверждает настоящее имя, сценическое имя и театральные роли Мольера."),
      evidence("Comédie-Française", "https://www.comedie-francaise.fr/listes-des-oeuvres-de-moliere", "Официальный каталог национального театра независимо атрибутирует Мольеру четыре названные комедии."),
    ],
  }),
  corrected({
    key: "france:montaigne",
    originalSha256: "2cdc41ccff3a189cca90ee3081ce8e16c93f71dd2282f4fad5f3d43422d3a84d",
    reviewedTextRu: "Мишель де Монтень — французский писатель и мыслитель эпохи Возрождения. В трёх книгах «Опытов», впервые опубликованных в 1580 году и затем дополнявшихся автором, он соединил размышления о человеке с наблюдениями над собственной жизнью.",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://www.bnf.fr/fr/montaigne-ressources-en-ligne", "BnF подтверждает авторство «Опытов», их тематику, работу автора над дополнениями и связь размышлений с собственной жизнью."),
      evidence("Bibliothèque municipale de Bordeaux — Séléné", "https://selene.bordeaux.fr/space-montaigne", "Муниципальная библиотека независимо фиксирует первое издание 1580 года и последующие авторские правки «Опытов»."),
    ],
  }),
  corrected({
    key: "france:montesquieu",
    originalSha256: "691c31c7a395366b2324784622cf7a74b02ae9237ecd2c849a533bb4eefbe9b8",
    reviewedTextRu: "Шарль Луи де Секонда, барон де Ла-Бред и де Монтескьё, — французский писатель, философ и правовед эпохи Просвещения. Он написал эпистолярный роман «Персидские письма» и политико-правовой трактат «О духе законов».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://expositions.bnf.fr/montesquieu/", "Выставочный ресурс BnF подтверждает полное имя, интеллектуальные роли и два названных произведения Монтескьё."),
      evidence("École normale supérieure de Lyon", "https://dictionnaire-montesquieu.ens-lyon.fr/fr/article/1377621398/fr/", "Университетский словарь независимо документирует биографию Монтескьё и авторство «Персидских писем» и «О духе законов»."),
    ],
  }),
  corrected({
    key: "france:patrick_modiano",
    originalSha256: "8479ed9aa744c46118a0c0a9d8f8e8738fc50838c05083d9154610726e9bb207",
    reviewedTextRu: "Патрик Модиано — французский писатель, лауреат Нобелевской премии по литературе 2014 года. В его прозе темы памяти и оккупации Франции раскрываются, в частности, в романах «Улица тёмных лавок» и «Дора Брюдер».",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/2014/modiano/facts/", "Официальная запись подтверждает премию 2014 года, национальную принадлежность и библиографию Модиано."),
      evidence("Éditions P.O.L", "https://www.pol-editeur.com/index.php?numauteur=141&spec=auteur", "Издательский профиль независимо подтверждает авторство названных романов и устойчивые темы памяти и оккупации."),
    ],
  }),
  corrected({
    key: "france:prosper_merimee",
    originalSha256: "71dd3921739b9598a0b3cff23602615980f30589c38bc19635888d04c2fbc869",
    reviewedTextRu: "Проспер Мериме — французский писатель, историк и государственный инспектор исторических памятников. Он написал новеллы «Коломба» и «Кармен», а также роман «Хроника царствования Карла IX».",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/prosper-merimee", "Академическая биография подтверждает государственную должность, историческую работу и литературную библиографию Мериме."),
      evidence("Ministère de la Culture", "https://www.culture.gouv.fr/content/download/326239/pdf_file/DP_Mission%20Patrimoine%202023_Les%2018%20sites%20embl%C3%A9matiques.pdf?inLanguage=fre-FR", "Материал Министерства культуры независимо подтверждает деятельность Мериме как инспектора памятников и писателя."),
    ],
  }),
  corrected({
    key: "france:racine",
    originalSha256: "8b0ebfbf099ff343bc6682da5fbf07b70abe05185a67904fa79f77509f31ca72",
    reviewedTextRu: "Жан Расин — французский драматург XVII века, избранный во Французскую академию в 1672 году. Он написал трагедии «Андромаха», «Британик», «Береника», «Федра» и «Гофолия».",
    evidence: [
      evidence("Académie française", "https://www.academie-francaise.fr/les-immortels/jean-racine", "Академическая биография подтверждает избрание Расина в 1672 году, даты жизни и атрибуцию трагедий."),
      evidence("Comédie-Française", "https://www.comedie-francaise.fr/2013-2014/andromaque", "Национальный театр независимо атрибутирует Расину «Андромаху» и помещает её в подтверждённый корпус его трагедий."),
    ],
    notes: "Identity-очередь Q742 подтверждает Жана Расина. Shared birthDate 1639-12-22 и deathDate 1699-04-21 согласуются с биографией Французской академии; изменения дат не рекомендуются.",
  }),
  corrected({
    key: "france:roger_martin_du_gard",
    originalSha256: "40059f3edab38154b982c0c6b470d7bb5b3d1b9b8d0dccd8fb218bc70c45c8c3",
    reviewedTextRu: "Роже Мартен дю Гар — французский романист и архивист-палеограф, лауреат Нобелевской премии по литературе 1937 года. Его цикл «Семья Тибо» прослеживает судьбы братьев Антуана и Жака на фоне французской жизни и Первой мировой войны.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1937/gard/facts/", "Официальная запись подтверждает профессию, образование, премию 1937 года и авторство цикла «Семья Тибо»."),
      evidence("Éditions Larousse", "https://www.larousse.fr/encyclopedie/litterature/Roger_Martin_du_Gard/175196", "Институциональная энциклопедия независимо подтверждает биографию автора, персонажей и исторический фон цикла."),
    ],
  }),
  corrected({
    key: "france:romain_rolland",
    originalSha256: "1bfe56e5f95cc2f1c6b3d248d8a956841b341dc3399000c61c576a849a22c004",
    reviewedTextRu: "Ромен Роллан — французский писатель, драматург и исследователь музыки, лауреат Нобелевской премии по литературе 1915 года. Его роман-цикл «Жан-Кристоф», публиковавшийся в 1904–1912 годах, посвящён жизни вымышленного немецкого музыканта.",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1915/press-release/", "Официальный материал подтверждает премию 1915 года, литературную и музыкально-исследовательскую работу Роллана."),
      evidence("Bibliothèque nationale de France — Comité d’histoire", "https://comitehistoire.bnf.fr/dictionnaire-fonds/romain-rolland", "Архивная справка BnF независимо подтверждает биографию, хронологию и содержание цикла «Жан-Кристоф»."),
    ],
  }),
  corrected({
    key: "france:ronsard",
    originalSha256: "3020a0671beff9dcf3736e652c99b45b03531d2a505cba4bc2284a948308eeb0",
    reviewedTextRu: "Пьер де Ронсар — французский поэт эпохи Возрождения и участник объединения «Плеяда». Его поэтические книги включают «Оды», «Любовные стихотворения» и «Гимны».",
    evidence: [
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb44435265p", "Каталог BnF подтверждает личность Ронсара и наличие «Од», «Любовных стихотворений» и «Гимнов» в его корпусе."),
      evidence("Poetry Foundation", "https://www.poetryfoundation.org/poets/pierre-de-ronsard", "Независимый биографический профиль подтверждает ренессансный контекст, участие в «Плеяде» и названные поэтические сборники."),
    ],
  }),
  corrected({
    key: "france:rousseau",
    originalSha256: "295fa6a45123c12e89b9b8e5a855dcc11f7f9be08018875d0a6352dc563a69c2",
    reviewedTextRu: "Жан-Жак Руссо — женевский писатель, философ и композитор эпохи Просвещения. Он написал трактаты «Об общественном договоре» и «Эмиль, или О воспитании», роман «Юлия, или Новая Элоиза» и автобиографическую «Исповедь».",
    evidence: [
      evidence("Société Jean-Jacques Rousseau", "https://www.sjjr.ch/en/les-oeuvres", "Научное общество подтверждает женевскую идентичность Руссо, его интеллектуальные роли и атрибуцию названных произведений."),
      evidence("UNESCO Memory of the World", "https://www.unesco.org/en/memory-world/jean-jacques-rousseau-geneva-and-neuchatel-collections", "ЮНЕСКО независимо документирует биографию Руссо и рукописное наследие его философских, литературных и музыкальных работ."),
    ],
  }),
  corrected({
    key: "france:saint_exupery",
    originalSha256: "1a77d4e9c83d4c9fb07ee2a038a184c1f0d248a0900e8b8c4202528cf0ba48dc",
    reviewedTextRu: "Антуан де Сент-Экзюпери — французский писатель и лётчик, чей опыт гражданской и военной авиации вошёл в его прозу. Он написал «Южный почтовый», «Ночной полёт», «Планету людей» и философскую сказку «Маленький принц».",
    evidence: [
      evidence("Succession Antoine de Saint Exupéry", "https://www.antoinedesaintexupery.org/oeuvre/", "Официальный авторский архив подтверждает авиационную биографию Сент-Экзюпери и атрибуцию названных книг."),
      evidence("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb34652230z", "Каталог BnF независимо подтверждает авторство и библиографические сведения о «Маленьком принце»."),
    ],
  }),
  corrected({
    key: "france:saint_john_perse",
    originalSha256: "1b5966bd272c31e30e03e3f75562fac7ade6e48fbfcad4c63cddb874fd30c70d",
    reviewedTextRu: "Сен-Жон Перс — литературный псевдоним французского поэта и дипломата Алексиса Леже, лауреата Нобелевской премии по литературе 1960 года. Он написал поэмы «Анабасис», «Изгнание» и «Ветры».",
    evidence: [
      evidence("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1960/perse/facts/", "Официальная запись подтверждает настоящее имя, псевдоним, дипломатическую службу, премию 1960 года и библиографию поэта."),
      evidence("Fondation Saint-John Perse", "https://fondationsaintjohnperse.fr/une-vie-de-poete-et-de-diplomate/", "Официальный архив независимо документирует жизнь Алексиса Леже, псевдоним и названные поэмы."),
    ],
  }),
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch28: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch28Base.map(finalizeReviewRecord);

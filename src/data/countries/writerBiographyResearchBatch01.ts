import type { WriterBiographySourceProfile } from "./types";
import {
  WRITER_BIOGRAPHY_RESEARCH_AUTHOR,
  type WriterBiographyResearchDraft,
} from "./writerBiographyResearch";

const researchedAt = "2026-08-08";
const selectionReason =
  "P0 literary-history priority: Nobel Prize laureate in the unreviewed manifest queue.";
const rightsNote =
  "Written specifically for this project from discrete facts. No source prose was copied or closely adapted; both cited pages are used only to verify facts.";
const qaReviewer = "Codex independent factual QA";

/**
 * Independent factual QA performed after the editorial draft was complete.
 * Records absent from this set remain in research and cannot pass the public
 * promotion gate.
 */
export const writerBiographyResearchBatch01ApprovedKeys: ReadonlySet<string> = new Set([
  "belgium:maurice_maeterlinck",
  "denmark:karl_gjellerup",
  "denmark:henrik_pontoppidan",
  "england:rudyard_kipling",
  "france:sully_prudhomme",
  "france:frederic_mistral",
  "france:romain_rolland",
  "france:anatole_france",
  "germany:theodor_mommsen",
  "germany:gerhart_hauptmann",
  "india:rabindranath_tagore",
  "ireland:w_b_yeats",
  "italy:giosue_carducci",
  "norway:bjornstjerne_bjornson",
  "norway:knut_hamsun",
  "poland:henryk_sienkiewicz",
  "spain:jose_echegaray",
  "spain:jacinto_benavente",
  "sweden:selma_lagerlof",
  "switzerland:carl_spitteler",
]);

export const writerBiographyResearchBatch01QaHolds = {} as const;

type BatchInput = {
  countryId: string;
  writerId: string;
  nobelYear: number;
  nobelSlug: string;
  worksOnBiographicalPage?: boolean;
  locAuthorityId: string;
  identity: string;
  lifeDates: string;
  nationalLiteraryContext: string;
  notableWorks: string;
  ru: string;
  en: string;
};

function researchDraft(input: BatchInput): WriterBiographyResearchDraft {
  const key = `${input.countryId}:${input.writerId}` as const;
  const independentlyApproved = writerBiographyResearchBatch01ApprovedKeys.has(key);
  const nobelUrl = `https://www.nobelprize.org/prizes/literature/${input.nobelYear}/${input.nobelSlug}/facts/`;
  const nobelBiographicalUrl = `https://www.nobelprize.org/prizes/literature/${input.nobelYear}/${input.nobelSlug}/biographical/`;
  const nobelBibliographyUrl = `https://www.nobelprize.org/prizes/literature/${input.nobelYear}/${input.nobelSlug}/bibliography/`;
  const locUrl = `https://id.loc.gov/authorities/names/${input.locAuthorityId}.json`;
  const sources: WriterBiographySourceProfile[] = [
    {
      provider: "Nobel Prize Outreach",
      title: `The Nobel Prize in Literature ${input.nobelYear} - facts`,
      url: nobelUrl,
      fields: ["identity", "life-dates", "biography-facts", "awards"],
      usage: "fact-check",
      retrievedAt: researchedAt,
    },
    {
      provider: "Nobel Prize Outreach",
      title: `Laureate biographical record - ${input.nobelYear}`,
      url: nobelBiographicalUrl,
      fields: input.worksOnBiographicalPage
        ? ["biography-facts", "works"]
        : ["biography-facts"],
      usage: "fact-check",
      retrievedAt: researchedAt,
    },
    ...(!input.worksOnBiographicalPage
      ? [
          {
            provider: "Nobel Prize Outreach",
            title: `Laureate bibliography - ${input.nobelYear}`,
            url: nobelBibliographyUrl,
            fields: ["works"],
            usage: "fact-check",
            retrievedAt: researchedAt,
          } satisfies WriterBiographySourceProfile,
        ]
      : []),
    {
      provider: "Library of Congress",
      title: "Library of Congress Name Authority File",
      url: locUrl,
      fields: ["identity", "life-dates"],
      usage: "structured-data",
      retrievedAt: researchedAt,
    },
  ];
  const authorityUrls = [nobelUrl, locUrl];

  return {
    key,
    countryId: input.countryId,
    writerId: input.writerId,
    author: WRITER_BIOGRAPHY_RESEARCH_AUTHOR,
    status: independentlyApproved ? "reviewed" : "research",
    researchedAt,
    selectionReason,
    facts: {
      identity: {
        summary: input.identity,
        sourceUrls: authorityUrls,
        evidence: [
          {
            sourceUrl: nobelUrl,
            supports: "Official laureate identity, country/residence and language.",
          },
          {
            sourceUrl: locUrl,
            supports: "Independent authority identity and authorized name variants.",
          },
        ],
      },
      lifeDates: {
        summary: input.lifeDates,
        sourceUrls: authorityUrls,
        evidence: [
          {
            sourceUrl: nobelUrl,
            supports: "Exact displayed birth and death dates.",
          },
          {
            sourceUrl: locUrl,
            supports: "Independent authority lifespan years; not claimed for exact days.",
          },
        ],
      },
      nationalLiteraryContext: {
        summary: input.nationalLiteraryContext,
        sourceUrls: [nobelUrl, nobelBiographicalUrl],
        evidence: [
          {
            sourceUrl: nobelUrl,
            supports: "Official Life and Work overview and prize context.",
          },
          {
            sourceUrl: nobelBiographicalUrl,
            supports: "Detailed biographical and literary context.",
          },
        ],
      },
      notableWorks: {
        summary: input.notableWorks,
        sourceUrls: [
          input.worksOnBiographicalPage
            ? nobelBiographicalUrl
            : nobelBibliographyUrl,
        ],
        evidence: [
          {
            sourceUrl: input.worksOnBiographicalPage
              ? nobelBiographicalUrl
              : nobelBibliographyUrl,
            supports: input.worksOnBiographicalPage
              ? "Named works in the official laureate biography."
              : "Exact original titles in the official laureate bibliography.",
          },
        ],
      },
    },
    translations: {
      ru: {
        locale: "ru",
        text: input.ru,
        sourceLanguage: "ru",
        method: "editorial-original",
        sources,
      },
      en: {
        locale: "en",
        text: input.en,
        sourceLanguage: "en",
        method: "editorial-original",
        sources,
      },
    },
    sources,
    rights: {
      sourceUse: "facts-only",
      proseCreation: "project-original-editorial-draft",
      sourceProseCopied: false,
      wikipediaUsed: false,
      note: rightsNote,
    },
    review: independentlyApproved
      ? {
          independentReviewRequired: true,
          decision: "approved",
          reviewer: qaReviewer,
          reviewedAt: researchedAt,
        }
      : {
          independentReviewRequired: true,
          decision: "pending",
          reviewer: null,
          reviewedAt: null,
        },
  };
}

/**
 * Curated research batch 01. Only the records listed in the independent QA
 * approval set are eligible for deterministic promotion; held records remain
 * non-public research.
 */
export const writerBiographyResearchBatch01: WriterBiographyResearchDraft[] = [
  researchDraft({
    countryId: "belgium",
    writerId: "maurice_maeterlinck",
    nobelYear: 1911,
    nobelSlug: "maeterlinck",
    locAuthorityId: "n79018814",
    identity:
      "Maurice Maeterlinck was a Belgian French-language playwright, poet and essayist.",
    lifeDates: "Born 29 August 1862; died 6 May 1949.",
    nationalLiteraryContext:
      "A leading writer of Symbolist theatre whose drama emphasized suggestion, silence and interior states.",
    notableWorks:
      "La Princesse Maleine; Les Aveugles (The Blind); Pelléas et Mélisande; L'Oiseau bleu (The Blue Bird).",
    ru: "Морис Метерлинк (1862-1949) - бельгийский франкоязычный драматург, поэт и эссеист, одна из центральных фигур европейского символизма. В пьесах «Слепые» и «Пеллеас и Мелизанда» он строил действие вокруг недосказанности, ожидания и скрытых движений сознания, а сказочная драма «Синяя птица» принесла ему широкую международную известность. В 1911 году Метерлинк получил Нобелевскую премию по литературе.",
    en: "Maurice Maeterlinck (1862-1949) was a Belgian French-language playwright, poet and essayist and a central figure in European Symbolism. In The Blind and Pelléas and Mélisande, he built drama from suggestion, expectancy and concealed states of mind, while the fairy play The Blue Bird brought him a broad international readership. He received the Nobel Prize in Literature in 1911.",
  }),
  researchDraft({
    countryId: "denmark",
    writerId: "karl_gjellerup",
    nobelYear: 1917,
    nobelSlug: "gjellerup",
    locAuthorityId: "n88261579",
    identity: "Karl Adolph Gjellerup was a Danish poet and novelist.",
    lifeDates: "Born 2 June 1857; died 11 October 1919.",
    nationalLiteraryContext:
      "He moved from naturalism and religious criticism toward German idealism and Buddhist thought, and later wrote in German as well as Danish.",
    notableWorks: "En Idealist; Minna; Der Pilger Kamanita (The Pilgrim Kamanita).",
    ru: "Карл Адольф Гьеллеруп (1857-1919) - датский писатель и поэт, который после переезда в Германию создавал произведения также на немецком языке. Его творческий путь прошёл от натуралистической прозы и критики религии к интересу к немецкому идеализму и буддийской философии; этот поворот особенно заметен в романах «Минна» и «Паломник Каманита». В 1917 году он разделил Нобелевскую премию по литературе с Хенриком Понтоппиданом.",
    en: "Karl Adolph Gjellerup (1857-1919) was a Danish novelist and poet who also wrote in German after settling in Germany. His career moved from naturalist fiction and criticism of religion toward German idealism and Buddhist philosophy, a development especially visible in Minna and The Pilgrim Kamanita. In 1917 he shared the Nobel Prize in Literature with Henrik Pontoppidan.",
  }),
  researchDraft({
    countryId: "denmark",
    writerId: "henrik_pontoppidan",
    nobelYear: 1917,
    nobelSlug: "pontoppidan",
    locAuthorityId: "n79113935",
    identity: "Henrik Pontoppidan was a Danish novelist and short-story writer.",
    lifeDates: "Born 24 July 1857; died 21 August 1943.",
    nationalLiteraryContext:
      "His realist fiction examined Denmark's social, religious and political transformation around industrialization and constitutional change.",
    notableWorks:
      "Det forjættede Land (The Promised Land); Lykke-Per (Lucky Per); De Dødes Rige (The Realm of the Dead).",
    ru: "Хенрик Понтоппидан (1857-1943) - датский прозаик-реалист, проследивший в романах и рассказах общественные перемены эпохи индустриализации и становления парламентской Дании. Трилогии «Земля обетованная» и «Царство мёртвых», а также роман «Счастливчик Пер» исследуют конфликт личных стремлений с религиозной средой, семьёй и устройством общества. В 1917 году Понтоппидан разделил Нобелевскую премию по литературе с Карлом Гьеллерупом.",
    en: "Henrik Pontoppidan (1857-1943) was a Danish realist whose novels and short stories traced the social changes brought by industrialization and parliamentary government. The Promised Land, The Realm of the Dead and Lucky Per examine how individual ambition collides with religion, family and social institutions. In 1917 Pontoppidan shared the Nobel Prize in Literature with Karl Gjellerup.",
  }),
  researchDraft({
    countryId: "england",
    writerId: "rudyard_kipling",
    nobelYear: 1907,
    nobelSlug: "kipling",
    locAuthorityId: "n79103792",
    identity: "Rudyard Kipling was an English poet, short-story writer and novelist.",
    lifeDates: "Born 30 December 1865; died 18 January 1936.",
    nationalLiteraryContext:
      "Born in Bombay, he made British India central to much of his fiction and poetry; his imperial outlook remains a subject of critical debate.",
    notableWorks: "Plain Tales from the Hills; The Jungle Book; Kim.",
    ru: "Редьярд Киплинг (1865-1936) - английский поэт и прозаик, родившийся в Бомбее и работавший в Индии в англоязычной прессе. Сборник «Простые рассказы с гор», «Книга джунглей» и роман «Ким» относятся к главным произведениям его индийского периода и принесли автору международную известность. В 1907 году Киплинг получил Нобелевскую премию по литературе.",
    en: "Rudyard Kipling (1865-1936) was an English poet and fiction writer who was born in Bombay and worked for English-language newspapers in India. Plain Tales from the Hills, The Jungle Book and Kim are among the major works associated with his Indian experience and brought him an international readership. Kipling received the Nobel Prize in Literature in 1907.",
  }),
  researchDraft({
    countryId: "france",
    writerId: "sully_prudhomme",
    nobelYear: 1901,
    nobelSlug: "prudhomme",
    locAuthorityId: "n86048840",
    identity:
      "René François Armand Prudhomme, known as Sully Prudhomme, was a French poet.",
    lifeDates:
      "Born 16 March 1839; Nobel Prize Outreach gives 7 September 1907, while the Library of Congress authority record supplies the death year only. The prose therefore uses years only and does not repeat the conflicting 6 September date in the legacy card.",
    nationalLiteraryContext:
      "Associated with the Parnassian movement, he combined formal control with philosophical and scientific questions.",
    notableWorks: "Stances et Poèmes; Les Solitudes; Le Bonheur.",
    ru: "Рене Франсуа Арман Прюдом, публиковавшийся как Сюлли-Прюдом (1839-1907), - французский поэт, связанный с парнасской школой. В сборниках «Стансы и стихотворения» и «Одиночества» он сочетал строгую форму с размышлениями о любви, знании и противоречии между чувством и разумом, а поздняя поэма «Счастье» развивает этические и философские темы. В 1901 году он стал первым лауреатом Нобелевской премии по литературе.",
    en: "René François Armand Prudhomme, who published as Sully Prudhomme (1839-1907), was a French poet associated with the Parnassian movement. In Stances et Poèmes and Les Solitudes, he joined formal discipline to questions of love, knowledge and the tension between feeling and reason, while the later poem Le Bonheur developed ethical and philosophical themes. In 1901 he became the first recipient of the Nobel Prize in Literature.",
  }),
  researchDraft({
    countryId: "france",
    writerId: "frederic_mistral",
    nobelYear: 1904,
    nobelSlug: "mistral",
    locAuthorityId: "n50000937",
    identity: "Frédéric Mistral was a Provençal poet and lexicographer.",
    lifeDates: "Born 8 September 1830; died 25 March 1914.",
    nationalLiteraryContext:
      "He wrote in Occitan and co-founded the Félibrige movement to renew Provençal language and literature.",
    notableWorks: "Mirèio; Lou Tresor dóu Felibrige.",
    ru: "Фредерик Мистраль (1830-1914) - провансальский поэт и лексикограф, писавший на окситанском языке и участвовавший в возрождении его литературной традиции. В 1854 году он стал одним из основателей движения «Фелибриж», а поэма «Мирейо» и многолетний словарь «Сокровище фелибрижа» закрепили культурную программу этого круга. Нобелевскую премию по литературе 1904 года Мистраль разделил с Хосе Эчегараем.",
    en: "Frédéric Mistral (1830-1914) was a Provençal poet and lexicographer who wrote in Occitan and worked to renew its literary tradition. In 1854 he helped found the Félibrige movement, while the poem Mirèio and his long-term lexicographical project Lou Tresor dóu Felibrige gave that cultural program its defining works. Mistral shared the 1904 Nobel Prize in Literature with José Echegaray.",
  }),
  researchDraft({
    countryId: "france",
    writerId: "romain_rolland",
    nobelYear: 1915,
    nobelSlug: "rolland",
    locAuthorityId: "n79059160",
    identity: "Romain Rolland was a French novelist, dramatist, essayist and music scholar.",
    lifeDates: "Born 29 January 1866; died 30 December 1944.",
    nationalLiteraryContext:
      "A humanist and internationalist, he used the long-form roman-fleuve and advocated a theatre addressed to a broad public.",
    notableWorks: "Jean-Christophe; L'Âme enchantée (The Enchanted Soul).",
    ru: "Ромен Роллан (1866-1944) - французский романист, драматург, эссеист и исследователь музыки, отстаивавший гуманистические и интернационалистские взгляды. Десятитомный «Жан-Кристоф» и цикл «Очарованная душа» развивают форму романа-потока, в которой судьба героя раскрывается на фоне духовной и политической истории Европы. Нобелевская премия по литературе за 1915 год была присуждена Роллану в 1916 году.",
    en: "Romain Rolland (1866-1944) was a French novelist, playwright, essayist and music scholar committed to humanist and internationalist ideals. The ten-volume Jean-Christophe and the cycle The Enchanted Soul develop the roman-fleuve, following individual lives across the intellectual and political history of Europe. Rolland was awarded the 1915 Nobel Prize in Literature in 1916.",
  }),
  researchDraft({
    countryId: "france",
    writerId: "anatole_france",
    nobelYear: 1921,
    nobelSlug: "france",
    locAuthorityId: "n80045853",
    identity:
      "Anatole France, the pen name of Jacques Anatole François Thibault, was a French novelist, critic, poet and journalist.",
    lifeDates: "Born 16 April 1844; died 12 October 1924.",
    nationalLiteraryContext:
      "His urbane, skeptical fiction and criticism addressed French political and religious life, and he publicly supported Alfred Dreyfus.",
    notableWorks:
      "Le Crime de Sylvestre Bonnard; Thaïs; L'Île des Pingouins (Penguin Island); Les Dieux ont soif (The Gods Are Athirst).",
    ru: "Анатоль Франс, литературное имя Жака Анатоля Франсуа Тибо (1844-1924), - французский романист, критик и публицист. Его ироническая, скептическая проза обращена к истории, религии и политической жизни Франции; среди ключевых книг - «Преступление Сильвестра Боннара», «Таис», «Остров пингвинов» и «Боги жаждут». Писатель открыто поддержал Альфреда Дрейфуса, а в 1921 году получил Нобелевскую премию по литературе.",
    en: "Anatole France, the pen name of Jacques Anatole François Thibault (1844-1924), was a French novelist, critic and public intellectual. His ironic, skeptical fiction examines history, religion and French political life; major works include The Crime of Sylvestre Bonnard, Thaïs, Penguin Island and The Gods Are Athirst. He publicly supported Alfred Dreyfus and received the Nobel Prize in Literature in 1921.",
  }),
  researchDraft({
    countryId: "germany",
    writerId: "theodor_mommsen",
    nobelYear: 1902,
    nobelSlug: "mommsen",
    locAuthorityId: "n50004383",
    identity: "Theodor Mommsen was a German historian of Rome, epigraphist and jurist.",
    lifeDates: "Born 30 November 1817; died 1 November 1903.",
    nationalLiteraryContext:
      "His scholarship joined political narrative to legal, economic and institutional analysis of the Roman world.",
    notableWorks: "Römische Geschichte (History of Rome); Römisches Staatsrecht (Roman Constitutional Law).",
    ru: "Теодор Моммзен (1817-1903) - немецкий историк античности, эпиграфист и правовед, посвятивший основные исследования Древнему Риму. В многотомной «Истории Рима» он соединил политическое повествование с анализом права, экономики и общественных институтов, а «Римское государственное право» систематизировало устройство римской власти. В 1902 году Моммзен получил Нобелевскую премию по литературе, прежде всего за историческое письмо.",
    en: "Theodor Mommsen (1817-1903) was a German historian of antiquity, epigraphist and jurist whose principal subject was ancient Rome. His multi-volume History of Rome combined political narrative with legal, economic and institutional analysis, while Roman Constitutional Law offered a systematic account of Roman government. Mommsen received the Nobel Prize in Literature in 1902, chiefly in recognition of his historical writing.",
  }),
  researchDraft({
    countryId: "germany",
    writerId: "gerhart_hauptmann",
    nobelYear: 1912,
    nobelSlug: "hauptmann",
    worksOnBiographicalPage: true,
    locAuthorityId: "n80076391",
    identity: "Gerhart Hauptmann was a German playwright and novelist.",
    lifeDates: "Born 15 November 1862; died 6 June 1946.",
    nationalLiteraryContext:
      "He was a formative dramatist of German naturalism and later expanded his theatre beyond a single movement.",
    notableWorks: "Vor Sonnenaufgang (Before Sunrise); Die Weber (The Weavers).",
    ru: "Герхарт Гауптман (1862-1946) - немецкий драматург и прозаик, чьи ранние пьесы стали важной частью немецкого натурализма. «Перед восходом солнца» показывает разрушительное действие наследственности и социальной среды, а «Ткачи» превращают восстание силезских рабочих в коллективную драму без единственного героя. В 1912 году Гауптман получил Нобелевскую премию по литературе; его позднее творчество вышло за рамки натуралистической эстетики.",
    en: "Gerhart Hauptmann (1862-1946) was a German playwright and novelist whose early plays helped establish German naturalism. Before Sunrise examines the destructive force of heredity and social environment, while The Weavers turns the Silesian workers' uprising into a collective drama without a single protagonist. Hauptmann received the Nobel Prize in Literature in 1912, and his later writing moved beyond a strictly naturalist aesthetic.",
  }),
  researchDraft({
    countryId: "india",
    writerId: "rabindranath_tagore",
    nobelYear: 1913,
    nobelSlug: "tagore",
    locAuthorityId: "n80036680",
    identity: "Rabindranath Tagore was a Bengali poet, fiction writer, dramatist, composer and educator.",
    lifeDates:
      "Nobel Prize Outreach gives 7 May 1861 and 7 August 1941. The Library of Congress display record gives 6 May 1861 and 8 July 1941, so the Nobel dates are used and the discrepancy is preserved for review.",
    nationalLiteraryContext:
      "He reshaped modern Bengali literature, wrote in Bengali and English, and founded an experimental school at Santiniketan.",
    notableWorks: "Gitanjali; Gora; Ghare-Baire (The Home and the World).",
    ru: "Рабиндранат Тагор (1861-1941) - бенгальский поэт, прозаик, драматург, композитор и педагог, существенно обновивший язык современной бенгальской литературы. В книгах «Гитанджали», «Гора» и «Дом и мир» он соединял лирическую сосредоточенность с размышлениями о религии, общественной реформе и национальной идентичности; основанная им школа в Шантиникетане воплощала его педагогические идеи. В 1913 году Тагор стал первым азиатским лауреатом Нобелевской премии по литературе.",
    en: "Rabindranath Tagore (1861-1941) was a Bengali poet, fiction writer, playwright, composer and educator who reshaped the language of modern Bengali literature. Gitanjali, Gora and The Home and the World join lyric reflection to questions of religion, social reform and national identity; the school he founded at Santiniketan put his educational ideas into practice. In 1913 Tagore became the first Asian recipient of the Nobel Prize in Literature.",
  }),
  researchDraft({
    countryId: "ireland",
    writerId: "w_b_yeats",
    nobelYear: 1923,
    nobelSlug: "yeats",
    locAuthorityId: "n78095579",
    identity: "William Butler Yeats was an Irish poet and playwright.",
    lifeDates: "Born 13 June 1865; died 28 January 1939.",
    nationalLiteraryContext:
      "A major figure in the Irish Literary Revival, he helped establish the Irish Literary Theatre that developed into the Abbey Theatre.",
    notableWorks: "The Celtic Twilight; The Tower; plays written for the Irish theatre.",
    ru: "Уильям Батлер Йейтс (1865-1939) - ирландский поэт и драматург, одна из ключевых фигур Ирландского литературного возрождения. Вместе с леди Грегори и другими единомышленниками он создавал национальный театр, из которого вырос дублинский Театр Аббатства, а в книгах «Кельтские сумерки» и «Башня» переосмысливал фольклор, историю и современность Ирландии. В 1923 году Йейтс получил Нобелевскую премию по литературе.",
    en: "William Butler Yeats (1865-1939) was an Irish poet and playwright and a central figure in the Irish Literary Revival. With Lady Gregory and other collaborators, he built the national theatre movement that developed into Dublin's Abbey Theatre, while The Celtic Twilight and The Tower reworked Irish folklore, history and modern experience. Yeats received the Nobel Prize in Literature in 1923.",
  }),
  researchDraft({
    countryId: "italy",
    writerId: "giosue_carducci",
    nobelYear: 1906,
    nobelSlug: "carducci",
    locAuthorityId: "n79063249",
    identity: "Giosuè Carducci was an Italian poet, critic, translator and literary historian.",
    lifeDates: "Born 27 July 1835; died 16 February 1907.",
    nationalLiteraryContext:
      "As professor at Bologna, he brought classical meters and Italy's civic history into modern Italian poetry.",
    notableWorks: "Rime nuove; Odi barbare; Rime e ritmi.",
    ru: "Джозуэ Кардуччи (1835-1907) - итальянский поэт, критик и историк литературы, много лет преподававший в Болонском университете. В сборниках «Новые рифмы», «Варварские оды» и «Рифмы и ритмы» он переносил античные метрические модели в современный итальянский стих и обращался к гражданской истории страны. В 1906 году Кардуччи стал первым итальянским лауреатом Нобелевской премии по литературе.",
    en: "Giosuè Carducci (1835-1907) was an Italian poet, critic and literary historian who taught for many years at the University of Bologna. In New Rhymes, Barbarian Odes and Rhymes and Rhythms, he adapted classical metrical models to modern Italian verse and engaged with the country's civic history. Carducci became the first Italian recipient of the Nobel Prize in Literature in 1906.",
  }),
  researchDraft({
    countryId: "norway",
    writerId: "bjornstjerne_bjornson",
    nobelYear: 1903,
    nobelSlug: "bjornson",
    locAuthorityId: "n84017029",
    identity: "Bjørnstjerne Bjørnson was a Norwegian novelist, playwright, poet and journalist.",
    lifeDates: "Born 8 December 1832; died 26 April 1910.",
    nationalLiteraryContext:
      "His peasant tales contributed to Norwegian national literature, while his later plays engaged social and political questions.",
    notableWorks: "Synnøve Solbakken; Arne; lyrics of Ja, vi elsker dette landet.",
    ru: "Бьёрнстьерне Бьёрнсон (1832-1910) - норвежский прозаик, драматург, поэт и журналист, участвовавший в формировании национальной литературы XIX века. Повести «Сюннёве Сульбаккен» и «Арне» придали крестьянской жизни эпический и психологический масштаб, а поздние пьесы обращались к общественным конфликтам; его стихотворение «Да, мы любим этот край» стало текстом национального гимна Норвегии. В 1903 году Бьёрнсон получил Нобелевскую премию по литературе.",
    en: "Bjørnstjerne Bjørnson (1832-1910) was a Norwegian novelist, playwright, poet and journalist who helped shape the country's nineteenth-century national literature. Synnøve Solbakken and Arne gave rural life epic and psychological scope, while his later plays addressed social conflict; his poem Ja, vi elsker dette landet became the text of Norway's national anthem. Bjørnson received the Nobel Prize in Literature in 1903.",
  }),
  researchDraft({
    countryId: "norway",
    writerId: "knut_hamsun",
    nobelYear: 1920,
    nobelSlug: "hamsun",
    locAuthorityId: "n79089334",
    identity: "Knut Hamsun was a Norwegian novelist, poet and playwright.",
    lifeDates: "Born 4 August 1859; died 19 February 1952.",
    nationalLiteraryContext:
      "His fiction introduced an intensely subjective modern narrative voice and later explored agrarian life; his support for Nazi Germany and the occupation of Norway is essential historical context.",
    notableWorks: "Sult (Hunger); Pan; Markens Grøde (Growth of the Soil).",
    ru: "Кнут Гамсун (1859-1952) - норвежский романист, получивший известность благодаря книгам «Голод» и «Пан». Нобелевская премия по литературе 1920 года была присуждена ему за роман «Плоды земли», посвящённый труду и связи человека с природой. Гамсун сочувственно отнёсся к нацистскому вторжению в Норвегию; после Второй мировой войны он лишился имущества и некоторое время находился под психиатрическим наблюдением.",
    en: "Knut Hamsun (1859-1952) was a Norwegian novelist who established his reputation with Hunger and Pan. He received the 1920 Nobel Prize in Literature for Growth of the Soil, a novel centred on work and the relationship between human beings and nature. Hamsun sympathized with the Nazi invasion of Norway; after the Second World War he lost his property and was placed under psychiatric observation for a period.",
  }),
  researchDraft({
    countryId: "poland",
    writerId: "henryk_sienkiewicz",
    nobelYear: 1905,
    nobelSlug: "sienkiewicz",
    locAuthorityId: "n50024588",
    identity: "Henryk Sienkiewicz was a Polish novelist and short-story writer.",
    lifeDates: "Born 5 May 1846; died 15 November 1916.",
    nationalLiteraryContext:
      "His historical fiction revisited the Polish-Lithuanian Commonwealth for readers living under the partitions of Poland.",
    notableWorks:
      "Ogniem i mieczem (With Fire and Sword); Potop (The Deluge); Pan Wołodyjowski; Quo Vadis.",
    ru: "Генрик Сенкевич (1846-1916) - польский романист и новеллист, обратившийся к национальной истории в эпоху, когда Польша оставалась разделённой между империями. Трилогия «Огнём и мечом», «Потоп» и «Пан Володыёвский» воссоздаёт конфликты Речи Посполитой XVII века, а роман «Камо грядеши» перенёс историческое действие в Рим времён Нерона и получил международную известность. В 1905 году Сенкевич был удостоен Нобелевской премии по литературе.",
    en: "Henryk Sienkiewicz (1846-1916) was a Polish novelist and short-story writer who turned to national history while Poland remained partitioned among empires. His trilogy With Fire and Sword, The Deluge and Pan Wołodyjowski recreates conflicts of the seventeenth-century Polish-Lithuanian Commonwealth, while Quo Vadis moved the historical setting to Nero's Rome and gained an international readership. Sienkiewicz received the Nobel Prize in Literature in 1905.",
  }),
  researchDraft({
    countryId: "spain",
    writerId: "jose_echegaray",
    nobelYear: 1904,
    nobelSlug: "eizaguirre",
    worksOnBiographicalPage: true,
    locAuthorityId: "n82134563",
    identity:
      "José Echegaray y Eizaguirre was a Spanish playwright, mathematician, engineer and statesman.",
    lifeDates:
      "Born 19 April 1832; died 4 September 1916. The curated legacy field says 14 September and should be corrected independently of this prose batch.",
    nationalLiteraryContext:
      "His theatre used romantic melodrama to stage conflicts of duty, honor and conscience in late nineteenth-century Spain.",
    notableWorks:
      "O locura o santidad (Madness or Sanctity); El gran Galeoto (The Great Galeoto); Conflicto entre dos deberes (Conflict of Duties).",
    ru: "Хосе Эчегарай-и-Эйсагирре (1832-1916) - испанский драматург, математик, инженер и государственный деятель. В пьесах «Безумие или святость», «Великий Галеото» и «Конфликт обязанностей» он использовал романтическую мелодраму для исследования долга, чести, общественного давления и нравственного выбора. В 1904 году Эчегарай разделил Нобелевскую премию по литературе с Фредериком Мистралем.",
    en: "José Echegaray y Eizaguirre (1832-1916) was a Spanish playwright, mathematician, engineer and statesman. In Madness or Sanctity, The Great Galeoto and Conflict of Duties, he used romantic melodrama to examine duty, honor, social pressure and moral choice. Echegaray shared the 1904 Nobel Prize in Literature with Frédéric Mistral.",
  }),
  researchDraft({
    countryId: "spain",
    writerId: "jacinto_benavente",
    nobelYear: 1922,
    nobelSlug: "benavente",
    worksOnBiographicalPage: true,
    locAuthorityId: "n80001380",
    identity: "Jacinto Benavente y Martínez was a Spanish playwright.",
    lifeDates: "Born 12 August 1866; died 14 July 1954.",
    nationalLiteraryContext:
      "He moved Spanish theatre away from declamatory melodrama toward conversational comedy, social observation and satire.",
    notableWorks:
      "Los intereses creados (The Bonds of Interest); La malquerida (The Unloved Woman).",
    ru: "Хасинто Бенавенте-и-Мартинес (1866-1954) - испанский драматург, стремившийся к достоверному изображению современной ему жизни. Он прославился комедиями нравов и сатирическими пьесами; среди наиболее известных произведений автора - «Игра интересов» и психологическая драма «Нелюбимая». В 1922 году Бенавенте получил Нобелевскую премию по литературе.",
    en: "Jacinto Benavente y Martínez (1866-1954) was a Spanish playwright who sought a credible portrayal of contemporary life on stage. He became known for comedies of manners and social satire; The Bonds of Interest and the psychological drama The Unloved Woman are among his best-known plays. Benavente received the Nobel Prize in Literature in 1922.",
  }),
  researchDraft({
    countryId: "sweden",
    writerId: "selma_lagerlof",
    nobelYear: 1909,
    nobelSlug: "lagerlof",
    locAuthorityId: "n82143184",
    identity: "Selma Lagerlöf was a Swedish novelist and short-story writer.",
    lifeDates: "Born 20 November 1858; died 16 March 1940.",
    nationalLiteraryContext:
      "Her fiction joined Värmland storytelling and legend to social observation and modern narrative craft.",
    notableWorks:
      "Gösta Berlings saga; Nils Holgerssons underbara resa genom Sverige (The Wonderful Adventures of Nils).",
    ru: "Сельма Лагерлёф (1858-1940) - шведская романистка, соединившая устные предания и пейзажи Вермланда с современным повествованием и вниманием к общественной жизни. Роман «Сага о Йёсте Берлинге» принёс ей известность, а «Чудесное путешествие Нильса с дикими гусями по Швеции», задуманное как учебная книга, стало классикой детской литературы. В 1909 году Лагерлёф первой среди женщин получила Нобелевскую премию по литературе.",
    en: "Selma Lagerlöf (1858-1940) was a Swedish novelist who combined the oral traditions and landscapes of Värmland with modern narrative craft and close attention to social life. Gösta Berling's Saga established her reputation, while The Wonderful Adventures of Nils, conceived as a school reader, became a classic of children's literature. In 1909 Lagerlöf became the first woman to receive the Nobel Prize in Literature.",
  }),
  researchDraft({
    countryId: "switzerland",
    writerId: "carl_spitteler",
    nobelYear: 1919,
    nobelSlug: "spitteler",
    locAuthorityId: "n87941375",
    identity: "Carl Spitteler was a Swiss German-language poet, novelist and essayist.",
    lifeDates: "Born 24 April 1845; died 29 December 1924.",
    nationalLiteraryContext:
      "He reworked classical myth in modern epic poetry and wrote prose concerned with imagination, identity and artistic vocation.",
    notableWorks:
      "Prometheus und Epimetheus; Olympischer Frühling (Olympian Spring); Imago.",
    ru: "Карл Шпиттелер (1845-1924) - швейцарский немецкоязычный поэт, прозаик и эссеист, переосмысливавший античный миф в современной литературе. Аллегорическая поэма «Прометей и Эпиметей» и эпический цикл «Олимпийская весна» исследуют свободу, власть и конфликт личности с коллективом, а название романа «Имаго» позднее вошло в терминологию аналитической психологии. Шпиттелер был удостоен Нобелевской премии по литературе за 1919 год.",
    en: "Carl Spitteler (1845-1924) was a Swiss German-language poet, novelist and essayist who recast classical myth for modern literature. Prometheus and Epimetheus and the epic cycle Olympian Spring examine freedom, authority and the individual's conflict with the group, while the title of his novel Imago later entered the vocabulary of analytical psychology. Spitteler was awarded the 1919 Nobel Prize in Literature.",
  }),
];

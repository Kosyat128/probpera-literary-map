import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch32 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{
    provider: string;
    url: string;
    checkedAt: string;
  }>;
  note: string;
};

type ProfileCorrectionSeed = readonly [
  key: string,
  patch: Partial<WriterProfile>,
  note: string,
];

type EvidenceSeed = readonly [provider: string, url: string];

const checkedAt = "2026-08-11";
const evidenceSeeds: Record<string, readonly EvidenceSeed[]> = {
  "india:amitav_ghosh": [
    ["Bharatiya Jnanpith", "https://www.jnanpith.net/media_image/announcement/54th%20Jnanpith%20Award%20goes%20to%20Amitav%20Ghosh.pdf"],
    ["Penguin Random House India", "https://www.penguin.co.in/book_author/amitav-ghosh/"],
  ],
  "india:anil_menon": [
    ["Simon & Schuster", "https://www.simonandschuster.com/authors/Anil-Menon/186511004"],
    ["Официальный сайт Анила Менона", "https://anilmenon.com/about/"],
  ],
  "india:anita_desai": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/anita-desai"],
    ["Sahitya Akademi", "https://www.sahitya-akademi.gov.in/awards/akademi%20samman_suchi.jsp"],
  ],
  "india:bankim_chandra_chatterjee": [
    ["Banglapedia", "https://en.banglapedia.org/index.php?title=Novel"],
    ["Oxford Academic / Oxford Reference", "https://academic.oup.com/reference/62357/reference-article-abstract/554514050"],
  ],
  "india:bhartrihari": [
    ["Internet Encyclopedia of Philosophy / University of Tennessee at Martin", "https://iep.utm.edu/bhartrihari/"],
    ["Presses universitaires de Strasbourg / OpenEdition", "https://books.openedition.org/pus/40516"],
  ],
  "india:bhavabhuti": [
    ["University of Toronto Libraries, Jackson Bibliography", "https://jacksonbibliography.library.utoronto.ca/author/details/bhavabhuti/22250"],
    ["Library of Congress", "https://www.loc.gov/resource/gdc.00542322354/?st=list"],
  ],
  "india:chetan_bhagat": [
    ["Официальный сайт Четана Бхагата", "https://www.chetanbhagat.com/about-2/"],
    ["Indian Institute of Management Ahmedabad", "https://www.iima.ac.in/news/its-not-simple-be-simple-chetan-bhagat-iima-students"],
  ],
  "india:geetanjali_shree": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/geetanjali-shree"],
    ["Tilted Axis Press", "https://www.tiltedaxispress.com/geetanjali-shree/"],
  ],
  "india:jaishankar_prasad": [
    ["Hindwi / Rekhta Foundation", "https://www.hindwi.org/poets/jaishankar-prasad/profile"],
    ["Government of India, Department of Official Language", "https://rajbhasha.gov.in/sites/default/files/jan-jaishankar.pdf"],
  ],
  "india:jeet_thayil": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/narcopolis"],
    ["Faber", "https://www.faber.co.uk/author/jeet-thayil/"],
  ],
  "india:jhumpa_lahiri": [
    ["The Pulitzer Prizes", "https://www.pulitzer.org/winners/jhumpa-lahiri"],
    ["Obama Presidential Library / National Archives", "https://obama.artifacts.archives.gov/people/21532/jhumpa-lahiri"],
  ],
  "india:kabir": [
    ["Poetry Foundation", "https://www.poetryfoundation.org/poets/kabir"],
    ["The Metropolitan Museum of Art, Heilbrunn Timeline", "https://82nd-and-fifth.metmuseum.org/toah/ht/08/ssa.html"],
  ],
  "india:kalidasa": [
    ["Indira Gandhi National Centre for the Arts (IGNCA)", "https://ignca.gov.in/poetic-culture-of-kalidasa/"],
    ["Karnataka Sanskrit University", "https://ksu.ac.in/assets/slides/kc.pdf"],
  ],
  "india:khushwant_singh": [
    ["Rajya Sabha, Parliament of India", "https://cms.rajyasabha.nic.in/documents/Members/1628692669169.02_s.pdf"],
    ["Rajya Sabha, Parliament of India", "https://cms.rajyasabha.nic.in/UploadedFiles/Synopsis/SynopsisUpload/231/09062014.pdf"],
    ["Penguin Random House India", "https://www.penguin.co.in/book_author/khushwant-singh/"],
  ],
  "india:kiran_desai": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/kiran-desai"],
    ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/6912/kiran-desai/"],
  ],
  "india:mirabai": [
    ["Poetry Foundation", "https://www.poetryfoundation.org/poets/mirabai"],
    ["UCLA South Asia Institute / MANAS", "https://southasia.ucla.edu/religions/gurus-saints/mirabai/"],
  ],
  "india:munshi_premchand": [
    ["Press Information Bureau / New India Samachar, Government of India", "https://newindiasamachar.pib.gov.in/WriteReadData/Magazine/2024/Jul/M202407161.pdf"],
    ["Rekhta Foundation", "https://www.rekhta.org/artists/premchand/profile"],
  ],
  "india:perumal_murugan": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/perumal-murugan"],
    ["Penguin Random House India", "https://www.penguin.co.in/book_author/perumal-murugan/"],
  ],
  "india:r_k_narayan": [
    ["INFLIBNET / UGC MOOCs", "https://ugcmoocs.inflibnet.ac.in/assets/uploads/1/94/2875/et/R200225111102023131.pdf"],
    ["Sahitya Akademi", "https://www.sahitya-akademi.gov.in/awards/akademi%20samman_suchi.jsp"],
  ],
  "india:rohinton_mistry": [
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/rohinton-mistry"],
    ["University of Toronto Alumni", "https://alumni.utoronto.ca/news/featured-alumni/rohinton-mistry"],
  ],
  "india:ruskin_bond": [
    ["Penguin Random House India", "https://www.penguin.co.in/book_author/ruskin-bond/"],
    ["DD News / Prasar Bharati", "https://www.newsonair.gov.in/bulletins-detail/aaj-savere-70/"],
  ],
  "india:sharat_chandra_chattopadhyay": [
    ["Banglapedia, Asiatic Society of Bangladesh", "https://en.banglapedia.org/index.php?title=Chattopadhyay%2C_Sharat_Chandra"],
    ["Rekhta Foundation", "https://www.rekhta.org/authors/sarat-chandra-chatterjee/profile"],
  ],
  "india:subramania_bharati": [
    ["Department of Art and Culture, Government of Puducherry", "https://art.py.gov.in/mahakavi-bharathiyar-museum"],
    ["Press Information Bureau, Government of India", "https://www.pib.gov.in/newsite/printrelease.aspx?lang=2&reg=3&relid=148927"],
  ],
  "india:surdas": [
    ["National Endowment for the Humanities", "https://www.neh.gov/humanities/2015/mayjune/curio/murty-classical-library-india-sheds-light-sixteenth-century-lyrical-po"],
    ["Lakshmi Mittal and Family South Asia Institute, Harvard University", "https://mittalsouthasiainstitute.harvard.edu/2015/01/murty-classical-library-of-india-introduces-indian-literature-to-a-new-generation/"],
  ],
  "india:tulsidas": [
    ["Encyclopedia of Religion via Encyclopedia.com", "https://www.encyclopedia.com/environment/encyclopedias-almanacs-transcripts-and-maps/tulsidas"],
    ["State Council of Educational Research and Training, Telangana", "https://scert.telangana.gov.in/pdf/publication/ebooks2019/7th%20social%20part2%202022-23.pdf"],
  ],
  "india:v_s_naipaul": [
    ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/2001/naipaul/biographical/"],
    ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/in-a-free-state"],
  ],
  "india:valmiki": [
    ["Valmiki Ramayanam Project, IIT Kanpur", "https://www.valmiki.iitk.ac.in/introduction"],
    ["Michael C. Carlos Museum, Emory University", "https://digitalprojects.carlos.emory.edu/exhibits/show/ramayana/ramayana-intro"],
  ],
  "india:vikram_seth": [
    ["Stanford Magazine, Stanford University", "https://web.stanford.edu/~clh/articles/poetic_License.html"],
    ["Sahitya Akademi, Government of India", "https://www.sahitya-akademi.gov.in/awards/akademi%20samman_suchi.jsp"],
  ],
  "india:vyasa": [
    ["Большая российская энциклопедия", "https://old.bigenc.ru/religious_studies/text/2380511"],
    ["Treccani, Enciclopedia Italiana", "https://www.treccani.it/enciclopedia/vyasa_%28Enciclopedia-Italiana%29/"],
  ],
  "indonesia:achdiyat_karta_mihardja": [
    ["Ensiklopedia Sastra Indonesia, Ministry of Education and Culture of Indonesia", "https://ensiklopedia.kemdikbud.go.id/sastra/artikel/Achdiat_Karta_Mihardja"],
    ["University of Indonesia Library", "https://lib.ui.ac.id/detail.jsp?id=20237803"],
  ],
  "indonesia:goenawan_mohamad": [
    ["Ensiklopedia Sastra Indonesia, Ministry of Education of Indonesia", "https://ensiklopedia.kemendikdasmen.go.id/sastra/artikel/Goenawan_Mohamad"],
    ["Dan David Prize", "https://dandavidprize.org/laureates/goenawan-mohamad/"],
  ],
  "indonesia:hamka": [
    ["Badan Pengembangan dan Pembinaan Bahasa, Ministry of Education of Indonesia", "https://bahasa-dev.kemendikdasmen.go.id/tokoh-detail/3349/hamka"],
    ["Majelis Ulama Indonesia", "https://mui.or.id/public/index.php/baca/berita/halal-tourism-hub-buya-hamka-ikon-pariwisata-ramah-muslim"],
  ],
  "indonesia:pramoedya_ananta_toer": [
    ["Ensiklopedia Sastra Indonesia, Ministry of Education of Indonesia", "https://ensiklopedia.kemendikdasmen.go.id/sastra/artikel/Pramoedya_Ananta_Toer"],
    ["Ramon Magsaysay Award Foundation", "https://rmaward.asia/rmawardees/pramoedya-ananta-toer/"],
  ],
  "iran:ferdowsi": [
    ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/ferdowsi-i/"],
    ["Library of Congress", "https://www.loc.gov/exhibits/thousand-years-of-the-persian-book/epic-of-shahnameh.html"],
  ],
};

const seeds = [
  [
    "india:amitav_ghosh",
    {
      birthDate: "1956",
      works: ["Стеклянный дворец", "Маковое море", "Ибисская трилогия"],
    },
    "Publishes only the source-supported birth year and removes the unverified title «Остров Павлина».",
  ],
  [
    "india:anil_menon",
    {
      years: "",
      birthDate: "",
      birthPlace: "",
      works: ["The Beast with Nine Billion Feet", "Half of What I Say"],
    },
    "Withholds the unsupported 1970 birth year and place and normalizes the verified novel title.",
  ],
  [
    "india:anita_desai",
    {
      birthDate: "1937",
      works: ["Огонь на горе", "Чистый свет дня", "In Custody"],
    },
    "Reduces the birth date to the verified year and replaces an unverified literal title with the documented novel.",
  ],
  [
    "india:bankim_chandra_chatterjee",
    {
      name: "Банким Чандра Чаттопадхьяй",
      fullName: "Bankim Chandra Chattopadhyaya",
      works: ["Анандаматх", "Капалакундала", "Деви Чаудхурани"],
    },
    "Uses the source-language surname form and normalizes the documented title Anandamath without altering unverified exact dates.",
  ],
  [
    "india:bhartrihari",
    {
      birthDate: "",
      deathDate: "",
      works: ["Шатакатрая"],
    },
    "Removes false date precision and keeps only the poetic collection attributed to Bhartrihari; the disputed grammarian identity is not merged into the card.",
  ],
  [
    "india:bhavabhuti",
    {
      years: "ок. VIII век",
      birthDate: "",
      deathDate: "",
      works: ["Уттарарамачарита", "Малатимадхава", "Махавирачарита"],
    },
    "Represents only the approximate period of activity and normalizes the titles of the three surviving plays.",
  ],
  [
    "india:chetan_bhagat",
    {
      works: ["Five Point Someone", "The 3 Mistakes of My Life", "2 States"],
    },
    "Replaces unverified literal Russian renderings with the documented original titles; unverified life fields are not changed by guesswork.",
  ],
  [
    "india:geetanjali_shree",
    {
      birthDate: "1957",
      birthPlace: "Майнпури, Уттар-Прадеш, Индия",
      coordinates: undefined,
    },
    "Corrects the false Manipur birthplace, reduces the date to verified year precision and withholds coordinates that pointed to another city.",
  ],
  [
    "india:jaishankar_prasad",
    {
      years: "1889/1890-1937",
      birthDate: "",
      deathDate: "1937-11-15",
      works: ["Камаяни", "Скандгупта", "Чандрагупта"],
    },
    "Corrects the consistently documented death date, exposes the institutional conflict over the birth year and normalizes the title typography.",
  ],
  [
    "india:jeet_thayil",
    {
      birthDate: "1959",
      works: ["Наркополис"],
    },
    "Reduces the birth date to supported year precision and removes the non-bibliographic placeholder «Стихи».",
  ],
  [
    "india:jhumpa_lahiri",
    {
      birthDate: "1967",
      works: ["Толкователь болезней", "Тёзка", "Низина"],
    },
    "Reduces the birth date to supported year precision and corrects the Russian title spelling.",
  ],
  [
    "india:kabir",
    {
      years: "XV век",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
      language: "",
      works: ["Стихи Кабира (традиционная атрибуция)"],
    },
    "Removes traditional dates and places presented as facts and labels the transmitted poetic corpus as an attribution.",
  ],
  [
    "india:kalidasa",
    {
      years: "ок. IV-V век",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
    },
    "Keeps only the approximate scholarly period and removes invented life-date and place precision.",
  ],
  [
    "india:khushwant_singh",
    {
      awards: ["Падма Бхушан 1974 года", "Падма Вибхушан 2007 года"],
    },
    "Adds the documented Padma Vibhushan while preserving the documented 1974 Padma Bhushan.",
  ],
  [
    "india:kiran_desai",
    {
      birthDate: "1971",
      works: ["Hullabaloo in the Guava Orchard", "Наследие потерь"],
    },
    "Reduces the birth date to verified year precision and replaces the false title «Туристический город».",
  ],
  [
    "india:mirabai",
    {
      years: "конец XV - середина XVI века",
      birthDate: "ок. 1498",
      deathDate: "",
      birthPlace: "окрестности Мерты, Раджастхан",
      deathPlace: "",
      works: ["Бхаджаны, приписываемые Мирабаи"],
    },
    "Preserves the traditional approximate birth information, removes unsupported death precision and marks the song corpus as attributed.",
  ],
  [
    "india:munshi_premchand",
    {
      fullName: "Dhanpat Rai Srivastava",
      birthPlace: "Ламхи близ Варанаси, Британская Индия",
      deathPlace: "Варанаси, Британская Индия",
      works: ["Годан", "Габан", "Нирмала", "Севасадан"],
    },
    "Adds the documented personal name, normalizes historical places and replaces an unverified title with attested novels.",
  ],
  [
    "india:perumal_murugan",
    {
      birthPlace: "Тамилнад, Индия",
      works: [
        "One Part Woman",
        "Poonachi, or The Story of a Black Goat",
        "Pyre",
        "Fire Bird",
      ],
      awards: ["Премия JCB по литературе 2023 года"],
    },
    "Uses the supported birthplace granularity, replaces an unattested title and corrects the JCB award year and work set.",
  ],
  [
    "india:r_k_narayan",
    {
      fullName: "Rasipuram Krishnaswami Narayan",
      birthPlace: "Мадрас (ныне Ченнаи), Британская Индия",
      works: ["Свами и его друзья", "Дни Мальгуди", "Гид"],
      awards: ["Премия Сахитья Академи 1960 года за роман «Гид»"],
    },
    "Adds the documented full name, historical birthplace, replaces a place name with a book title and corrects the Sahitya Akademi award year.",
  ],
  [
    "india:rohinton_mistry",
    {
      works: ["Such a Long Journey", "A Fine Balance", "Family Matters"],
      awards: [
        "Премия генерал-губернатора Канады 1991 года за роман «Such a Long Journey»",
      ],
    },
    "Publishes the three documented titles and adds the verified year and work for the Governor General's Award.",
  ],
  [
    "india:ruskin_bond",
    {
      works: ["The Room on the Roof", "The Blue Umbrella", "The Night Train at Deoli"],
    },
    "Replaces an inaccurate plural rendering with the documented title and keeps a consistently sourced bibliography.",
  ],
  [
    "india:sharat_chandra_chattopadhyay",
    {
      birthPlace: "Дебанандапур, Британская Индия",
      deathPlace: "Калькутта, Британская Индия",
      works: ["Девдас", "Шриканта", "Паринита"],
    },
    "Normalizes the historical places and replaces an unmatched title with the documented novel «Паринита».",
  ],
  [
    "india:subramania_bharati",
    {
      name: "Субрамания Бхарати",
      works: ["Каннан патту", "Куйил патту", "Панчали сапатам"],
    },
    "Normalizes the Russian display name and replaces the truncated work title with three documented works.",
  ],
  [
    "india:surdas",
    {
      years: "XVI век",
      birthDate: "",
      deathDate: "",
      works: ["Сурсагар (традиционная атрибуция)"],
    },
    "Removes incompatible traditional life dates and marks the evolving Sur Sagar corpus as an attribution.",
  ],
  [
    "india:tulsidas",
    {
      years: "традиционно ок. 1532-1623",
      birthDate: "ок. 1532",
      language: "авадхи",
      works: ["Рамачаритманас", "Виная-патрика"],
    },
    "Labels the disputed birth year as traditional, corrects the language name and normalizes documented titles.",
  ],
  [
    "india:v_s_naipaul",
    {
      nationality: "британец, родившийся в Тринидаде в семье индийского происхождения",
    },
    "Replaces the ambiguous origin-only field with the source-supported national and biographical description.",
  ],
  [
    "india:valmiki",
    {
      years: "даты жизни не установлены",
      birthDate: "",
      deathDate: "",
      works: ["Рамаяна (традиционная атрибуция)"],
    },
    "Separates the epic's broad textual dating from the legendary author's unknown life dates and marks authorship as traditional.",
  ],
  [
    "india:vikram_seth",
    {
      name: "Викрам Сет",
      awards: ["Премия Sahitya Akademi 1988 года за «Золотые ворота»"],
    },
    "Keeps the normalized display name and records the verified award year and cited work.",
  ],
  [
    "india:vyasa",
    {
      years: "даты жизни не установлены",
      birthDate: "",
      deathDate: "",
      works: [
        "Махабхарата (традиционная атрибуция)",
        "собрания Вед и Пуран (традиционная атрибуция)",
      ],
    },
    "Removes invented life-date precision and labels the works assigned to the legendary sage as traditional attributions.",
  ],
  [
    "indonesia:achdiyat_karta_mihardja",
    {
      birthPlace: "Чибату, Гарут, Западная Ява, Индонезия",
    },
    "Publishes the more precise birthplace documented by the Indonesian literary encyclopedia.",
  ],
  [
    "indonesia:goenawan_mohamad",
    {
      name: "Гунаван Мохамад",
      fullName: "Goenawan Susatyo Mohamad",
      works: ["Pariksit", "Interlude"],
      awards: ["Премия Дэна Дэвида 2006 года"],
    },
    "Corrects the false Russian display name, adds the documented full name and records the verified award.",
  ],
  [
    "indonesia:hamka",
    {
      birthDate: "1908-02-16",
    },
    "Corrects the birth date to 16 February, as agreed by two Indonesian institutional sources.",
  ],
  [
    "indonesia:pramoedya_ananta_toer",
    {
      works: ["Мир человеческий", "Дитя всех народов", "Следы", "Стеклянный дом"],
      awards: ["Премия Рамона Магсайсая 1995 года"],
    },
    "Publishes a consistent Russian rendering of the four documented Buru novels and adds the verified award year.",
  ],
  [
    "iran:ferdowsi",
    {
      years: "ок. 940 - ок. 1020",
      birthDate: "ок. 940",
      deathDate: "ок. 1020",
    },
    "Removes fabricated 1 January placeholders and preserves the uncertainty of both life dates.",
  ],
] satisfies readonly ProfileCorrectionSeed[];

function buildCorrection(
  [key, patch, note]: ProfileCorrectionSeed
): WriterPublicProfileFactCorrectionBatch32 {
  const evidence = evidenceSeeds[key];
  if (!evidence || evidence.length < 2) {
    throw new Error(`Missing Batch32 profile evidence for ${key}`);
  }

  const separatorIndex = key.indexOf(":");
  const countryId = key.slice(0, separatorIndex);
  const writerId = key.slice(separatorIndex + 1);

  return {
    countryId,
    writerId,
    patch,
    evidence: evidence.map(([provider, url]) => ({ provider, url, checkedAt })),
    note,
  };
}

export const writerBiographyPublicProfileFactCorrectionsBatch32 =
  seeds.map(buildCorrection);

import { createHash } from "node:crypto";

import {
  equivalentWorkTitle,
  extractExplicitWorkTitles,
} from "./writer-biography-work-titles.mjs";

const LITERARY_OCCUPATION_IDS = new Set([
  "Q36180", // writer
  "Q49757", // poet
  "Q6625963", // novelist
  "Q214917", // playwright
  "Q11774202", // essayist
  "Q4853732", // children's writer
  "Q18814623", // autobiographer
  "Q4263842", // science-fiction writer
]);

/**
 * Exact identity matches that were resolved against an authority or an
 * institutional biography even though a Wikidata date claim is wrong. This
 * prevents a bad date on an otherwise exact entity from quarantining a lawful
 * portrait or turning the person into a false-identity finding.
 */
export const WRITER_IDENTITY_MANUAL_CONFIRMATIONS = Object.freeze({
  "djibouti:aden_robleh_awaleh": {
    qid: "Q967740",
    note: "The exact full name, Djiboutian independence activity and the documented book Djibouti, clef de la mer Rouge establish Aden Robleh Awaleh; the official national biography supplies the corrected 1941-2014 life dates.",
    sources: [
      {
        title: "Aden Robleh Awaleh - La Nation, République de Djibouti",
        url: "https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/",
      },
      {
        title: "Aden Robleh Awaleh - Bibliothèque nationale de France",
        url: "https://catalogue.bnf.fr/ark%3A/12148/cb34933567g",
      },
    ],
  },
  "democratic_republic_of_congo:v_y_mudimbe": {
    qid: "Q3056528",
    note: "Duke University and the Cambridge University Press journal Africa identify Valentin-Yves Mudimbe as the Congolese philosopher, novelist, poet and author of The Invention of Africa, and independently record his death on 21 April 2025. The divergent Wikidata label and 22 April claim therefore do not identify a different person.",
    sources: [
      {
        title: "Valentin-Yves Mudimbe - Duke University",
        url: "https://trinity.duke.edu/news/literature-professor-valentin-yves-mudimbe-passes-away",
      },
      {
        title: "The life and work of V.-Y. Mudimbe - Cambridge University Press",
        url: "https://www.cambridge.org/core/journals/africa/article/life-and-work-of-vy-mudimbe-8-december-194121-april-2025/E7E89FC89E5B6CDAF870EA8B54A0D5E0",
      },
    ],
  },
  "england:agatha_christie": {
    qid: "Q35064",
    note: "The estate and British Library identify the English detective writer and playwright Agatha Christie and corroborate the exact mapped entity even though the compact card has no life dates.",
    sources: [
      {
        title: "Agatha Christie - official estate",
        url: "https://www.agathachristie.com/about-christie",
      },
      {
        title: "Agatha Christie - British Library",
        url: "https://www.bl.uk/about/press/releases/british-library-to-open-major-exhibition-on-agatha-christie",
      },
    ],
  },
  "england:alex_garland": {
    qid: "Q542634",
    note: "The publisher and British Film Institute establish Alex Garland as the British author of The Beach and a screenwriter-director, matching the mapped entity without importing an unsupported birth date.",
    sources: [
      {
        title: "The Beach - Penguin Books",
        url: "https://www.penguin.co.uk/books/56173/the-beach-by-garland-alex/9780241976562",
      },
      {
        title: "Alex Garland - British Film Institute",
        url: "https://www.bfi.org.uk/features/where-begin-with-alex-garland",
      },
    ],
  },
  "england:anthony_burgess": {
    qid: "Q217619",
    note: "The Anthony Burgess Foundation and Penguin identify the English novelist-composer and author of A Clockwork Orange, establishing the mapped entity.",
    sources: [
      {
        title: "Anthony Burgess - International Anthony Burgess Foundation",
        url: "https://www.anthonyburgess.org/about-anthony-burgess/",
      },
      {
        title: "A Clockwork Orange - Penguin Books",
        url: "https://www.penguin.co.uk/books/384903/a-clockwork-orange-by-anthony-burgess/9781407058542",
      },
    ],
  },
  "england:bede": {
    qid: "Q154938",
    note: "The British Library and Dickinson College identify the Anglo-Saxon monk, historian and theologian Bede and his Historia Ecclesiastica; approximate chronology remains approximate.",
    sources: [
      {
        title: "Bede - British Library",
        url: "https://www.bl.uk/stories/blogs/posts/bede-the-greatest-hits",
      },
      {
        title: "Bede, Historia Ecclesiastica - Dickinson College Commentaries",
        url: "https://dcc.dickinson.edu/bede-historia-ecclesiastica/intro/preface",
      },
    ],
  },
  "england:chaucer": {
    qid: "Q5683",
    note: "The Poetry Foundation and National Portrait Gallery establish Geoffrey Chaucer, his royal service and The Canterbury Tales; the public chronology deliberately remains approximate.",
    sources: [
      {
        title: "Geoffrey Chaucer - Poetry Foundation",
        url: "https://www.poetryfoundation.org/poets/geoffrey-chaucer",
      },
      {
        title: "Geoffrey Chaucer - National Portrait Gallery",
        url: "https://www.npg.org.uk/collections/search/person/mp00852/geoffrey-chaucer",
      },
    ],
  },
  "england:daniel_defoe": {
    qid: "Q40946",
    note: "The Poetry Foundation and National Portrait Gallery identify Daniel Defoe as the English writer and journalist associated with Robinson Crusoe; the approximate birth year is not promoted to an exact date.",
    sources: [
      {
        title: "Daniel Defoe - Poetry Foundation",
        url: "https://www.poetryfoundation.org/poets/daniel-defoe",
      },
      {
        title: "Daniel Defoe - National Portrait Gallery",
        url: "https://www.npg.org.uk/collections/search/person/mp01230/daniel-defoe",
      },
    ],
  },
  "england:diane_setterfield": {
    qid: "Q2550958",
    note: "The author's official biography and Simon & Schuster establish the British novelist Diane Setterfield and The Thirteenth Tale, matching the mapped entity without importing an unsupported birthday.",
    sources: [
      {
        title: "Diane Setterfield - official author site",
        url: "https://www.dianesetterfield.com/bio/",
      },
      {
        title: "The Thirteenth Tale - Simon & Schuster",
        url: "https://www.simonandschuster.com/books/The-Thirteenth-Tale/Diane-Setterfield/9780743298032",
      },
    ],
  },
  "england:edmund_spenser": {
    qid: "Q4352055",
    note: "The Poetry Foundation and National Portrait Gallery identify Edmund Spenser and The Faerie Queene; the approximate birth year remains approximate.",
    sources: [
      {
        title: "Edmund Spenser - Poetry Foundation",
        url: "https://www.poetryfoundation.org/poets/edmund-spenser",
      },
      {
        title: "Edmund Spenser - National Portrait Gallery",
        url: "https://www.npg.org.uk/collections/search/person/mp14383/edmund-spenser",
      },
    ],
  },
  "england:frederick_forsyth": {
    qid: "Q249197",
    note: "The National Portrait Gallery and publisher obituary establish Frederick Forsyth as the British journalist and thriller writer who died in 2025, matching the mapped entity.",
    sources: [
      {
        title: "Frederick Forsyth - National Portrait Gallery",
        url: "https://www.npg.org.uk/collections/search/person/mp05961/frederick-forsyth",
      },
      {
        title: "Frederick Forsyth obituary - Penguin Random House",
        url: "https://global.penguinrandomhouse.com/announcements/legendary-thriller-author-frederick-forsyth-passes-away-at-86/",
      },
    ],
  },
  "egypt:hamdi_abu_golayyel": {
    qid: "Q1573270",
    note: "The exact name, Egyptian writer identity and the two documented novels establish Hamdi Abu Golayyel; this confirmation does not choose between the conflicting 1967 and 1968 birth years.",
    sources: [
      {
        title: "Hamdi Abu Golayyel - AUC Press",
        url: "https://aucpress.com/author/hamdi-abu-golayyel/",
      },
      {
        title: "Hamdi Abu Golayyel - Words Without Borders",
        url: "https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/",
      },
    ],
  },
  "egypt:ibrahim_aslan": {
    qid: "Q3082457",
    note: "The exact name and authorship of The Heron and Nile Sparrows establish Ibrahim Aslan; this confirmation deliberately leaves the conflicting 1935/1936/1937 birth years unresolved.",
    sources: [
      {
        title: "Ibrahim Aslan - AUC Press",
        url: "https://aucpress.com/author/ibrahim-aslan/",
      },
      {
        title: "Ibrahim Aslan - Banipal",
        url: "https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/",
      },
    ],
  },
  "cyprus:alex_michaelides": {
    qid: "Q62071397",
    note: "The exact author name, Cypriot-British background, screenwriting work and authorship of The Silent Patient establish Alex Michaelides; the checked sources do not establish an exact birth date, so none is imported.",
    sources: [
      {
        title: "Alex Michaelides - Macmillan",
        url: "https://us.macmillan.com/author/alexmichaelides",
      },
      {
        title: "Alex Michaelides - Trinity College Cambridge",
        url: "https://www.trin.cam.ac.uk/alumni-interview/alex-michaelides/",
      },
    ],
  },
  "china:zhuangzi": {
    qid: "Q47739",
    note: "The exact Zhuangzi/Zhuang Zhou labels, Warring States context and association with the multi-layered Zhuangzi text establish the entity; the public card deliberately keeps approximate dates because the institutional sources emphasize the limits of the biography.",
    sources: [
      {
        title: "Zhuangzi - Stanford Encyclopedia of Philosophy",
        url: "https://plato.stanford.edu/entries/zhuangzi/",
      },
      {
        title: "Zhuangzi - Internet Encyclopedia of Philosophy, University of Tennessee at Martin",
        url: "https://iep.utm.edu/zhuangzi-chuang-tzu-chinese-philosopher/",
      },
    ],
  },
  "guatemala:luis_cardoza_y_aragon": {
    qid: "Q6700406",
    note: "The exact bilingual name, Guatemalan poet-diplomat identity, works and death date establish Q6700406 as Luis Cardoza y Aragon. Two official Guatemalan biographies establish 21 June 1901, so the conflicting 1904 Wikidata birth year is a data error rather than an identity mismatch.",
    sources: [
      {
        title: "Luis Cardoza y Aragon - Registro Nacional de las Personas de Guatemala",
        url: "https://www.renap.gob.gt/sites/default/files/publicaciones-renap/luis-cardoza-y-aragon-web.pdf",
      },
      {
        title: "Luis Cardoza y Aragon - Ministerio de Cultura y Deportes de Guatemala",
        url: "https://mcd.gob.gt/wp-content/uploads/2022/05/7-Poesi%E2%95%A0ua-de-Luis-Cardoza-y-Arago%E2%95%A0un-Lecturas-Bicentenarias.pdf",
      },
    ],
  },
  "french_guiana:leon_gontran_damas": {
    qid: "Q983363",
    note: "The Bibliotheque nationale de France authority record and the French National Assembly deputy database identify Leon-Gontran Damas, born in Cayenne on 28 March 1912 and deceased in Washington on 22 January 1978. These records establish both the mapped identity and the corrected public birth date.",
    sources: [
      {
        title: "Leon-Gontran Damas - Bibliotheque nationale de France",
        url: "https://catalogue.bnf.fr/ark:/12148/cb11898508m",
      },
      {
        title: "Leon Damas - Assemblee nationale",
        url: "https://www2.assemblee-nationale.fr/sycomore/fiche/2113",
      },
    ],
  },
  "tanzania:said_ahmed_mohamed": {
    qid: "Q16678223",
    note: "The university sources identify Said Ahmed Mohamed Khamis as the Zanzibar-born Tanzanian Swahili writer born on 12 December 1947; the shorter Wikidata label omits Khamis but describes the same person.",
    sources: [
      {
        title: "Said Ahmed Mohamed Khamis - Universität Bayreuth",
        url: "https://www.presse.uni-bayreuth.de/de/archiv/2012/194-Swahili-Kolloquium.pdf",
      },
      {
        title: "Said Ahmed Mohamed Khamis - University of Nairobi",
        url: "https://erepository.uonbi.ac.ke/server/api/core/bitstreams/1a972ff5-f647-4f39-9791-4f705e98abdf/content",
      },
    ],
  },
  "china:lao_tzu": {
    qid: "Q9333",
    note: "The authority labels and traditional attribution identify this mapping as the traditional Laozi figure. This confirmation does not establish Laozi's historicity or exact chronology.",
    sources: [
      {
        title: "Laozi - Stanford Encyclopedia of Philosophy",
        url: "https://plato.stanford.edu/archives/spr2026/entries/laozi/",
      },
      {
        title: "Лао-цзы - Большая российская энциклопедия",
        url: "https://bigenc.ru/c/lao-tszy-e153da",
      },
    ],
  },
  "china:luo_guanzhong": {
    qid: "Q264517",
    note: "The authority name, approximate fourteenth-century chronology and traditional attribution of Romance of the Three Kingdoms identify Luo Guanzhong. This confirmation does not resolve variants within the approximate dates.",
    sources: [
      {
        title: "Chinese Personal Names - Library of Congress",
        url: "https://www.loc.gov/catdir/cpso/CJKChap26.pdf",
      },
      {
        title: "Romance of the Three Kingdoms - Columbia University Asia for Educators",
        url: "https://video.afe.easia.columbia.edu/teaching-guides/romance-of-the-three-kingdoms-teaching-guide/",
      },
    ],
  },
  "china:shi_naian": {
    qid: "Q1777502",
    note: "The name and traditional attribution of Water Margin identify the Shi Nai'an figure used by this card. The biography and authorship remain incompletely documented, so this confirmation does not establish exact life dates or sole authorship.",
    sources: [
      {
        title: "The Story of Water Margin - Library of Congress",
        url: "https://blogs.loc.gov/international-collections/2017/07/the-story-of-water-margin-%E6%B0%B4%E6%BB%B8%E5%82%B3/",
      },
      {
        title: "Water Margin - Indiana University ScholarWorks",
        url: "https://scholarworks.iu.edu/iuswrrest/api/core/bitstreams/26a1a210-0ac4-4c83-9c3b-705fec901748/content",
      },
    ],
  },
  "china:sima_qian": {
    qid: "Q9372",
    note: "The Han-period historian and authorship of the Shiji identify Sima Qian. This confirmation deliberately leaves the competing approximate 145/135 BCE birth and 86/85 BCE death chronologies unresolved.",
    sources: [
      {
        title: "Records of the Grand Historian - Smithsonian Libraries and Archives",
        url: "https://www.si.edu/object/records-grand-historian-han-dynasty-sima-qian-translated-burton-watson%3Asiris_sil_886567",
      },
      {
        title: "Classical Chinese Historical Thought - Harvard University",
        url: "https://puett.scholars.harvard.edu/sites/g/files/omnuum3361/files/puett/files/puett_classical_chinese_historical_thought_8.pdf",
      },
    ],
  },
  "china:wu_chengen": {
    qid: "Q228889",
    note: "The Ming writer and traditional attribution of Journey to the West identify Wu Cheng'en. This confirmation does not promote approximate life dates to exact dates or remove the attribution caveat.",
    sources: [
      {
        title: "Wu Cheng'en - British Museum",
        url: "https://www.britishmuseum.org/collection/object/A_1947-0712-160",
      },
      {
        title: "Xiyou zhen quan - University of Southern California Chinese Rare Books",
        url: "https://scalar.usc.edu/works/chinese-rare-books/media/xiyouzhenquan",
      },
    ],
  },
  "china:cao_xueqin": {
    qid: "Q182874",
    note: "The exact RU/EN labels, Qing-era literary role and authorship of Dream of the Red Chamber identify Cao Xueqin; the Library of Congress and Harvard sources support the deliberately approximate ca. 1715-ca. 1763 display rather than a false exact birth date.",
    sources: [
      {
        title: "Dream of the Red Chamber - Library of Congress",
        url: "https://www.loc.gov/resource/gdcwdl.wdl_13547/?sp=5&st=list",
      },
      {
        title: "The Story of the Stone - Fairbank Center for Chinese Studies, Harvard University",
        url: "https://fairbank.fas.harvard.edu/events/wei-shang-the-story-of-the-stone-and-the-visual-culture-of-the-manchu-court/",
      },
    ],
  },
  "chile:diamela_eltit": {
    qid: "Q2032745",
    note: "The exact RU/EN labels, Chilean authorship, national-literature award and institutional biography identify Diamela Eltit; only Wikidata's 1947 birth-year claim conflicts with the Universidad de Chile record for 1949.",
    sources: [
      {
        title: "Diamela Eltit González - Universidad de Chile",
        url: "https://uchile.cl/presentacion/historia/grandes-figuras/premios-nacionales/literatura/diamela-eltit-gonzalez",
      },
      {
        title: "Diamela Eltit - Ministerio de las Culturas, las Artes y el Patrimonio",
        url: "https://www.cultura.gob.cl/institucional/ministra-de-las-culturas-anuncia-a-diamela-eltit-como-la-ganadora-del-premio-nacional-de-literatura-2018/",
      },
    ],
  },
  "colombia:santiago_gamboa": {
    qid: "Q2420039",
    note: "The entity identifiers, occupations, Colombian citizenship, authority links and Commons portrait identify the novelist Santiago Gamboa; only its 1962 birth-year claim conflicts with the institutional biography.",
    sources: [
      {
        title: "Santiago Gamboa - Instituto Cervantes de Lyon",
        url: "https://cultura.cervantes.es/lyon/es/Santiago-Gamboa/185167",
      },
      {
        title: "Santiago Gamboa - Europa Editions",
        url: "https://www.europaeditions.com/author/119/santiago-gamboa",
      },
    ],
  },
  "england:hilary_mantel": {
    qid: "Q465700",
    note: "The Booker Prize archive and Macmillan identify Hilary Mantel, her Cromwell trilogy and its two Booker-winning novels, establishing the mapped writer identity.",
    sources: [
      {
        title: "Hilary Mantel - The Booker Prizes",
        url: "https://thebookerprizes.com/the-booker-library/authors/hilary-mantel",
      },
      {
        title: "Hilary Mantel - Macmillan",
        url: "https://us.macmillan.com/author/hilarymantel/",
      },
    ],
  },
  "england:ian_mcewan": {
    qid: "Q190379",
    note: "The Booker Prize archive and the author's official bibliography identify Ian McEwan and his Booker-winning novel Amsterdam, establishing the mapped writer identity.",
    sources: [
      {
        title: "Ian McEwan - The Booker Prizes",
        url: "https://thebookerprizes.com/the-booker-library/authors/ian-mcewan",
      },
      {
        title: "Amsterdam - Ian McEwan official website",
        url: "https://www.ianmcewan.com/books/amsterdam.html",
      },
    ],
  },
  "england:joanne_harris": {
    qid: "Q234718",
    note: "The author's official biography and Hachette identify the Anglo-French novelist Joanne Harris and the documented novels, establishing the mapped identity without inventing a day-level birth date.",
    sources: [
      {
        title: "Joanne Harris - official website",
        url: "https://www.joanne-harris.co.uk/about/",
      },
      {
        title: "Joanne Harris - Hachette UK",
        url: "https://www.hachette.co.uk/contributor/joanne-harris/",
      },
    ],
  },
  "england:john_le_carre": {
    qid: "Q209641",
    note: "The official estate biography and the Bodleian archive identify John le Carré as David John Moore Cornwell and document his intelligence service and literary archive, establishing the mapped identity.",
    sources: [
      {
        title: "John le Carré - official biography",
        url: "https://johnlecarre.com/biography/",
      },
      {
        title: "John le Carré archive - Bodleian Libraries",
        url: "https://archives.bodleian.ox.ac.uk/repositories/2/resources/14397",
      },
    ],
  },
  "england:john_marrs": {
    qid: "Q64014274",
    note: "The author's official biography and Pan Macmillan identify the British novelist and his documented thrillers, establishing the mapped identity without importing an unsupported birth date.",
    sources: [
      {
        title: "John Marrs - official biography",
        url: "https://www.johnmarrsauthor.com/about",
      },
      {
        title: "John Marrs - Pan Macmillan",
        url: "https://www.panmacmillan.com/authors/john-marrs/42734",
      },
    ],
  },
  "england:lee_child": {
    qid: "Q333719",
    note: "Macmillan and Simon & Schuster identify the British author Lee Child and the Jack Reacher series beginning with Killing Floor, establishing the mapped identity.",
    sources: [
      {
        title: "Lee Child - Macmillan",
        url: "https://us.macmillan.com/author/leechild",
      },
      {
        title: "Lee Child - Simon & Schuster",
        url: "https://www.simonandschuster.com/authors/Lee-Child/260099991",
      },
    ],
  },
  "england:oliver_goldsmith": {
    qid: "Q236236",
    note: "The Russian Great Encyclopedia and the National Portrait Gallery identify the same Irish-born writer Oliver Goldsmith and his documented works. Their disagreement over 1728 versus 1730 is retained as date uncertainty, not an identity conflict.",
    sources: [
      {
        title: "Оливер Голдсмит - Большая российская энциклопедия",
        url: "https://old.bigenc.ru/literature/text/2366524",
      },
      {
        title: "Oliver Goldsmith - National Portrait Gallery",
        url: "https://www.npg.org.uk/collections/search/personExtended/mp01810/oliver-goldsmith?tab=biography",
      },
    ],
  },
  "england:paula_hawkins": {
    qid: "Q20732317",
    note: "Bloomsbury and Penguin identify the Zimbabwe-born British novelist Paula Hawkins and The Girl on the Train, establishing the mapped identity.",
    sources: [
      {
        title: "Paula Hawkins - Bloomsbury",
        url: "https://www.bloomsbury.com/uk/author/paula-hawkins/",
      },
      {
        title: "The Girl on the Train - Penguin Books",
        url: "https://www.penguin.co.uk/books/434488/the-girl-on-the-train-by-hawkins-paula/9781448171682",
      },
    ],
  },
  "england:rafael_sabatini": {
    qid: "Q345104",
    note: "Penguin Random House and EBSCO identify the Italy-born British historical novelist Rafael Sabatini and his documented works, establishing the mapped identity.",
    sources: [
      {
        title: "Rafael Sabatini - Penguin Random House",
        url: "https://www.penguinrandomhouse.com/authors/26615/rafael-sabatini/",
      },
      {
        title: "Rafael Sabatini - EBSCO Research",
        url: "https://www.ebsco.com/research-starters/biography/rafael-sabatini",
      },
    ],
  },
  "england:stuart_turton": {
    qid: "Q55474411",
    note: "DHH Literary Agency and Bloomsbury identify the British novelist-journalist Stuart Turton and his documented novels, establishing the mapped identity without importing an unsupported precise birthday.",
    sources: [
      {
        title: "Stuart Turton - DHH Literary Agency",
        url: "https://www.dhhliteraryagency.com/stuart-turton",
      },
      {
        title: "Stuart Turton - Bloomsbury",
        url: "https://www.bloomsbury.com/uk/author/stuart-turton/",
      },
    ],
  },
  "england:t_s_eliot": {
    qid: "Q37767",
    note: "The Nobel Prize archive and the official T. S. Eliot estate identify Thomas Stearns Eliot; the compact Wikidata label is an abbreviation of the same person.",
    sources: [
      {
        title: "T. S. Eliot - Nobel Prize",
        url: "https://www.nobelprize.org/prizes/literature/1948/eliot/",
      },
      {
        title: "T. S. Eliot - official estate and Faber & Faber",
        url: "https://tseliot.com/foundation/about/",
      },
    ],
  },
  "eritrea:alemseged_tesfai": {
    qid: "Q55991620",
    note: "Bloomsbury and Hurst identify the Eritrean playwright-historian Alemseged Tesfai and his documented works; the publisher biographies also establish the corrected 1944 birth year.",
    sources: [
      {
        title: "Alemseged Tesfai - Bloomsbury Publishing",
        url: "https://www.bloomsbury.com/us/author/alemseged-tesfai/",
      },
      {
        title: "Alemseged Tesfai - C. Hurst & Co. Publishers",
        url: "https://www.hurstpublishers.com/wp-content/uploads/2024/03/LBF24-Hurst-catalogue-lo-res-RGB.pdf",
      },
    ],
  },
  "finland:mikael_agricola": {
    qid: "Q215346",
    note: "The National Library of Finland and Finnish Literature Society identify Mikael Agricola, his Reformation-era printed works and his role in the Finnish literary language; the birth year remains explicitly approximate.",
    sources: [
      {
        title: "Mikael Agricola - National Library of Finland",
        url: "https://kansalliskirjasto.finna.fi/Record/doria.10024_130474",
      },
      {
        title: "Mikael Agricola - Finnish Literature Society",
        url: "https://www.finna.fi/Record/sks_doabooks.19784",
      },
    ],
  },
  "france:chretien_de_troyes": {
    qid: "Q4302",
    note: "The BnF and Yale identify Chrétien de Troyes and his Arthurian romances; the public profile deliberately uses only the second half of the twelfth century because exact life years are not documented.",
    sources: [
      {
        title: "Quêtes arthuriennes - Bibliothèque nationale de France",
        url: "https://cdn.essentiels.bnf.fr/uploads/media/attachment/20220321123022000000_quetesarthuriennes.pdf",
      },
      {
        title: "The Romances of Chrétien de Troyes - Yale University Press",
        url: "https://yalebooks.yale.edu/book/9780300133707/the-romances-of-chretien-de-troyes/",
      },
    ],
  },
  "france:franck_thilliez": {
    qid: "Q779144",
    note: "The BnF and Simon & Schuster identify French thriller writer and screenwriter Franck Thilliez and his documented novels, establishing the mapped identity and retaining the authority birth date.",
    sources: [
      {
        title: "Franck Thilliez - Bibliothèque nationale de France",
        url: "https://www.bnf.fr/fr/mediatheque/franck-thilliez",
      },
      {
        title: "Franck Thilliez - Simon & Schuster",
        url: "https://www.simonandschuster.com/authors/Franck-Thilliez/228575065",
      },
    ],
  },
  "france:francois_rabelais": {
    qid: "Q131018",
    note: "The BnF and Musée Rabelais identify François Rabelais, the humanist physician and author of the Gargantua-Pantagruel cycle; the public profile keeps the documented 1483/1494 birth-year dispute visible.",
    sources: [
      {
        title: "François Rabelais - Bibliothèque nationale de France",
        url: "https://catalogue.bnf.fr/ark%3A/12148/cb11920939s",
      },
      {
        title: "François Rabelais - Musée Rabelais",
        url: "https://www.musee-rabelais.fr/le-musee/rabelais/sa-vie/",
      },
    ],
  },
  "france:racine": {
    qid: "Q742",
    note: "The Académie française and Comédie-Française identify Jean Racine and his tragedies; the public life dates agree with the Academy biography.",
    sources: [
      {
        title: "Jean Racine - Académie française",
        url: "https://www.academie-francaise.fr/les-immortels/jean-racine",
      },
      {
        title: "Andromaque - Comédie-Française",
        url: "https://www.comedie-francaise.fr/2013-2014/andromaque",
      },
    ],
  },
  "georgia:shota_rustaveli": {
    qid: "Q132984",
    note: "The Georgian Encyclopedia and UNESCO identify Shota Rustaveli as the Georgian court poet associated with The Knight in the Panther's Skin, establishing the exact curated entity without promoting disputed exact life dates.",
    sources: [
      {
        title: "Shota Rustaveli - Georgian Encyclopedia",
        url: "https://www.georgianencyclopedia.ge/en/form_eng/903",
      },
      {
        title: "Shota Rustaveli manuscript collection - UNESCO Memory of the World",
        url: "https://www.unesco.org/en/memory-world/manuscript-collection-shota-rustavelis-poem-knight-panthers-skin",
      },
    ],
  },
  "germany:hartmann_von_aue": {
    qid: "Q75852",
    note: "Deutsche Biographie and the Deutsche Nationalbibliothek identify the medieval German poet and knight Hartmann von Aue and document Erec, Iwein, Gregorius and Der arme Heinrich; the chronology remains deliberately approximate.",
    sources: [
      {
        title: "Hartmann von Aue - Deutsche Biographie",
        url: "https://www.deutsche-biographie.de/sfz26217.html",
      },
      {
        title: "Hartmann von Aue - Deutsche Nationalbibliothek",
        url: "https://d-nb.info/gnd/118546228",
      },
    ],
  },
  "germany:sebastian_brant": {
    qid: "Q60351",
    note: "Deutsche Biographie and the Deutsche Nationalbibliothek identify Sebastian Brant, his 1458-1521 chronology and his authorship of Das Narrenschiff, establishing the exact curated entity.",
    sources: [
      {
        title: "Sebastian Brant - Deutsche Biographie",
        url: "https://www.deutsche-biographie.de/gnd118514474.html",
      },
      {
        title: "Sebastian Brant - Deutsche Nationalbibliothek",
        url: "https://d-nb.info/gnd/118514474",
      },
    ],
  },
  "germany:walther_von_der_vogelweide": {
    qid: "Q44385",
    note: "Deutsche Biographie and the Deutsche Nationalbibliothek identify Walther von der Vogelweide as the medieval German lyric poet associated with Minnesang and the surviving manuscript tradition; approximate dates remain approximate.",
    sources: [
      {
        title: "Walther von der Vogelweide - Deutsche Biographie",
        url: "https://www.deutsche-biographie.de/sfz84442.html",
      },
      {
        title: "Walther von der Vogelweide - Deutsche Nationalbibliothek",
        url: "https://d-nb.info/gnd/118628976",
      },
    ],
  },
  "germany:wolfram_von_eschenbach": {
    qid: "Q18821",
    note: "Deutsche Biographie and Heidelberg University Library identify Wolfram von Eschenbach as the medieval German poet responsible for Parzival and Willehalm; approximate dates remain approximate.",
    sources: [
      {
        title: "Wolfram von Eschenbach - Deutsche Biographie",
        url: "https://www.deutsche-biographie.de/sfz98512.html",
      },
      {
        title: "Parzival manuscript - Universitätsbibliothek Heidelberg",
        url: "https://digi.ub.uni-heidelberg.de/diglit/cpg339i",
      },
    ],
  },
});

/**
 * Source decisions made by a human after comparing the staging value with a
 * stronger or more direct authority. They suppress only the named field/value
 * pair; all other automated checks continue to run.
 */
export const WRITER_FACT_MANUAL_RESOLUTIONS = Object.freeze({
  "democratic_republic_of_congo:v_y_mudimbe": [
    {
      field: "deathDate",
      cardValue: "2025-04-21",
      stagingValue: "",
      decision: "retain-authority-confirmed-card",
      note: "Duke University states that Mudimbe died on 21 April 2025, and the Cambridge University Press journal Africa independently gives the same date. The conflicting 22 April Wikidata claim is not promoted.",
      sources: [
        {
          title: "Valentin-Yves Mudimbe - Duke University",
          url: "https://trinity.duke.edu/news/literature-professor-valentin-yves-mudimbe-passes-away",
        },
        {
          title: "The life and work of V.-Y. Mudimbe - Cambridge University Press",
          url: "https://www.cambridge.org/core/journals/africa/article/life-and-work-of-vy-mudimbe-8-december-194121-april-2025/E7E89FC89E5B6CDAF870EA8B54A0D5E0",
        },
      ],
    },
  ],
  "england:oliver_goldsmith": [
    {
      field: "birthDate",
      cardValue: "",
      stagingValue: "1728-11-10",
      decision: "withheld-conflicting-sources",
      note: "The exact birth year is disputed: the Russian Great Encyclopedia gives 10 November 1730, while the National Portrait Gallery uses 1728. The public card therefore does not present either year as certain.",
      sources: [
        {
          title: "Оливер Голдсмит - Большая российская энциклопедия",
          url: "https://old.bigenc.ru/literature/text/2366524",
        },
        {
          title: "Oliver Goldsmith - National Portrait Gallery",
          url: "https://www.npg.org.uk/collections/search/personExtended/mp01810/oliver-goldsmith?tab=biography",
        },
      ],
    },
  ],
  "ecuador:lupe_rumazo": [
    {
      field: "birthDate",
      cardValue: "1933-10-14",
      stagingValue: "",
      decision: "corrected-card",
      note: "The false 1904 birth date was replaced with the Casa de la Cultura authority date.",
      sources: [
        {
          title: "Lupe Rumazo - Academia Ecuatoriana de la Lengua",
          url: "https://www.academiaecuatorianadelalengua.org/sra-d-a-lupe-rumazo-de-alzamora/",
        },
        {
          title: "Lupe Rumazo - Casa de la Cultura Ecuatoriana authority record",
          url: "https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=7275&marc=1",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "",
      stagingValue: "",
      decision: "removed-unsupported-value",
      note: "The false 2004 death date was removed because the checked authority sources do not establish a death date.",
      sources: [
        {
          title: "Lupe Rumazo - Academia Ecuatoriana de la Lengua",
          url: "https://www.academiaecuatorianadelalengua.org/sra-d-a-lupe-rumazo-de-alzamora/",
        },
        {
          title: "Lupe Rumazo - Casa de la Cultura Ecuatoriana authority record",
          url: "https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=7275&marc=1",
        },
      ],
    },
  ],
  "egypt:hamdi_abu_golayyel": [
    {
      field: "birthDate",
      cardValue: "",
      stagingValue: "",
      decision: "withheld-conflicting-sources",
      note: "The existing 1967 year was withheld because the two checked institutional biographies disagree between 1967 and 1968.",
      sources: [
        {
          title: "Hamdi Abu Golayyel - AUC Press",
          url: "https://aucpress.com/author/hamdi-abu-golayyel/",
        },
        {
          title: "Hamdi Abu Golayyel - Words Without Borders",
          url: "https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "2023",
      stagingValue: "",
      decision: "corrected-card",
      note: "Both checked biographies establish the 2023 death year.",
      sources: [
        {
          title: "Hamdi Abu Golayyel - AUC Press",
          url: "https://aucpress.com/author/hamdi-abu-golayyel/",
        },
        {
          title: "Hamdi Abu Golayyel - Words Without Borders",
          url: "https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/",
        },
      ],
    },
  ],
  "egypt:ibrahim_aslan": [
    {
      field: "birthDate",
      cardValue: "",
      stagingValue: "",
      decision: "withheld-conflicting-sources",
      note: "The existing 1935 year was withheld because the checked sources disagree among 1935, 1936 and 1937.",
      sources: [
        {
          title: "Ibrahim Aslan - AUC Press",
          url: "https://aucpress.com/author/ibrahim-aslan/",
        },
        {
          title: "Ibrahim Aslan - Banipal",
          url: "https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "2012",
      stagingValue: "",
      decision: "retained-source-agreement",
      note: "The checked sources agree on the 2012 death year already present in the card.",
      sources: [
        {
          title: "Ibrahim Aslan - AUC Press",
          url: "https://aucpress.com/author/ibrahim-aslan/",
        },
        {
          title: "Ibrahim Aslan - Banipal",
          url: "https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/",
        },
      ],
    },
  ],
  "england:christopher_marlowe": [
    {
      field: "birthDate",
      cardValue: "1564",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "26 February 1564 is Marlowe's baptism date, not an established birthday, so the public card keeps only the birth year.",
      sources: [
        {
          title: "Christopher Marlowe - Poetry Foundation",
          url: "https://www.poetryfoundation.org/poets/christopher-marlowe",
        },
        {
          title: "Christopher Marlowe - Royal Shakespeare Company",
          url: "https://www.rsc.org.uk/edward-ii/about-the-play/who-was-christopher-marlowe",
        },
      ],
    },
  ],
  "djibouti:aden_robleh_awaleh": [
    {
      field: "birthDate",
      cardValue: "1941",
      stagingValue: "",
      decision: "corrected-card",
      note: "The unsupported 1940 value was replaced by the 1941 year in the official Djiboutian biography.",
      sources: [
        {
          title: "Aden Robleh Awaleh - La Nation, République de Djibouti",
          url: "https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/",
        },
        {
          title: "Aden Robleh Awaleh - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark%3A/12148/cb34933567g",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "2014-10-31",
      stagingValue: "",
      decision: "corrected-card",
      note: "The public card now records the source-confirmed death date.",
      sources: [
        {
          title: "Aden Robleh Awaleh - La Nation, République de Djibouti",
          url: "https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/",
        },
        {
          title: "Aden Robleh Awaleh - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark%3A/12148/cb34933567g",
        },
      ],
    },
    {
      field: "birthPlace",
      cardValue: "Али-Сабих, Джибути",
      stagingValue: "",
      decision: "corrected-card",
      note: "Ali Sabieh replaces the generic and inaccurate Djibouti birthplace.",
      sources: [
        {
          title: "Aden Robleh Awaleh - La Nation, République de Djibouti",
          url: "https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/",
        },
        {
          title: "Aden Robleh Awaleh - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark%3A/12148/cb34933567g",
        },
      ],
    },
  ],
  "china:zhang_ling": [
    {
      field: "birthPlace",
      cardValue: "Ханчжоу, Чжэцзян, Китай",
      stagingValue: "",
      decision: "corrected-card",
      note: "The birthplace was corrected from Shanghai to Hangzhou, Zhejiang using the publisher biography and the author's official biography.",
      sources: [
        {
          title: "Ling Zhang - Penguin Random House",
          url: "https://www.penguinrandomhouse.com/authors/252959/ling-zhang/",
        },
        {
          title: "Zhang Ling - official author biography",
          url: "https://zhanglingwriter.com/",
        },
      ],
    },
  ],
  "colombia:hector_rojas_herazo": [
    {
      field: "deathDate",
      cardValue: "2002-04-11",
      stagingValue: "",
      decision: "corrected-card",
      note: "The death date was corrected from 19 April to 11 April 2002; the unresolved 1920/1921 birth-year variation remains unchanged.",
      sources: [
        {
          title: "Héctor Rojas Herazo - Editorial Universidad del Norte",
          url: "https://editorial.uninorte.edu.co/simeh/authors/view/id/16",
        },
        {
          title: "Héctor Rojas Herazo anthology - Universidad Externado de Colombia",
          url: "https://www.uexternado.edu.co/wp-content/uploads/2017/01/16-antologia-HectorRojasHerazo.pdf",
        },
      ],
    },
  ],
  "colombia:juan_carlos_botero": [
    {
      field: "birthDate",
      cardValue: "1960",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The checked institutional and publisher biographies establish 1960 but not 1 May, so the public card no longer invents day precision.",
      sources: [
        {
          title: "Juan Carlos Botero - Biblioteca Virtual del Banco de la República",
          url: "https://babel.banrepcultural.org/digital/collection/hernan-diaz/id/197/",
        },
        {
          title: "Juan Carlos Botero - Editorial Planeta",
          url: "https://www.planetadelibros.com.co/autor/juan-carlos-botero/000039139",
        },
      ],
    },
  ],
  "colombia:laura_restrepo": [
    {
      field: "birthDate",
      cardValue: "1950",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The checked institutional and publisher biographies establish 1950 but not 1 January, so only the year is published.",
      sources: [
        {
          title: "Laura Restrepo - Instituto Cervantes",
          url: "https://cultura.cervantes.es/estambul/es/laura-restrepo/166110",
        },
        {
          title: "Laura Restrepo - Penguin Libros",
          url: "https://www.penguinlibros.com/us/tematicas/367712-ebook-la-multitud-errante-9788410496613",
        },
      ],
    },
  ],
  "colombia:ricardo_silva_romero": [
    {
      field: "birthDate",
      cardValue: "1975-08-14",
      stagingValue: "",
      decision: "corrected-card",
      note: "The birth date was corrected from 14 February to 14 August 1975 using the university biographical record, with the publisher independently corroborating the year and identity.",
      sources: [
        {
          title: "Ricardo Silva Romero - Gobernación de Antioquia / Universidad Santo Tomás biography",
          url: "https://antioquia.gov.co/images/PDF2/Decretos/2023/12/2023070005714.pdf",
        },
        {
          title: "Ricardo Silva Romero - Penguin Libros",
          url: "https://www.penguinlibros.com/co/tematicas/83502-ebook-historia-oficial-del-amor-9789588948201",
        },
      ],
    },
  ],
  "comoros:salim_hatubou": [
    {
      field: "birthPlace",
      cardValue: "Хахайя, Нгазиджа, Коморы",
      stagingValue: "",
      decision: "corrected-card",
      note: "The generic country-only birthplace was replaced with the documented village Hahaya on Ngazidja.",
      sources: [
        {
          title: "Salim Hatubou - Ville de Marseille",
          url: "https://www.marseille.fr/culture/actualites/salim-hatubou-le-passeur-de-memoire",
        },
        {
          title: "Salim Hatubou - Takam Tikou, Bibliothèque nationale de France",
          url: "https://takamtikou.bnf.fr/actualites/2015-04-02/hommage-salim-hatubou-crivain-et-conteur-franco-comorien",
        },
      ],
    },
  ],
  "guatemala:luis_cardoza_y_aragon": [
    {
      field: "birthDate",
      cardValue: "1901-06-21",
      stagingValue: "",
      decision: "retain-current-card",
      note: "RENAP records 21 June 1901 and the Guatemalan Ministry of Culture independently records 1901. The conflicting 1904 Wikidata claim is therefore excluded from corrections while the verified public date is retained.",
      sources: [
        {
          title: "Luis Cardoza y Aragon - Registro Nacional de las Personas de Guatemala",
          url: "https://www.renap.gob.gt/sites/default/files/publicaciones-renap/luis-cardoza-y-aragon-web.pdf",
        },
        {
          title: "Luis Cardoza y Aragon - Ministerio de Cultura y Deportes de Guatemala",
          url: "https://mcd.gob.gt/wp-content/uploads/2022/05/7-Poesi%E2%95%A0ua-de-Luis-Cardoza-y-Arago%E2%95%A0un-Lecturas-Bicentenarias.pdf",
        },
      ],
    },
  ],
  "french_guiana:leon_gontran_damas": [
    {
      field: "birthDate",
      cardValue: "1912-03-28",
      stagingValue: "",
      decision: "corrected-card",
      note: "The erroneous 28 April date was corrected to 28 March 1912. The Bibliotheque nationale de France authority record and the French National Assembly deputy database independently give the same exact date.",
      sources: [
        {
          title: "Leon-Gontran Damas - Bibliotheque nationale de France",
          url: "https://catalogue.bnf.fr/ark:/12148/cb11898508m",
        },
        {
          title: "Leon Damas - Assemblee nationale",
          url: "https://www2.assemblee-nationale.fr/sycomore/fiche/2113",
        },
      ],
    },
  ],
  "tanzania:said_ahmed_mohamed": [
    {
      field: "birthDate",
      cardValue: "1947-12-12",
      stagingValue: "",
      decision: "corrected-card-and-country",
      note: "The false Comoros 1956 card was replaced by the source-supported Tanzania/Zanzibar identity and exact date 12 December 1947.",
      sources: [
        {
          title: "Said Ahmed Mohamed Khamis - Universität Bayreuth",
          url: "https://www.presse.uni-bayreuth.de/de/archiv/2012/194-Swahili-Kolloquium.pdf",
        },
        {
          title: "Said Ahmed Mohamed Khamis - University of Nairobi",
          url: "https://erepository.uonbi.ac.ke/server/api/core/bitstreams/1a972ff5-f647-4f39-9791-4f705e98abdf/content",
        },
      ],
    },
  ],
  "china:su_tong": [
    {
      field: "birthDate",
      cardValue: "1963-01-23",
      stagingValue: "",
      decision: "corrected-card",
      note: "The first-of-year placeholder was replaced with 23 January 1963 using two independent authority and national-encyclopedia records.",
      sources: [
        {
          title: "Su Tong - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark%3A/12148/cb122453866",
        },
        {
          title: "Su Tong - Store norske leksikon",
          url: "https://snl.no/Su_Tong",
        },
      ],
    },
  ],
  "chile:lina_meruane": [
    {
      field: "birthDate",
      cardValue: "1970",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The public card now keeps only the source-supported year 1970; the competing exact dates 25 May and 20 September are not established by the checked institutional and publisher biographies.",
      sources: [
        {
          title: "Lina Meruane - New York University Creative Writing in Spanish",
          url: "https://wp.nyu.edu/cwskjcc/autores/lina-meruane/",
        },
        {
          title: "Lina Meruane - Deep Vellum Publishing",
          url: "https://www.deepvellum.org/authors/lina-meruane",
        },
      ],
    },
  ],
  "cape_verde:ovidio_martins": [
    {
      field: "birthDate",
      cardValue: "1928-09-17",
      stagingValue: "",
      decision: "corrected-card",
      note: "The card date was corrected from 17 August to 17 September 1928 using the RTP/Lusa family-supported biographical record.",
      sources: [
        {
          title: "Ovídio Martins - RTP / Agência Lusa",
          url: "https://www.rtp.pt/noticias/cultura/ovidio-martins-poeta-e-ativista-cabo-verdiano-vai-ser-homenageado-em-lisboa_n478097",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1999-04-29",
      stagingValue: "",
      decision: "corrected-card",
      note: "The first-of-year placeholder was replaced with 29 April 1999 using the RTP/Lusa family-supported biographical record.",
      sources: [
        {
          title: "Ovídio Martins - RTP / Agência Lusa",
          url: "https://www.rtp.pt/noticias/cultura/ovidio-martins-poeta-e-ativista-cabo-verdiano-vai-ser-homenageado-em-lisboa_n478097",
        },
      ],
    },
  ],
  "chile:alberto_blest_gana": [
    {
      field: "birthDate",
      cardValue: "1830-05-04",
      stagingValue: "",
      decision: "retain-current-card",
      note: "Memoria Chilena records 4 May 1830 in its national-library materials; the conflicting Wikidata June claim is not promoted.",
      sources: [
        {
          title: "Alberto Blest Gana - Memoria Chilena, Biblioteca Nacional de Chile",
          url: "https://www.memoriachilena.gob.cl/602/w3-article-3273.html",
        },
        {
          title: "Don Alberto Blest Gana - Memoria Chilena",
          url: "https://www.memoriachilena.gob.cl/archivos2/pdfs/MC0009737.pdf",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1920-11-09",
      stagingValue: "",
      decision: "retain-current-card",
      note: "A Biblioteca Nacional de Chile document explicitly records 9 November 1920; the conflicting Wikidata 8 November claim is not promoted.",
      sources: [
        {
          title: "Don Alberto Blest Gana - Memoria Chilena",
          url: "https://www.memoriachilena.gob.cl/archivos2/pdfs/MC0009737.pdf",
        },
      ],
    },
  ],
  "chile:diamela_eltit": [
    {
      field: "birthDate",
      cardValue: "1949-08-24",
      stagingValue: "",
      decision: "retain-current-card",
      note: "The Universidad de Chile official biography supports 24 August 1949; the conflicting Wikidata 1947 claim is not promoted.",
      sources: [
        {
          title: "Diamela Eltit González - Universidad de Chile",
          url: "https://uchile.cl/presentacion/historia/grandes-figuras/premios-nacionales/literatura/diamela-eltit-gonzalez",
        },
      ],
    },
  ],
  "cape_verde:manuel_de_novas": [
    {
      field: "birthDate",
      cardValue: "1938-02-24",
      stagingValue: "",
      decision: "retain-current-card",
      note: "The Government of Cabo Verde obituary and the national news agency's commemorative record support the current biographical identity and 24 February 1938 date; the conflicting Wikidata December claim is not promoted.",
      sources: [
        {
          title: "Manuel d'Novas - Government of Cabo Verde, Ministry of Culture",
          url: "https://www.governo.cv/ministerio-da-cultura-manifesta-pesar-e-consternacao-pela-morte-de-manuel-dnovas/",
        },
        {
          title: "Manel d'Novas - Inforpress, Agência Cabo-verdiana de Notícias",
          url: "https://inforpress.cv/en/maneldnovasrecebetributoemlisboaparamarcaros15anossobreoseufalecimento",
        },
      ],
    },
  ],
  "bosnia:mehmed_beg_kapetanovic": [
    {
      field: "deathDate",
      cardValue: "1902-07-29",
      stagingValue: "",
      decision: "retain-current-card",
      note: "The Academy of Sciences and Arts of Bosnia and Herzegovina and the Croatian Encyclopedia support 29 July 1902; the conflicting Wikidata day is not promoted.",
      sources: [
        {
          title: "Mehmed-beg Kapetanović Ljubušak - ANUBiH",
          url: "https://bastina.anubih.ba/bitstreams/8a324c15-6395-44c8-a07b-6daa7c61339a/download",
        },
        {
          title: "Kapetanović Ljubušak, Mehmed-beg - Hrvatska enciklopedija",
          url: "https://www.enciklopedija.hr/clanak/kapetanovic-ljubusak-mehmed-beg",
        },
      ],
    },
  ],
  "angola:pepetela": [
    {
      field: "birthDate",
      cardValue: "1941-10-19",
      stagingValue: "1941-10-19",
      decision: "corrected-card",
      note: "The card was corrected from 1941-10-29 to 1941-10-19 using the Russian encyclopedia entry.",
      sources: [
        {
          title: "Пепетела - Большая российская энциклопедия",
          url: "https://old.bigenc.ru/text/2711021",
        },
      ],
    },
  ],
  "armenia:narine_abgaryan": [
    {
      field: "birthDate",
      cardValue: "1971-01-14",
      stagingValue: "1971-01-14",
      decision: "corrected-card",
      note: "The card was corrected from 1971-01-01 to 1971-01-14 using the publisher's author page.",
      sources: [
        {
          title: "Наринэ Абгарян - издательство АСТ",
          url: "https://ast.ru/authors/abgaryan-narine-ast011330/",
        },
      ],
    },
  ],
  "cambodia:rim_kin": [
    {
      field: "birthDate",
      cardValue: "1911-11-08",
      stagingValue: "1911-01-01",
      decision: "corrected-card",
      note: "The card was enriched from year-only precision using the BnF authority record; the staging first-of-year placeholder is not retained.",
      sources: [
        {
          title: "Rim, Kin (1911-1959) - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark:/12148/cb12285967d",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1959-01-27",
      stagingValue: "1959-01-01",
      decision: "corrected-card",
      note: "The card was enriched from year-only precision using the BnF authority record; the staging first-of-year placeholder is not retained.",
      sources: [
        {
          title: "Rim, Kin (1911-1959) - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark:/12148/cb12285967d",
        },
      ],
    },
  ],
  "cameroon:calixthe_beyala": [
    {
      field: "birthDate",
      cardValue: "1961-10-26",
      stagingValue: "1961-10-26",
      decision: "corrected-card",
      note: "The card was corrected from 1961-12-01 to 1961-10-26 after authority-backed review.",
      sources: [
        {
          title: "Calixthe Beyala - Le Livre de Poche",
          url: "https://www.livredepoche.com/auteur/calixthe-beyala",
        },
      ],
    },
  ],
  "colombia:santiago_gamboa": [
    {
      field: "birthDate",
      cardValue: "1965-12-30",
      stagingValue: "",
      decision: "corrected-card",
      note: "The card was corrected from 1965-12-02 to 1965-12-30 using Instituto Cervantes; the conflicting 1962 Wikidata claim is not used.",
      sources: [
        {
          title: "Santiago Gamboa - Instituto Cervantes de Lyon",
          url: "https://cultura.cervantes.es/lyon/es/Santiago-Gamboa/185167",
        },
        {
          title: "Santiago Gamboa - Europa Editions",
          url: "https://www.europaeditions.com/author/119/santiago-gamboa",
        },
      ],
    },
  ],
  "cyprus:kostas_montis": [
    {
      field: "birthDate",
      cardValue: "1914-02-18",
      stagingValue: "1914-02-18",
      decision: "corrected-card",
      note: "The card was corrected from 1914-03-18 to 1914-02-18 using the University of Cyprus library authority record.",
      sources: [
        {
          title: "Κώστας Μόντης - University of Cyprus Library",
          url: "https://lekythos.library.ucy.ac.cy/archive/item/174854?lang=el",
        },
      ],
    },
  ],
  "georgia:galaktion_tabidze": [
    {
      field: "birthDate",
      cardValue: "1891-11-17",
      stagingValue: "",
      decision: "corrected-card",
      note: "The National Archives of Georgia records 5 November 1891 Old Style, equivalent to 17 November 1891 in the Gregorian calendar; the unsupported 1892 card year was corrected.",
      sources: [
        {
          title: "Galaktion Tabidze - National Archives of Georgia",
          url: "https://www.archive.gov.ge/en/galaktioni-1",
        },
      ],
    },
  ],
  "georgia:otar_chiladze": [
    {
      field: "deathDate",
      cardValue: "2009-10-01",
      stagingValue: "2009-10-01",
      decision: "corrected-card",
      note: "The card was corrected from 2009-10-08 to 2009-10-01 using the Russian encyclopedia entry.",
      sources: [
        {
          title: "Чиладзе Отар Иванович - Большая российская энциклопедия",
          url: "https://bigenc.ru/c/chiladze-otar-ivanovich-b371ff",
        },
        {
          title: "Умер грузинский писатель Отар Чиладзе - Российская газета",
          url: "https://rg.ru/2009/10/01/chiladze-anons.html",
        },
        {
          title: "Умер грузинский писатель Отар Чиладзе - Коммерсантъ",
          url: "https://www.kommersant.ru/doc/1720449",
        },
      ],
    },
  ],
  "iraq:nazik_al_malaika": [
    {
      field: "birthDate",
      cardValue: "1923-08-23",
      stagingValue: "1922-08-23",
      decision: "retain-current-card",
      note: "The current 1923 birth year is retained; the 1922 staging value is not promoted.",
      sources: [
        {
          title: "Вестник Таджикского национального университета, 2025",
          url: "https://msu.tj/file/vestnik/vestnik_t2%2852%29_4_2025.pdf",
        },
      ],
    },
  ],
  "iraq:badr_shakir_al_sayyab": [
    {
      field: "birthDate",
      cardValue: "1926-12-24",
      stagingValue: "1926-12-24",
      decision: "corrected-card",
      note: "The card was corrected from 1926-12-25 to 1926-12-24 using the INHA authority record.",
      sources: [
        {
          title: "al-Sayyab, Badr Shakir - Institut national d'histoire de l'art",
          url: "https://agorha.inha.fr/ark:/54721/ab33f4f3-f62a-4390-bd1f-862a09ca276c?database=71",
        },
      ],
    },
  ],
  "israel:zeruya_shalev": [
    {
      field: "birthDate",
      cardValue: "1959-04-13",
      stagingValue: "1959-04-13",
      decision: "corrected-card",
      note: "The card was corrected from 1959-06-13 to 1959-04-13 using the Hebrew Project Ben-Yehuda biography and publisher corroboration.",
      sources: [
        {
          title: "צרויה שלו - פרויקט בן־יהודה",
          url: "https://benyehuda.org/lexicon/00036.php",
        },
        {
          title: "Zeruya Shalev - Humanitas",
          url: "https://humanitas.ro/autori/zeruya-shalev",
        },
      ],
    },
  ],
  "japan:kawabata_yasunari": [
    {
      field: "birthDate",
      cardValue: "1899-06-14",
      stagingValue: "1899-06-11",
      decision: "retained-national-authority-value",
      note: "The National Diet Library of Japan gives 14 June 1899, while the Nobel Foundation gives 11 June 1899. The public card retains the Japanese national authority value and records the institutional disagreement explicitly.",
      sources: [
        {
          title: "KAWABATA Yasunari - National Diet Library, Japan",
          url: "https://www.ndl.go.jp/portrait/e/datas/6086/",
        },
        {
          title: "Yasunari Kawabata - NobelPrize.org",
          url: "https://www.nobelprize.org/prizes/literature/1968/kawabata/facts/",
        },
      ],
    },
  ],
  "kosovo:ali_podrimja": [
    {
      field: "birthDate",
      cardValue: "1942-08-28",
      stagingValue: "1942-08-01",
      decision: "retain-current-card",
      note: "The Library of Congress authority record supports 1942-08-28; the staging first-of-month value is not promoted.",
      sources: [
        {
          title: "Ali Podrimja - Library of Congress authority record n85829191",
          url: "https://lccn.loc.gov/n85829191",
        },
      ],
    },
  ],
  "kyrgyzstan:tugolbai_sydykbekov": [
    {
      field: "birthDate",
      cardValue: "1912-05-14",
      stagingValue: "1912-05-01",
      decision: "retain-current-card",
      note: "Kyrgyz state and municipal sources support 14 May; the staging first-of-month value reflects lower precision and is not promoted.",
      sources: [
        {
          title: "Кабинет Министров Кыргызской Республики - 100-летие Тугельбая Сыдыкбекова",
          url: "https://www.gov.kg/ru/post/s/sostoyalos-torzhestvennoe-otkrytie-memorialnoj-doski-v-chest-100-letiya-narodnogo-pisatelya-tugelbaya-sydykbekova",
        },
        {
          title: "Мэрия Бишкека - день памяти Туголбая Сыдыкбекова",
          url: "https://www.bishkek.gov.kg/ru/post/15582",
        },
      ],
    },
  ],
  "latvia:andrejs_upits": [
    {
      field: "birthDate",
      cardValue: "1877-12-04",
      stagingValue: "1877-11-22",
      decision: "retain-current-card-calendar-normalized",
      note: "Both values are the same birth date: 22 November Old Style / 4 December New Style. The card retains the Gregorian date.",
      sources: [
        {
          title: "Упит (Упитс) Андрейс - Большая российская энциклопедия",
          url: "https://old.bigenc.ru/literature/text/4700066",
        },
      ],
    },
  ],
  "latvia:rainis": [
    {
      field: "birthDate",
      cardValue: "1865-09-11",
      stagingValue: "1865-08-30",
      decision: "retain-current-card-calendar-normalized",
      note: "Both values are the same birth date: 30 August Old Style / 11 September New Style. The card retains the Gregorian date.",
      sources: [
        {
          title: "Покачать колыбель Райниса - Latvijas Sabiedriskais medijs",
          url: "https://rus.lsm.lv/statja/kultura/kultura/pokachat-kolibel-raynisa.a292372/",
        },
      ],
    },
  ],
  "lebanon:mikhail_naimy": [
    {
      field: "birthDate",
      cardValue: "1889-11-22",
      stagingValue: "1889-10-17",
      decision: "corrected-card-source-disagreement",
      note: "The unsupported 1889-11-17 card value was corrected to the current and prior Russian encyclopedia editions' primary value, 1889-11-22. The current edition explicitly records 1889-10-17 as an alternate report.",
      sources: [
        {
          title: "Михаил Нуайме - Большая российская энциклопедия",
          url: "https://bigenc.ru/c/nuaime-mikhail-090e8b",
        },
        {
          title: "Нуайме Михаил - Большая российская энциклопедия, прежняя электронная версия",
          url: "https://old.bigenc.ru/literature/text/2672937",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1988-02-28",
      stagingValue: "1988-01-01",
      decision: "retain-current-card",
      note: "Both Russian encyclopedia editions support 1988-02-28; the staging first-of-year value is not promoted.",
      sources: [
        {
          title: "Михаил Нуайме - Большая российская энциклопедия",
          url: "https://bigenc.ru/c/nuaime-mikhail-090e8b",
        },
      ],
    },
  ],
  "lithuania:vincas_kreve": [
    {
      field: "deathDate",
      cardValue: "1954-07-07",
      stagingValue: "1954-07-17",
      decision: "retain-current-card",
      note: "The Lithuanian national encyclopedia supports 1954-07-07; the staging value is not promoted.",
      sources: [
        {
          title: "Vincas Krėvė - Visuotinė lietuvių enciklopedija",
          url: "https://www.vle.lt/straipsnis/vincas-kreve/",
        },
        {
          title: "Vincas Krėvė-Mickevičius - Lietuvos mokslų akademija",
          url: "https://www.lma.lt/uploads/Biogramos/Kr%C4%97v%C4%97_V_red..pdf",
        },
      ],
    },
  ],
  "mali:amadou_hampate_ba": [
    {
      field: "birthDate",
      cardValue: "1901",
      stagingValue: "1900",
      decision: "retain-current-card",
      note: "UNESCO and the Library of Congress support 1901; the 1900 staging value is not promoted.",
      sources: [
        {
          title: "Послание человечеству - Амаду Ампате Ба",
          url: "https://www.unesco.org/ru/articles/poslanie-chelovechestvu",
        },
        {
          title: "Library of Congress authority record n84149759",
          url: "https://lccn.loc.gov/n84149759",
        },
      ],
    },
  ],
  "mongolia:dashdorj_natsagdorj": [
    {
      field: "deathDate",
      cardValue: "1937-07-13",
      stagingValue: "1937-06-13",
      decision: "retain-current-card",
      note: "The Mongolian Film Institute biography, citing the contemporary Shine Toli notice, supports 1937-07-13; the staging value is not promoted.",
      sources: [
        {
          title: "Дашдоржийн Нацагдорж - Монголын кино урлагийн зөвлөл",
          url: "https://www.mfi.mn/artist/natsagdorj-dashdorj/detail",
        },
      ],
    },
  ],
  "mongolia:lodoidamba": [
    {
      field: "birthDate",
      cardValue: "1917-08-20",
      stagingValue: "1917-01-01",
      decision: "corrected-card",
      note: "The card was corrected from 1917-03-10 to 1917-08-20 using Mongolia's official historical dictionary timeline and a national book platform biography.",
      sources: [
        {
          title: "Чадраабалын Лодойдамба - Монголын түүхийн тайлбар толь",
          url: "https://mongoltoli.mn/history/timeline?day=20&month=08&year=1917",
        },
        {
          title: "Чадраабалын Лодойдамба - M-book",
          url: "https://www.m-book.mn/authors/1256",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1970-01-11",
      stagingValue: "1970-01-01",
      decision: "corrected-card",
      note: "The card was corrected from 1970-06-20 to 1970-01-11 using the national book platform biography; the official historical dictionary corroborates the identity and birth date.",
      sources: [
        {
          title: "Чадраабалын Лодойдамба - M-book",
          url: "https://www.m-book.mn/authors/1256",
        },
        {
          title: "Чадраабалын Лодойдамба - Монголын түүхийн тайлбар толь",
          url: "https://mongoltoli.mn/history/timeline?day=20&month=08&year=1917",
        },
      ],
    },
  ],
  "myanmar:ma_ma_lay": [
    {
      field: "birthDate",
      cardValue: "1917-04-13",
      stagingValue: "1917-04-13",
      decision: "corrected-card",
      note: "The card was corrected from 1917-04-06 to 1917-04-13 after the identity mapping was repaired and the publisher biography was checked.",
      sources: [
        {
          title: "Biography of Journal Kyaw Ma Ma Lay - Cornell University Press",
          url: "https://api.pageplace.de/preview/DT0400.9781501719356_A33947823/preview-9781501719356_A33947823.pdf",
        },
        {
          title: "Journal Kyaw Ma Ma Lay - Wikidata Q6273845",
          url: "https://www.wikidata.org/wiki/Q6273845",
        },
      ],
    },
  ],
  "nepal:laxmi_prasad_devkota": [
    {
      field: "birthDate",
      cardValue: "1909-11-12",
      stagingValue: "1909-11-12",
      decision: "corrected-card-calendar-conversion",
      note: "The card was corrected from 1909-11-13 to the Gregorian conversion 1909-11-12 for the Nepal-government curriculum date Kartik 27, 1966 BS.",
      sources: [
        {
          title: "English Composition Grade 9-12 - Curriculum Development Centre, Government of Nepal",
          url: "https://giwmscdnone.gov.np/media/pdf_upload/English%20Composition%20Grade%209%20-%2012%20%28%E0%A4%B8%E0%A4%A8%E0%A5%8D%E0%A4%A6%E0%A4%B0%E0%A5%8D%E0%A4%AD%20%E0%A4%8F%E0%A4%B5%E0%A4%AE%E0%A5%8D%20%E0%A4%B8%E0%A5%8D%E0%A4%B5%20%E0%A4%85%E0%A4%A7%E0%A5%8D%E0%A4%AF%E0%A4%AF%E0%A4%A8%20%E0%A4%B8%E0%A4%BE%E0%A4%AE%E0%A4%97%E0%A5%8D%E0%A4%B0%E0%A5%80%29_h2lkhrs.pdf",
        },
      ],
    },
  ],
  "new_zealand:loyd_jones": [
    {
      field: "birthDate",
      cardValue: "1955-03-23",
      stagingValue: "1955-03-23",
      decision: "corrected-card",
      note: "The card was corrected from 1955-05-23 to 1955-03-23 using the Christchurch City Libraries author record.",
      sources: [
        {
          title: "Lloyd Jones - Christchurch City Libraries",
          url: "https://my.christchurchcitylibraries.com/new-zealand-childrens-authors/lloyd-jones/",
        },
      ],
    },
  ],
  "nigeria:buchi_emecheta": [
    {
      field: "birthDate",
      cardValue: "1944-07-21",
      stagingValue: "1944-07-21",
      decision: "corrected-card",
      note: "The card was corrected from 1944-08-21 to 1944-07-21 using South African History Online and Cambridge Orlando records.",
      sources: [
        {
          title: "Buchi Emecheta - South African History Online",
          url: "https://sahistory.org.za/people/buchi-emecheta",
        },
        {
          title: "Buchi Emecheta - Cambridge Orlando",
          url: "https://orlando.cambridge.org/people/f75322f4-8804-43a3-888f-c1a5058e2756",
        },
      ],
    },
  ],
  "nigeria:helon_habila": [
    {
      field: "birthDate",
      cardValue: "1967-11",
      stagingValue: "1967-01-01",
      decision: "corrected-card-reduced-precision",
      note: "The unsupported day 25 was removed. The author's first-person account establishes November 1967, while the staging first-of-year value is not an exact date.",
      sources: [
        {
          title: "Helon Habila, Writers on Writing - Lancaster University Transcultural Writing Archive",
          url: "https://www.lancaster.ac.uk/transculturalwriting-archive/radiophonics/contents/writersonwriting/helonhabila/index.html",
        },
      ],
    },
    {
      field: "birthPlace",
      cardValue: "Калтунго, Нигерия",
      stagingValue: "",
      decision: "corrected-card",
      note: "The malformed place name 'Кфи' was corrected to Kaltungo, Nigeria using the author's first-person biography.",
      sources: [
        {
          title: "Helon Habila, Writers on Writing - Lancaster University Transcultural Writing Archive",
          url: "https://www.lancaster.ac.uk/transculturalwriting-archive/radiophonics/contents/writersonwriting/helonhabila/index.html",
        },
      ],
    },
  ],
  "nigeria:christopher_okigbo": [
    {
      field: "birthDate",
      cardValue: "1932-08-16",
      stagingValue: "1930-08-16",
      decision: "retain-current-card",
      note: "Poetry Foundation and UNESCO support 1932; the 1930 staging value is not promoted.",
      sources: [
        {
          title: "Christopher Okigbo",
          url: "https://www.poetryfoundation.org/poets/christopher-okigbo",
        },
        {
          title: "Christopher Okigbo Papers - UNESCO Memory of the World",
          url: "https://media.unesco.org/sites/default/files/webform/mow001/50africaokigbopapers.pdf",
        },
      ],
    },
  ],
  "samoa:albert_wendt": [
    {
      field: "birthDate",
      cardValue: "1939-10-27",
      stagingValue: "1939-10-27",
      decision: "corrected-card",
      note: "The card was corrected from 1939-10-08 to 1939-10-27 using the Academy of New Zealand Literature record and the linked Wikidata authority snapshot.",
      sources: [
        {
          title: "Albert Wendt - Academy of New Zealand Literature",
          url: "https://www.anzliterature.com/member/albert-wendt/",
        },
        {
          title: "Albert Wendt - Wikidata Q1235864",
          url: "https://www.wikidata.org/wiki/Q1235864",
        },
      ],
    },
  ],
  "senegal:birago_diop": [
    {
      field: "birthDate",
      cardValue: "1906-12-11",
      stagingValue: "1906-12-12",
      decision: "retain-current-card",
      note: "The Bibliothèque nationale de France authority record supports 1906-12-11; the staging value is not promoted.",
      sources: [
        {
          title: "Birago Diop - Bibliothèque nationale de France authority record",
          url: "https://catalogue.bnf.fr/ark:/12148/cb11900243p",
        },
      ],
    },
  ],
  "taiwan:li_ang": [
    {
      field: "birthDate",
      cardValue: "1952-04-07",
      stagingValue: "1952-04-07",
      decision: "corrected-card",
      note: "The card was corrected from 1952-04-05 to 1952-04-07 using Taiwan Ministry of Culture and National Chung Hsing University records.",
      sources: [
        {
          title: "Li Ang - Ministry of Culture, Taiwan",
          url: "https://www.moc.gov.tw/en/News_Content2.aspx?n=491&s=17978",
        },
        {
          title: "Li Ang - National Chung Hsing University",
          url: "https://taiwan.nchu.edu.tw/content.php?a=%E9%A7%90%E6%A0%A1%E4%BD%9C%E5%AE%B6&b=%E7%B3%BB%E6%89%80%E6%88%90%E5%93%A1&c=ut&id=50d652d4-bc15-4b9d-9b54-f4e52c8fd393",
        },
      ],
    },
  ],
  "south_sudan:taban_lo_liyong": [
    {
      field: "birthDate",
      cardValue: "1939",
      stagingValue: "1938-01-01",
      decision: "retain-current-card",
      note: "Большая российская энциклопедия supports 1939; the 1938 staging value is not promoted.",
      sources: [
        {
          title: "Табан Ло Лийонг - Большая российская энциклопедия",
          url: "https://old.bigenc.ru/literature/text/2173989",
        },
      ],
    },
  ],
  "tajikistan:muhammadjon_shakuri": [
    {
      field: "birthDate",
      cardValue: "1925-02",
      stagingValue: "1925-02",
      decision: "corrected-card",
      note: "The card was corrected from 1926-10-30 to the source-supported month precision, February 1925; the evidence does not establish a day.",
      sources: [
        {
          title: "Таджикский национальный университет - диссертация Т. Х. Каримовой",
          url: "https://tnu.tj/Dissertatsii/KarimovaTKh/KarimovaTKh.pdf",
        },
        {
          title: "ŠOKUROV, MOḤAMMADJĀN - Encyclopaedia Iranica",
          url: "https://www.iranicaonline.org/articles/shokurov-mohammadjan/",
        },
      ],
    },
  ],
  "uzbekistan:odil_yoqubov": [
    {
      field: "birthDate",
      cardValue: "1926-10-20",
      stagingValue: "1926-10-26",
      decision: "retain-current-card",
      note: "The Uzbek history and culture source supports 1926-10-20; the staging value is not promoted.",
      sources: [
        {
          title: "Одил Ёқубов - Tarix.uz",
          url: "https://www.tarix.uz/site/report?id=238",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "2009-12-21",
      stagingValue: "2009-12-22",
      decision: "retain-current-card",
      note: "The Uzbek biography supports 2009-12-21; the staging value is not promoted.",
      sources: [
        {
          title: "Одил Ёқубов - Muzaffar.uz",
          url: "https://muzaffar.uz/mashhurlar-hayotidan/2644-odil-yoqubov.html",
        },
      ],
    },
  ],
  "germany:sebastian_brant": [
    {
      field: "birthDate",
      cardValue: "1458",
      stagingValue: "",
      decision: "corrected-card",
      note: "The unsupported 1457 card year was corrected to the 1458 year established by Deutsche Biographie and independently recorded by the Deutsche Nationalbibliothek.",
      sources: [
        {
          title: "Sebastian Brant - Deutsche Biographie",
          url: "https://www.deutsche-biographie.de/gnd118514474.html",
        },
        {
          title: "Sebastian Brant - Deutsche Nationalbibliothek",
          url: "https://d-nb.info/gnd/118514474",
        },
      ],
    },
  ],
  "ghana:joseph_casely_hayford": [
    {
      field: "birthDate",
      cardValue: "1866",
      stagingValue: "",
      decision: "reduced-conflicting-day-precision",
      note: "The false 24 May value was removed. Inner Temple gives 29 September 1866 while Encyclopaedia Africana gives 28 September 1866, so the public profile publishes only their shared year.",
      sources: [
        {
          title: "Joseph Ephraim Casely Hayford - Inner Temple",
          url: "https://www.innertemple.org.uk/celebrating-diversity-at-the-bar/joseph-ephraim-casely-hayford/",
        },
        {
          title: "J. E. Casely Hayford - Encyclopaedia Africana",
          url: "https://encyclopaediaafricana.com/hayford-j-e-casely/",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "1930-08-11",
      stagingValue: "",
      decision: "corrected-card",
      note: "The false 15 January value was replaced with 11 August 1930; this exact day is attributed only to Encyclopaedia Africana, while Inner Temple supports the year alone.",
      sources: [
        {
          title: "J. E. Casely Hayford - Encyclopaedia Africana",
          url: "https://encyclopaediaafricana.com/hayford-j-e-casely/",
        },
      ],
    },
  ],
  "ghana:martin_egblewogbe": [
    {
      field: "birthDate",
      cardValue: "1975",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The Batch30 institutional profiles establish Martin Egblewogbe and his bibliography but do not establish a month or day; the first-of-year placeholder is therefore reduced to the existing 1975 year.",
      sources: [
        {
          title: "Martin Egblewogbe - Writers Project of Ghana",
          url: "https://www.writersprojectghana.com/megblewogbe/",
        },
        {
          title: "Against Ethnography - Cambridge University Press",
          url: "https://www.cambridge.org/core/books/decolonizing-the-english-literary-curriculum/against-ethnography/B3D295B83E9DE2EEE9F559DA4E34568B",
        },
        {
          title: "The Waiting - CiNii Books",
          url: "https://ci.nii.ac.jp/ncid/BD00490608",
        },
      ],
    },
  ],
  "ghana:nii_ayikwei_parkes": [
    {
      field: "birthDate",
      cardValue: "1974",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The Batch30 publisher and official-author profiles establish the exact writer identity but do not substantiate either 1 January or the candidate 1 April; the public profile retains only the shared 1974 year.",
      sources: [
        {
          title: "Nii Ayikwei Parkes - Peepal Tree Press",
          url: "https://www.peepaltreepress.com/authors/nii-ayikwei-parkes",
        },
        {
          title: "Nii Ayikwei Parkes - official curriculum vitae",
          url: "https://niiparkes.com/open/profile/cv/?aid=235&sa=0",
        },
      ],
    },
  ],
  "greece:andreas_kalvos": [
    {
      field: "birthDate",
      cardValue: "1792",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The false 1 May value was removed. Both Batch30 institutional sources establish April 1792 but not a day, and the public profile conservatively keeps year precision only.",
      sources: [
        {
          title: "Andreas Kalvos - Capodistrias Museum",
          url: "https://www.capodistriasmuseum.gr/en/persons/andreas-kalvos/",
        },
        {
          title: "Andreas Kalvos - Ionian University POLYSEMi",
          url: "https://polysemi.di.ionio.gr/index.php/2019/08/29/andreas-kalvos-2/",
        },
      ],
    },
  ],
  "grenada:george_brizan": [
    {
      field: "birthDate",
      cardValue: "1942-10-31",
      stagingValue: "",
      decision: "corrected-card",
      note: "The first-of-year placeholder was replaced with 31 October 1942, the exact birth date recorded by the National Democratic Congress of Grenada biography.",
      sources: [
        {
          title: "George Brizan - National Democratic Congress of Grenada",
          url: "https://www.ndcgrenada.org/past-leaders/",
        },
      ],
    },
    {
      field: "deathDate",
      cardValue: "2012",
      stagingValue: "",
      decision: "reduced-unsupported-precision",
      note: "The unsupported 1 January placeholder was removed; the CARICOM obituary establishes the 2012 death year, so no month or day is published.",
      sources: [
        {
          title: "George Brizan - CARICOM",
          url: "https://caricom.org/caricom-remembers-rt-hon-george-brizan/",
        },
      ],
    },
  ],
  "guatemala:francisco_alejandro_mendez": [
    {
      field: "deathDate",
      cardValue: "2026-03-28",
      stagingValue: "",
      decision: "added-source-confirmed-date",
      note: "The public profile now records 28 March 2026, the exact death date reported by Prensa Libre and consistent with the 1964-2026 life years in the Guatemalan language-academy biography.",
      sources: [
        {
          title: "Francisco Alejandro Méndez - Prensa Libre",
          url: "https://www.prensalibre.com/vida/escenario/fallece-francisco-alejandro-mendez-premio-nacional-de-literatura-2017/",
        },
        {
          title: "Francisco Alejandro Méndez Castañeda - Academia Guatemalteca de la Lengua",
          url: "https://agl.org.gt/academicos/francisco-alejandro-mendez-castaneda/",
        },
      ],
    },
  ],
  "republic_of_congo:sony_labou_tansi": [
    {
      field: "birthDate",
      cardValue: "1947-06-05",
      stagingValue: "1947-07-05",
      decision: "corrected-card",
      note: "The card was corrected from 5 July to 5 June using the Bibliothèque nationale de France authority record and the Les Francophonies institutional biography; the stale staging value is not promoted.",
      sources: [
        {
          title: "Sony Labou Tansi - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark:/12148/cb11910402v",
        },
        {
          title: "Sony Labou Tansi - Les Francophonies",
          url: "https://www.lesfrancophonies.fr/SONY-LABOU-TANSI",
        },
      ],
    },
  ],
  "uganda:timothy_wangusa": [
    {
      field: "birthDate",
      cardValue: "1942-05-20",
      stagingValue: "1942-01-01",
      decision: "retain-current-card",
      note: "Makerere University's official eightieth-birthday profile explicitly records 20 May 1942; the staging value represents only year-level authority precision and is not promoted over the university biography.",
      sources: [
        {
          title: "Timothy Wangusa at 80 - Makerere University",
          url: "https://news.mak.ac.ug/2022/07/makerere-university-celebrates-prof-timothy-wangusa80/",
        },
        {
          title: "Timothy Wangusa - Bibliothèque nationale de France",
          url: "https://catalogue.bnf.fr/ark:/12148/cb122319918",
        },
      ],
    },
  ],
});

const CLAIM_PATTERNS = {
  "identity-role":
    /(?:писател|писательниц|поэт|поэтесс|драматург|романист|эссеист|публицист|журналист|сценарист|философ|критик|переводчик|автор)\p{L}*/iu,
  "national-cultural-affiliation":
    /(?:афганск|албанск|алжирск|американск|английск|арабск|аргентинск|армянск|австралийск|австрийск|белорусск|бельгийск|бразильск|британск|болгарск|венгерск|вьетнамск|ганск|греческ|грузинск|датск|египетск|израильск|индийск|иранск|ирландск|испанск|итальянск|казахск|канадск|китайск|колумбийск|корейск|кубинск|латвийск|литовск|мексиканск|немецк|нигерийск|норвежск|пакистанск|перуанск|польск|португальск|российск|русск|сербск|советск|турецк|украинск|финск|французск|чилийск|чешск|шведск|швейцарск|эстонск|южноафриканск|японск)\p{L}*/iu,
  "life-dates":
    /(?:(?:родил(?:ся|ась)|умер(?:ла)?|годы жизни)|\b(?:1\d{3}|20\d{2})\s*[−-]\s*(?:1\d{3}|20\d{2})\b)/iu,
  language:
    /(?:язык\p{L}*|язычн\p{L}*|писал(?:а)?\s+на)/iu,
  works:
    /(?:«[^»]{2,120}»|(?:роман(?!ист)|поэм|пьес|книг|сборник|произведен)\p{L}*)/iu,
  awards: /(?:лауреат|премия|премии|награда|награды)/iu,
  nobel: /Нобелевск\p{L}*/iu,
  "movement-era":
    /(?:реализм|романтизм|символизм|модернизм|постмодернизм|натурализм|авангард|классицизм|просвещение|магическ\p{L}*\s+реализм|нов\p{L}*\s+роман)/iu,
  places:
    /(?:родил(?:ся|ась)|жил(?:а)?|эмигрировал(?:а)?|изгнание|диаспора)/iu,
  "themes-style":
    /(?:творчеств\p{L}*|проза|поэзи\p{L}*|стил\p{L}*|тем\p{L}*|мотив\p{L}*|образ\p{L}*)/iu,
  "reception-influence":
    /(?:влияни\p{L}*|признани\p{L}*|известен|известна|переведен\p{L}*|оказал\p{L}*\s+влияние)/iu,
  "critical-ranking":
    /(?:од(?:ин|на) из (?:крупнейших|ведущих|известнейших|наиболее|самых)|ведущ(?:ий|ая)|крупнейш(?:ий|ая)|величайш(?:ий|ая)|наиболее (?:известн|значим)|сам(?:ый|ая) (?:известн|значим|влиятельн))/iu,
  "priority-claim":
    /(?:перв(?:ый|ая|ые|ое)|единственн(?:ый|ая)|основател\p{L}*|основоположник\p{L}*)/iu,
};

const DATE_PAIR_PATTERN =
  /\b(1\d{3}|20\d{2})\s*[−-]\s*(1\d{3}|20\d{2})\b/gu;
const NOBEL_PATTERN = /Нобелевск\p{L}*/iu;
const QUOTED_TITLE_PATTERN = /«([^»\r\n]{2,120})»/gu;

function isLifeYearPair(source, match) {
  const index = match.index ?? 0;
  const before = source.slice(Math.max(0, index - 64), index);
  const after = source.slice(index + match[0].length, index + match[0].length + 16);
  return (
    /(?:жил(?:а|и)?|живш\p{L}*|годы\s+жизни)\s*(?:в\s*)?$/iu.test(before) ||
    (/\(\s*$/u.test(before) && /^\s*\)/u.test(after))
  );
}

export function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function parsePartialDate(value) {
  const source = String(value || "").trim();
  const beforeCommonEra = /(?:до\s+н\.\s*э\.?|до\s+нашей\s+эры)/iu.test(source);
  const normalized = source
    .replace(/^\+/u, "")
    .replace(/\s*(?:до\s+н\.\s*э\.?|до\s+нашей\s+эры)\s*$/iu, "");
  const match = normalized.match(/^(-?\d{1,16})(?:-(\d{2}))?(?:-(\d{2}))?$/u);
  if (!match) return null;
  const absoluteYear = Math.abs(Number(match[1]));
  return {
    year: beforeCommonEra ? -absoluteYear : Number(match[1]),
    month: match[2] ? Number(match[2]) : null,
    day: match[3] ? Number(match[3]) : null,
    precision: match[3] ? "day" : match[2] ? "month" : "year",
  };
}

export function partialDatesConflict(left, right) {
  const a = parsePartialDate(left);
  const b = parsePartialDate(right);
  if (!a || !b) return false;
  if (a.year !== b.year) return true;
  if (a.month !== null && b.month !== null && a.month !== b.month) return true;
  return a.day !== null && b.day !== null && a.day !== b.day;
}

const WIKIDATA_TIME_PRECISION = Object.freeze({
  9: "year",
  10: "month",
  11: "day",
});

const WIKIDATA_GREGORIAN_CALENDAR = "Q1985727";

function wikidataCalendarId(value) {
  return String(value || "").match(/(Q\d+)$/u)?.[1] || null;
}

export function parseWikidataTimeClaim(claim) {
  if (!claim?.time || !WIKIDATA_TIME_PRECISION[claim.precision]) return null;
  const match = String(claim.time).match(
    /^([+-])(\d{1,16})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}Z$/u
  );
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const year = sign * Number(match[2]);
  const month = claim.precision >= 10 ? Number(match[3]) : null;
  const day = claim.precision >= 11 ? Number(match[4]) : null;
  if (
    !Number.isSafeInteger(year) ||
    (month !== null && (month < 1 || month > 12)) ||
    (day !== null && (day < 1 || day > 31))
  ) {
    return null;
  }
  const yearText = `${year < 0 ? "-" : ""}${String(Math.abs(year)).padStart(4, "0")}`;
  const value = [
    yearText,
    ...(month === null ? [] : [String(month).padStart(2, "0")]),
    ...(day === null ? [] : [String(day).padStart(2, "0")]),
  ].join("-");
  return {
    value,
    year,
    month,
    day,
    precision: WIKIDATA_TIME_PRECISION[claim.precision],
    precisionCode: claim.precision,
    calendarId: wikidataCalendarId(claim.calendarmodel),
  };
}

function selectBestRankClaims(claims) {
  const parsed = (claims || [])
    .map((claim) => ({ claim, parsed: parseWikidataTimeClaim(claim) }))
    .filter((entry) => entry.parsed);
  const preferred = parsed.filter((entry) => entry.claim.rank === "preferred");
  return preferred.length ? preferred : parsed.filter((entry) => entry.claim.rank !== "deprecated");
}

function compactWikidataTimeEntry(entry) {
  return {
    value: entry.parsed.value,
    precision: entry.parsed.precision,
    calendarId: entry.parsed.calendarId,
    rank: entry.claim.rank || "normal",
    referenced: Boolean(entry.claim.referenced),
    referenceCount: Number(entry.claim.referenceCount || 0),
    claimId: entry.claim.claimId,
  };
}

function datePrecisionsEqual(left, right) {
  return left?.precision === right?.precision;
}

function julianDateToGregorian(parsed) {
  if (
    parsed?.precision !== "day" ||
    parsed.year < 1 ||
    parsed.month === null ||
    parsed.day === null
  ) {
    return null;
  }
  const adjustment = Math.floor((14 - parsed.month) / 12);
  const adjustedYear = parsed.year + 4800 - adjustment;
  const adjustedMonth = parsed.month + 12 * adjustment - 3;
  const julianDayNumber =
    parsed.day +
    Math.floor((153 * adjustedMonth + 2) / 5) +
    365 * adjustedYear +
    Math.floor(adjustedYear / 4) -
    32083;

  const a = julianDayNumber + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return {
    year,
    month,
    day,
    precision: "day",
    value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function compareCardDateWithWikidata(cardValue, claims = []) {
  const cardDate = parsePartialDate(cardValue);
  const allParsed = (claims || [])
    .map((claim) => ({ claim, parsed: parseWikidataTimeClaim(claim) }))
    .filter((entry) => entry.parsed);
  const bestRank = selectBestRankClaims(claims);
  const candidates = bestRank.map(compactWikidataTimeEntry);

  if (!cardDate) {
    return {
      status: "no-card-date",
      cardValue: cardValue || null,
      bestRankClaims: candidates,
    };
  }
  if (!allParsed.length) {
    return {
      status: "no-wikidata-date",
      cardValue,
      bestRankClaims: [],
    };
  }

  const compatibleBest = bestRank.filter(
    (entry) => !partialDatesConflict(cardValue, entry.parsed.value)
  );
  const compatibleAny = allParsed.filter(
    (entry) => !partialDatesConflict(cardValue, entry.parsed.value)
  );
  const calendarEquivalent = allParsed.find((entry) => {
    if (entry.parsed.calendarId !== "Q1985786") return false;
    const gregorian = julianDateToGregorian(entry.parsed);
    return gregorian && !partialDatesConflict(cardValue, gregorian.value);
  });
  if (calendarEquivalent) {
    const converted = julianDateToGregorian(calendarEquivalent.parsed);
    return {
      status: "calendar-equivalent",
      cardValue,
      matchedClaim: compactWikidataTimeEntry(calendarEquivalent),
      convertedGregorianValue: converted?.value || null,
      bestRankClaims: candidates,
      allClaimCount: allParsed.length,
    };
  }
  const matched = compatibleBest[0] || compatibleAny[0] || null;
  if (!matched) {
    return {
      status: "wikidata-date-discrepancy",
      cardValue,
      bestRankClaims: candidates,
      allClaimCount: allParsed.length,
    };
  }

  const samePrecision = datePrecisionsEqual(cardDate, matched.parsed);
  const gregorian = matched.parsed.calendarId === WIKIDATA_GREGORIAN_CALENDAR;
  const selectedFromBestRank = compatibleBest.includes(matched);
  const status = !selectedFromBestRank
    ? "compatible-alternate-rank"
    : !gregorian
      ? "compatible-calendar-unresolved"
      : samePrecision
        ? "exact-gregorian-match"
        : "compatible-at-shared-precision";
  return {
    status,
    cardValue,
    matchedClaim: compactWikidataTimeEntry(matched),
    bestRankClaims: candidates,
    allClaimCount: allParsed.length,
  };
}

export function buildWikidataSnapshotIndex(snapshot = {}) {
  const byQid = new Map();
  for (const entity of snapshot.entities || []) {
    const qid = String(entity?.qid || "").toUpperCase();
    if (!/^Q[1-9]\d*$/u.test(qid) || byQid.has(qid)) continue;
    byQid.set(qid, entity);
  }
  return byQid;
}

function buildWikidataEvidence(publicRecord, curatedQids, wikidataIndex) {
  const key = `${publicRecord.countryId}:${publicRecord.writer.id}`;
  const mapping = curatedQids[key];
  const qid = String(mapping?.wikidataId || "").toUpperCase();
  if (!qid) {
    return {
      mappingStatus: "no-curated-qid",
      qid: null,
      entityAvailable: false,
      dates: {},
    };
  }
  const entity = wikidataIndex.get(qid) || null;
  if (!entity || entity.missing) {
    return {
      mappingStatus: "curated-qid",
      qid,
      entityAvailable: false,
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      dates: {},
    };
  }

  const claims = entity.claims || {};
  const occupationClaims = claims.P106 || [];
  const literaryOccupationIds = [
    ...new Set(
      occupationClaims
        .map((claim) => claim.entityId)
        .filter((id) => LITERARY_OCCUPATION_IDS.has(id))
    ),
  ].sort((a, b) => a.localeCompare(b, "en"));
  const humanClaimPresent = (claims.P31 || []).some(
    (claim) => claim.entityId === "Q5"
  );
  const labels = Object.fromEntries(
    Object.entries(entity.labels || {}).filter(
      ([language, value]) =>
        ["en", "ru"].includes(language) && typeof value === "string" && value.trim()
    )
  );
  const normalizedWriterNames = writerNames(publicRecord.writer);
  const normalizedLabels = Object.values(labels)
    .map(normalizeIdentity)
    .filter(Boolean);
  const labelIdentityMatch = normalizedLabels.some((label) =>
    normalizedWriterNames.includes(label)
  );
  const cardBirthYear = dateYear(publicRecord.writer.birthDate);
  const wikidataBirthYears = [
    ...new Set(
      (claims.P569 || [])
        .map((claim) => parseWikidataTimeClaim(claim)?.year)
        .filter((year) => year !== undefined && year !== null)
    ),
  ].sort((a, b) => a - b);
  const birthYearIdentityStatus =
    cardBirthYear === null || !wikidataBirthYears.length
      ? "not-comparable"
      : wikidataBirthYears.includes(cardBirthYear)
        ? "match"
        : "conflict";
  const nearestBirthYearDistance =
    cardBirthYear === null || !wikidataBirthYears.length
      ? null
      : Math.min(
          ...wikidataBirthYears.map((year) => Math.abs(year - cardBirthYear))
        );
  const manualIdentityConfirmation =
    WRITER_IDENTITY_MANUAL_CONFIRMATIONS[key]?.qid === qid
      ? WRITER_IDENTITY_MANUAL_CONFIRMATIONS[key]
      : null;
  const identityValidationStatus =
    manualIdentityConfirmation ||
    (labelIdentityMatch &&
    birthYearIdentityStatus === "match" &&
    humanClaimPresent)
      ? "identity-corroborated"
      : birthYearIdentityStatus === "conflict" &&
          (!labelIdentityMatch || (nearestBirthYearDistance ?? 0) >= 3)
        ? "identity-discrepant"
        : "identity-review-required";
  return {
    mappingStatus: "curated-qid-candidate",
    qid,
    entityAvailable: true,
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    lastRevisionId: entity.lastrevid || null,
    modified: entity.modified || null,
    labels,
    labelIdentityMatch,
    cardBirthYear,
    wikidataBirthYears,
    birthYearIdentityStatus,
    nearestBirthYearDistance,
    identityValidationStatus,
    manualIdentityConfirmation,
    publicPortrait: publicRecord.writer.portrait || null,
    publicPortraitSourceUrl: publicRecord.writer.portraitSourceUrl || null,
    portraitIdentityRisk: Boolean(
      identityValidationStatus === "identity-discrepant" &&
        (publicRecord.writer.portrait || publicRecord.writer.portraitSourceUrl)
    ),
    humanClaimPresent,
    literaryOccupationIds,
    structuredClaimCounts: {
      birthDates: (claims.P569 || []).length,
      deathDates: (claims.P570 || []).length,
      occupations: occupationClaims.length,
      citizenships: (claims.P27 || []).length,
      notableWorks: (claims.P800 || []).length,
    },
    dates: {
      birthDate: compareCardDateWithWikidata(
        publicRecord.writer.birthDate,
        claims.P569 || []
      ),
      deathDate: compareCardDateWithWikidata(
        publicRecord.writer.deathDate,
        claims.P570 || []
      ),
    },
  };
}

function dateYear(value) {
  return parsePartialDate(value)?.year ?? null;
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return decodeURIComponent(url.toString())
      .replace(/\/+$/u, "")
      .toLocaleLowerCase("en");
  } catch {
    return "";
  }
}

function writerNames(writer) {
  return [...new Set([writer?.name, writer?.fullName].map(normalizeIdentity).filter(Boolean))];
}

function namesAgree(left, right) {
  const leftNames = writerNames(left);
  const rightNames = new Set(writerNames(right));
  return leftNames.some((name) => rightNames.has(name));
}

function yearsCompatible(left, right) {
  for (const field of ["birthDate", "deathDate"]) {
    if (left?.[field] && right?.[field] && partialDatesConflict(left[field], right[field])) {
      return false;
    }
  }
  const leftBirth = dateYear(left?.birthDate);
  const rightBirth = dateYear(right?.birthDate);
  return leftBirth === null || rightBirth === null || leftBirth === rightBirth;
}

function uniqueByQid(records) {
  const index = new Map();
  for (const record of records) {
    const qid = String(record.writer?.wikidataId || "").toUpperCase();
    if (!qid) continue;
    const group = index.get(qid) || [];
    group.push(record);
    index.set(qid, group);
  }
  return index;
}

function addIndex(index, key, record) {
  if (!key) return;
  const group = index.get(key) || [];
  group.push(record);
  index.set(key, group);
}

export function buildStagingIdentityIndex(stagingPayload) {
  const records = Object.entries(stagingPayload || {}).flatMap(
    ([countryId, writers]) =>
      (Array.isArray(writers) ? writers : []).map((writer) => ({ countryId, writer }))
  );
  const byQid = uniqueByQid(records);
  const byName = new Map();
  const byArticleUrl = new Map();
  const byAuthority = new Map();

  for (const record of records) {
    for (const name of writerNames(record.writer)) addIndex(byName, name, record);
    addIndex(byArticleUrl, normalizeUrl(record.writer.articleUrl), record);
    for (const [scheme, value] of Object.entries(record.writer.authorityIds || {})) {
      addIndex(byAuthority, `${scheme}:${normalizeIdentity(value)}`, record);
    }
  }

  return { records, byQid, byName, byArticleUrl, byAuthority };
}

function acceptedMatch(record, method, evidence) {
  return {
    status: "reliable-match",
    method,
    evidence,
    record,
  };
}

function qidCandidate(candidates, countryId) {
  if (candidates.length === 1) return candidates[0];
  const sameCountry = candidates.filter((candidate) => candidate.countryId === countryId);
  return sameCountry.length === 1 ? sameCountry[0] : null;
}

export function resolveReliableStagingIdentity(
  publicRecord,
  stagingIndex,
  curatedQids = {}
) {
  const { countryId, writer } = publicRecord;
  const explicitQid = String(writer.wikidataId || "").toUpperCase();
  if (explicitQid) {
    const candidates = stagingIndex.byQid.get(explicitQid) || [];
    const candidate = qidCandidate(candidates, countryId);
    if (
      candidate &&
      (namesAgree(writer, candidate.writer) || yearsCompatible(writer, candidate.writer))
    ) {
      return acceptedMatch(candidate, "explicit-wikidata-id", [explicitQid]);
    }
  }

  const curated = curatedQids[`${countryId}:${writer.id}`];
  const curatedQid = String(curated?.wikidataId || "").toUpperCase();
  if (
    curatedQid &&
    curated?.identityRule === "exact-label-and-birth-year" &&
    normalizeUrl(curated.sourceUrl) ===
      normalizeUrl(`https://www.wikidata.org/wiki/${curatedQid}`) &&
    /^\d{4}-\d{2}-\d{2}$/u.test(curated.checkedAt || "")
  ) {
    const candidates = stagingIndex.byQid.get(curatedQid) || [];
    const candidate = qidCandidate(candidates, countryId);
    if (candidate) {
      return acceptedMatch(candidate, "curated-key-to-wikidata-id", [
        `${countryId}:${writer.id}`,
        curatedQid,
        curated.identityRule,
      ]);
    }
  }

  for (const [scheme, value] of Object.entries(writer.authorityIds || {})) {
    const candidates =
      stagingIndex.byAuthority.get(`${scheme}:${normalizeIdentity(value)}`) || [];
    if (
      candidates.length === 1 &&
      (namesAgree(writer, candidates[0].writer) || yearsCompatible(writer, candidates[0].writer))
    ) {
      return acceptedMatch(candidates[0], "authority-id", [`${scheme}:${value}`]);
    }
  }

  const articleUrl = normalizeUrl(writer.articleUrl);
  if (articleUrl) {
    const candidates = stagingIndex.byArticleUrl.get(articleUrl) || [];
    if (candidates.length === 1 && namesAgree(writer, candidates[0].writer)) {
      return acceptedMatch(candidates[0], "article-url-and-name", [articleUrl]);
    }
  }

  const candidates = [
    ...new Set(
      writerNames(writer).flatMap((name) => stagingIndex.byName.get(name) || [])
    ),
  ].filter((candidate) => yearsCompatible(writer, candidate.writer));
  if (
    candidates.length === 1 &&
    dateYear(writer.birthDate) !== null &&
    dateYear(candidates[0].writer.birthDate) !== null
  ) {
    return acceptedMatch(candidates[0], "unique-name-and-birth-year", [
      writerNames(writer).find((name) => writerNames(candidates[0].writer).includes(name)),
      String(dateYear(writer.birthDate)),
    ]);
  }

  return {
    status: candidates.length > 1 ? "ambiguous" : "no-reliable-match",
    method: null,
    evidence: [],
    record: null,
  };
}

export function extractBiographyClaims(text) {
  const source = String(text || "").replace(/\s+/gu, " ").trim();
  const claimTypes = Object.entries(CLAIM_PATTERNS)
    .filter(([, pattern]) => pattern.test(source))
    .map(([key]) => key)
    .sort();
  const sentences = source.match(/[^.!?…]+[.!?…]?/gu)?.map((item) => item.trim()).filter(Boolean) || [];
  const nobelSentences = sentences.filter((sentence) => NOBEL_PATTERN.test(sentence));
  const nobelYears = [
    ...new Set(
      nobelSentences.flatMap((sentence) => {
        const mentions = [...sentence.matchAll(/Нобелевск\p{L}*/giu)];
        const years = [...sentence.matchAll(/\b(19\d{2}|20\d{2})\b/gu)];
        return mentions.flatMap((mention) => {
          const mentionIndex = mention.index ?? 0;
          const nearest = years
            .map((year) => ({
              year: Number(year[1]),
              distance: Math.abs((year.index ?? 0) - mentionIndex),
            }))
            .filter((item) => item.distance <= 120)
            .sort((left, right) => left.distance - right.distance)[0];
          return nearest ? [nearest.year] : [];
        });
      })
    ),
  ].sort((a, b) => a - b);
  const quotedTitles = [...source.matchAll(QUOTED_TITLE_PATTERN)].map((match) => match[1].trim());
  const workTitles = extractExplicitWorkTitles(source);
  const lifeYearPairs = [...source.matchAll(DATE_PAIR_PATTERN)]
    .filter((match) => isLifeYearPair(source, match))
    .map((match) => ({
      birthYear: Number(match[1]),
      deathYear: Number(match[2]),
      text: match[0],
    }));

  return {
    sentenceCount: sentences.length,
    claimTypes,
    nobelYears,
    quotedTitles: [...new Set(quotedTitles)].sort((a, b) => a.localeCompare(b, "ru")),
    workTitles,
    lifeYearPairs,
  };
}

function issue(code, severity, field, values, note, safeFixCandidate = null) {
  return { code, severity, field, values, note, safeFixCandidate };
}

function validateCardDates(writer) {
  const issues = [];
  const birth = parsePartialDate(writer.birthDate);
  const death = parsePartialDate(writer.deathDate);
  if (birth && death && death.year < birth.year) {
    issues.push(
      issue(
        "death-before-birth",
        "contradiction",
        "birthDate/deathDate",
        { birthDate: writer.birthDate, deathDate: writer.deathDate },
        "Структурированный год смерти предшествует году рождения.",
        "Сверить обе даты с authority-записью, затем заново вывести years из подтверждённых структурированных дат."
      )
    );
  }
  if (birth && death && death.year - birth.year > 125) {
    issues.push(
      issue(
        "implausible-lifespan",
        "high-risk",
        "birthDate/deathDate",
        { birthDate: writer.birthDate, deathDate: writer.deathDate },
        "Структурированная продолжительность жизни превышает 125 лет и требует сверки источника."
      )
    );
  }

  const yearsLabel = String(writer.years || "");
  const yearsMatch = /(?:\/|или)/iu.test(yearsLabel)
    ? null
    : yearsLabel.match(/\b(\d{3,4})\s*[−-]\s*(\d{3,4})\b/u);
  if (yearsMatch) {
    const [, birthYear, deathYear] = yearsMatch;
    const beforeCommonEra = /(?:до\s+н\.\s*э\.?|до\s+нашей\s+эры)/iu.test(
      yearsLabel
    );
    const labelBirthYear = beforeCommonEra ? -Number(birthYear) : Number(birthYear);
    const labelDeathYear = beforeCommonEra ? -Number(deathYear) : Number(deathYear);
    if (birth && labelBirthYear !== birth.year) {
      issues.push(
        issue(
          "years-label-birth-conflict",
          "contradiction",
          "years/birthDate",
          { years: writer.years, birthDate: writer.birthDate },
          "Строка years противоречит структурированной дате рождения.",
          "После подтверждения birthDate заново вывести years из структурированных дат."
        )
      );
    }
    if (death && labelDeathYear !== death.year) {
      issues.push(
        issue(
          "years-label-death-conflict",
          "contradiction",
          "years/deathDate",
          { years: writer.years, deathDate: writer.deathDate },
          "Строка years противоречит структурированной дате смерти.",
          "После подтверждения deathDate заново вывести years из структурированных дат."
        )
      );
    }
  }
  return issues;
}

function compareBiographyToCard(writer, claims) {
  const issues = [];
  const structuredBirthYear = dateYear(writer.birthDate);
  const structuredDeathYear = dateYear(writer.deathDate);
  for (const pair of claims.lifeYearPairs) {
    if (structuredBirthYear !== null && structuredBirthYear !== pair.birthYear) {
      issues.push(
        issue(
          "biography-birth-year-conflict",
          "contradiction",
          "biography/birthDate",
          { biography: pair.text, birthDate: writer.birthDate },
          "Пара лет жизни в биографии противоречит году рождения карточки.",
          "Проверить год рождения в authority-источнике; затем исправить либо утверждение bio, либо birthDate, не выбирая значение по догадке."
        )
      );
    }
    if (structuredDeathYear !== null && structuredDeathYear !== pair.deathYear) {
      issues.push(
        issue(
          "biography-death-year-conflict",
          "contradiction",
          "biography/deathDate",
          { biography: pair.text, deathDate: writer.deathDate },
          "Пара лет жизни в биографии противоречит году смерти карточки.",
          "Проверить год смерти в authority-источнике; затем исправить либо утверждение bio, либо deathDate, не выбирая значение по догадке."
        )
      );
    }
  }

  if (claims.nobelYears.length && writer.nobelYear) {
    for (const claimedYear of claims.nobelYears) {
      if (claimedYear !== Number(writer.nobelYear)) {
        issues.push(
          issue(
            "biography-nobel-year-conflict",
            "contradiction",
            "biography/nobelYear",
            { biographyYear: claimedYear, nobelYear: writer.nobelYear },
            "Год Нобелевской премии в биографии противоречит полю nobelYear.",
            "Проверить официальную страницу Nobel Prize, затем согласовать текст и nobelYear с одним подтверждённым годом."
          )
        );
      }
    }
  } else if (claims.claimTypes.includes("nobel") && !writer.nobelYear) {
    issues.push(
      issue(
        "nobel-claim-missing-structured-year",
        "metadata-gap",
        "biography/nobelYear",
        { biographyYears: claims.nobelYears, nobelYear: null },
        "В биографии есть утверждение о Нобелевской премии, но в карточке нет nobelYear.",
        "Проверить утверждение на официальной странице Nobel Prize; если оно подтверждено, заполнить nobelYear без изменения авторского текста."
      )
    );
  }

  const structuredWorks = [
    ...(writer.works || []),
    ...(writer.workDetails || []).map((work) => work?.title),
  ]
    .map((title) => String(title || "").trim())
    .filter(Boolean);
  for (const title of claims.workTitles) {
    if (!structuredWorks.some((candidate) => equivalentWorkTitle(candidate, title))) {
      issues.push(
        issue(
          "named-work-not-in-structured-list",
          "metadata-gap",
          "biography/works",
          { biographyTitle: title },
          "Название, поданное в bio как произведение, отсутствует в структурированном списке works.",
          "Проверить название и авторство по библиографическому authority-источнику; затем либо добавить подтверждённое произведение в works, либо исправить название в bio."
        )
      );
    }
  }
  return issues;
}

function compareWithStaging(writer, stagingWriter, resolvedFields = new Set()) {
  const issues = [];
  for (const field of ["birthDate", "deathDate"]) {
    if (resolvedFields.has(field)) continue;
    if (
      writer[field] &&
      stagingWriter[field] &&
      partialDatesConflict(writer[field], stagingWriter[field])
    ) {
      const cardDate = parsePartialDate(writer[field]);
      const stagingDate = parsePartialDate(stagingWriter[field]);
      const yearConflict = cardDate?.year !== stagingDate?.year;
      issues.push(
        issue(
          `card-${field}-staging-conflict`,
          yearConflict
            ? "high-confidence-source-conflict"
            : "calendar-or-source-discrepancy",
          field,
          { card: writer[field], staging: stagingWriter[field] },
          yearConflict
            ? "Карточка и source-confirmed staging расходятся по году при надёжно сопоставленной личности."
            : "Карточка и source-confirmed staging совпадают по году, но расходятся по месяцу или дню; календарный стиль, точность источника или ошибку данных нужно разрешить вручную.",
          yearConflict
            ? "Проверить год по указанной цепочке Wikidata/authority; записать подтверждённый год в структурированное поле и вывести years из него."
            : "Сопоставить исходные authority-источники и календарную систему; сохранить текущее значение, пока одна дата не получит более сильного подтверждения."
        )
      );
    }
  }
  return issues;
}

function stableHash(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function recordPriority(issues, claims, hasReliableSource) {
  if (
    issues.some((item) =>
      ["contradiction", "high-confidence-source-conflict"].includes(item.severity)
    )
  ) {
    return "P0";
  }
  if (
    issues.some((item) =>
      ["high-risk", "calendar-or-source-discrepancy"].includes(item.severity)
    ) ||
    claims.claimTypes.some((type) =>
      ["critical-ranking", "priority-claim", "nobel", "awards"].includes(type)
    )
  ) {
    return "P1";
  }
  return hasReliableSource ? "P2" : "P3";
}

export function auditWriterBiographyRecord(
  publicRecord,
  stagingIndex,
  curatedQids = {},
  biographySelector = (writer) => writer.bio || writer.biography || writer.description || "",
  wikidataIndex = new Map()
) {
  const { countryId, countryName, writer } = publicRecord;
  const key = `${countryId}:${writer.id}`;
  const text = String(biographySelector(writer) || "").trim();
  const claims = extractBiographyClaims(text);
  const identity = resolveReliableStagingIdentity(publicRecord, stagingIndex, curatedQids);
  const stagingWriter = identity.record?.writer || null;
  const stagingSourceConfirmed = Boolean(
    stagingWriter &&
      stagingWriter.verification?.status === "source-confirmed" &&
      !(stagingWriter.verification?.issues || []).length
  );
  const wikidataEvidence = buildWikidataEvidence(
    publicRecord,
    curatedQids,
    wikidataIndex
  );
  const manualResolutions = (WRITER_FACT_MANUAL_RESOLUTIONS[key] || [])
    .filter(
      (resolution) =>
        String(writer[resolution.field] || "") === resolution.cardValue &&
        String(stagingWriter?.[resolution.field] || "") === resolution.stagingValue
    )
    .map((resolution) => ({
      ...resolution,
      observedStagingValue: stagingWriter?.[resolution.field] || null,
    }));
  const resolvedFields = new Set(
    manualResolutions.map((resolution) => resolution.field)
  );
  const issues = [
    ...validateCardDates(writer),
    ...compareBiographyToCard(writer, claims),
    ...(stagingSourceConfirmed
      ? compareWithStaging(writer, stagingWriter, resolvedFields)
      : []),
  ];
  const hasLiteraryOccupationEvidence = Boolean(
    stagingSourceConfirmed &&
      (stagingWriter.occupationIds || []).some((id) => LITERARY_OCCUPATION_IDS.has(id))
  );
  const locallyCorroboratedClaimTypes = [
    ...(stagingSourceConfirmed ? ["identity"] : []),
    ...(stagingSourceConfirmed && (stagingWriter.birthDate || stagingWriter.deathDate)
      ? ["life-dates"]
      : []),
    ...(hasLiteraryOccupationEvidence ? ["identity-role"] : []),
  ].sort();
  const claimsRequiringHumanSources = claims.claimTypes.filter(
    (type) => !locallyCorroboratedClaimTypes.includes(type)
  );
  const sourceUrls = stagingSourceConfirmed
    ? [
        stagingWriter.verification?.source,
        stagingWriter.sourceUrl,
        stagingWriter.articleUrl,
        ...(stagingWriter.editorial?.sources || []).map((source) => source.url),
      ].filter((url, index, values) => url && values.indexOf(url) === index)
    : [];

  return {
    key,
    countryId,
    countryName,
    writerId: writer.id,
    name: writer.name || writer.fullName || writer.id,
    biography: {
      present: Boolean(text),
      sha256: stableHash(text),
      characters: text.length,
      sentenceCount: claims.sentenceCount,
    },
    claims: {
      types: claims.claimTypes,
      nobelYears: claims.nobelYears,
      quotedTitleCount: claims.quotedTitles.length,
      namedWorkTitles: claims.workTitles,
      lifeYearPairs: claims.lifeYearPairs,
      locallyCorroboratedTypes: locallyCorroboratedClaimTypes,
      typesRequiringHumanSources: claimsRequiringHumanSources,
    },
    stagingEvidence: {
      identityStatus: identity.status,
      matchMethod: identity.method,
      matchEvidence: identity.evidence,
      wikidataId: stagingWriter?.wikidataId || null,
      verificationStatus: stagingWriter?.verification?.status || null,
      sourceConfirmed: stagingSourceConfirmed,
      sourceUrls,
      authorityIds: stagingSourceConfirmed ? stagingWriter.authorityIds || {} : {},
    },
    wikidataEvidence,
    manualResolutions,
    issues,
    priority: recordPriority(issues, claims, stagingSourceConfirmed),
    automatedCoverage: {
      textAndClaimInventory: true,
      cardSelfConsistency: true,
      reliableStagingIdentity: identity.status === "reliable-match",
      sourceConfirmedStructuredCrossCheck: stagingSourceConfirmed,
      wikidataStructuredTriage: wikidataEvidence.entityAvailable,
      manualSourceResolutionApplied: manualResolutions.length > 0,
      completeClaimLevelFactCheck: false,
    },
  };
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value);
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function comparisonHasMatchingIdentitySignal(comparison) {
  return [
    "exact-gregorian-match",
    "compatible-at-shared-precision",
    "compatible-alternate-rank",
    "calendar-equivalent",
  ].includes(comparison?.status);
}

function classifyWikidataDateDiscrepancy(record, field, comparison) {
  const cardDate = parsePartialDate(comparison.cardValue);
  const claimDates = (comparison.bestRankClaims || [])
    .map((claim) => parsePartialDate(claim.value))
    .filter(Boolean);
  const claimYears = [...new Set(claimDates.map((date) => date.year))].sort(
    (a, b) => a - b
  );
  const yearConflict = Boolean(
    cardDate && claimYears.length && !claimYears.includes(cardDate.year)
  );
  const nearestYearDistance =
    cardDate && claimYears.length
      ? Math.min(...claimYears.map((year) => Math.abs(year - cardDate.year)))
      : null;
  const otherField = field === "birthDate" ? "deathDate" : "birthDate";
  const otherComparison = record.wikidataEvidence.dates?.[otherField];
  const otherFieldCorroboratesIdentity = comparisonHasMatchingIdentitySignal(
    otherComparison
  );
  const otherCardDate = parsePartialDate(otherComparison?.cardValue);
  const otherClaimYears = (otherComparison?.bestRankClaims || [])
    .map((claim) => parsePartialDate(claim.value)?.year)
    .filter((year) => year !== undefined && year !== null);
  const otherYearConflict = Boolean(
    otherCardDate &&
      otherClaimYears.length &&
      !otherClaimYears.includes(otherCardDate.year)
  );
  const identityValidationStatus =
    record.wikidataEvidence.identityValidationStatus ||
    "identity-review-required";
  const likelyIdentityMismatch =
    identityValidationStatus !== "identity-corroborated";
  const modern = Boolean(
    (cardDate?.year || claimYears[0] || 0) >= 1900
  );
  const referenced = (comparison.bestRankClaims || []).some(
    (claim) => claim.referenced
  );
  if (likelyIdentityMismatch) {
    return {
      classificationCode: "c",
      classification: "likely-bad-qid-mapping-or-identity",
      classificationConfidence:
        identityValidationStatus === "identity-discrepant" ? "high" : "review-required",
      reason:
        identityValidationStatus === "identity-discrepant"
          ? "The RU/EN labels and/or the birth-year evidence contradict the curated card identity. Exclude this QID from factual corrections until the mapping is repaired."
          : "The RU/EN label plus birth-year identity check is incomplete. Treat the QID as a candidate, not as factual evidence, until identity is validated.",
      identityValidationStatus,
      entityLabels: record.wikidataEvidence.labels || {},
      labelIdentityMatch: record.wikidataEvidence.labelIdentityMatch ?? null,
      birthYearIdentityStatus:
        record.wikidataEvidence.birthYearIdentityStatus || "not-comparable",
      yearConflict,
      nearestYearDistance,
      otherFieldCorroboratesIdentity,
      modern,
      referenced,
    };
  }
  return {
    classificationCode: "d",
    classification: "date-contradiction-requiring-authoritative-source",
    classificationConfidence: modern && referenced ? "high-triage" : "review-required",
    reason:
      "The curated identity is not disproved, but the date values conflict. Review the Wikidata references and an authoritative national, publisher, archival, or library source before editing.",
    yearConflict,
    identityValidationStatus,
    entityLabels: record.wikidataEvidence.labels || {},
    labelIdentityMatch: record.wikidataEvidence.labelIdentityMatch ?? null,
    birthYearIdentityStatus:
      record.wikidataEvidence.birthYearIdentityStatus || "not-comparable",
    nearestYearDistance,
    otherFieldCorroboratesIdentity,
    modern,
    referenced,
  };
}

export function buildWriterBiographyFactQaReport({
  publicRecords,
  stagingPayload,
  curatedQids = {},
  wikidataSnapshot = {},
  biographySelector,
}) {
  const stagingIndex = buildStagingIdentityIndex(stagingPayload);
  const wikidataIndex = buildWikidataSnapshotIndex(wikidataSnapshot);
  const publicKeySet = new Set(
    publicRecords.map((record) => `${record.countryId}:${record.writer.id}`)
  );
  const publicCuratedQidEntries = Object.entries(curatedQids).filter(([key]) =>
    publicKeySet.has(key)
  );
  const stagingQids = new Set(
    stagingIndex.records
      .map((record) => String(record.writer?.wikidataId || "").toUpperCase())
      .filter(Boolean)
  );
  const curatedEntriesMissingStaging = publicCuratedQidEntries.filter(
    ([, record]) => !stagingQids.has(String(record.wikidataId || "").toUpperCase())
  );
  const records = publicRecords
    .map((record) =>
      auditWriterBiographyRecord(
        record,
        stagingIndex,
        curatedQids,
        biographySelector,
        wikidataIndex
      )
    )
    .sort((a, b) => a.key.localeCompare(b.key, "en"));
  const issues = records.flatMap((record) =>
    record.issues.map((item) => ({ key: record.key, name: record.name, ...item }))
  );
  const contradictionRecords = records.filter((record) =>
    record.issues.some((item) =>
      ["contradiction", "high-confidence-source-conflict"].includes(item.severity)
    )
  );
  const calendarDiscrepancyRecords = records.filter((record) =>
    record.issues.some((item) => item.severity === "calendar-or-source-discrepancy")
  );
  const metadataGapQueue = records.flatMap((record) =>
    record.issues
      .filter((item) => item.severity === "metadata-gap")
      .map((item) => ({ key: record.key, name: record.name, ...item }))
  );
  const manualResolutionQueue = records.flatMap((record) =>
    record.manualResolutions.map((resolution) => ({
      key: record.key,
      name: record.name,
      ...resolution,
    }))
  );
  const wikidataDateDiscrepancyQueue = records.flatMap((record) => {
    const resolvedFields = new Set(
      record.manualResolutions.map((resolution) => resolution.field)
    );
    return Object.entries(record.wikidataEvidence.dates || {})
      .filter(
        ([field, comparison]) =>
          comparison.status === "wikidata-date-discrepancy" &&
          !resolvedFields.has(field)
      )
      .map(([field, comparison]) => ({
        key: record.key,
        name: record.name,
        qid: record.wikidataEvidence.qid,
        field,
        cardValue: comparison.cardValue,
        bestRankClaims: comparison.bestRankClaims,
        sourceUrl: record.wikidataEvidence.sourceUrl,
        ...classifyWikidataDateDiscrepancy(record, field, comparison),
        safeAction:
          "Compare the claim references with an authoritative national or library source; do not auto-rewrite the card from Wikidata.",
      }));
  });
  const wikidataCalendarModelReviewQueue = records.flatMap((record) =>
    Object.entries(record.wikidataEvidence.dates || {})
      .filter(([, comparison]) => comparison.status === "compatible-calendar-unresolved")
      .map(([field, comparison]) => ({
        key: record.key,
        name: record.name,
        qid: record.wikidataEvidence.qid,
        field,
        cardValue: comparison.cardValue,
        matchedClaim: comparison.matchedClaim,
        classification: "calendar-model-unresolved",
        safeAction:
          "Confirm whether the card intentionally stores Old Style or New Style before normalizing the date.",
      }))
  );
  const wikidataStructuredTriageQueue = [
    ...records.flatMap((record) =>
      Object.entries(record.wikidataEvidence.dates || {}).flatMap(
        ([field, comparison]) => {
          if (comparison.status === "calendar-equivalent") {
            return [
              {
                key: record.key,
                name: record.name,
                qid: record.wikidataEvidence.qid,
                field,
                cardValue: comparison.cardValue,
                snapshotValue: comparison.matchedClaim?.value || null,
                convertedGregorianValue:
                  comparison.convertedGregorianValue || null,
                classificationCode: "a",
                classification: "calendar-equivalent",
              },
            ];
          }
          if (comparison.status === "compatible-at-shared-precision") {
            return [
              {
                key: record.key,
                name: record.name,
                qid: record.wikidataEvidence.qid,
                field,
                cardValue: comparison.cardValue,
                snapshotValue: comparison.matchedClaim?.value || null,
                classificationCode: "b",
                classification: "lower-precision-compatible",
              },
            ];
          }
          return [];
        }
      )
    ),
    ...wikidataDateDiscrepancyQueue,
  ].sort(
    (a, b) =>
      a.classificationCode.localeCompare(b.classificationCode, "en") ||
      a.key.localeCompare(b.key, "en") ||
      a.field.localeCompare(b.field, "en")
  );
  const wikidataIdentityCorroboratedRecords = records.filter(
    (record) =>
      record.wikidataEvidence.identityValidationStatus === "identity-corroborated"
  );
  const badQidIdentityQueue = records
    .filter(
      (record) =>
        record.wikidataEvidence.identityValidationStatus === "identity-discrepant"
    )
    .map((record) => ({
      key: record.key,
      name: record.name,
      qid: record.wikidataEvidence.qid,
      entityLabels: record.wikidataEvidence.labels || {},
      labelIdentityMatch: record.wikidataEvidence.labelIdentityMatch,
      cardBirthYear: record.wikidataEvidence.cardBirthYear,
      wikidataBirthYears: record.wikidataEvidence.wikidataBirthYears,
      nearestBirthYearDistance:
        record.wikidataEvidence.nearestBirthYearDistance,
      humanClaimPresent: record.wikidataEvidence.humanClaimPresent,
      literaryOccupationIds:
        record.wikidataEvidence.literaryOccupationIds || [],
      publicPortrait: record.wikidataEvidence.publicPortrait,
      publicPortraitSourceUrl:
        record.wikidataEvidence.publicPortraitSourceUrl,
      portraitIdentityRisk: record.wikidataEvidence.portraitIdentityRisk,
      safeAction:
        "Quarantine this QID and any portrait sourced through it; repair the identity mapping before using snapshot claims as factual evidence.",
    }));
  const wikidataIdentityReviewQueue = records
    .filter(
      (record) =>
        record.wikidataEvidence.identityValidationStatus ===
        "identity-review-required"
    )
    .map((record) => ({
      key: record.key,
      name: record.name,
      qid: record.wikidataEvidence.qid,
      entityLabels: record.wikidataEvidence.labels || {},
      labelIdentityMatch: record.wikidataEvidence.labelIdentityMatch,
      cardBirthYear: record.wikidataEvidence.cardBirthYear,
      wikidataBirthYears: record.wikidataEvidence.wikidataBirthYears,
      birthYearIdentityStatus:
        record.wikidataEvidence.birthYearIdentityStatus,
      humanClaimPresent: record.wikidataEvidence.humanClaimPresent,
      literaryOccupationIds:
        record.wikidataEvidence.literaryOccupationIds || [],
      safeAction:
        "Keep this as a candidate mapping only; validate the identity with an authority ID or an authoritative biographical source.",
    }));
  const claimTypeCounts = {};
  for (const record of records) {
    for (const type of record.claims.types) claimTypeCounts[type] = (claimTypeCounts[type] || 0) + 1;
  }
  const sortedClaimTypeCounts = Object.fromEntries(
    Object.entries(claimTypeCounts).sort(([a], [b]) => a.localeCompare(b, "en"))
  );
  const reliableMatches = records.filter(
    (record) => record.stagingEvidence.identityStatus === "reliable-match"
  );
  const sourceConfirmedMatches = records.filter(
    (record) => record.stagingEvidence.sourceConfirmed
  );
  const queue = records
    .map((record) => ({
      key: record.key,
      name: record.name,
      priority: record.priority,
      issueCodes: record.issues.map((item) => item.code),
      claimsRequiringHumanSources: record.claims.typesRequiringHumanSources,
      reliableStagingIdentity: record.automatedCoverage.reliableStagingIdentity,
      sourceConfirmedStructuredCrossCheck:
        record.automatedCoverage.sourceConfirmedStructuredCrossCheck,
      wikidataIdentityValidationStatus:
        record.wikidataEvidence.identityValidationStatus || "not-mapped",
    }))
    .sort((a, b) => {
      const priorities = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return priorities[a.priority] - priorities[b.priority] || a.key.localeCompare(b.key, "en");
    });

  const sourceFingerprint = stableHash(
    JSON.stringify({
      public: publicRecords
        .map((record) => ({
          key: `${record.countryId}:${record.writer.id}`,
          writer: record.writer,
        }))
        .sort((a, b) => a.key.localeCompare(b.key, "en")),
      staging: stagingPayload,
      curatedQids,
      wikidataSnapshot,
      manualResolutions: WRITER_FACT_MANUAL_RESOLUTIONS,
      manualIdentityConfirmations: WRITER_IDENTITY_MANUAL_CONFIRMATIONS,
    })
  );

  return {
    version: 3,
    deterministic: true,
    sourceFingerprint: `sha256:${sourceFingerprint}`,
    scope: {
      corpus: "stored short Russian writer biographies",
      cardsAudited: records.length,
      uiChanged: false,
      statusesChanged: false,
      biographyTextChanged: false,
      claimLevelFactChecksCompletedByAutomation: 0,
      statement:
        "This report inventories every biography and detects local contradictions. It does not certify the corpus as fact-checked.",
    },
    summary: {
      writerCards: records.length,
      biographiesPresent: records.filter((record) => record.biography.present).length,
      claimTypeCounts: sortedClaimTypeCounts,
      reliableStagingIdentityMatches: reliableMatches.length,
      sourceConfirmedStructuredCrossChecks: sourceConfirmedMatches.length,
      sourceConfirmedCoveragePercent:
        records.length === 0
          ? 0
          : Number(((sourceConfirmedMatches.length / records.length) * 100).toFixed(1)),
      wikidataSnapshotCandidateRecords: records.filter(
        (record) => record.wikidataEvidence.entityAvailable
      ).length,
      wikidataIdentityCorroboratedRecords:
        wikidataIdentityCorroboratedRecords.length,
      wikidataIdentityDiscrepantRecords: badQidIdentityQueue.length,
      wikidataIdentityReviewRequiredRecords:
        wikidataIdentityReviewQueue.length,
      wikidataStructuredTriageCoveragePercent:
        records.length === 0
          ? 0
          : Number(
              ((
                wikidataIdentityCorroboratedRecords.length / records.length
              ) * 100).toFixed(1)
            ),
      wikidataDateFieldsCompared: records.reduce(
        (total, record) =>
          total +
          Object.values(record.wikidataEvidence.dates || {}).filter(
            (comparison) =>
              !["no-card-date", "no-wikidata-date"].includes(comparison.status)
          ).length,
        0
      ),
      wikidataExactGregorianDateMatches: records.reduce(
        (total, record) =>
          total +
          Object.values(record.wikidataEvidence.dates || {}).filter(
            (comparison) => comparison.status === "exact-gregorian-match"
          ).length,
        0
      ),
      wikidataSharedPrecisionMatches: records.reduce(
        (total, record) =>
          total +
          Object.values(record.wikidataEvidence.dates || {}).filter(
            (comparison) => comparison.status === "compatible-at-shared-precision"
          ).length,
        0
      ),
      wikidataCalendarUnresolvedMatches: records.reduce(
        (total, record) =>
          total +
          Object.values(record.wikidataEvidence.dates || {}).filter(
            (comparison) => comparison.status === "compatible-calendar-unresolved"
          ).length,
        0
      ),
      wikidataAlternateRankMatches: records.reduce(
        (total, record) =>
          total +
          Object.values(record.wikidataEvidence.dates || {}).filter(
            (comparison) => comparison.status === "compatible-alternate-rank"
          ).length,
        0
      ),
      wikidataUnresolvedDateDiscrepancies:
        wikidataDateDiscrepancyQueue.length,
      wikidataModernReferencedDateContradictions:
        wikidataDateDiscrepancyQueue.filter(
          (item) =>
            item.classificationCode === "d" && item.modern && item.referenced
        ).length,
      wikidataLikelyBadQidOrIdentityDateRows:
        wikidataDateDiscrepancyQueue.filter(
          (item) => item.classificationCode === "c"
        ).length,
      wikidataTriageClassificationCounts: countBy(
        wikidataStructuredTriageQueue,
        (item) => `${item.classificationCode}:${item.classification}`
      ),
      wikidataLiteraryOccupationCorroborations: records.filter(
        (record) => record.wikidataEvidence.literaryOccupationIds?.length
      ).length,
      manuallyResolvedRecords: records.filter(
        (record) => record.manualResolutions.length > 0
      ).length,
      manualResolutionEntries: manualResolutionQueue.length,
      recordsWithConcreteContradictions: contradictionRecords.length,
      concreteContradictionIssues: issues.filter((item) =>
        ["contradiction", "high-confidence-source-conflict"].includes(item.severity)
      ).length,
      calendarOrSourceDiscrepancyRecords: calendarDiscrepancyRecords.length,
      calendarOrSourceDiscrepancyIssues: issues.filter(
        (item) => item.severity === "calendar-or-source-discrepancy"
      ).length,
      metadataGapIssues: issues.filter((item) => item.severity === "metadata-gap").length,
      recordsNeedingHumanClaimSources: records.filter(
        (record) => record.claims.typesRequiringHumanSources.length
      ).length,
      priorityCounts: countBy(records, (record) => record.priority),
      matchMethodCounts: countBy(reliableMatches, (record) => record.stagingEvidence.matchMethod),
      issueCodeCounts: countBy(issues, (item) => item.code),
    },
    automationBoundary: {
      fullyAutomated: [
        "presence, length and sentence inventory for every stored biography",
        "claim-type routing for every stored biography",
        "internal consistency of life dates, Nobel year and structured works metadata",
        "source-conflict detection where a reliable staging identity and source-confirmed structured record exist",
        "offline Wikidata candidate triage with RU/EN label, birth-year, precision, calendar and rank preservation",
      ],
      notAutomated: [
        "truth of interpretive, reputational, thematic, influence or priority claims",
        "identity resolution where local identifiers are absent or ambiguous",
        "treating a curated QID candidate as identity-confirmed without label and birth-year corroboration",
        "selection between conflicting sources",
        "full claim-by-claim factual approval",
      ],
      safeConclusion:
        "Automation inventories every card and expands candidate triage with an offline snapshot. Only the source-confirmed staging subset and explicitly curated manual resolutions are source-backed; Wikidata rows remain candidate evidence until identity and source references are validated. Every prose claim still needs a human-selected source before the corpus can be called fact-checked.",
    },
    wikidataStructuredSnapshot: {
      source: "Wikidata compact CC0 snapshot linked through the curated QID candidate registry and independently revalidated by RU/EN label plus birth year",
      retrievedAt: wikidataSnapshot.retrievedAt || null,
      qidSetSha256: wikidataSnapshot.source?.qidSetSha256 || null,
      snapshotUniqueQids: wikidataSnapshot.counts?.requestedQids || 0,
      snapshotReturnedEntities: wikidataSnapshot.counts?.returnedEntities || 0,
      selectedProperties: wikidataSnapshot.source?.properties || [],
      publicCardsWithCuratedQid: publicCuratedQidEntries.length,
      publicCorpusCoveragePercent:
        records.length === 0
          ? 0
          : Number(((publicCuratedQidEntries.length / records.length) * 100).toFixed(1)),
      curatedCardsAlreadyPresentInStaging:
        publicCuratedQidEntries.length - curatedEntriesMissingStaging.length,
      publicCardsWithSnapshotEntity: records.filter(
        (record) => record.wikidataEvidence.entityAvailable
      ).length,
      identityCorroboratedPublicCards:
        wikidataIdentityCorroboratedRecords.length,
      identityDiscrepantPublicCards: badQidIdentityQueue.length,
      identityReviewRequiredPublicCards:
        wikidataIdentityReviewQueue.length,
      curatedCardsMissingCompactSnapshot: records.filter(
        (record) =>
          record.wikidataEvidence.mappingStatus !== "no-curated-qid" &&
          !record.wikidataEvidence.entityAvailable
      ).length,
      publicCardsWithoutCuratedQid: records.length - publicCuratedQidEntries.length,
      implementationStatus: "checked-in-offline-snapshot-active",
      safetyBoundary:
        "Wikidata expands structured discrepancy triage only. It does not certify prose claims, resolve conflicting sources, rewrite biographies, or change publication status automatically.",
    },
    contradictionQueue: contradictionRecords,
    calendarOrSourceDiscrepancyQueue: calendarDiscrepancyRecords,
    manualResolutionQueue,
    wikidataDateDiscrepancyQueue,
    wikidataStructuredTriageQueue,
    wikidataCalendarModelReviewQueue,
    badQidIdentityQueue,
    wikidataIdentityReviewQueue,
    metadataGapQueue,
    reviewQueue: queue,
    records,
  };
}

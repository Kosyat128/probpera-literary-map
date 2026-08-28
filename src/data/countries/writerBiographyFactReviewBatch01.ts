export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimFinding =
  | "confirmed"
  | "corrected"
  | "held";

export type WriterBiographyClaimField =
  | "identity-role"
  | "national-cultural-affiliation"
  | "critical-ranking"
  | "language"
  | "priority-claim"
  | "reception-influence"
  | "works"
  | "themes-style"
  | "awards";

export type WriterBiographyEvidenceSource = {
  provider: string;
  sourceFamily: string;
  url: string;
  checkedAt: string;
};

export type WriterBiographyClaimEvidence = {
  field: WriterBiographyClaimField;
  claimRu: string;
  finding: WriterBiographyClaimFinding;
  sources: readonly WriterBiographyEvidenceSource[];
};

export type WriterBiographyFactReviewRecord = {
  key: `${string}:${string}`;
  originalSha256: string;
  originalTextRu: string;
  reviewedTextRu: string;
  claimEvidence: readonly WriterBiographyClaimEvidence[];
  reviewer: string;
  decision: WriterBiographyFactReviewDecision;
  notes: readonly string[];
};

/**
 * Stable, batch-agnostic shape consumed by the future review aggregator.
 * The detailed source-family metadata above remains available in the isolated
 * batch, while this adapter deliberately matches the normalized batch schema.
 */
export type NormalizedWriterBiographyFactReviewRecord = {
  key: `${string}:${string}`;
  originalSha256: string;
  reviewedTextRu: string;
  applicableTextRu: string | null;
  claims: readonly {
    textRu: string;
    verdict: "supported" | "corrected" | "not-established";
    evidence: readonly {
      provider: string;
      url: string;
      checkedAt: string;
      findingRu: string;
    }[];
  }[];
  reviewer: string;
  decision: WriterBiographyFactReviewDecision;
  notes: string;
};

const checkedAt = "2026-08-09";
const reviewer = "OpenAI Codex / writer_claim_review_batch01";

function source(
  provider: string,
  sourceFamily: string,
  url: string
): WriterBiographyEvidenceSource {
  return { provider, sourceFamily, url, checkedAt };
}

function claim(
  field: WriterBiographyClaimField,
  claimRu: string,
  finding: WriterBiographyClaimFinding,
  sources: readonly WriterBiographyEvidenceSource[]
): WriterBiographyClaimEvidence {
  return { field, claimRu, finding, sources };
}

const bnfAtiq = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/ark:/12148/cb13579642n"
);
const cannesAtiq = source(
  "Festival de Cannes",
  "international-film-institution",
  "https://www.festival-cannes.com/en/p/atiq-rahimi-3/"
);
const goncourtAtiq = source(
  "Académie Goncourt",
  "official-prize-body",
  "https://www.academiegoncourt.com/tous-les-laureats-prix-goncourt"
);
const polEarthAndAshes = source(
  "Éditions P.O.L",
  "publisher",
  "https://www.pol-editeur.com/index.php?ISBN=2-84682-045-7&spec=livre"
);
const polSyngueSabour = source(
  "Éditions P.O.L",
  "publisher",
  "https://www.pol-editeur.com/index.php?ISBN=978-2-84682-277-0&spec=livre"
);
const iranicaKhalili = source(
  "Encyclopaedia Iranica",
  "academic-encyclopedia",
  "https://www.iranicaonline.org/articles/kalili-kalil-allah/"
);
const locKhalili = source(
  "Library of Congress",
  "national-library",
  "https://www.loc.gov/exhibits/thousand-years-of-the-persian-book/eighteenth-and-nineteenth-century-literature.html"
);
const iranicaTarzi = source(
  "Encyclopaedia Iranica",
  "academic-encyclopedia",
  "https://www.iranicaonline.org/articles/tarzi-mahmud/"
);
const bookerKadare = source(
  "Booker Prize Foundation",
  "official-prize-body",
  "https://thebookerprizes.com/the-booker-library/authors/ismail-kadare"
);
const albanianAcademyKadare = source(
  "Academy of Sciences of Albania",
  "national-academy",
  "https://akad.gov.al/wp-content/uploads/2024/02/I.Kadare.pdf"
);
const treccaniDeRada = source(
  "Treccani",
  "national-encyclopedia",
  "https://www.treccani.it/enciclopedia/girolamo-de-rada_%28Enciclopedia-Italiana%29/"
);
const albanianAcademyDeRada = source(
  "Academy of Sciences of Albania",
  "national-academy",
  "https://akad.gov.al/wp-content/uploads/2026/04/Buletini-Mars-2026_compressed.pdf"
);
const pogradecKuteli = source(
  "Municipality of Pogradec / Academy of Sciences of Albania",
  "government-and-national-academy",
  "https://bashkiapogradec.gov.al/publikime/aktivitete-4/akademia-e-shkencave-akrodon-titull-per-mitrush-kutelin-ne-115-vjetorin-e-lindjes--267/"
);
const qkllKuteli = source(
  "National Centre for Books and Reading of Albania",
  "national-book-center",
  "https://qkll.gov.al/?p=6938"
);
const albanianAcademyNaim = source(
  "Academy of Sciences of Albania",
  "national-academy",
  "https://akad.gov.al/wp-content/uploads/2026/06/Maj-2026-Final_compressed.pdf"
);
const albanianAcademyNaimOctober = source(
  "Academy of Sciences of Albania",
  "national-academy",
  "https://akad.gov.al/wp-content/uploads/2025/11/Buletini-tetor-2025.pdf"
);
const academieDjebar = source(
  "Académie française",
  "national-academy",
  "https://www.academie-francaise.fr/les-immortels/assia-djebar?election=16-06-&fauteuil=5"
);
const bnfDjebar = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/ark:/12148/cb11900279p"
);
const imaKateb = source(
  "Institut du monde arabe",
  "public-cultural-institution",
  "https://www.imarabe.org/fr/agenda/rencontres-et-debats/rencontre-debat-lectures-kateb-yacine"
);
const bnfKateb = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/rechercher.do?motRecherche=Kateb+Yacine"
);
const bnfDib = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://www.bnf.fr/fr/agenda/mohammed-dib"
);
const bnfDibArchive = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://www.bnf.fr/fr/selection-de-dons-faits-la-bnf-en-2012"
);
const academieDib = source(
  "Académie française",
  "national-academy",
  "https://www.academie-francaise.fr/rapports-sur-les-grands-prix-et-discours-sur-letat-de-la-langue-0"
);
const radioMoufdi = source(
  "Radio Algérienne / Algérie Presse Service",
  "state-news-agency",
  "https://news.radioalgerie.dz/fr/node/30780"
);
const bnfMoufdi = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/ark:/12148/cb158269504"
);
const imaFeraoun = source(
  "Institut du monde arabe",
  "public-cultural-institution",
  "https://www.imarabe.org/fr/magazine/hommage-ecrivain-algerien-mouloud-feraoun-28-septembre-2013"
);
const bnfFeraoun = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/ark:/12148/cb13091444d"
);
const bnfBoudjedra = source(
  "Bibliothèque nationale de France",
  "national-library",
  "https://catalogue.bnf.fr/ark:/12148/cb118932046"
);
const imaBoudjedra = source(
  "Institut du monde arabe",
  "public-cultural-institution",
  "https://www.imarabe.org/fr/magazine/chaire-ima-rend-hommage-naget-belkaid-khadda"
);
const radioBoudjedra = source(
  "Radio Algérienne / Algérie Presse Service",
  "state-news-agency",
  "https://news.radioalgerie.dz/fr/node/73262"
);
const andorraMorell = source(
  "Government of Andorra",
  "government-publication",
  "https://www.govern.ad/documents/d/guest/2019_el_soler_antoni_morell_lhumanista_andorra"
);
const angolaNeto = source(
  "Government of Angola",
  "government-publication",
  "https://governo.gov.ao/noticias/2940/cultura/homenagem-a-agostinho-neto/abertas-candidaturas-do-premio-literario-sagrada-esperanca-2026"
);
const angolaNetoCentenary = source(
  "Government of Angola",
  "government-publication",
  "https://governo.gov.ao/noticias/92/sociedade/executivo-lanca-programa-do-centenario-de-agostinho-neto/o-ministro-de-estado-e-chefe-da-casa-civil-do-presidente-da-republica-adao-de-almeida-considerou-justo-merecido-e-necessario-celebrar-o-centenario-de-agostinho-neto"
);
const ucclaLuandino = source(
  "UCCLA",
  "intermunicipal-cultural-institution",
  "https://www.uccla.pt/sites/default/files/a_literatura_angolana.pdf"
);
const angolaLuandino = source(
  "Government of Angola",
  "government-publication",
  "https://sys.portais.gov.ao/uploads/News_Letter_Mirempet_Edicao_69_31_12_2024_28c9e40d5a.pdf"
);
const ucclaOndjaki = source(
  "UCCLA",
  "intermunicipal-cultural-institution",
  "https://www.uccla.pt/noticias/ondjaki-vence-premio-jose-saramago"
);
const angolaLiteraryPatrimony = source(
  "Government of Angola",
  "government-publication",
  "https://mat.gov.ao/web/noticias/colectanea-%22angola%3A-50-livros-50-autores%22-marca-encerramento-das-celebracoes-da-independencia-nacional"
);
const ucclaCamoes = source(
  "UCCLA",
  "intermunicipal-cultural-institution",
  "https://www.uccla.pt/noticias/premio-camoes-atribuido-escritora-brasileira-adelia-prado"
);
const angolaPepetelaWorks = source(
  "National Institute for Qualification in Education of Angola",
  "government-education-institute",
  "https://infqe.gov.ao/documentos/baixar/12"
);
const harvardKincaid = source(
  "Harvard University Department of English",
  "university",
  "https://english.fas.harvard.edu/news/jamaica-kincaids-encyclopedia-gardening-colored-children"
);
const harvardGazetteKincaid = source(
  "Harvard Gazette",
  "university",
  "https://news.harvard.edu/gazette/story/2024/07/visiting-jamaica-kincaids-vermont-garden/"
);
const nbfKincaid = source(
  "National Book Foundation",
  "official-prize-body",
  "https://www.nationalbook.org/people/jamaica-kincaid/"
);
const cervantesBioy = source(
  "Instituto Cervantes",
  "national-cultural-institution",
  "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/cairo_adolfo_bioy_casares.htm"
);
const argentinaBioy = source(
  "Argentina Ministry of Culture",
  "government-cultural-institution",
  "https://www.cultura.gob.ar/los-ultimos-dias-de-borges-por-adolfo-bioy-casares-9121/"
);

export const writerBiographyFactReviewBatch01 = [
  {
    key: "afghanistan:atiq_rahimi",
    originalSha256:
      "91a4302d3b48159b170cacd20e61bf559d110b5c572fa2039cfae8178075f307",
    originalTextRu:
      "Афганский писатель и режиссёр. Получил международное признание благодаря романам о войне, памяти и человеческом достоинстве.",
    reviewedTextRu:
      "Афганский писатель и режиссёр. Получил международное признание благодаря романам о войне, памяти и человеческом достоинстве.",
    claimEvidence: [
      claim(
        "identity-role",
        "Атик Рахими - писатель и режиссёр.",
        "confirmed",
        [bnfAtiq, cannesAtiq]
      ),
      claim(
        "national-cultural-affiliation",
        "Автор связан с Афганистаном и афганской литературой.",
        "confirmed",
        [bnfAtiq, cannesAtiq]
      ),
      claim(
        "reception-influence",
        "Его книги получили международное признание.",
        "confirmed",
        [cannesAtiq, goncourtAtiq]
      ),
      claim(
        "works",
        "В его романах представлены война, память и человеческое достоинство.",
        "confirmed",
        [polEarthAndAshes, polSyngueSabour]
      ),
    ],
    reviewer,
    decision: "unchanged",
    notes: [
      "Формулировка сохранена: все конкретные утверждения подтверждены независимыми институциональными и издательскими источниками.",
    ],
  },
  {
    key: "afghanistan:khalilullah_khalili",
    originalSha256:
      "bde202fe9e4bd8ea9808604fa535faaa6099461b2b4fc0b66048e05bb7ecc841",
    originalTextRu:
      "Величайший афганский поэт XX века, один из последних крупных представителей классической персидской поэтической традиции.",
    reviewedTextRu:
      "Афганский поэт XX века, писавший в классической персидской традиции.",
    claimEvidence: [
      claim(
        "identity-role",
        "Халилулла Халили - афганский поэт XX века.",
        "confirmed",
        [iranicaKhalili, locKhalili]
      ),
      claim(
        "national-cultural-affiliation",
        "Он принадлежит персоязычной литературе Афганистана.",
        "confirmed",
        [iranicaKhalili, locKhalili]
      ),
      claim(
        "critical-ranking",
        "Оценочный суперлатив заменён проверяемым описанием поэтической традиции.",
        "corrected",
        [locKhalili, iranicaKhalili]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективные определения «величайший» и «крупный» удалены; роль, эпоха и поэтическая традиция сохранены по двум независимым источникам.",
    ],
  },
  {
    key: "afghanistan:mahmud_tarzi",
    originalSha256:
      "3b6e67133b6d9a09116b62b6b04801a114981aeac62de2a84a374cd6ee84107e",
    originalTextRu:
      "Афганский писатель, журналист и мыслитель. Один из основателей современной афганской публицистики и литературы.",
    reviewedTextRu:
      "Афганский писатель, журналист и мыслитель. Один из основателей современной афганской публицистики и литературы.",
    claimEvidence: [
      claim(
        "identity-role",
        "Махмуд Тарзи - писатель, журналист и мыслитель.",
        "confirmed",
        [iranicaTarzi]
      ),
      claim(
        "national-cultural-affiliation",
        "Его деятельность относится к Афганистану.",
        "confirmed",
        [iranicaTarzi]
      ),
      claim(
        "priority-claim",
        "Тарзи стоял у истоков современной афганской журналистики и новых литературных форм.",
        "confirmed",
        [iranicaTarzi]
      ),
    ],
    reviewer,
    decision: "unchanged",
    notes: [
      "Iranica прямо называет Тарзи отцом журналистики и описывает введённые им новые жанры прозы.",
    ],
  },
  {
    key: "albania:ismail_kadare",
    originalSha256:
      "9c490a561c0d40181e1a30c4324b06272c2c58e9bba1fe629d24918ed0a76fff",
    originalTextRu: "Крупнейший албанский писатель XX-XXI веков.",
    reviewedTextRu:
      "Албанский писатель, лауреат Международной Букеровской премии 2005 года.",
    claimEvidence: [
      claim(
        "identity-role",
        "Исмаил Кадаре - албанский писатель.",
        "confirmed",
        [bookerKadare, albanianAcademyKadare]
      ),
      claim(
        "national-cultural-affiliation",
        "Он является центральной фигурой албанской литературы.",
        "confirmed",
        [albanianAcademyKadare]
      ),
      claim(
        "critical-ranking",
        "Оценочный суперлатив заменён документированным международным признанием.",
        "corrected",
        [albanianAcademyKadare, bookerKadare]
      ),
      claim(
        "awards",
        "Кадаре получил Международную Букеровскую премию 2005 года.",
        "confirmed",
        [bookerKadare]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективное слово «крупнейший» заменено точным фактом из официального архива Букеровской премии.",
    ],
  },
  {
    key: "albania:jeronim_de_rada",
    originalSha256:
      "0357849bd0cc91a6da0beaa5aed9a45f77b162aed3436a632b0eeade60fc2101",
    originalTextRu:
      "Албанский поэт арберешской традиции, один из основателей албанского национального литературного движения.",
    reviewedTextRu:
      "Албанский поэт арберешской традиции, один из инициаторов арберешского культурного движения XIX века.",
    claimEvidence: [
      claim(
        "identity-role",
        "Джеронимо де Рада - албанский поэт арберешской традиции.",
        "confirmed",
        [treccaniDeRada]
      ),
      claim(
        "national-cultural-affiliation",
        "Его творчество связано с албанским языком и культурой арберешей Италии.",
        "confirmed",
        [treccaniDeRada, albanianAcademyDeRada]
      ),
      claim(
        "priority-claim",
        "Он был одним из двух главных инициаторов итало-албанского, или арберешского, культурного движения второй половины XIX века.",
        "corrected",
        [albanianAcademyDeRada]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Широкое выражение «основатель албанского национального литературного движения» заменено точной формулировкой национальной академии об арберешском культурном движении.",
    ],
  },
  {
    key: "albania:mitrush_kuteli",
    originalSha256:
      "31cba6ce2ff25f56b3e08a4d35158da2d4ee02adfa1761353302f81bcf772395",
    originalTextRu:
      "Албанский писатель, поэт и переводчик, один из крупнейших авторов албанской прозы XX века.",
    reviewedTextRu:
      "Албанский писатель, поэт и переводчик, один из основоположников современной албанской прозы.",
    claimEvidence: [
      claim(
        "identity-role",
        "Митруш Кутели - писатель, поэт и переводчик.",
        "confirmed",
        [pogradecKuteli]
      ),
      claim(
        "national-cultural-affiliation",
        "Его творчество принадлежит албанской литературе.",
        "confirmed",
        [pogradecKuteli, qkllKuteli]
      ),
      claim(
        "priority-claim",
        "Оценочный суперлатив заменён подтверждённой историко-литературной ролью Кутели в становлении современной албанской прозы.",
        "corrected",
        [qkllKuteli, pogradecKuteli]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективное выражение «один из крупнейших» заменено подтверждённой ролью в становлении современной албанской прозы.",
    ],
  },
  {
    key: "albania:naim_frasheri",
    originalSha256:
      "3d6927567079d32257cee2438403075eef1b38880c6c9628f1460704dbc9318d",
    originalTextRu:
      "Величайший албанский поэт эпохи национального возрождения.",
    reviewedTextRu:
      "Албанский национальный поэт эпохи Возрождения, один из основоположников современной албанской литературы.",
    claimEvidence: [
      claim(
        "identity-role",
        "Наим Фрашери - поэт албанского национального Возрождения.",
        "confirmed",
        [albanianAcademyNaim, albanianAcademyNaimOctober]
      ),
      claim(
        "national-cultural-affiliation",
        "Он является национальным поэтом Албании.",
        "confirmed",
        [albanianAcademyNaim, albanianAcademyNaimOctober]
      ),
      claim(
        "critical-ranking",
        "Он относится к основоположникам современной албанской литературы.",
        "corrected",
        [albanianAcademyNaim]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Абсолютный суперлатив заменён точными институциональными определениями: национальный поэт и один из основоположников современной албанской литературы.",
    ],
  },
  {
    key: "algeria:assia_djebar",
    originalSha256:
      "3565baa2fcbb08c29a954a1515aa14d819879da18ffae9b22f0a00dc90b91bf0",
    originalTextRu:
      "Алжирская писательница, историк и режиссёр, одна из самых известных франкоязычных авторов XX века.",
    reviewedTextRu:
      "Алжирская писательница и режиссёр, писавшая по-французски; она изучала и преподавала историю Магриба.",
    claimEvidence: [
      claim(
        "identity-role",
        "Ассия Джебар - писательница и режиссёр; историю она изучала и преподавала.",
        "corrected",
        [academieDjebar, bnfDjebar]
      ),
      claim(
        "language",
        "Её литературные произведения написаны по-французски.",
        "confirmed",
        [bnfDjebar, academieDjebar]
      ),
      claim(
        "national-cultural-affiliation",
        "Она - алжирская писательница.",
        "confirmed",
        [bnfDjebar, academieDjebar]
      ),
      claim(
        "critical-ranking",
        "Её международный статус подтверждают избрание во Французскую академию и переводы произведений на 23 языка.",
        "corrected",
        [academieDjebar]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Профессиональное обозначение «историк» заменено проверяемой формулировкой об историческом образовании и преподавании; расплывчатый рейтинг удалён.",
    ],
  },
  {
    key: "algeria:kateb_yacine",
    originalSha256:
      "119f961f8339b10765f6430db26b20b86df8f7b588e4b596556baf2afd767f74",
    originalTextRu:
      "Алжирский писатель и драматург, один из крупнейших представителей франкоязычной литературы Магриба.",
    reviewedTextRu:
      "Алжирский писатель и драматург, значительная часть литературного наследия которого написана по-французски.",
    claimEvidence: [
      claim(
        "identity-role",
        "Катеб Ясин - писатель и драматург.",
        "confirmed",
        [imaKateb]
      ),
      claim(
        "national-cultural-affiliation",
        "Он является крупной фигурой литературы Алжира.",
        "confirmed",
        [imaKateb]
      ),
      claim(
        "language",
        "Значительная часть его литературного наследия написана по-французски.",
        "confirmed",
        [bnfKateb, imaKateb]
      ),
      claim(
        "critical-ranking",
        "Институциональный источник характеризует его как крупную фигуру алжирской словесности.",
        "corrected",
        [imaKateb]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Региональный суперлатив удалён; сохранены подтверждённые роль, национальная связь и язык значительной части наследия.",
    ],
  },
  {
    key: "algeria:mohammed_dib",
    originalSha256:
      "c89fecc68fea1cb5735bd383386de4028c0ddb0338c0c6b8d44e76badb5a6450",
    originalTextRu:
      "Один из основателей современной алжирской литературы, автор романов о жизни Алжира периода колониализма.",
    reviewedTextRu:
      "Алжирский писатель, писавший по-французски; его «алжирская трилогия» посвящена жизни страны в колониальный период.",
    claimEvidence: [
      claim(
        "identity-role",
        "Мохаммед Диб - алжирский писатель.",
        "confirmed",
        [bnfDib, bnfDibArchive]
      ),
      claim(
        "national-cultural-affiliation",
        "Он относится к франкоязычной литературе Алжира.",
        "confirmed",
        [bnfDib]
      ),
      claim(
        "priority-claim",
        "Он является ключевой фигурой, но утверждение об «основателе» не было найдено в выбранных авторитетных источниках.",
        "corrected",
        [bnfDib, bnfDibArchive]
      ),
      claim(
        "works",
        "Его алжирская трилогия изображает Алжир 1950-х годов и нищету колониального периода.",
        "confirmed",
        [academieDib, bnfDibArchive]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Неподтверждённое слово «основатель» и оценочная замена удалены; язык и содержание трилогии подтверждены BnF и Французской академией.",
    ],
  },
  {
    key: "algeria:moufdi_zakaria",
    originalSha256:
      "bdd962eced62dfcc08261fe3af49c45b096f578bc2d55d313282ec20499b8363",
    originalTextRu:
      "Алжирский поэт, один из крупнейших представителей арабоязычной литературы Алжира, автор текста государственного гимна страны.",
    reviewedTextRu:
      "Алжирский арабоязычный поэт, известный как поэт Алжирской революции. Автор текста государственного гимна «Кассаман».",
    claimEvidence: [
      claim(
        "identity-role",
        "Муфди Закария - алжирский поэт.",
        "confirmed",
        [radioMoufdi]
      ),
      claim(
        "language",
        "Он писал стихи на арабском языке.",
        "confirmed",
        [radioMoufdi, bnfMoufdi]
      ),
      claim(
        "national-cultural-affiliation",
        "Его наследие принадлежит литературе Алжира.",
        "confirmed",
        [radioMoufdi, bnfMoufdi]
      ),
      claim(
        "critical-ranking",
        "Он известен как поэт Алжирской революции.",
        "corrected",
        [radioMoufdi]
      ),
      claim(
        "works",
        "Он написал текст государственного гимна «Кассаман».",
        "confirmed",
        [radioMoufdi]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Общий суперлатив заменён официально употребляемой и предметной характеристикой «поэт Революции»; название гимна добавлено по APS.",
    ],
  },
  {
    key: "algeria:mouloud_feraoun",
    originalSha256:
      "d4a761c0afbce22547d4137005c66133fb7f28f0787f98513faadfc4dc92c1e8",
    originalTextRu:
      "Алжирский писатель кабильского происхождения, один из крупнейших авторов франкоязычной литературы Алжира.",
    reviewedTextRu:
      "Алжирский писатель кабильского происхождения, писавший по-французски.",
    claimEvidence: [
      claim(
        "identity-role",
        "Мулуд Фераун - алжирский писатель.",
        "confirmed",
        [imaFeraoun, bnfFeraoun]
      ),
      claim(
        "national-cultural-affiliation",
        "Он родился в Кабилии и сохранял связь с кабильскими корнями.",
        "confirmed",
        [imaFeraoun]
      ),
      claim(
        "language",
        "Он писал по-французски.",
        "confirmed",
        [bnfFeraoun, imaFeraoun]
      ),
      claim(
        "critical-ranking",
        "Оценочный рейтинг удалён; происхождение, роль и язык автора подтверждены институциональными источниками.",
        "corrected",
        [imaFeraoun]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективное выражение «один из крупнейших» удалено; сохранены проверяемые происхождение, роль и язык.",
    ],
  },
  {
    key: "algeria:rachid_boudjedra",
    originalSha256:
      "6485117ac6f24a65f13e757184582154a0ec6edcae47a9505df822efccb891cc",
    originalTextRu:
      "Современный алжирский писатель и один из наиболее известных авторов франкоязычной прозы.",
    reviewedTextRu:
      "Современный алжирский писатель и романист, писавший по-французски.",
    claimEvidence: [
      claim(
        "identity-role",
        "Рашид Буджедра - алжирский писатель и романист.",
        "confirmed",
        [bnfBoudjedra, radioBoudjedra]
      ),
      claim(
        "national-cultural-affiliation",
        "Его творчество относится к литературе Алжира.",
        "confirmed",
        [bnfBoudjedra, imaBoudjedra]
      ),
      claim(
        "language",
        "Он писал по-французски.",
        "confirmed",
        [bnfBoudjedra, imaBoudjedra]
      ),
      claim(
        "critical-ranking",
        "Оценка известности заменена проверяемыми сведениями о роли и языке автора.",
        "corrected",
        [imaBoudjedra, radioBoudjedra]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективная оценка известности удалена; роль и язык подтверждены независимыми институциональными источниками.",
    ],
  },
  {
    key: "andorra:antoni_morell_i_mora",
    originalSha256:
      "789857c81cfb0efdb000ea21dab5fadd62d65c4b08f1f2823e9acdab93decf05",
    originalTextRu:
      "Андоррский писатель, один из наиболее известных представителей литературы страны.",
    reviewedTextRu:
      "Андоррский писатель и гуманист, чьё творчество сосредоточено на Андорре и её жителях.",
    claimEvidence: [
      claim(
        "identity-role",
        "Антони Морель-и-Мора - андоррский писатель и гуманист.",
        "corrected",
        [andorraMorell]
      ),
      claim(
        "critical-ranking",
        "Правительственная публикация относит его к важнейшим интеллектуалам страны, но исходное «один из наиболее известных» заменено предметным описанием.",
        "corrected",
        [andorraMorell]
      ),
      claim(
        "themes-style",
        "Его романы, эссе, исторические и журналистские тексты размышляют об Андорре и её жителях.",
        "confirmed",
        [andorraMorell]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Расплывчатая известность заменена содержательной характеристикой из официального правительственного издания.",
    ],
  },
  {
    key: "angola:agostinho_neto",
    originalSha256:
      "52a9e0993288e95d4813a8bdce553f3fb94f01471df99f9ba87e9593cd3870dd",
    originalTextRu:
      "Ангольский поэт, общественный деятель и первый президент независимой Анголы.",
    reviewedTextRu:
      "Ангольский поэт, общественный деятель и первый президент независимой Анголы.",
    claimEvidence: [
      claim(
        "identity-role",
        "Агостиньо Нето - ангольский поэт и общественный деятель.",
        "confirmed",
        [angolaNeto, angolaNetoCentenary]
      ),
      claim(
        "priority-claim",
        "Он был первым президентом Республики Ангола после провозглашения независимости.",
        "confirmed",
        [angolaNeto, angolaNetoCentenary]
      ),
    ],
    reviewer,
    decision: "unchanged",
    notes: [
      "Обе части биографии прямо подтверждены официальными публикациями правительства Анголы.",
    ],
  },
  {
    key: "angola:jose_luandino_vieira",
    originalSha256:
      "bae1a7088104357cad14649243d4eeb90137fa84be7a62983ccac4a62c400fda",
    originalTextRu:
      "Один из крупнейших ангольских писателей XX века, автор прозы о колониальном периоде.",
    reviewedTextRu:
      "Ангольский писатель, автор прозы о жизни при колониальном режиме и антиколониальном опыте.",
    claimEvidence: [
      claim(
        "identity-role",
        "Жозе Луандину Виейра - ангольский писатель.",
        "confirmed",
        [ucclaLuandino, angolaLiteraryPatrimony]
      ),
      claim(
        "critical-ranking",
        "Оценочный суперлатив заменён проверяемым описанием тематики прозы.",
        "corrected",
        [ucclaLuandino]
      ),
      claim(
        "works",
        "Его проза изображает жизнь при колониальном режиме и антиколониальный опыт.",
        "confirmed",
        [angolaLuandino]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективное выражение «один из крупнейших» удалено; национальная связь и тематика прозы сохранены по институциональным источникам.",
    ],
  },
  {
    key: "angola:ondjaki",
    originalSha256:
      "ae1e208a49036f871714eed8b40148a01d6c324554f761a063a85124b684f5a5",
    originalTextRu:
      "Современный ангольский писатель, один из наиболее известных авторов португалоязычной Африки.",
    reviewedTextRu:
      "Современный ангольский писатель, лауреат премии Жозе Сарамаго за роман «Прозрачные».",
    claimEvidence: [
      claim(
        "identity-role",
        "Онджаки - современный ангольский писатель.",
        "confirmed",
        [ucclaOndjaki, angolaLiteraryPatrimony]
      ),
      claim(
        "language",
        "Он публикует произведения на португальском языке.",
        "confirmed",
        [ucclaOndjaki]
      ),
      claim(
        "critical-ranking",
        "Широкий региональный рейтинг заменён проверяемым литературным достижением.",
        "corrected",
        [ucclaOndjaki, angolaLiteraryPatrimony]
      ),
      claim(
        "awards",
        "Роман «Прозрачные» получил премию Жозе Сарамаго 2013 года.",
        "confirmed",
        [ucclaOndjaki]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Неформализуемый рейтинг по всей португалоязычной Африке заменён точным фактом о премии и произведении.",
    ],
  },
  {
    key: "angola:pepetela",
    originalSha256:
      "f95c3f3336c3466f706aa255acf42ff62bdcb4d06dd9d0495fa3f1a066843e74",
    originalTextRu:
      "Крупнейший ангольский романист, один из главных представителей португалоязычной африканской литературы.",
    reviewedTextRu:
      "Ангольский романист, лауреат премии Камоэнса. Среди его произведений - «Майомбе» и «Поколение утопии».",
    claimEvidence: [
      claim(
        "identity-role",
        "Пепетела - ангольский романист.",
        "confirmed",
        [angolaLiteraryPatrimony, angolaPepetelaWorks]
      ),
      claim(
        "language",
        "Он относится к португалоязычной литературе Анголы.",
        "confirmed",
        [ucclaCamoes, angolaPepetelaWorks]
      ),
      claim(
        "critical-ranking",
        "Общий суперлатив заменён документированными достижениями и произведениями.",
        "corrected",
        [angolaLiteraryPatrimony, ucclaCamoes]
      ),
      claim(
        "awards",
        "Пепетела получил премию Камоэнса 1997 года.",
        "confirmed",
        [ucclaCamoes]
      ),
      claim(
        "works",
        "«Майомбе» и «Поколение утопии» входят в библиографию Пепетелы.",
        "confirmed",
        [angolaPepetelaWorks]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективный рейтинг заменён устойчивой короткой биографией с официально подтверждённой премией и двумя произведениями.",
    ],
  },
  {
    key: "antigua_and_barbuda:jamaica_kincaid",
    originalSha256:
      "2d77da0de507bf6ab706ed98a30d889db31e4e52c6e746c7fd955277a35e6b60",
    originalTextRu:
      "Антигуанская писательница и эссеистка, одна из наиболее известных представительниц современной англоязычной литературы Карибского региона. В её произведениях исследуются темы колониального наследия, семьи, памяти и личной идентичности.",
    reviewedTextRu:
      "Антигуанская писательница и эссеистка, представительница англоязычной карибской литературы. В её произведениях исследуются темы колониального наследия, семьи, памяти и личной идентичности.",
    claimEvidence: [
      claim(
        "identity-role",
        "Джамайка Кинкейд - писательница и эссеистка.",
        "confirmed",
        [harvardKincaid, nbfKincaid]
      ),
      claim(
        "national-cultural-affiliation",
        "Она родилась на Антигуа и связана с карибской литературой.",
        "confirmed",
        [harvardKincaid, nbfKincaid]
      ),
      claim(
        "language",
        "Она является англоязычной писательницей.",
        "confirmed",
        [harvardKincaid, nbfKincaid]
      ),
      claim(
        "critical-ranking",
        "Оценка известности удалена; литературная роль и тематический круг сохранены.",
        "corrected",
        [harvardKincaid]
      ),
      claim(
        "themes-style",
        "В её произведениях представлены колониализм, идентичность и семейные отношения.",
        "confirmed",
        [harvardGazetteKincaid]
      ),
      claim(
        "works",
        "Её библиография включает художественную прозу и эссе.",
        "confirmed",
        [harvardGazetteKincaid, nbfKincaid]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективная оценка известности удалена; происхождение, язык, литературная роль и темы подтверждены двумя независимыми источниками.",
    ],
  },
  {
    key: "argentina:adolfo_bioy_casares",
    originalSha256:
      "10f6e62067a6a79e4a13dbba2cbef4eb3438468ad4aff4fc7fa08454dded6491",
    originalTextRu:
      "Аргентинский писатель, один из крупнейших мастеров фантастической литературы XX века. Близкий друг и литературный соратник Хорхе Луиса Борхеса.",
    reviewedTextRu:
      "Аргентинский писатель, автор рассказов и фантастической прозы. Близкий друг и литературный соратник Хорхе Луиса Борхеса.",
    claimEvidence: [
      claim(
        "identity-role",
        "Адольфо Биой Касарес - аргентинский писатель.",
        "confirmed",
        [cervantesBioy]
      ),
      claim(
        "national-cultural-affiliation",
        "Он принадлежит аргентинской литературе.",
        "confirmed",
        [cervantesBioy, argentinaBioy]
      ),
      claim(
        "critical-ranking",
        "Оценочный суперлатив заменён проверяемым описанием жанров его прозы.",
        "corrected",
        [cervantesBioy]
      ),
      claim(
        "reception-influence",
        "Его связывала с Борхесом пожизненная личная и литературная дружба, включавшая совместные книги.",
        "confirmed",
        [cervantesBioy, argentinaBioy]
      ),
    ],
    reviewer,
    decision: "corrected",
    notes: [
      "Субъективное выражение «один из крупнейших мастеров» удалено; жанровая характеристика и отношения с Борхесом подтверждены государственными культурными источниками.",
    ],
  },
] as const satisfies readonly WriterBiographyFactReviewRecord[];

function normalizedVerdict(
  finding: WriterBiographyClaimFinding
): "supported" | "corrected" | "not-established" {
  if (finding === "confirmed") return "supported";
  if (finding === "corrected") return "corrected";
  return "not-established";
}

function normalizedFindingRu(
  claimRu: string,
  finding: WriterBiographyClaimFinding
) {
  if (finding === "confirmed") {
    return `Источник подтверждает утверждение: ${claimRu}`;
  }
  if (finding === "corrected") {
    return `Источник обосновывает уточнённую формулировку: ${claimRu}`;
  }
  return `Источник не позволил установить утверждение: ${claimRu}`;
}

/**
 * Normalized read-only adapter. It is intentionally not connected to runtime.
 */
export const writerBiographyFactReviewBatch01Normalized =
  writerBiographyFactReviewBatch01.map(
    (record): NormalizedWriterBiographyFactReviewRecord => ({
      key: record.key,
      originalSha256: record.originalSha256,
      reviewedTextRu: record.reviewedTextRu,
      // Batch 01 has no held records; keep the normalized field explicit so
      // TypeScript does not widen the frozen decision literals artificially.
      applicableTextRu: record.reviewedTextRu,
      claims: record.claimEvidence.map((item) => ({
        textRu: item.claimRu,
        verdict: normalizedVerdict(item.finding),
        evidence: item.sources.map((evidence) => ({
          provider: evidence.provider,
          url: evidence.url,
          checkedAt: evidence.checkedAt,
          findingRu: normalizedFindingRu(item.claimRu, item.finding),
        })),
      })),
      reviewer: record.reviewer,
      decision: record.decision,
      notes: record.notes.join(" "),
    })
  );

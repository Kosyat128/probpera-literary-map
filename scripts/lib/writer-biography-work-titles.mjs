/**
 * Extracts only titles that the Russian biography explicitly identifies as a
 * literary work. Bare guillemets are intentionally insufficient: awards,
 * organisations, festivals and movements may also be quoted in prose.
 */
export const WORK_TITLE_PATTERN =
  /(?:(?<!из\s)(?:роман|повест|рассказ|поэм|пьес|книг|сборник|произведен|цикл|комед|трагед|новелл|эссе|сказк|эпос|драм|сонет|стихотворен|мемуар)\p{L}*|автор(?:ка)?|написал(?:а|и)?|создал(?:а|и)?|опубликовал(?:а|и)?)\s*(?:[-\u2013\u2014:]\s*)?«([^\u00bb\r\n]{2,120})»/giu;

const WORK_TITLE_CONTINUATION_PATTERN =
  /^\s*(?:(?:,\s*)|(?:и\s+)|(?:а\s+также\s+))«([^\u00bb\r\n]{2,120})»/iu;

/**
 * Narrow translation/inflection aliases for reviewed work titles. Every
 * entry is tied to one writer, one emitted Russian title and one exact
 * evidence record. `evidenceTitle` must occur literally in the selected
 * supported/corrected claim or its selected evidence finding.
 */
export const curatedWorkTitleEvidenceAliases = Object.freeze(
  [
    {
      key: "bangladesh:jibanananda_das",
      russianTitle: "Баналата Сен",
      evidenceTitle: "Banalata Sen",
      evidenceUrl: "https://en.banglapedia.org/index.php?title=Das%2C_Jibanananda",
      checkedAt: "2026-08-09",
    },
    {
      key: "bangladesh:tahmima_anam",
      russianTitle: "Золотой век",
      evidenceTitle: "A Golden Age",
      evidenceUrl: "https://canongate.co.uk/books/1273-a-golden-age/",
      checkedAt: "2026-08-09",
    },
    {
      key: "bolivia:nataniel_aguirre",
      russianTitle: "Juan de la Rosa: memorias del último soldado de la Independencia",
      evidenceTitle: "Juan de la Rosa",
      evidenceUrl: "https://www.cervantesvirtual.com/obras/autor/aguirre-nataniel-1843-1888-2794/",
      checkedAt: "2026-08-09",
    },
    {
      key: "brazil:manoel_de_barros",
      russianTitle: "Хранитель вод",
      evidenceTitle: "O guardador das águas",
      evidenceUrl: "https://www.bpp.pr.gov.br/Candido/Pagina/Retrato-de-Um-Artista-Manoel-de-Barros",
      checkedAt: "2026-08-09",
    },
    {
      key: "cambodia:kram_ngoy",
      russianTitle: "Венок новых наставлений",
      evidenceTitle: "A Garland of New Advice",
      evidenceUrl: "https://www.degruyterbrill.com/document/doi/10.1515/9780824896843-004/pdf?licenseType=free",
      checkedAt: "2026-08-09",
    },
    {
      key: "cambodia:nou_hach",
      russianTitle: "Увядший цветок",
      evidenceTitle: "Phka Srapoun",
      evidenceUrl: "https://library.khmerstudies.org/bib/8993",
      checkedAt: "2026-08-09",
    },
    {
      key: "cambodia:soth_polin",
      russianTitle: "Бессмысленная жизнь",
      evidenceTitle: "A Meaningless Life",
      evidenceUrl: "https://wordswithoutborders.org/contributors/view/soth-polin/",
      checkedAt: "2026-08-09",
    },
    {
      key: "cameroon:ferdinand_oyono",
      russianTitle: "Une vie de boy",
      evidenceTitle: "Une vie de boy",
      evidenceUrl: "https://data.bnf.fr/en/see_all_activities/12170141/page1",
      checkedAt: "2026-08-09",
    },
    {
      key: "china:ai_qing",
      russianTitle: "К солнцу",
      evidenceTitle: "向太阳",
      evidenceUrl: "https://www.chinawriter.com.cn/fwzj/wxds/8.shtml",
      checkedAt: "2026-08-09",
    },
    {
      key: "dominican_republic:junot_diaz",
      russianTitle: "Короткая фантастическая жизнь Оскара Вау",
      evidenceTitle: "The Brief Wondrous Life of Oscar Wao",
      evidenceUrl: "https://www.pulitzer.org/winners/junot-diaz",
      checkedAt: "2026-08-09",
    },
    {
      key: "ecuador:arturo_borja",
      russianTitle: "Ониксовая флейта",
      evidenceTitle: "La flauta de ónix",
      evidenceUrl: "https://casadelacultura.gob.ec/wp-content/uploads/2020/11/casapalabras42.pdf",
      checkedAt: "2026-08-09",
    },
    {
      key: "ecuador:eliecer_cardenas",
      russianTitle: "Прах и пепел",
      evidenceTitle: "Polvo y ceniza",
      evidenceUrl: "https://casadelacultura.gob.ec/2025.php/postpublicaciones/trilogia-bandolera/",
      checkedAt: "2026-08-09",
    },
    {
      key: "ecuador:pablo_palacio",
      russianTitle: "Человек, убитый пинками",
      evidenceTitle: "Un hombre muerto a puntapiés",
      evidenceUrl: "https://www.uasb.edu.ec/alicia-ortega-participa-en-edicion-de-cuentos-de-pablo-palacio/",
      checkedAt: "2026-08-09",
    },
    {
      key: "egypt:salah_abdel_sabour",
      russianTitle: "Люди моей страны",
      evidenceTitle: "People in My Country",
      evidenceUrl: "https://www.bibalex.org/libraries/Presentation/Static/Abdelsabur_eng_1105_ed2.pdf",
      checkedAt: "2026-08-09",
    },
    {
      key: "el_salvador:roque_dalton",
      russianTitle: "Таверна и другие места",
      evidenceTitle: "Taberna y otros lugares",
      evidenceUrl: "https://eluniversitario.ues.edu.sv/escritores-salvadorenos-roque-dalton/",
      checkedAt: "2026-08-09",
    },
    {
      key: "england:john_galsworthy",
      russianTitle: "Серебряная коробка",
      evidenceTitle: "Серебряную коробку",
      evidenceUrl: "https://www.npg.org.uk/collections/search/person/mp01713/john-galsworthy",
      checkedAt: "2026-08-09",
    },
    {
      key: "england:john_le_carre",
      russianTitle: "Шпион, пришедший с холода",
      evidenceTitle: "The Spy Who Came in from the Cold",
      evidenceUrl: "https://johnlecarre.com/biography/",
      checkedAt: "2026-08-09",
    },
    {
      key: "estonia:eduard_vilde",
      russianTitle: "Молочник из Мяэкюла",
      evidenceTitle: "Mäeküla piimamees",
      evidenceUrl: "https://ewod.ut.ee/v/eduardvilde/",
      checkedAt: "2026-08-09",
    },
    {
      key: "estonia:friedebert_tuglas",
      russianTitle: "Феликс Ормуссон",
      evidenceTitle: "Felix Ormusson",
      evidenceUrl: "https://ewod.ut.ee/t/friedeberttuglas/",
      checkedAt: "2026-08-09",
    },
  ].map((alias) => Object.freeze(alias))
);

const curatedAliasIdentities = new Set();
for (const alias of curatedWorkTitleEvidenceAliases) {
  const identity = `${alias.key}\u0000${alias.russianTitle}`;
  if (curatedAliasIdentities.has(identity)) {
    throw new Error(`Duplicate curated work-title alias: ${alias.key}:${alias.russianTitle}`);
  }
  if (
    !alias.key ||
    !alias.russianTitle ||
    !alias.evidenceTitle ||
    !/^https:\/\//u.test(alias.evidenceUrl) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(alias.checkedAt)
  ) {
    throw new Error(`Invalid curated work-title alias: ${alias.key}:${alias.russianTitle}`);
  }
  curatedAliasIdentities.add(identity);
}

export function extractExplicitWorkTitles(value) {
  const source = String(value || "");
  const titles = new Set();
  for (const match of source.matchAll(WORK_TITLE_PATTERN)) {
    const firstTitle = match[1].replace(/\s+/gu, " ").trim();
    if (firstTitle) titles.add(firstTitle);
    let cursor = (match.index || 0) + match[0].length;
    while (cursor < source.length) {
      const continuation = source.slice(cursor).match(WORK_TITLE_CONTINUATION_PATTERN);
      if (!continuation) break;
      const title = continuation[1].replace(/\s+/gu, " ").trim();
      if (title) titles.add(title);
      cursor += continuation[0].length;
    }
  }
  return [...titles].sort((left, right) => left.localeCompare(right, "ru"));
}

export function normalizeWorkEvidenceText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function russianWorkTitleStem(value) {
  return normalizeWorkEvidenceText(value)
    .split(" ")
    .map((token) => {
      if (!/^[а-я]+$/u.test(token) || token.length < 5) return token;
      const adjectiveStem = token.replace(
        /(?:ского|скому|скими|ский|скии|ская|ское|ские|ской|скои|ским|скую)$/u,
        ""
      );
      const nounStem = adjectiveStem.replace(
        /(?:иями|ами|ями|ого|ому|ыми|ими|иях|ах|ях|ью|ою|ею|ов|ев|ом|ем|ой|ей|а|я|у|ю|ы|и|е)$/u,
        ""
      );
      const stem = nounStem.replace(/[ьъ]$/u, "");
      return stem.length >= 4 ? stem : token;
    })
    .join(" ");
}

function workTitleVariants(value) {
  const source = String(value || "").replace(/\s+/gu, " ").trim();
  if (!source) return [];
  const candidates = [source];
  const outsideParentheses = source.replace(/\([^()]*\)/gu, " ").trim();
  if (outsideParentheses) candidates.push(outsideParentheses);
  for (const match of source.matchAll(/\(([^()]{2,160})\)/gu)) {
    candidates.push(match[1]);
  }
  const subtitlePrefix = source
    .split(/\s*(?:[:;]|[.!?](?=\s)|,\s*или(?=\s|$)|[«“"]|\s+[\u2014\u2013-]\s+)\s*/iu, 1)[0]
    ?.trim();
  if (subtitlePrefix) candidates.push(subtitlePrefix);

  const variants = new Set();
  for (const candidate of candidates) {
    const normalized = normalizeWorkEvidenceText(candidate);
    if (!normalized) continue;
    variants.add(normalized);
    variants.add(russianWorkTitleStem(normalized));
  }
  return [...variants];
}

/**
 * Treats inflected Russian forms, an explicit subtitle and a parenthesized
 * original/translation as the same already-structured work. The matcher is
 * deliberately conservative: unseparated prefix matching requires at least
 * four complete words, so short titles do not absorb unrelated works.
 */
export function equivalentWorkTitle(left, right) {
  const leftVariants = workTitleVariants(left);
  const rightVariants = workTitleVariants(right);
  const rightSet = new Set(rightVariants);
  if (leftVariants.some((variant) => rightSet.has(variant))) return true;

  const leftFull = normalizeWorkEvidenceText(left);
  const rightFull = normalizeWorkEvidenceText(right);
  const [shorter, longer] =
    leftFull.length <= rightFull.length
      ? [leftFull, rightFull]
      : [rightFull, leftFull];
  return Boolean(
    shorter.split(" ").filter(Boolean).length >= 4 &&
      ` ${longer} `.startsWith(` ${shorter} `)
  );
}

function containsNormalizedTitle(value, title) {
  const source = normalizeWorkEvidenceText(value);
  const expected = normalizeWorkEvidenceText(title);
  return Boolean(
    source &&
      expected &&
      ` ${source} `.includes(` ${expected} `)
  );
}

/**
 * Requires the same supported/corrected claim to contain both the normalized
 * title mention and at least one evidence record. This deliberately prevents
 * an unrelated evidenced claim from authorising a title found elsewhere.
 */
export function claimSupportsExplicitWorkTitle(claim, title) {
  if (
    !claim ||
    !new Set(["supported", "corrected"]).has(claim.verdict) ||
    !Array.isArray(claim.evidence) ||
    claim.evidence.length === 0
  ) {
    return false;
  }
  return [
    claim.textRu,
    claim.claimRu,
    ...claim.evidence.flatMap((evidence) => [
      evidence?.findingRu,
      evidence?.finding,
    ]),
  ].some((value) => containsNormalizedTitle(value, title));
}

function literalTitleInSelectedClaimEvidence(claim, alias) {
  if (
    !claim ||
    !new Set(["supported", "corrected"]).has(claim.verdict) ||
    !Array.isArray(claim.evidence)
  ) {
    return false;
  }
  const evidence = claim.evidence.find(
    (item) =>
      item?.url === alias.evidenceUrl && item?.checkedAt === alias.checkedAt
  );
  if (!evidence) return false;
  return [
    claim.textRu,
    claim.claimRu,
    evidence.findingRu,
    evidence.finding,
  ].some((value) => String(value || "").includes(alias.evidenceTitle));
}

export function curatedAliasSupportsExplicitWorkTitle(record, title, alias) {
  return Boolean(
    record?.key === alias?.key &&
      title === alias?.russianTitle &&
      Array.isArray(record?.claims) &&
      record.claims.some((claim) =>
        literalTitleInSelectedClaimEvidence(claim, alias)
      )
  );
}

export function resolveCuratedWorkTitleEvidenceAlias(
  record,
  title,
  aliases = curatedWorkTitleEvidenceAliases
) {
  const candidates = aliases.filter(
    (alias) => alias.key === record?.key && alias.russianTitle === title
  );
  if (candidates.length > 1) {
    throw new Error(`Ambiguous curated work-title alias: ${record.key}:${title}`);
  }
  const alias = candidates[0];
  return alias && curatedAliasSupportsExplicitWorkTitle(record, title, alias)
    ? alias
    : null;
}

export function invalidCuratedWorkTitleEvidenceAliases(
  records,
  aliases = curatedWorkTitleEvidenceAliases
) {
  const recordsByKey = new Map(records.map((record) => [record.key, record]));
  return aliases.filter(
    (alias) =>
      !curatedAliasSupportsExplicitWorkTitle(
        recordsByKey.get(alias.key),
        alias.russianTitle,
        alias
      )
  );
}

export function reviewSupportedWorkTitles(
  record,
  titles,
  aliases = curatedWorkTitleEvidenceAliases
) {
  const supported = [];
  const unsupported = [];
  const curatedEvidenceAliases = [];
  for (const title of titles) {
    const directSupport =
      Array.isArray(record?.claims) &&
      record.claims.some((claim) =>
        claimSupportsExplicitWorkTitle(claim, title)
      );
    const curatedAlias = resolveCuratedWorkTitleEvidenceAlias(
      record,
      title,
      aliases
    );
    if (directSupport || curatedAlias) {
      supported.push(title);
      if (curatedAlias) curatedEvidenceAliases.push(curatedAlias);
    } else {
      unsupported.push(title);
    }
  }
  return { supported, unsupported, curatedEvidenceAliases };
}

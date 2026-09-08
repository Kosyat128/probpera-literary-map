export type LiterarySearchValue = string | null | undefined;

const searchStopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "а",
  "без",
  "в",
  "для",
  "и",
  "из",
  "к",
  "на",
  "о",
  "об",
  "от",
  "по",
  "с",
  "со",
]);

const cyrillicToLatin: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "i",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ў: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function normalizeLiterarySearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function transliterateToken(token: string) {
  const transliterated = [...token]
    .map((letter) => cyrillicToLatin[letter] ?? letter)
    .join("")
    .replace(/iy$/u, "y")
    .replace(/ii$/u, "y");
  return normalizeLiterarySearch(transliterated).replace(/\s+/gu, "");
}

function stemRussianToken(token: string) {
  if (token.length < 5 || !/\p{Script=Cyrillic}/u.test(token)) return token;
  return token.replace(
    /(ателями|ителей|ателей|ениями|иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ей|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
    ""
  );
}

function stemEnglishToken(token: string) {
  if (token.length < 5 || !/^[a-z]+$/u.test(token)) return token;
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 7 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 6 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 6 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function stemToken(token: string) {
  return stemEnglishToken(stemRussianToken(token));
}

function rawSearchTokens(value: string) {
  const tokens = normalizeLiterarySearch(value).split(" ").filter(Boolean);
  if (tokens.length <= 1) return tokens;
  return tokens.filter((token) => !searchStopWords.has(token));
}

export function literarySearchTokens(value: string) {
  return rawSearchTokens(value)
    .map(stemToken)
    .filter((token) => token.length >= 2);
}

function tokenAliases(token: string) {
  const normalized = stemToken(token);
  const transliterated = stemToken(transliterateToken(token));
  return [...new Set([normalized, transliterated])].filter(
    (candidate) => candidate.length >= 2
  );
}

function editDistanceAtMostOne(first: string, second: string) {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1) return false;
  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  let shortIndex = 0;
  let longIndex = 0;
  let edits = 0;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) shortIndex += 1;
    longIndex += 1;
  }
  return true;
}

function tokensMatch(queryToken: string, valueToken: string) {
  if (queryToken === valueToken) return true;
  if (queryToken.length >= 4 && valueToken.startsWith(queryToken)) return true;
  return (
    queryToken.length >= 7 &&
    valueToken.length >= 7 &&
    editDistanceAtMostOne(queryToken, valueToken)
  );
}

export function literarySearchMatches(
  query: string,
  values: LiterarySearchValue[]
) {
  const queryGroups = rawSearchTokens(query)
    .map(tokenAliases)
    .filter((aliases) => aliases.length > 0);
  const valueTokens = values
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap(rawSearchTokens)
    .flatMap(tokenAliases);
  if (!queryGroups.length || !valueTokens.length) return false;
  return queryGroups.every((aliases) =>
    aliases.some((queryToken) =>
      valueTokens.some((valueToken) => tokensMatch(queryToken, valueToken))
    )
  );
}

function normalizedVariants(value: string) {
  const normalized = normalizeLiterarySearch(value);
  const transliterated = rawSearchTokens(value)
    .map(transliterateToken)
    .join(" ");
  return [...new Set([normalized, transliterated])].filter(Boolean);
}

export function literarySearchMatchScore(
  query: string,
  primaryValues: LiterarySearchValue[],
  secondaryValues: LiterarySearchValue[] = []
) {
  if (!literarySearchMatches(query, [...primaryValues, ...secondaryValues])) {
    return null;
  }
  const queryVariants = normalizedVariants(query);
  const primary = primaryValues
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap(normalizedVariants);
  const secondary = secondaryValues
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap(normalizedVariants);
  if (primary.some((value) => queryVariants.includes(value))) return 0;
  if (
    primary.some((value) =>
      queryVariants.some((queryValue) =>
        queryValue.length >= 3 ? value.startsWith(queryValue) : false
      )
    )
  ) {
    return 1;
  }
  if (literarySearchMatches(query, primaryValues)) return 2;
  if (secondary.some((value) => queryVariants.includes(value))) return 3;
  if (literarySearchMatches(query, secondaryValues)) return 4;
  return 5;
}

export function literarySearchScore(label: string, query: string) {
  return literarySearchMatchScore(query, [label]) ?? 6;
}

import {
  bookArchiveKey,
  isCoverArtworkDisplayAllowed,
  isCoverDisplayAllowed,
  isEditorialCover,
} from "../data/bookArchive";
import {
  presentBookArchiveQueueItem,
  type BookArchiveQueueItem,
  type BookArchiveQueueStatus,
} from "../data/bookArchiveQueue";
import {
  selectBookAuthorByline,
  selectBookAuthorNames,
  selectBookAuthorRefs,
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  type BookAuthorReference,
} from "../data/bookLocalization";
import type {
  BookArticleMentionKind,
  BookMentionIndex,
} from "../data/articles/bookMentions";
import type { WorkLocale } from "../data/countries/types";
import { normalizeLiterarySearch } from "../utils/literarySearch";

export const BOOK_ARCHIVE_QUICK_PRESETS = [
  "all",
  "verified",
  "children",
  "classic",
  "modern",
  "with-cover",
  "saved",
  "custom",
] as const;

export type BookArchiveQuickPreset =
  (typeof BOOK_ARCHIVE_QUICK_PRESETS)[number];

export const BOOK_ARCHIVE_PERIODS = [
  "pre-1800",
  "xix",
  "1900-1945",
  "1946-1999",
  "xxi",
  "unknown",
] as const;

export type BookArchivePeriod = (typeof BOOK_ARCHIVE_PERIODS)[number];

export const BOOK_ARCHIVE_AUDIENCES = [
  "children",
  "young-adult",
  "adult",
  "all-ages",
] as const;

export type WorkAudienceCategory =
  (typeof BOOK_ARCHIVE_AUDIENCES)[number];

export type WorkAudienceProfile = Readonly<{
  categories: readonly WorkAudienceCategory[];
  ageMin?: number;
  ageMax?: number;
  status: "draft" | "reviewed" | "verified";
  sourceUrls: readonly string[];
  reviewedAt?: string;
  reviewer?: string;
}>;

export const BOOK_ARCHIVE_COVER_MODES = [
  "uploaded",
  "editorial",
  "typographic",
] as const;

export type BookArchiveCoverMode =
  (typeof BOOK_ARCHIVE_COVER_MODES)[number];

export const BOOK_ARCHIVE_ARTICLE_RELATIONS = [
  "related",
  "review",
  "feature",
  "mention",
  "unrelated",
] as const;

export type BookArchiveArticleRelation =
  (typeof BOOK_ARCHIVE_ARTICLE_RELATIONS)[number];

export const BOOK_ARCHIVE_SORTS = [
  "editorial-relevance",
  "title",
  "writer",
  "oldest",
  "newest",
  "cover-first",
  "manual",
  "recent",
] as const;

export type BookArchiveSort = (typeof BOOK_ARCHIVE_SORTS)[number];

export const BOOK_ARCHIVE_GENRES = [
  {
    id: "novel",
    aliases: ["роман", "novel", "цикл романов", "novel cycle"],
  },
  {
    id: "novella",
    aliases: ["повесть", "новелла", "novella", "novelette"],
  },
  {
    id: "short-story",
    aliases: ["рассказ", "рассказы", "short story", "short stories"],
  },
  {
    id: "poetry",
    aliases: [
      "поэзия",
      "стихи",
      "стихотворение",
      "лирика",
      "лирический сборник",
      "песенная лирика",
      "сонет",
      "poetry",
      "poem",
      "poems",
      "lyrics",
      "sonnet",
    ],
  },
  {
    id: "drama",
    aliases: [
      "драма",
      "драматургия",
      "пьеса",
      "трагедия",
      "комедия",
      "фарс",
      "drama",
      "play",
      "tragedy",
      "comedy",
      "farce",
    ],
  },
  { id: "essay", aliases: ["эссе", "essay", "essays"] },
  {
    id: "memoir",
    aliases: ["мемуары", "мемуарная проза", "memoir", "memoirs"],
  },
  {
    id: "biography",
    aliases: ["биография", "автобиография", "biography", "autobiography"],
  },
  {
    id: "epic",
    aliases: [
      "эпос",
      "эпическая поэма",
      "эпическая поэзия",
      "epic",
      "epic poem",
      "epic poetry",
    ],
  },
  {
    id: "satire",
    aliases: ["сатира", "сатирическая проза", "satire", "satirical prose"],
  },
  { id: "fable", aliases: ["басня", "басни", "fable", "fables"] },
  {
    id: "fairy-tale",
    aliases: ["сказка", "сказки", "fairy tale", "fairy tales"],
  },
  {
    id: "folklore",
    aliases: [
      "фольклор",
      "фольклорная проза",
      "устная традиция",
      "folklore",
      "oral tradition",
    ],
  },
  {
    id: "science-fiction",
    aliases: [
      "научная фантастика",
      "научно-фантастический роман",
      "science fiction",
      "sci-fi",
    ],
  },
  { id: "fantasy", aliases: ["фэнтези", "fantasy"] },
  {
    id: "detective",
    aliases: ["детектив", "детективная проза", "detective fiction", "mystery"],
  },
  {
    id: "adventure",
    aliases: [
      "приключенческая проза",
      "приключенческий роман",
      "adventure",
      "adventure fiction",
    ],
  },
  {
    id: "historical-fiction",
    aliases: [
      "историческая проза",
      "исторический роман",
      "historical fiction",
      "historical novel",
    ],
  },
  {
    id: "philosophy",
    aliases: [
      "философия",
      "философская проза",
      "philosophy",
      "philosophical fiction",
    ],
  },
  {
    id: "children",
    aliases: ["детская литература", "children's literature"],
  },
  {
    id: "young-adult",
    aliases: ["подростковая литература", "young adult", "young-adult"],
  },
  {
    id: "criticism",
    aliases: [
      "литературная критика",
      "театральная критика",
      "кинокритика",
      "criticism",
      "literary criticism",
    ],
  },
  {
    id: "journalism",
    aliases: ["журналистика", "публицистика", "journalism", "publicism"],
  },
] as const;

export type BookArchiveGenreId = (typeof BOOK_ARCHIVE_GENRES)[number]["id"];

export const BOOK_ARCHIVE_LANGUAGES = [
  { id: "ru", aliases: ["ru", "rus", "русский", "russian"] },
  { id: "en", aliases: ["en", "eng", "английский", "english"] },
  { id: "fr", aliases: ["fr", "fra", "fre", "французский", "french"] },
  { id: "de", aliases: ["de", "deu", "ger", "немецкий", "german"] },
  { id: "es", aliases: ["es", "spa", "испанский", "spanish"] },
  { id: "it", aliases: ["it", "ita", "итальянский", "italian"] },
  { id: "pt", aliases: ["pt", "por", "португальский", "portuguese"] },
  { id: "ar", aliases: ["ar", "ara", "арабский", "arabic"] },
  { id: "zh", aliases: ["zh", "zho", "chi", "китайский", "chinese"] },
  { id: "ja", aliases: ["ja", "jpn", "японский", "japanese"] },
  { id: "pl", aliases: ["pl", "pol", "польский", "polish"] },
  { id: "cs", aliases: ["cs", "ces", "cze", "чешский", "czech"] },
  { id: "sv", aliases: ["sv", "swe", "шведский", "swedish"] },
  { id: "no", aliases: ["no", "nor", "норвежский", "norwegian"] },
  { id: "da", aliases: ["da", "dan", "датский", "danish"] },
  {
    id: "nl",
    aliases: ["nl", "nld", "dut", "нидерландский", "голландский", "dutch"],
  },
  { id: "hu", aliases: ["hu", "hun", "венгерский", "hungarian"] },
  { id: "tr", aliases: ["tr", "tur", "турецкий", "turkish"] },
  { id: "bn", aliases: ["bn", "ben", "бенгальский", "bengali"] },
  { id: "la", aliases: ["la", "lat", "латинский", "latin"] },
  {
    id: "grc",
    aliases: ["grc", "древнегреческий", "ancient greek"],
  },
  { id: "el", aliases: ["el", "ell", "gre", "греческий", "greek"] },
  { id: "uk", aliases: ["uk", "ukr", "украинский", "ukrainian"] },
  { id: "be", aliases: ["be", "bel", "белорусский", "belarusian"] },
  { id: "hy", aliases: ["hy", "hye", "arm", "армянский", "armenian"] },
  { id: "ka", aliases: ["ka", "kat", "geo", "грузинский", "georgian"] },
  { id: "fa", aliases: ["fa", "fas", "per", "персидский", "persian"] },
  { id: "he", aliases: ["he", "heb", "иврит", "hebrew"] },
  { id: "ko", aliases: ["ko", "kor", "корейский", "korean"] },
  { id: "fi", aliases: ["fi", "fin", "финский", "finnish"] },
  { id: "is", aliases: ["is", "isl", "ice", "исландский", "icelandic"] },
  { id: "ro", aliases: ["ro", "ron", "rum", "румынский", "romanian"] },
  { id: "sr", aliases: ["sr", "srp", "сербский", "serbian"] },
  { id: "hr", aliases: ["hr", "hrv", "хорватский", "croatian"] },
  { id: "bg", aliases: ["bg", "bul", "болгарский", "bulgarian"] },
  { id: "az", aliases: ["az", "aze", "азербайджанский", "azerbaijani"] },
  { id: "kk", aliases: ["kk", "kaz", "казахский", "kazakh"] },
  { id: "uz", aliases: ["uz", "uzb", "узбекский", "uzbek"] },
] as const;

export type BookArchiveLanguageId =
  (typeof BOOK_ARCHIVE_LANGUAGES)[number]["id"];

export type BookArchiveFilterState = Readonly<{
  query: string;
  quickPreset: BookArchiveQuickPreset;
  authorKey: string | null;
  countryIds: readonly string[];
  genreIds: readonly BookArchiveGenreId[];
  audienceIds: readonly WorkAudienceCategory[];
  periods: readonly BookArchivePeriod[];
  originalLanguageIds: readonly BookArchiveLanguageId[];
  editorialStatuses: readonly BookArchiveQueueStatus[];
  coverModes: readonly BookArchiveCoverMode[];
  articleRelations: readonly BookArchiveArticleRelation[];
  savedOnly: boolean;
  sort: BookArchiveSort;
}>;

type FacetMap = ReadonlyMap<string, readonly number[]>;
type MutableFacetMap = Map<string, number[]>;

export type BookArchiveFacetDocument = Readonly<{
  position: number;
  sourcePosition: number;
  key: string;
  item: BookArchiveQueueItem;
  /** Legacy routing anchor retained for existing UI state. */
  authorKey: string;
  /** Factual, linkable authors used by the author facet. */
  authorKeys: readonly string[];
  authorRefs: readonly BookAuthorReference[];
  authorLabels: readonly string[];
  countryId: string;
  title: string;
  writerLabel: string;
  countryLabel: string;
  sourceGenreLabels: readonly string[];
  sourceTagLabels: readonly string[];
  sourceOriginalLanguage: string;
  genreIds: readonly BookArchiveGenreId[];
  audienceIds: readonly WorkAudienceCategory[];
  period: BookArchivePeriod;
  originalLanguageIds: readonly BookArchiveLanguageId[];
  editorialStatus: BookArchiveQueueStatus;
  coverMode: BookArchiveCoverMode;
  articleRelations: readonly BookArchiveArticleRelation[];
  publicationYear: number | null;
  reviewedAtTimestamp: number | null;
  searchValues: readonly string[];
  searchTokens: readonly string[];
  searchFields: Readonly<{
    title: string;
    writer: string;
    authors: readonly string[];
    original: string;
    alternate: readonly string[];
    country: string;
    verifiedMetadata: readonly string[];
  }>;
  searchFieldTokens: Readonly<{
    title: readonly string[];
    writer: readonly string[];
    original: readonly string[];
    alternate: readonly string[];
    country: readonly string[];
    verifiedMetadata: readonly string[];
  }>;
}>;

export type BookArchiveFacetIndex = Readonly<{
  locale: WorkLocale;
  documents: readonly BookArchiveFacetDocument[];
  byKey: ReadonlyMap<string, BookArchiveFacetDocument>;
  indexes: Readonly<{
    author: FacetMap;
    country: FacetMap;
    genre: FacetMap;
    audience: FacetMap;
    period: FacetMap;
    language: FacetMap;
    status: FacetMap;
    cover: FacetMap;
    relation: FacetMap;
    searchToken: FacetMap;
  }>;
  diagnostics: Readonly<{
    duplicateBookKeys: number;
    audienceProfilesAccepted: number;
    audienceProfilesRejected: number;
    audienceProfilesUnavailable: number;
    audienceFacetStatus: "available" | "unavailable";
    relationFacetStatus: "available" | "unavailable";
    unmappedGenreLabels: readonly string[];
    unmappedLanguageLabels: readonly string[];
  }>;
}>;

export type BookArchiveAudienceProfiles =
  | ReadonlyMap<string, WorkAudienceProfile | undefined>
  | Readonly<Record<string, WorkAudienceProfile | undefined>>;
export type BuildBookArchiveFacetIndexOptions = Readonly<{
  items: readonly BookArchiveQueueItem[];
  locale: WorkLocale;
  translate?: (value: string) => string;
  countryName?: (countryCode: string, fallback: string) => string;
  audienceProfiles?: BookArchiveAudienceProfiles;
  mentionIndex?: Pick<BookMentionIndex, "byBook"> | null;
}>;

export type FilterBookArchiveFacetIndexContext = Readonly<{
  savedBookKeys?: ReadonlySet<string>;
}>;

export type BookArchiveFacetResult = Readonly<{
  documents: readonly BookArchiveFacetDocument[];
  items: readonly BookArchiveQueueItem[];
  total: number;
  bestMatchKey: string | null;
}>;

const quickPresetSet = new Set<string>(BOOK_ARCHIVE_QUICK_PRESETS);
const periodSet = new Set<string>(BOOK_ARCHIVE_PERIODS);
const audienceSet = new Set<string>(BOOK_ARCHIVE_AUDIENCES);
const coverModeSet = new Set<string>(BOOK_ARCHIVE_COVER_MODES);
const relationSet = new Set<string>(BOOK_ARCHIVE_ARTICLE_RELATIONS);
const sortSet = new Set<string>(BOOK_ARCHIVE_SORTS);
const editorialStatusSet = new Set<string>(["verified", "pending"]);
const articleMentionKindSet = new Set<string>([
  "review",
  "feature",
  "mention",
]);

function buildAliasMap<
  T extends readonly { id: string; aliases: readonly string[] }[],
>(definitions: T) {
  const aliases = new Map<string, T[number]["id"]>();
  for (const definition of definitions) {
    for (const alias of [definition.id, ...definition.aliases]) {
      aliases.set(normalizeLiterarySearch(alias), definition.id);
    }
  }
  return aliases;
}

const genreAliases = buildAliasMap(BOOK_ARCHIVE_GENRES);
const languageAliases = buildAliasMap(BOOK_ARCHIVE_LANGUAGES);
const genreIdSet = new Set<string>(BOOK_ARCHIVE_GENRES.map(({ id }) => id));
const languageIdSet = new Set<string>(
  BOOK_ARCHIVE_LANGUAGES.map(({ id }) => id)
);

function cleanStringValues(values: readonly string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"));
}

function cleanAllowedValues<T extends string>(
  values: readonly string[] | undefined,
  allowed: ReadonlySet<string>
) {
  return cleanStringValues(values).filter((value): value is T =>
    allowed.has(value)
  );
}

export function normalizeBookGenreIds(values: readonly string[] | undefined) {
  const ids = (values || []).flatMap((value) => {
    const id = genreAliases.get(normalizeLiterarySearch(value));
    return id ? [id] : [];
  });
  return [...new Set(ids)].sort() as BookArchiveGenreId[];
}

export function normalizeBookLanguageIds(
  values: readonly string[] | undefined
) {
  const ids = (values || []).flatMap((value) => {
    const id = languageAliases.get(normalizeLiterarySearch(value));
    return id ? [id] : [];
  });
  return [...new Set(ids)].sort() as BookArchiveLanguageId[];
}

function isExactAuthorKey(value: string) {
  const parts = value.split(":");
  return parts.length === 2 && parts.every((part) => Boolean(part.trim()));
}

export function normalizeBookArchiveFilterState(
  input: Partial<BookArchiveFilterState> = {}
): BookArchiveFilterState {
  const quickPreset =
    typeof input.quickPreset === "string" &&
    quickPresetSet.has(input.quickPreset)
      ? input.quickPreset
      : "all";
  const authorKey = input.authorKey?.trim() || "";

  return {
    query: typeof input.query === "string" ? input.query : "",
    quickPreset,
    authorKey: isExactAuthorKey(authorKey) ? authorKey : null,
    countryIds: cleanStringValues(input.countryIds),
    genreIds: cleanAllowedValues<BookArchiveGenreId>(
      input.genreIds,
      genreIdSet
    ),
    audienceIds: cleanAllowedValues<WorkAudienceCategory>(
      input.audienceIds,
      audienceSet
    ),
    periods: cleanAllowedValues<BookArchivePeriod>(
      input.periods,
      periodSet
    ),
    originalLanguageIds: cleanAllowedValues<BookArchiveLanguageId>(
      input.originalLanguageIds,
      languageIdSet
    ),
    editorialStatuses: cleanAllowedValues<BookArchiveQueueStatus>(
      input.editorialStatuses,
      editorialStatusSet
    ),
    coverModes: cleanAllowedValues<BookArchiveCoverMode>(
      input.coverModes,
      coverModeSet
    ),
    articleRelations: cleanAllowedValues<BookArchiveArticleRelation>(
      input.articleRelations,
      relationSet
    ),
    savedOnly: input.savedOnly === true,
    sort:
      typeof input.sort === "string" && sortSet.has(input.sort)
        ? input.sort
        : "editorial-relevance",
  };
}

function emptyFacetSelection(
  state: BookArchiveFilterState,
  quickPreset: BookArchiveQuickPreset
): BookArchiveFilterState {
  return {
    ...normalizeBookArchiveFilterState(),
    query: state.query,
    quickPreset,
    sort: state.sort,
  };
}

export function applyBookArchiveQuickPreset(
  state: BookArchiveFilterState,
  preset: Exclude<BookArchiveQuickPreset, "custom">
): BookArchiveFilterState {
  const next = emptyFacetSelection(state, preset);
  switch (preset) {
    case "verified":
      return { ...next, editorialStatuses: ["verified"] };
    case "children":
      return { ...next, audienceIds: ["children"] };
    case "classic":
      return {
        ...next,
        periods: ["pre-1800", "xix", "1900-1945"],
        editorialStatuses: ["verified"],
      };
    case "modern":
      return {
        ...next,
        periods: ["1946-1999", "xxi"],
        editorialStatuses: ["verified"],
      };
    case "with-cover":
      return { ...next, coverModes: ["uploaded", "editorial"] };
    case "saved":
      return { ...next, savedOnly: true };
    case "all":
      return next;
  }
}

export function bookArchivePeriodFor(
  firstPublished: number | undefined,
  editorialStatus: BookArchiveQueueStatus
): BookArchivePeriod {
  if (
    editorialStatus !== "verified" ||
    !Number.isInteger(firstPublished)
  ) {
    return "unknown";
  }
  if (firstPublished! < 1800) return "pre-1800";
  if (firstPublished! <= 1899) return "xix";
  if (firstPublished! <= 1945) return "1900-1945";
  if (firstPublished! <= 1999) return "1946-1999";
  return "xxi";
}

export function bookArchiveCoverModeFor(
  item: Pick<BookArchiveQueueItem, "book">
): BookArchiveCoverMode {
  if (
    isEditorialCover(item.book) &&
    isCoverArtworkDisplayAllowed(item.book)
  ) {
    return "editorial";
  }
  if (isCoverDisplayAllowed(item.book)) return "uploaded";
  return "typographic";
}

function isAudienceProfileMap(
  profiles: BookArchiveAudienceProfiles
): profiles is ReadonlyMap<string, WorkAudienceProfile | undefined> {
  return typeof (profiles as ReadonlyMap<string, unknown>).get === "function";
}

function profileAt(
  profiles: BuildBookArchiveFacetIndexOptions["audienceProfiles"],
  key: string
) {
  if (!profiles) return undefined;
  return isAudienceProfileMap(profiles)
    ? profiles.get(key)
    : profiles[key];
}

function normalizedAudienceProfile(
  profile: WorkAudienceProfile | undefined
) {
  if (!profile || (profile.status !== "reviewed" && profile.status !== "verified")) {
    return null;
  }
  if (
    !Array.isArray(profile.categories) ||
    !profile.categories.length ||
    profile.categories.some((category) => !audienceSet.has(category))
  ) {
    return null;
  }
  if (
    !Array.isArray(profile.sourceUrls) ||
    !profile.sourceUrls.length ||
    profile.sourceUrls.some((url) => !/^https:\/\//iu.test(url.trim()))
  ) {
    return null;
  }
  const ages = [profile.ageMin, profile.ageMax].filter(
    (age): age is number => age !== undefined
  );
  if (
    ages.some((age) => !Number.isInteger(age) || age < 0 || age > 120) ||
    (profile.ageMin !== undefined &&
      profile.ageMax !== undefined &&
      profile.ageMin > profile.ageMax)
  ) {
    return null;
  }
  return [...new Set(profile.categories)].sort() as WorkAudienceCategory[];
}

function addToFacet(map: MutableFacetMap, id: string, position: number) {
  const positions = map.get(id);
  if (positions) {
    positions.push(position);
  } else {
    map.set(id, [position]);
  }
}

function freezeFacetMap(map: MutableFacetMap): FacetMap {
  return new Map(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([id, positions]) => [id, Object.freeze([...positions])] as const)
  );
}

function normalizedField(value: string) {
  return normalizeLiterarySearch(value);
}

function normalizedFields(values: readonly string[]) {
  return values.map(normalizedField).filter(Boolean);
}

const facetSearchStopWords = new Set([
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

const facetCyrillicToLatin: Readonly<Record<string, string>> = {
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

function facetStemToken(token: string) {
  let stemmed = token;
  if (stemmed.length >= 5 && /\p{Script=Cyrillic}/u.test(stemmed)) {
    stemmed = stemmed.replace(
      /(ателями|ителей|ателей|ениями|иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ей|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
      ""
    );
  }
  if (stemmed.length >= 5 && /^[a-z]+$/u.test(stemmed)) {
    if (stemmed.length > 6 && stemmed.endsWith("ies")) {
      return stemmed.slice(0, -3) + "y";
    }
    if (stemmed.length > 7 && stemmed.endsWith("ing")) {
      return stemmed.slice(0, -3);
    }
    if (stemmed.length > 6 && stemmed.endsWith("ed")) {
      return stemmed.slice(0, -2);
    }
    if (stemmed.length > 6 && stemmed.endsWith("es")) {
      return stemmed.slice(0, -2);
    }
    if (stemmed.length > 5 && stemmed.endsWith("s")) {
      return stemmed.slice(0, -1);
    }
  }
  return stemmed;
}

function facetTransliterateToken(token: string) {
  return facetStemToken(
    [...token]
      .map((letter) => facetCyrillicToLatin[letter] ?? letter)
      .join("")
      .replace(/iy$/u, "y")
      .replace(/ii$/u, "y")
  );
}

function facetRawSearchTokens(value: string) {
  const tokens = normalizeLiterarySearch(value).split(" ").filter(Boolean);
  const meaningful =
    tokens.length <= 1
      ? tokens
      : tokens.filter((token) => !facetSearchStopWords.has(token));
  return meaningful.map(facetStemToken).filter((token) => token.length >= 2);
}

function facetSearchTokenAliases(token: string) {
  return [...new Set([facetStemToken(token), facetTransliterateToken(token)])]
    .filter((candidate) => candidate.length >= 2);
}

function facetDocumentSearchTokens(values: readonly string[]) {
  return [
    ...new Set(
      values.flatMap(facetRawSearchTokens).flatMap(facetSearchTokenAliases)
    ),
  ];
}

function prepareFacetSearchQuery(value: string) {
  const normalized = normalizeLiterarySearch(value);
  return {
    normalized,
    groups: facetRawSearchTokens(normalized).map(facetSearchTokenAliases),
  };
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

function facetTokensMatch(queryToken: string, documentToken: string) {
  if (queryToken === documentToken) return true;
  if (queryToken.length >= 4 && documentToken.startsWith(queryToken)) {
    return true;
  }
  return (
    queryToken.length >= 7 &&
    documentToken.length >= 7 &&
    editDistanceAtMostOne(queryToken, documentToken)
  );
}

function searchTokensMatchPreparedQuery(
  searchTokens: readonly string[],
  groups: readonly (readonly string[])[]
) {
  if (!groups.length || !searchTokens.length) return false;
  return groups.every((aliases) =>
    aliases.some((queryToken) =>
      searchTokens.some((documentToken) =>
        facetTokensMatch(queryToken, documentToken)
      )
    )
  );
}
function validTimestamp(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildBookArchiveFacetIndex({
  items,
  locale,
  translate = (value) => value,
  countryName = (_countryCode, fallback) => fallback,
  audienceProfiles,
  mentionIndex,
}: BuildBookArchiveFacetIndexOptions): BookArchiveFacetIndex {
  const mutableIndexes = {
    author: new Map<string, number[]>(),
    country: new Map<string, number[]>(),
    genre: new Map<string, number[]>(),
    audience: new Map<string, number[]>(),
    period: new Map<string, number[]>(),
    language: new Map<string, number[]>(),
    status: new Map<string, number[]>(),
    cover: new Map<string, number[]>(),
    relation: new Map<string, number[]>(),
    searchToken: new Map<string, number[]>(),
  };
  const documents: BookArchiveFacetDocument[] = [];
  const byKey = new Map<string, BookArchiveFacetDocument>();
  const unmappedGenreLabels = new Set<string>();
  const unmappedLanguageLabels = new Set<string>();
  let duplicateBookKeys = 0;
  let audienceProfilesAccepted = 0;
  let audienceProfilesRejected = 0;

  items.forEach((item, sourcePosition) => {
    const { book } = item;
    const key = bookArchiveKey(book.countryId, book.writerId, book.id);
    if (byKey.has(key)) {
      duplicateBookKeys += 1;
      return;
    }

    const position = documents.length;
    const authorKey = book.countryId + ":" + book.writerId;
    const authorRefs = selectBookAuthorRefs(book);
    const authorKeys = [
      ...new Set(
        authorRefs.map((author) => `${author.countryId}:${author.writerId}`)
      ),
    ];
    const displayed = presentBookArchiveQueueItem(item, locale);
    const authorLabels = selectBookAuthorNames(
      book,
      locale,
      translate("Автор")
    );
    const writerLabel = selectBookAuthorByline(
      book,
      locale,
      translate("Автор")
    );
    const countryLabel = countryName(
      book.country.code || "",
      book.countryName
    );
    const sourceGenreLabels = cleanStringValues(book.genres);
    const sourceTagLabels = cleanStringValues(book.tags);
    const genreIds =
      item.status === "verified"
        ? normalizeBookGenreIds(sourceGenreLabels)
        : [];
    if (item.status === "verified") {
      for (const label of sourceGenreLabels) {
        if (!genreAliases.has(normalizeLiterarySearch(label))) {
          unmappedGenreLabels.add(label);
        }
      }
    }

    const sourceOriginalLanguage = book.originalLanguage?.trim() || "";
    const originalLanguageIds =
      item.status === "verified"
        ? normalizeBookLanguageIds(
            sourceOriginalLanguage ? [sourceOriginalLanguage] : []
          )
        : [];
    if (
      item.status === "verified" &&
      sourceOriginalLanguage &&
      !originalLanguageIds.length
    ) {
      unmappedLanguageLabels.add(sourceOriginalLanguage);
    }

    const audienceInput = profileAt(audienceProfiles, key);
    const audienceIds = normalizedAudienceProfile(audienceInput);
    if (audienceInput) {
      if (audienceIds) {
        audienceProfilesAccepted += 1;
      } else {
        audienceProfilesRejected += 1;
      }
    }

    const period = bookArchivePeriodFor(book.firstPublished, item.status);
    const coverMode = bookArchiveCoverModeFor(item);
    const mentions = mentionIndex?.byBook[key];
    const mentionKinds = mentionIndex
      ? [...new Set(
          (mentions || []).flatMap((mention) =>
            articleMentionKindSet.has(mention.kind) ? [mention.kind] : []
          )
        )].sort() as BookArticleMentionKind[]
      : [];
    const articleRelations: BookArchiveArticleRelation[] = mentionIndex
      ? mentions?.length
        ? ["related", ...mentionKinds]
        : ["unrelated"]
      : [];
    const selectedOriginalLanguage =
      item.status === "verified"
        ? selectBookOriginalLanguage(book, locale)
        : "";
    const verifiedMetadata =
      item.status === "verified"
        ? cleanStringValues([
            displayed.description,
            selectedOriginalLanguage,
            ...selectBookMetadataLabels(book, locale, translate),
          ])
        : [];
    const alternateTitles = cleanStringValues(book.alternateTitles);
    const originalTitle = book.originalTitle?.trim() || "";
    const searchValues = cleanStringValues([
      displayed.title,
      originalTitle,
      ...alternateTitles,
      writerLabel,
      ...authorLabels,
      countryLabel,
      ...verifiedMetadata,
      ...(audienceIds || []),
      period !== "unknown" ? period : "",
    ]);

    const document: BookArchiveFacetDocument = {
      position,
      sourcePosition,
      key,
      item,
      authorKey,
      authorKeys,
      authorRefs,
      authorLabels,
      countryId: book.countryId,
      title: displayed.title,
      writerLabel,
      countryLabel,
      sourceGenreLabels,
      sourceTagLabels,
      sourceOriginalLanguage,
      genreIds,
      audienceIds: audienceIds || [],
      period,
      originalLanguageIds,
      editorialStatus: item.status,
      coverMode,
      articleRelations,
      publicationYear:
        item.status === "verified" && Number.isInteger(book.firstPublished)
          ? book.firstPublished!
          : null,
      reviewedAtTimestamp:
        item.status === "verified"
          ? validTimestamp(book.editorial?.reviewedAt)
          : null,
      searchValues,
      searchTokens: facetDocumentSearchTokens(searchValues),
      searchFields: {
        title: normalizedField(displayed.title),
        writer: normalizedField(writerLabel),
        authors: normalizedFields(authorLabels),
        original: normalizedField(originalTitle),
        alternate: normalizedFields(alternateTitles),
        country: normalizedField(countryLabel),
        verifiedMetadata: normalizedFields(verifiedMetadata),
      },
      searchFieldTokens: {
        title: facetDocumentSearchTokens([displayed.title]),
        writer: facetDocumentSearchTokens([writerLabel, ...authorLabels]),
        original: facetDocumentSearchTokens([originalTitle]),
        alternate: facetDocumentSearchTokens(alternateTitles),
        country: facetDocumentSearchTokens([countryLabel]),
        verifiedMetadata: facetDocumentSearchTokens(verifiedMetadata),
      },
    };

    documents.push(document);
    byKey.set(key, document);
    document.searchTokens.forEach((token) =>
      addToFacet(mutableIndexes.searchToken, token, position)
    );
    authorKeys.forEach((key) =>
      addToFacet(mutableIndexes.author, key, position)
    );
    addToFacet(mutableIndexes.country, book.countryId, position);
    genreIds.forEach((id) => addToFacet(mutableIndexes.genre, id, position));
    (audienceIds || []).forEach((id) =>
      addToFacet(mutableIndexes.audience, id, position)
    );
    addToFacet(mutableIndexes.period, period, position);
    originalLanguageIds.forEach((id) =>
      addToFacet(mutableIndexes.language, id, position)
    );
    addToFacet(mutableIndexes.status, item.status, position);
    addToFacet(mutableIndexes.cover, coverMode, position);
    articleRelations.forEach((id) =>
      addToFacet(mutableIndexes.relation, id, position)
    );
  });

  const audienceFacetStatus =
    audienceProfilesAccepted > 0 ? "available" : "unavailable";

  return {
    locale,
    documents: Object.freeze(documents),
    byKey,
    indexes: {
      author: freezeFacetMap(mutableIndexes.author),
      country: freezeFacetMap(mutableIndexes.country),
      genre: freezeFacetMap(mutableIndexes.genre),
      audience: freezeFacetMap(mutableIndexes.audience),
      period: freezeFacetMap(mutableIndexes.period),
      language: freezeFacetMap(mutableIndexes.language),
      status: freezeFacetMap(mutableIndexes.status),
      cover: freezeFacetMap(mutableIndexes.cover),
      relation: freezeFacetMap(mutableIndexes.relation),
      searchToken: freezeFacetMap(mutableIndexes.searchToken),
    },
    diagnostics: {
      duplicateBookKeys,
      audienceProfilesAccepted,
      audienceProfilesRejected,
      audienceProfilesUnavailable:
        documents.length - audienceProfilesAccepted,
      audienceFacetStatus,
      relationFacetStatus: mentionIndex ? "available" : "unavailable",
      unmappedGenreLabels: [...unmappedGenreLabels].sort(),
      unmappedLanguageLabels: [...unmappedLanguageLabels].sort(),
    },
  };
}

function unionFacetPositions(
  map: FacetMap,
  ids: readonly string[]
): Set<number> {
  const union = new Set<number>();
  ids.forEach((id) =>
    (map.get(id) || []).forEach((position) => union.add(position))
  );
  return union;
}

function intersectPositions(
  candidates: Set<number>,
  accepted: Set<number>
) {
  for (const position of candidates) {
    if (!accepted.has(position)) candidates.delete(position);
  }
}
function searchPositionsForPreparedQuery(
  index: BookArchiveFacetIndex,
  groups: readonly (readonly string[])[]
) {
  const entries = [...index.indexes.searchToken.entries()];
  let candidates: Set<number> | null = null;
  for (const aliases of groups) {
    const accepted = new Set<number>();
    for (const alias of aliases) {
      for (const [documentToken, positions] of entries) {
        if (!facetTokensMatch(alias, documentToken)) continue;
        positions.forEach((position) => accepted.add(position));
      }
    }
    if (candidates === null) {
      candidates = accepted;
    } else {
      intersectPositions(candidates, accepted);
    }
    if (!candidates.size) break;
  }
  return candidates || new Set<number>();
}


function searchScore(
  document: BookArchiveFacetDocument,
  query: ReturnType<typeof prepareFacetSearchQuery>
) {
  const normalizedQuery = query.normalized;
  const fields = document.searchFields;

  if (fields.title === normalizedQuery) return 0;
  if (
    normalizedQuery.length >= 2 &&
    fields.title.startsWith(normalizedQuery)
  ) {
    return 1;
  }
  if (
    fields.writer === normalizedQuery ||
    fields.authors.includes(normalizedQuery)
  ) {
    return 2;
  }
  if (fields.original === normalizedQuery) return 3;
  if (fields.alternate.includes(normalizedQuery)) return 4;
  if (fields.country === normalizedQuery) return 5;
  if (fields.verifiedMetadata.includes(normalizedQuery)) return 6;

  const tokenGroups = document.searchFieldTokens;
  const rankedFields: readonly (readonly string[])[] = [
    tokenGroups.title,
    tokenGroups.writer,
    tokenGroups.original,
    tokenGroups.alternate,
    tokenGroups.country,
    tokenGroups.verifiedMetadata,
  ];
  for (let index = 0; index < rankedFields.length; index += 1) {
    if (searchTokensMatchPreparedQuery(rankedFields[index], query.groups)) {
      return 10 + index * 10;
    }
  }
  return 100;
}

type RankedDocument = {
  document: BookArchiveFacetDocument;
  score: number;
};

function compareNullableNumber(
  left: number | null,
  right: number | null,
  direction: 1 | -1
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

function compareText(left: string, right: string, locale: WorkLocale) {
  return left.localeCompare(right, locale);
}

function compareEditorialRelevance(
  left: RankedDocument,
  right: RankedDocument,
  locale: WorkLocale
) {
  return (
    left.score - right.score ||
    (left.document.editorialStatus === "verified" ? 0 : 1) -
      (right.document.editorialStatus === "verified" ? 0 : 1) ||
    (left.document.coverMode === "typographic" ? 1 : 0) -
      (right.document.coverMode === "typographic" ? 1 : 0) ||
    compareText(left.document.title, right.document.title, locale) ||
    left.document.key.localeCompare(right.document.key, "en")
  );
}

function compareBySort(
  left: RankedDocument,
  right: RankedDocument,
  sort: BookArchiveSort,
  locale: WorkLocale
) {
  const first = left.document;
  const second = right.document;
  let difference = 0;

  switch (sort) {
    case "editorial-relevance":
      return compareEditorialRelevance(left, right, locale);
    case "title":
      difference = compareText(first.title, second.title, locale);
      break;
    case "writer":
      difference =
        compareText(first.writerLabel, second.writerLabel, locale) ||
        compareText(first.title, second.title, locale);
      break;
    case "oldest":
      difference =
        compareNullableNumber(first.publicationYear, second.publicationYear, 1) ||
        compareText(first.title, second.title, locale);
      break;
    case "newest":
      difference =
        compareNullableNumber(first.publicationYear, second.publicationYear, -1) ||
        compareText(first.title, second.title, locale);
      break;
    case "cover-first":
      difference =
        (first.coverMode === "typographic" ? 1 : 0) -
          (second.coverMode === "typographic" ? 1 : 0) ||
        compareText(first.title, second.title, locale);
      break;
    case "manual":
      difference = first.sourcePosition - second.sourcePosition;
      break;
    case "recent":
      difference =
        compareNullableNumber(
          first.reviewedAtTimestamp,
          second.reviewedAtTimestamp,
          -1
        ) || compareText(first.title, second.title, locale);
      break;
  }
  return difference || first.key.localeCompare(second.key, "en");
}
const sortOrderCache = new WeakMap<
  BookArchiveFacetIndex,
  Map<BookArchiveSort, readonly number[]>
>();

function sortedBookArchivePositions(
  index: BookArchiveFacetIndex,
  sort: BookArchiveSort
) {
  let cachedBySort = sortOrderCache.get(index);
  if (!cachedBySort) {
    cachedBySort = new Map();
    sortOrderCache.set(index, cachedBySort);
  }
  const cached = cachedBySort.get(sort);
  if (cached) return cached;
  const positions = index.documents
    .map((document): RankedDocument => ({ document, score: 0 }))
    .sort((left, right) => compareBySort(left, right, sort, index.locale))
    .map(({ document }) => document.position);
  cachedBySort.set(sort, positions);
  return positions;
}

export function filterBookArchiveFacetIndex(
  index: BookArchiveFacetIndex,
  inputState: BookArchiveFilterState,
  context: FilterBookArchiveFacetIndexContext = {}
): BookArchiveFacetResult {
  const state = normalizeBookArchiveFilterState(inputState);
  const candidates = new Set(index.documents.map(({ position }) => position));
  const categories: Array<[FacetMap, readonly string[]]> = [
    [
      index.indexes.author,
      state.authorKey ? [state.authorKey] : [],
    ],
    [index.indexes.country, state.countryIds],
    [index.indexes.genre, state.genreIds],
    [index.indexes.audience, state.audienceIds],
    [index.indexes.period, state.periods],
    [index.indexes.language, state.originalLanguageIds],
    [index.indexes.status, state.editorialStatuses],
    [index.indexes.cover, state.coverModes],
    [index.indexes.relation, state.articleRelations],
  ];

  categories.forEach(([facet, ids]) => {
    if (ids.length) intersectPositions(candidates, unionFacetPositions(facet, ids));
  });

  if (state.savedOnly) {
    const savedBookKeys = context.savedBookKeys || new Set<string>();
    for (const position of candidates) {
      if (!savedBookKeys.has(index.documents[position].key)) {
        candidates.delete(position);
      }
    }
  }

  const preparedQuery = prepareFacetSearchQuery(state.query);
  if (preparedQuery.normalized) {
    intersectPositions(
      candidates,
      searchPositionsForPreparedQuery(index, preparedQuery.groups)
    );
  }
  const ranked = preparedQuery.normalized
    ? [...candidates].map(
        (position): RankedDocument => ({
          document: index.documents[position],
          score: searchScore(index.documents[position], preparedQuery),
        })
      )
    : sortedBookArchivePositions(index, state.sort)
        .filter((position) => candidates.has(position))
        .map(
          (position): RankedDocument => ({
            document: index.documents[position],
            score: 0,
          })
        );
  const bestMatch = preparedQuery.normalized
    ? [...ranked].sort((left, right) =>
        compareEditorialRelevance(left, right, index.locale)
      )[0]
    : ranked[0];
  if (preparedQuery.normalized) {
    ranked.sort((left, right) =>
      compareBySort(left, right, state.sort, index.locale)
    );
  }
  const documents = ranked.map(({ document }) => document);

  return {
    documents,
    items: documents.map(({ item }) => item),
    total: documents.length,
    bestMatchKey: bestMatch?.document.key || null,
  };
}

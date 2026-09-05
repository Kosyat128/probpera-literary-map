# NAMES, TITLES, TRANSLITERATION AND SEARCH / ИМЕНА, НАЗВАНИЯ И ПОИСК

## 1. Stable entity identity

Writer, work, country and character IDs are language-neutral. Russian and
English names are fields/aliases, never separate duplicate entities.

```ts
type LocalizedName = {
  original: string;
  ru: string;
  en: string;
  sortRu: string;
  sortEn: string;
  aliasesRu: string[];
  aliasesEn: string[];
  transliterations: string[];
  sourceRefs: string[];
  status: "verified" | "fallback-transliteration" | "review-required";
};
```

## 2. Writer names

Priority for English display:

1. established English form in authoritative library/rights-holder data;
2. form used in a verified English edition or trusted reference;
3. documented transliteration fallback.

Preserve native form and alternative spellings for discovery. Do not
anglicize a name without evidence. Initials, particles, diacritics and name
order are part of the record.

## 3. Work titles

Store separately:

- original title;
- Russian published/established title;
- verified English published title;
- transliteration fallback;
- descriptive translation, clearly labelled;
- edition/translator/source;
- rights status.

Never invent a “published English title”. If multiple English titles exist,
select by editorial policy and keep aliases.

## 4. Quotations

A quotation is language-specific content with translator/edition/rights.
If a rights-cleared English quotation is unavailable, use a prose summary
and do not put quotation marks around generated wording.

## 5. Countries and places

- use ISO codes as identity;
- use CLDR/Intl display names for modern country UI where appropriate;
- editorially control historical states, disputed names and literary
  geography;
- do not overwrite the historical label on an artifact texture;
- country selection remains identical across languages.

## 6. Search normalization

Index:

- Russian display name;
- English display name;
- original/native script;
- common alternate spellings;
- verified transliterations;
- work title variants;
- diacritic-folded forms;
- initials and surname-first forms;
- aliases used on the canonical site.

Search must be locale-aware but cross-language. An English user may search
`Толстой`; a Russian user may search `Tolstoy`. Both resolve to the same
writer ID.

## 7. Ranking

Ranking priorities:

1. exact display name in active locale;
2. exact verified alias;
3. prefix;
4. original/native name;
5. transliteration;
6. fuzzy match with conservative threshold.

Do not let a fuzzy transliteration outrank an exact different writer.
Explain no-result and alternative spelling suggestions.

## 8. Sorting

Use locale-aware collators. Define editorial surname sort keys separately
from display order. Do not sort raw Cyrillic and Latin with ASCII rules.

## 9. Search privacy and child mode

- query stays local where feasible;
- no child behavioral profile;
- child index contains only allowed entities;
- alias resolution cannot bypass child policy;
- direct ID is policy-checked after resolution;
- English aliases do not unlock a blocked Russian work.

## 10. QA

Test real difficult cases:

- Dostoevsky/Dostoyevsky;
- Tchaikovsky/Chaikovsky variants where relevant;
- diacritics;
- double surnames;
- particles such as de, von, van;
- Chinese/Japanese name order;
- pseudonyms and legal names;
- titles with numerals/punctuation;
- identical transliterations.

# ENGLISH STYLE GUIDE AND VARIANTS / АНГЛИЙСКИЙ СТИЛЬ V12

## 1. Editorial baseline

Use clear international English with `en-US` as the production editorial
base. An `en-GB` store variant may be added only where a real market need
exists and the variant passes a complete metadata/screenshot/legal review.
Do not fork the literary content merely to change spelling.

## 2. Product names

- Russian: `Литературная планета`, `Проба пера`, `Планетка`.
- English: `Literary Planet`, `Proba Pera`, `Planetka`.
- Preserve `Proba Pera` and `Planetka` as brand/transliterated names.
- Do not translate the brand into a different trademark-like English name.

## 3. Tone

Adult mode:
- authoritative but accessible;
- factual, restrained and non-promotional;
- no unsupported superlatives;
- no inflated historical importance.

Child mode:
- warm, concise and age-banded;
- never patronizing;
- no fear pressure, commercial pressure or reward manipulation;
- direct safety/error wording.

Planetka:
- friendly guide, not a lecturer;
- short spoken clauses;
- avoids slang that ages quickly;
- does not imitate a protected character or celebrity voice.

## 4. Mechanics

- Sentence case for UI unless platform convention requires otherwise.
- Oxford comma policy: use when it prevents ambiguity; remain consistent.
- Use typographic apostrophes/quotation marks only through safe rendering.
- Preserve em/en dashes according to editorial context; never use punctuation
  substitution that changes a title.
- Use locale-aware dates, numbers, lists and currencies.
- Do not use `&` as a universal replacement for “and”.
- Avoid sentence fragments in errors unless established UI convention.

## 5. Protected facts

Names, dates, awards, institutions, countries, work titles, quotations,
citations, URLs, ISBNs and legal terms are protected spans. A stylistic
editor cannot change them without a factual/title/rights review.

## 6. Writer names and titles

Use the evidence hierarchy in 122 and 157. Established English forms may
not be overwritten by mechanical transliteration. When no verified English
published title exists, use a labelled descriptive translation or
transliteration according to policy; never present it as an official edition.

## 7. Inclusive and culturally neutral language

- Avoid nationality stereotypes.
- Avoid assigning modern national labels to historical entities without
  context.
- Respect author self-identification and established reference usage.
- Use gendered pronouns only when the source supports them.
- Do not “simplify” disability, ethnicity, religion or political repression
  into misleading euphemism.

## 8. Legal and commerce wording

Legal, privacy, purchase, refund, account deletion and child-safety text
requires independent review. Marketing English cannot be broader or more
promissory than Russian terms. Store-supplied prices are never rewritten.

## 9. Variant control

```text
base English content: en
default store locale: en-US
optional metadata overlay: en-GB
```

Differences are maintained as small overrides with a diff report. No mixed
US/UK spelling inside one listing. A variant without support capacity is not
published.

## 10. Quality gate

Block release for inconsistent brand names, unstable terminology, changed
facts, guessed official titles, machine-like phrasing in critical content,
misleading child language, variant drift or legal/commerce meaning mismatch.

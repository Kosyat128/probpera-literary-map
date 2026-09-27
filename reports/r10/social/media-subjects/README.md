# Offline writer identity matcher

`matchNewsMediaSubjects(item)` returns at most two `{ qid, name, matchedField, evidence }` candidates from exact full RU/EN names in the reviewed human-writer corpus. It reads the local cached facts and QID registry lazily and performs no network calls or image downloads.

Current coverage: **13 of 235 news records** have one usable identity candidate: 11 from headlines and 2 from summaries anchored by a literal surname in the headline. The remaining 222 stay unmatched: 216 lack an exact name in this cache, 5 contain only unanchored secondary mentions, and 1 names a prize after a writer. This is candidate coverage, not a count of available or licensed photographs.

The local corpus has 1405 human QIDs and 2535 indexed full-name phrases. It contains no alias data; the matcher supports explicit full-name aliases when supplied but invents none. John Green is absent from this snapshot, so his two news items stay unmatched. Virginia Woolf Q40909 passes a positive fixture.

Names use case-insensitive Unicode-normalized exact phrase boundaries. Surname-only identity inference, mononyms, declension guessing, transliteration and capitalized-title guessing are excluded. Ambiguous aliases hold the whole match. Headline identities take precedence; multiple returned writers signal ambiguity to the downstream image resolver. Award/festival/library/institute namesakes are excluded: a Kafka Prize does not become a Kafka portrait when the news concerns its winner. Likewise, a former winner or incidental influence mentioned only in a summary does not become the main illustration.

The evidence describes an identity mention, not authorship, image suitability or reuse rights. The downstream resolver must verify the specific image, its semantic relevance and permission for the destination. No UI, media registry, delivery pipeline or existing content was modified by this matcher task.

The separate `extractNewsMediaSubjectSearchCandidates(item)` export supplies at most four unapproved search queries from two-to-four capitalized English headline name components, supporting initials, apostrophes and particles. Source organisations, quoted book titles and award/institution namesakes are excluded. It returns no QID and sets identity/image approval to false. The downstream resolver must obtain a unique fresh exact label/alias match, human P31, literary P106, headline-context evidence and separate image/rights evidence before use. The extractor itself makes no network calls and does not extend the approved writer corpus.

Focused validation: **13 tests PASS**, including word boundaries, possessives, ambiguous aliases, RU declension rejection, title precedence, multiple people, overlapping names, non-human/unreviewed entities, current John Green records, namesake-versus-winner distinctions, and bounded unapproved search hints. Exact source hashes and the complete per-record coverage are in `coverage.json`.

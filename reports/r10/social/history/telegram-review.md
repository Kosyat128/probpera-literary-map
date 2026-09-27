# Independent review of the public Telegram snapshot

No duplicate of the 235 reviewed agenda records was identified in the captured public history of [@probbaperra](https://t.me/probbaperra). This conclusion is limited to the observed snapshot; it is not a statement that deleted or private posts never existed.

All 19 saved pages passed SHA-256, byte-count and extracted-ID checks. Pagination consistently uses the preceding page's minimum ID, with strictly descending page ranges. The snapshot contains 363 distinct posts, IDs 1 through 410, dated 17 June 2025 to 25 September 2026. The final page includes the channel-created entry at ID 1. There are 47 unobserved IDs whose causes are unknown.

The independent comparison used the correct news source field, `row.source.url`: all 235 `source` values are objects containing valid absolute URLs. Exact normalized source-URL and complete RU/EN title matches remain zero. The original audit text omitted link-preview metadata; this review additionally extracted 267 preview titles and 263 descriptions from the saved HTML and included them in comparison.

All 85,305 post/news pairs were screened using text, URLs and preview metadata. Detailed semantic inspection covered 38 relevant posts, including all 16 non-service posts from August-September 2026 and the strongest author/work overlaps. Examples:

- [Tolstoy recommendations](https://t.me/probbaperra/286) differ from the 2026 birthday notice and Yasnaya Polyana exhibition.
- [The Wells book list](https://t.me/probbaperra/401), [The War in the Air review](https://t.me/probbaperra/350) and earlier adaptations differ from the new Russian publication of Brynhild.
- [Yeats's 1923 Nobel profile](https://t.me/probbaperra/387) differs from the A Vision digitisation project.
- The apparent Kiki match is [Kikimora folklore](https://t.me/probbaperra/229); the Dal match is [Roald Dahl](https://t.me/probbaperra/368), not Vladimir Dal.

Two posts contain only legacy URLs without preview text. Exact URL and publication-day matches in the retained article catalog identify [post 112](https://t.me/probbaperra/112) as an Ozhegov dictionary review and [post 238](https://t.me/probbaperra/238) as a Black Swan Green review. No corresponding agenda event or source was found. These are local catalog identifications, not newly fetched historical article bodies.

The public snapshot duplicate screen passes for a bounded operator canary. The operator should bind the exact news ID/payload/destination and check the channel tail for changes after the snapshot, captured at `2026-09-26T22:24:21.396Z`. This review does not enable sending, update a ledger or create delivery receipts.

Limits: deleted/private/restricted posts, earlier revisions and the 47 unobserved IDs cannot be reconstructed. Preview descriptions can be truncated; linked article bodies and media were not exhaustively compared. Semantic screening is heuristic and does not prove the absence of every paraphrase. No new network calls, application-code changes, ledger changes or channel writes were made by this review.

Detailed case decisions, pagination checks, input fingerprints and scope are in `telegram-review.json`; the full history is not copied into the report. Review was performed by an agent, not a human reviewer.

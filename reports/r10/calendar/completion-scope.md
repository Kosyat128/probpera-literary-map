# Calendar completion scope - 2026-09-26

Bounded read-only audit of existing reports, date evidence and prepared overlays. No network requests, re-verification of the accepted 60 patches, corpus changes or UI changes. Historical operation baseline remains unknown.

## Confirmed scope and remaining target

- Current corpus: 1684 rows, 1671 unique writer identities. The corrected observed baseline has 2237 unique annual events; accepted patches add 60, giving 2297 (1254 births and 1043 memorial dates). The 2026 view has 2295 because two February 29 anniversaries are absent in a non-leap year.
- The minimum of 2000 is met. The additional-1000 objective is not met: 940 more events are required from this observed baseline, or 949 if only newly populated date fields count. The 60 accepted additions contain 51 new date fields and nine restored, evidence-confirmed January 1 events.
- Applying the accepted values to the stored baseline in memory leaves 590 blank fields (104 birth, 486 death), 447 partial/non-ISO fields (306 birth, 141 death), and 12 held full ISO strings. A blank death field is not evidence of a missing death event; it can belong to a living writer. Neither blank fields nor year-only values can be counted as recoverable anniversaries.
- Purely structural capacity is 3342 birth/death slots for 1671 identities, leaving 1045 slots after the 2297 accepted events. This is an upper bound, not a factual inventory of obtainable dates. Filling another 940 would consume almost all remaining slots, including unsupported or inapplicable ones. The held ledger has 1049 rows because it tracks writer fields before identity deduplication.

## Why the remaining fields are held

Source: [held.json](held.json), cross-checked against the existing normalized Wikidata snapshot.

| Reason | Birth | Death | Total |
| --- | ---: | ---: | ---: |
| No referenced exact-day claim | 83 | 385 | 468 |
| Existing precision needs source review | 73 | 35 | 108 |
| No reviewed QID | 52 | 117 | 169 |
| Existing editorial date decision | 196 | 89 | 285 |
| Qualified date needs review | 1 | 2 | 3 |
| Unsupported calendar model | 5 | 3 | 8 |
| Conflicting exact claims or calendar models | 8 | 0 | 8 |
| Total | 418 | 631 | 1049 |

Of the 468 fields without referenced exact-day evidence, 349 have no date statement, 114 have only lower precision, and five have day claims without references. Absence of a statement is not proof that a date does not exist elsewhere.

Only 233 held fields have a referenced day claim in the existing snapshot: 108 precision reviews, 106 protected editorial decisions, three qualified claims, eight unsupported calendar models and eight conflicts. These are candidates for individual evidence review, not ready patches. Even accepting all 233 hypothetically would leave 707 of the additional-1000 objective unsupported by this cache; accepting them indiscriminately would erase existing precision and conflict decisions. For example, the cached review for Francysk Skaryna explicitly retains an approximate birth date because institutional sources disagree.

## Check for an overlooked prepared batch

- `src/data/countries/generated/writers.generated.json` contains 2356 records / 2326 QIDs, all with `editorial.status: draft`. `generated/index.ts` intentionally returns the existing countries without merging this queue. Its metadata `finalCount: 4008` is a historical draft-plus-curated total, not the current public corpus.
- Joining this queue to the current reviewed identities finds 261 overlapping QIDs. Only 61 held fields contain complete-looking dates in the draft or its `reports/generated-writer-facts.json` report: 28 already held for precision review, 25 protected by editorial decisions and eight without exact-day evidence. All eight of the latter are January 1 placeholders whose underlying claims have precision 9 (year), including Kunzang Choden, Maaza Mengiste and Robert Serumaga. They cannot become calendar events. The report's `source-confirmed` label does not establish day precision or authorize publication of draft identities.
- The generated fact-review corrections, fact-review runtime and English-translation overlay contain no `birthDate`, `deathDate` or `dateEvidence` fields. The 57 fact-review batch reports contain no separate structured birth/death patches. The date-bearing legacy corrections are already applied before the R10 patch layer in `src/data/countries/index.ts`; 428 explicitly protected field keys were inventoried, with 285 presently held. They are not an unmerged date overlay.
- The dedicated current evidence file covers 57 candidate QIDs. The dedicated prepared date patch file contains the already accepted 60 patches. The three source-backed precision decisions in `scripts/governance/calendar-reviewed-precision.r10.json` are already included. No additional ready batch of 100 or more verified dates was found in these inspected caches or overlays.

There is no further ready batch to apply from the inspected material. The next defensible work is individual review of the 108 precision cases and selected protected dates, or separately reviewed new writer identities with exact-date sources. It cannot be reported as completion of +1000 on the present evidence. Accepted records, held decisions and all runtime files remain unchanged.

Audit anchors (SHA-256): `audit.json` = `33e33c42c0e5a3b7e388b1f21e004b6cfdf36cd254751da479bfee0f7e504589`; `held.json` = `bdf74c83bcd27d4f937f0f5b36655df293fb1d01b9700f36d1e5f59ee4671393`; `baseline-dates.json` = `4f4e8bf22d5f6e3a05c281a62692038fcd52ec36032acc234b8a8497a450d67d`; generated draft queue = `d8d2611825261d4e459f9b63cad6aaefdf5adaacc21fa0a40eaeda84a5f9147f`; generated facts report = `9a1531f5a968c0f4bb7d577cb12c88199f1a0454bee3f90d97321a669c098b8c`.

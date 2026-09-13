# Wells: exact CMS revision and evidence repair

The owner authorized editorial corrections and publication of the full library. The current CMS record for the 1899 *When the Sleeper Wakes* has a publication lock and three different descriptions. Its two translation descriptions match the project's 20 August checkpoint, but that checkpoint does not establish the original prose author, creation date, or translation direction. The old reviewed local overlay describes different prose and cannot provide provenance for the CMS text.

This repair creates two genuinely new, independently reviewed AI synopses. Both are official-source syntheses; neither is represented as a human translation. Author: `Codex AI /root`, creation date: `2026-09-13`. Independent factual reviewer: `Codex AI /root/security_governance_finish`, review date: `2026-09-13`.

## Editorial evidence

- [Owen Holland, University of Oxford Research Archive](https://ora.ox.ac.uk/objects/uuid%3Af17390d8-6d28-41e3-8be6-a075ea0db593): selected manuscript passages on pp. 8-10 and 13-14 support the long sleep, nominal ownership of half the world, the Council, Ostrog's political manipulation and Graham's later independent alignment. The study distinguishes the 1899 original from the 1910 revision.
- [Broadview Press](https://broadviewpress.com/product/when-the-sleeper-wakes/): the official publisher synopsis supports Graham's awakening in a transformed London and the developing revolution. Its 1897-2100 chronology is 203 years; “two centuries” in the new synopsis is a deliberate rounding.
- The figurehead/agency wording is a restrained synopsis interpretation. No definite ending is asserted. No full reading of the novel or the research paper, human review, or exhaustive plagiarism search is claimed. The reviewer found no distinctive verbatim borrowing from the selected passages.
- RU/EN publication-title evidence is retained from the separately dated 2 September bibliographic review. The Russian display title is corrected from `Когда спящий проснётся` to the exact documented `Когда спящий проснется`; national-catalogue fields are not respelled to fit the previous display. National-record access was not freshly certified in this pass.

The exact new synopsis hashes are RU `cb9830cb0d06ff0770a517537473fde7c9b6d11d9b1889e74204d5f251acdcf3` and EN `838685987575a6866d94b33e33798d2057e3d8f8d1d4c46cfc79d194fd4aeefc`. Both pass the unchanged complete TypeScript Evidence V2 validator against the frozen active registry. The checked-in JSON packet and validation receipt bind the complete before/after content, titles, source metadata, prose and evidence.

## Preservation and transaction

The active `work.description`, CMS lock, identity, URL slug, artworks, editions, external IDs, authorship fields and unrelated metadata stay unchanged. Both complete old translation projections and the previous work title are archived under `work.metadata.wellsEditorialRepair20260913`; the full pre-migration database backup provides the storage-level rollback checkpoint. No original authorship/date is inferred from the old file timestamp.

The new migration installs a service-only RPC for the fixed Wells UUID and exact reviewed packet. Installation alone does not revise content. Stale content, timestamp, lock, registry, incomplete history, altered protected fields or invalid attestation roll back the entire repair. Revision and old-registry attestation share one transaction. The subsequent full-library registry rotation is a separate atomic commit; if that later commit fails, the successfully attested Wells revision remains with its receipt. An exact already-repaired state is a read-only idempotent result.

The SQL attester previously required an EN translated-from hash even for `official-source-synthesis`, contrary to the unchanged TypeScript validator. The additive migration corrects those exact clauses and adds matching origin/method guards; real human translations still require their exact opposite-locale source hash. The published 2 September migration is not edited, and unrelated function code and permissions are preserved.

The default repair command validates only local artifacts. Applying requires the exact `main` SHA, the existing protected production-reconciliation workflow, the pinned Supabase project, a verified encrypted backup and schema restore drill. No success is claimed until the production RPC returns the expected content hash and a valid attestation.

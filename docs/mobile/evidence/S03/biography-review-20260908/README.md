# Biography review and correction boundary — 2026-09-08

This is a bounded S03 correction to the shared bilingual invariants (BIL-022,
BIL-023, BIL-083 and BIL-101). It does not start or accept the full S38 editorial
workflow. The active shared/S03 document route and immutable V12 input remain
unchanged.

Generated English biography text now enters as a draft. Model checks and AI
post-edit records remain provenance; they cannot supply human acceptance.
Existing English profiles take precedence, including drafts and stale profiles
with correction history.

Human and machine translations both require a separately supplied human review
of the exact source and target. The versioned SHA256 contract includes source
writer identity, text, provenance and review state, and target text/provenance.
The historical generation and public-export source hashes keep their original
formats. Machine-assisted text retains its actual method after review.

The selector checks that the source itself is publishable. Missing or changed
source/target revisions make previously accepted translations stale; missing or
withdrawn acceptance returns them to draft. Reconciliation runs after canonical
CMS overrides. Draft/stale content is never automatically promoted and its text
and evidence remain available for correction. The public exporter uses the same
review contract and preserves optional original/post-edit provenance.

Review metadata is an attestation supplied through the trusted editorial path.
Hash checks prove revision consistency; they do not authenticate a named human
or resolve an evidence reference. No real review or approval was created here.
Test attestations are explicitly synthetic and stay in test files.

`result.json` records focused validation and exact inputs. Earlier successful
runtime tests were followed by a targeted correction after review found an
invalid-source case; both receipts are retained. One public-test startup failed
because sandboxed esbuild could not access its config; no tests executed there.
The successful retry did not change assertions to conceal that failure.

Existing authored RU/EN eligibility is measured separately from editorial fact
verification. This change does not translate the remaining biographies, certify
full English coverage, deliver the visual owner correction workflow, or validate
the planned nearly 10,000-book catalog and English edition covers.

The selected browser scenario uses actual App/CSS/catalog/R3F source with injected
Android plugin APIs. Fresh Android/PWA artifact receipts, when present, identify
their own exact build inputs. Neither source/browser evidence nor APK inspection
establishes installed-device, iOS, store, stage or release acceptance.

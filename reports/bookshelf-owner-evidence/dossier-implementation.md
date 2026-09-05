# Editorial dossier V2

The public reader and 3D renderer share finite sections, stable section/block/item anchors, full original paragraphs and link destinations. Existing catalogue descriptions remain compact catalogue material; they are not labelled as newly published CORE/ENRICHED/SIGNATURE dossiers.

The 17 selected works have 34 existing reviewed/verified original descriptions in RU/EN. An overly narrow new URL allowlist initially hid these descriptions. The final adapter accepts their explicitly listed existing primary source hosts while retaining the ownership, human provenance, locale, method and exact-text checks. It presents identity, description, edition details, sources, available journal links and the dossier-only notice. Article body text is not copied. Full link targets remain in the shared data and accessible DOM; canvas presents descriptive titles and source domains.

`materials/canonical-dossier-layout.json` records the final 34 real cases: all descriptions retained, all layouts ready, 7-13 physical pages, no empty sections. This is font-ready source evaluation against the local preview, not a new editorial approval or a deployed CMS certification.

## Publication boundary

- Strict typed finite draft validation, separate per-block rights and translation evidence, content checksums, expiry, revocation, source references and reading-mode filtering.
- BEFORE_READING always has spoiler level NONE. Unknown progress is denied; hidden sections, blocks, items and graph edges are omitted from the payload.
- Authenticated CMS `/library/dossiers` uses the shared compiler. Staff identity comes from the existing session/MFA gate; six ordered human reviews, CAS and an append-only audit precede publication. Edits invalidate previous reviews. Unsaved form changes disable review/publication.
- Design review requires a content-bound browser measurement of every finite variant using the same Source font files, design tokens and pure layout function as 3D. Failed measurement or exceeded tier limits prevents design approval/publication. Human confirmation remains a separate action.
- Drafts, evidence, reviewer identities and the complete variant bank stay in the private RLS table. The anonymous RPC returns one approved document through POST with no-store and a lease of at most 60 seconds; expiry/revocation prevents subsequent responses.
- Hosted full text, quotes, third-party media, downloads and source-article prose reuse remain disabled. Existing article CMS data has no separate source-block reuse approval, so a dossier checkbox cannot authorize reuse. Journal titles and links are available.
- The static build gate rejects dossier drafts, variant banks and leased live dossier payloads in public/dist JSON. There is no raw dossier export or added service-role credential.

## Actual validation

- 24 focused unit/integration tests passed, covering provenance, rights, translations, CAS, forged review stamps, protected content, spoiler boundaries, expired leases, design proof and static delivery.
- `dossier-local-sql.json`: 33 actual PGlite 0.5.8 PostgreSQL checks passed using the real fixed-hash migration plan, existing SHA helper, existing `is_staff` function and synthetic auth/catalogue/prerequisite-ledger foundation. Covers transactional rollback, safe reapplication, receipt/function/permission drift, CREATE, six reviews, PUBLISH, anonymous read, invalid fields, permissions, CAS, tampered text, design proof, expiry and revoke. Review actors/design attestations are synthetic test inputs only.
- 28 focused source contracts passed across the new schema-only planner/workflow, existing production migration plan and content-data locks. Historical production workflows, safety helper and the 35-migration allowlist remain unchanged.
- `dossier-browser-design.json`: actual CMS measurement function in Chrome, nine synthetic variants, six pages each, real local Source fonts, overflow rejected. Public font aliases bind the same bytes that Next bundles under its own names. This does not exercise deployed CMS authentication.
- Public and admin TypeScript checks passed before source freeze; final release builds are coordinated separately. Short-hyphen policy passed. Static audit checked 658 existing JSON files with zero findings; the final production build reruns it.

## Deployment and remaining editorial work

No production database, CMS record, secret, deployment or approval was changed by this work. The additive `20260905_book_dossiers_v2.sql` migration has a separate manual schema-only deployment path in `.github/workflows/apply-book-dossier-schema.yml`, described in `dossier-schema-deployment.md`. Until its approved apply run succeeds, the editor reports unavailable storage and public readers use existing catalogue content.

The new workflow performs no archive publication or CMS content writes. The existing broader reconciliation workflow remains unchanged and independently triggers on some paths such as `package.json`; its broader archive action remains part of the release review. Applying this schema is not evidence that new dossiers have passed human review. New enriched/signature content, rights evidence and human review remain editorial work. None has been invented or automatically marked PUBLISHED.

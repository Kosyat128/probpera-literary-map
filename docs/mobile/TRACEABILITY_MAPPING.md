# V12 requirement-to-stage mapping

`STAGE_REQUIREMENT_MAP.json` maps the exact 342 IDs from the immutable V12 requirement index, including all 107 BIL IDs. It assigns future work and checks; it does not attest implementation, translation quality, native builds, approval, or release readiness.

The mapping uses the shared intake documents (03/03A/03B/03C, 68, 69, 89, 95, 119 and 140) and the S01-routed architecture and schemas (07, 43 and 57). Stage assignments follow the acceptance matrix and routing. Later-stage documents must be read when their stages become active before their detailed artifacts can be implemented or accepted. The dated official-source registry is a verification starting point, not proof that external requirements are current.

## Milestone semantics

- `implementationStages` identifies stages that must produce or materially integrate the requirement's artifacts. `validationStages` identifies stages that must supply the relevant verification evidence. Multiple entries express separate obligations, not alternative ways to pass.
- Each stage in the union creates one milestone, `${stageId}.${requirementId}`. Passing an architecture or implementation milestone cannot pass a later integration, device, localization, legal, or exact-release-candidate milestone. Global `PASSED` requires every milestone to pass with applicable evidence.
- S00 is the accepted repository baseline. It appears in neither stage array: a green Web baseline does not demonstrate all-platform or bilingual acceptance.
- S01 accepts architecture and traceability only. Required specialized examples, provider/legal/package schemas, owner defaults and release-automation state are accepted in their routed stages, not inferred from generic S01 schemas.
- Material changes to source facts, translations, native artifacts, rights, legal versions, configuration or release identity require affected evidence to be revisited. Existing approval must not silently cover changed artifacts.

## Stage allocation

| Stages | Primary obligations |
| --- | --- |
| S01-S04 | Architecture and traceability; shared domain; Web/PWA; native containers and adapters. |
| S05-S08 | Launch; the canonical globe; common interaction design; authenticated and integrity-checked exports. |
| S09-S12 | Stable literary entities; search and collections; offline content; the paid Base Edition. |
| S13-S18 | Customization; backgrounds; Planetka; Child Mode; permitted characters; rights and asset exclusions. |
| S19-S22 | Purchase experience; platform purchase providers; verified entitlements; editorial/admin workflows. |
| S23-S25 | Accessibility, privacy and security; performance; integrated platform parity and regression evidence. |
| S26-S31 | Release candidates and metadata; operations; moderation readiness; reviewer access; exact listing assets; rejection/correction workflow. |
| S32-S35 | Minimal owner inputs and defaults; territory/legal decisions; draft-only automation; intermediate owner handoff preparation. |
| S36-S40 | Bilingual runtime; legal/store/native localization; verified editorial translation; complete English and bilingual QA; final exact-artifact evidence and owner handoff. |

Every S01-S40 stage has both implementation and validation obligations in the map. The S35 preparation milestone does not finish V12: the final bilingual handoff remains in S40. Shared cross-platform requirements retain S25 checks; language-sensitive flows retain S39 checks; exact release, store, legal and owner artifacts retain their S40 checks.

## Bilingual allocation

The JSON contains the authoritative per-ID assignments; the ranges below explain their distinct responsibilities.

| BIL IDs | Allocation rationale |
| --- | --- |
| 001-020 | S36 establishes the RU/EN runtime, stable identity and state, locale selection, messages and formatting. Native strings also reach S37; critical UI and state preservation reach S39; localized Web routing reaches S40. |
| 021-028 | S38 implements editorial units, review, stale propagation, translation memory and correction ownership. S37 covers store metadata translation; S39 checks critical units; final change controls reach S40. |
| 029-046 | S38 verifies names and published titles, aliases, glossary and editorial content against evidence. Search starts at S10 and localized entity identity at S09/S36. Base Edition, mixed-language and correction checks extend to S39. |
| 047-054 | S39 accepts English Child Mode, Planetka and offline/audio behavior after their S11/S15/S16 feature foundations. Child safety, voice and package compatibility require their own evidence. |
| 055-063 | S37 prepares native/store/reviewer/legal/support localization from S26/S27/S29/S30/S33 artifacts. S40 validates exact-RC screenshots, final listings and synchronized public materials. |
| 064-070 | S39 verifies runtime language switching, accessibility, formatting and cross-platform language parity. S40 accepts bilingual guides, approval and zero-programming/translation owner handoff. |
| 071-074 | S38 owns controlled English editorial style, optional reviewed en-GB terminology, distinct adult/child/Planetka tones, and preservation of protected facts and terms. Semantic quality reaches S39; any en-GB variant remains optional, with RU and EN as the two required production locales. |
| 075-082 | S36 implements localized Web URLs and metadata; S37 supplies translated manifest, store and legal surfaces; S38 integrates legal/editorial synchronization. Final discoverability and artifact consistency are checked at S40. |
| 083-093 | S38 validates translation providers, data handling, auditability and literary evidence. S37 covers localized support, child routing, security/deletion/entitlement messages and the first-release push prohibition. S39/S40 validate the weighted quality scorecard and artifact-bound release evidence as specified per ID. |
| 094-095 | S40 accepts actual Russian/English screenshots and final owner materials prepared through S26/S37/S35. Generated mock screenshots cannot satisfy these milestones. |
| 096-099 | BIL-096's release-evidence example is created and validated at S40. BIL-097's provider schema belongs to S38; BIL-098's legal schema belongs to S37 with final S40 consistency. BIL-099 starts signed-export work at S08 and validates the routed locale-package schema and activation at S39. No S01 schema-completion milestone is assigned to these IDs. |
| 100-107 | S38 implements stale/correction workflows and inventories; S39 checks English Base Edition and complete bilingual quality; S40 checks final controls, owner approval and evidence. Locale architecture and parity requirements 103/107 also have S36 milestones. |

## Evidence and authorization boundaries

OMIN-049's machine-readable owner defaults belong to S32 and OMIN-053's release-automation state to S34, with final S40 checks. Their specialized schema/configuration documents are outside S01 routing. Architecture references do not substitute for reading them later.

OMIN-023 is limited to local preparation and draft/dry-run evidence. The user's explicit prohibition on automatic deploy, production submit, release and merge overrides any archive wording that would otherwise trigger a staging deployment. Store automation must retain that boundary.

Signed licenses, legal approval, store-account decisions, bilingual owner approval, signing identities and device/native-build evidence are separate verifiable inputs. A prepared draft or schema-valid blocked example is not approval. Missing external evidence remains open or blocked as appropriate while authorized internal work continues. Neither the mapping nor a green Web test may manufacture an approval, publication claim, native result or translation completion.

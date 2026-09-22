# Literary Planet V12 execution

The active task is the user's V12 bilingual product request, based on canonical
`Kosyat128/probpera-literary-map` main. Preserve unrelated worktrees.

- Read `docs/mobile/AUTOPILOT_STATE.json`, `STATUS.md`, `DECISIONS.md`,
  `BLOCKERS.md` and `NEXT_CODEX_PROMPT.txt` before resuming.
- Run `node scripts/mobile/verify-requirements.mjs` before using the immutable V12 input.
  Use `node scripts/mobile/stage-context.mjs S00` with the actual active stage. Read
  shared invariants and only the routed current-stage documents. The standalone
  prompt is a recovery fallback. Never edit `docs/mobile/requirements/v12/`.
- Russian and English are equal required production locales. AI output is draft
  only. Do not invent human/editorial/legal approval or name/title evidence.
- Preserve the existing LiteraryWorldMap/LiteraryGlobe/GlobeCameraRig and one
  Canvas/renderer. Locale and presentation changes must preserve scene and
  semantic state. Canonical CMS facts, real portraits and flag assets stay shared.
- The user's clarified product contract (2026-09-08) is globe-only application
  home: orange launch -> reveal the live canonical Literary Planet. Search,
  country/writer/work, collection, child/Planetka, settings and optional store
  are controls/panels around that persistent scene. Never use the website's
  magazine homepage, hero, editorial feed or an intermediate menu as app home.
  Preserve public-site chrome in the public site only. A compiled homepage
  wrapper or screenshot of it is not acceptance of the application experience.
- Preserve the approved header, hero, orange/violet brand and antique globe
  defaults from current main. Its typography scope allows the documented open
  Sections/Articles panel and embedded control-row refinements; see
  `reports/master-typography-and-card-geometry.md`. Native imports belong only
  in platform adapters.
- Paid base plus optional non-consumables; SAFE_PAID_BILINGUAL_V1. Child mode is
  local and deny-by-default; no child advertising, tracking or open AI chat.
- No unlicensed protected assets in production builds, manifests, screenshots,
  metadata, downloadable packages or SKUs. Requirements are internal source input.
- No production deploy, Submit, Release, merge, production database writes or
  automatic store mutation. Store automation defaults to local dry-run.
- Stage loop: tests, fixes, regression, evidence, atomic commit, persistent
  checkpoint, next stage. Completion requires evidence, not generated checklists.
- Keep internal implementation gaps separate from external owner actions.
  Never transfer translation/programming tasks to the owner.

<!-- s15-journey-runtime-20260923:begin -->
Latest source c27d50e0: adult literary-journey controls are wired into the actual App, confirmed reader policy, reviewed catalog compiler and canonical country/writer/book navigation. Each acknowledgement requires a newly committed settled view. Same-target resume, collection return, canonical coordinate fallback and mobile sheet completion are covered; semantic progress survives panel/lifecycle changes within the App only.
Validation: 223 focused tests, TypeScript, five actual-App Chrome scenarios and five inspected RU/EN screenshots; source manifest has 1,609 inputs, including 1,591 unchanged protected inputs. PWA 046440f9 and Android-dev f3c9f92d are freshly built and preserved. Installed-device/iOS testing and stage/release acceptance are not claimed.
Evidence: docs/mobile/evidence/S15/journey-runtime-20260923/result.json. Production journey content is empty; the 34 existing dialogue records remain drafts. PLANETKA-003 remains IN_PROGRESS; statuses stay 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Next: persist explicit semantic journey checkpoints with exact profile/route/version/node binding, deliberate resume/reset, truthful failed-write recovery and guarded migration. Prepare independent reviewed RU/EN content without promoting drafts. Do not stop after this checkpoint if authorized local implementation remains.
<!-- s15-journey-runtime-20260923:end -->

<!-- s15-navigation-rebaseline-20260923:begin -->
Latest source ad5c9553: explicitly versioned the eight contextual navigation drafts to payload/source version 2, binding unchanged literal copy to Controls source c5f8e80a. The 14 route records and 12 support records stay exact; all 34 records remain draft and unavailable as reviewed content. Validators compare fixed declarations and never refresh them.
56 focused tests and TypeScript passed on a1; inventory a2 passed after preserving the original a1 SOURCE_BYTES_CHANGED finding. All 1,595 other implementation/test inputs remain exact. Prior 353 reader-policy tests and 2 actual-App cases are retained without rerun. Preserved PWA ec2dd9dd / Android-dev 91837818 were rehashed against original runtime source c5f8e80a; the captured unimported inventory input differs explicitly, with no rebuild/browser run claimed.
Evidence: docs/mobile/evidence/S15/navigation-rebaseline-20260923/result.json. PLANETKA-003 and every stage/criterion status remain unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Next: continue guarded reviewed-dialogue and full literary-journey integration with explicit adult policy, fresh host sources and exact independent review receipts. Keep all 34 drafts unapproved; preserve canonical scene, current catalog readiness, ordinary navigation, semantic progress, explicit resume/reset, reader drafts and truthful save/delete retries. Child profiles, approved text/audio, full journeys, accessibility, installed-device, iOS and release acceptance remain pending. Preserve prior checkpoint history below.
<!-- s15-navigation-rebaseline-20260923:end -->

<!-- s15-reader-policy-integration-20260923:begin -->
Latest source c5f8e80a: optional explicit local adult reader settings now feed confirmed age/reading level into the actual companion journey-admission boundary. Native/Web adapters verify preference readback; pending, failed, cleared or unsupported policy cannot grant admission. App-owned drafts and failed save/delete intent survive panel collapse, collection transitions and background; delete confirmation remains local to each form opening.
353 focused tests, TypeScript and 2 actual-App Chrome scenarios passed on a3; 3 final images inspected. Fresh preserved PWA ec2dd9dd / Android-dev 91837818 bind c5f8e80a. Earlier checks, an incomplete a2 paint capture and intermediate builds remain preserved; built-PWA coverage is offline/download smoke, with no installed-device or iOS execution claimed.
Evidence: docs/mobile/evidence/S15/reader-policy-integration-20260923/result.json. PLANETKA-004 and all stage/criterion statuses remain unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Next: explicitly version-rebaseline the eight contextual navigation drafts whose whole-file Controls source hash changed; preserve all literal RU/EN copy, 14 route records, 12 support records and all draft/no-approval flags. Do not silently refresh hashes in a validator. Then continue guarded reviewed-dialogue/journey runtime integration using current host snapshots; no production reviewed journey, child profile or narration has been enabled. Preserve prior checkpoint history below.
<!-- s15-reader-policy-integration-20260923:end -->

<!-- s15-booky-journey-host-20260923:begin -->
Latest source c8e7a2f4: added an unimported, stateless journey-node admission adapter. It requires exact route/version/checksum/node/host revision, explicit adult policy, current country readiness and ready books for complete work routes, and rereads the same immutable host snapshot after whole-route compilation. No admission is cached; callers must resolve again at interaction time and replace the registry after review changes.
51 host/journey/registry tests and TypeScript passed on a1. All 1,588 prior implementation/test inputs remain exact. Preserved PWA dc0eb6c9 / Android-dev 53a91515 were rehashed against original source 259e93cc; the new adapter is not included, with no rebuild/browser run claimed.
Evidence: docs/mobile/evidence/S15/booky-journey-host-20260923/result.json. PLANETKA-004 remains IN_PROGRESS and all stage/criterion statuses remain unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Next: implement the missing explicit host policy contract before wiring reviewed journeys to App. The adult host currently supplies no exact age or reading level; never invent them or infer them from adult access, locale or behaviour. Keep all 34 RU/EN dialogue records draft. Preserve current navigation/progress, canonical scene and catalog readiness. Child profiles, reviewed text/audio, full journeys, accessibility, installed-device, iOS and release acceptance remain pending. Retain prior checkpoint history below.
<!-- s15-booky-journey-host-20260923:end -->

<!-- s15-catalog-scene-20260923:begin -->
Latest source 259e93cc: application catalog loading/error/recovery retains the same canonical canvas, renderer, camera, scene and recorded resources. Current readiness still gates Booky actions/progress. First catalog failure keeps the original fallback; the public site does not opt in.
TypeScript, 3 actual-App Chrome cases and 4 inspected views passed (a4), including a readable 320px error notice clear of Appearance controls. On mobile the expanded Booky panel has its own retry; the globe retry is checked after explicitly closing that panel. Retry trial clicks prove actionability, not a second HTTP retry. Prior 265 controller tests were retained without rerun. Earlier visual findings and the a2 overlay-related fixture failure are preserved.
Fresh preserved PWA dc0eb6c9 / Android-dev 53a91515 bind this source; PWA coverage is the offline/download smoke, APK checks are local binary/build evidence, not installed-device acceptance. All 83 inherited scene/model inputs and 1,584 protected implementation/test inputs remain exact.
Evidence: docs/mobile/evidence/S15/booky-catalog-scene-20260923/result.json. PLANETKA-005 and all stage/criterion statuses remain unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Next: continue guarded Booky dialogue/journey integration under real current host policy and independent review receipts. All 34 inventoried RU/EN records remain draft; do not fabricate age/reading-level policy or content approval. Preserve scene ownership, truthful readiness, adult semantic progress, explicit resume/reset and offline recovery. Child profiles, reviewed text/audio, full journeys, accessibility, installed-device/performance, iOS and release acceptance remain pending. Retain the historical notes below.
<!-- s15-catalog-scene-20260923:end -->

<!-- s15-booky-catalog-20260920:begin -->
Latest source f3abea82: Booky requires a currently ready country catalog before retained country/writer selections authorize dependent actions or semantic acknowledgement. Loading/error/unknown states suspend those operations; ready offline data still works. Existing progress and deliberate resume remain intact.
265 focused tests, TypeScript, 2 actual-App Chrome cases and 2 inspected views passed. Fresh preserved PWA 13b26073 / Android-dev f6ad1a85 bind this source. The built-PWA case is offline/download smoke; no installed-device or release acceptance. All 86 scene/model protected inputs and 1,584 other tracked implementation/test inputs remain exact. Historical unit-a1 and browser-a2 reproduce the defect; browser-a1 is a separate test-fixture observation error, retained unchanged.
Evidence: docs/mobile/evidence/S15/booky-catalog-readiness-20260920/result.json. PLANETKA-005/008 and all stage/criterion statuses stay unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false. All 34 dialogue records remain draft.
Next concrete step: keep the already mounted canonical globe mounted during application catalog reload, while truthful current catalog readiness continues to gate Booky actions. The existing LiteraryWorldMap readiness condition currently unmounts it during loading/error; initial-load and public-site behavior must stay unchanged. Prove renderer/camera/resource identity and explicit retry behavior. Then continue guarded reviewed-dialogue/journey integration with real host policy and review receipts. Child, full journeys, reviewed text/audio, accessibility, installed-device, iOS and release acceptance remain pending. Preserve the earlier checkpoint notes below as history.
<!-- s15-booky-catalog-20260920:end -->

<!-- s15-booky-navigation-inventory-20260920:begin -->
Latest checkpoint source 3b04e70a: added fixed inventory of 22 existing adult RU/EN navigation and contextual records. With the 12 support records, all 34 remain draft and unavailable through the reviewed-dialogue resolver. The inventory remains unimported by the application.
55 focused tests, TypeScript and the exact-source/copy inventory audit passed. All 1,583 prior implementation/test inputs remain exact. Retained PWA a44b4440 / Android-dev 5c3287a7 preserve source 5e6eb767; new inventory code is not included and no rebuild or browser run is claimed.
PLANETKA-003 stays IN_PROGRESS; all stage/criterion statuses are unchanged. Stages remain 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.
Evidence: docs/mobile/evidence/S15/booky-navigation-inventory-20260920/result.json.
Next concrete runtime step: suspend selected-country/writer acknowledgements and dependent Booky actions while the current country catalog is loading, idle or failed. The Recent History catalog retry can reload a populated archive while retaining selected objects. Preserve cached offline data when countryStatus is ready, all existing progress and explicit resume, general navigation and canonical scene ownership. Prove the regression with controller and actual-App checks, then build and preserve fresh local PWA/Android-dev artifacts. Continue reviewed-dialogue and journey integration afterward only with real host policy and review receipts; the host currently has no exact age/reading-level policy. Never fabricate those values or enable child/narration access. Earlier checkpoint notes below are retained as history.
<!-- s15-booky-navigation-inventory-20260920:end -->

<!-- s15-booky-journey-20260920:begin -->
Latest checkpoint source e59f9be0: guarded canonical journey definitions validate public country/writer/work membership and relationships, exact versioned dialogue, independent review and explicit host policy. The model is unimported; production journeys, child scenarios and age adaptation remain unavailable.
40 journey/registry tests and TypeScript passed. All 1,581 existing tracked implementation/test inputs remain exact. Retained PWA a44b4440 / Android-dev 5c3287a7 were rehashed against original source 5e6eb767; the new journey code is not included and no rebuild or browser run is claimed.
Only S15.PLANETKA-004 and global PLANETKA-004 advance OPEN to IN_PROGRESS. Stage counts remain 3 complete, 12 in progress, 26 unstarted; first unresolved S03.acceptance; releaseReady:false. All former Planetka scope belongs to Booky.
Evidence: docs/mobile/evidence/S15/booky-journey-boundary-20260920/result.json.
Continue S15 by expanding the fixed, unreviewed RU/EN dialogue inventory for the two existing adult navigation routes and contextual guidance. Preserve exact copy provenance, versioned checksums and draft status. Then prepare guarded runtime integration with explicit public-entity, review and host-policy checks; missing or unreviewed content stays unavailable. Preserve all current adult navigation, semantic progress, explicit resume/reset, unsupported-save protection, offline recovery and canonical scene ownership. Do not automatically publish content or infer editorial, child, narration or age-adaptive journey approval. Full literary journeys, accessibility, installed-device/performance, iOS and release acceptance remain pending. S03.acceptance remains first unresolved. Earlier checkpoint notes below are retained as history.
<!-- s15-booky-journey-20260920:end -->

<!-- s15-booky-dialogue-20260920:begin -->
Source 35e01e02: an unwired adult dialogue registry binds exact copy, version, age/context/entities, provenance and independent review receipts. Twelve existing RU/EN offline/error messages remain draft, with no approved production dialogue. Child and every narration-bearing record stay unavailable.
52 focused tests, TypeScript and the immutable-inventory audit passed (a2). All 1,576 existing tracked implementation/test inputs remain exact. Prior PWA a44b4440 / Android-dev 5c3287a7 source and payloads were rehashed with their original 5e6eb767 source identity; the new registry is not imported or included in those artifacts. No fresh runtime/browser build is claimed. Initial static-a1 failed because tests used replaceAll outside ES2020; its original report and contemporaneous successful unit/inventory reports remain preserved.
Only S15.PLANETKA-003 and global PLANETKA-003 advance OPEN to IN_PROGRESS. Stage counts remain 3 complete, 12 in progress, 26 unstarted; first unresolved S03.acceptance; releaseReady:false. All former Planetka scope belongs to Booky.
Evidence: docs/mobile/evidence/S15/booky-dialogue-registry-20260920/result.json.
Continue S15 with guarded, versioned literary journey definitions using canonical public country/writer/work IDs and reviewed dialogue references. Resolve public visibility and precise entity relations before exposing a route; unknown policy, missing or unreviewed content stays unavailable. Keep production journeys draft until content and rights are genuinely reviewed. Then expand the dialogue inventory to existing navigation and contextual lines. Preserve adult progress, explicit resume/reset, offline recovery and all canonical scene ownership. Child profiles, age-adaptive full journeys, reviewed text/audio, installed-device, accessibility, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.
<!-- s15-booky-dialogue-20260920:end -->

# Canonical S00 baseline

Inspected on 2026-09-04; report completed on 2026-09-05. The imported canonical baseline is `e073b21acfea854b3b573aa4613215156957ff38`, tree `188105f692c70865a038292a4d47bc2e8570c723`. The work branch is `codex/literary-planet-v12-bilingual-final-autopilot`.

On resume, root verified newer remote main `0a348bd4202e3fa1558d88183549f7576a361c4b` (#173 admin, #175 database permission, #176 typography). This report deliberately preserves the e073 measurements; refresh affected selectors and fingerprints after rebase before treating it as the current baseline.

The existing site supplies the shared product foundation. `LiteraryWorldMap` lazily mounts `LiteraryGlobe`, which owns the single R3F Canvas, `GlobeScene`, `MuseumSkyDome` and `MuseumStarfield`. `GlobeCameraRig` owns semantic camera movement. The Canvas key is a WebGL recovery generation, not locale. The nine existing editions and default `rand-mcnally-1887` remain canonical.

## Measured corpus

These values came from executing existing runtime selectors, with no network requests or source writes. They are not translation approval or critical-screen coverage scores.

| Existing selector output | Count |
| --- | ---: |
| Countries | 200 |
| Writer-country relations | 1,684 |
| Writer identities, existing deduplication rules | 1,672 |
| Work-title relations / unique title identities | 4,490 / 4,469 |
| Book archive candidates | 9,761 |
| Books accepted by current public gate | 46 |
| Held book candidates | 9,715 |
| Nonempty registered RU/EN interface pairs | 1,211 |
| Accepted English country profiles | 0 |
| Accepted RU / EN writer biographies | 1,684 / 20 |
| Writer relations needing English-name fallback | 689 |
| Article catalog records / English selector matches | 167 / 1 |

The 46 public books all declare English `human-translation` records and have nonempty English title/description. Those metadata values have not independently been re-adjudicated as V12 human evidence. The existing public set is not a declaration of the paid Base Edition.

Accepted Russian biography records report `editorial-original/verified`; the 20 accepted English records report `editorial-original/reviewed`. The generated English overlay is currently empty and automatic profile translation is explicitly paused. An inactive code path promotes two-pass AI output to `reviewed`; it requires a V12 editorial boundary before reuse.

## Shared boundaries to extend

- `src/data/countries/index.ts` exposes the public corpus, pre-quarantine book corpus and editorial recovery corpus. These are distinct views of canonical data, not separate platform databases.
- `src/data/bookArchive.ts` owns work assembly, public book keys and safe navigation back to public writers. Keep its quarantine distinctions.
- `selectWriterBiography`, `selectBookText`, country localization and article localization are existing shared presentation gates.
- `src/utils/literarySearch.ts` already provides normalization, Russian/English token handling, Cyrillic transliteration and ranked matching. Verified aliases should extend that path.
- `InterfaceLanguageProvider` persists the locale, updates the document language and keeps one provider above the app. Route language currently takes precedence over saved preference.
- `src/atlas/atlasExperienceState.ts`, `useAtlasExperience` and App selection state are the existing navigation/scene state owners.

Locale gaps include Russian fallback for unknown English interface keys, zero accepted English country profiles, incomplete English biographies/names/articles, and no established full bilingual app-route contract. The existing dictionary audit only establishes coverage of registered pairs.

The PWA already has registration, connectivity UI and a service worker. Its generated manifest text/shortcuts are Russian. Its bounded opportunistic caches do not constitute English offline/search/audio packages. No native project/config/resources, dedicated Planetka/child-profile or entitlement runtime was found in the scoped path/dependency inventory.

## Locks and build effects

Existing governance declares four scopes: Stage 4 scene ownership, book archive, premium translation/health pipeline, and approved header/hero CSS. Their expected fingerprints and paths are preserved in the JSON. Header, hero, orange/violet brand, antique default, canonical portraits and flags remain user-required invariants. This inventory does not issue fresh owner or editorial approval.

`npm run build` first exports configured CMS content and can rewrite generated snapshots/assets. `build:from-snapshot` still regenerates catalogs, modern textures, book mentions and static pages. The parent's domain build used `CMS_SNAPSHOT_PREEXPORTED=true`. Admin build also regenerates its catalog. Deployment scripts were not executed.

The JSON contains **67 SHA256 file hashes from git HEAD bytes**, including all twenty edition texture assets. Runtime-selector inputs have a separate worktree digest over 301 files (10,244,294 bytes): `1a638a42f3b87c4add64f9a45d0d6215946ec249f8a2f30f09a286a742c6038e`. No selector input had a tracked git change at capture. This separates newline/build rewrites from canonical source identity.

## Validation and scope

Root reports 501 passing test files / 2,912 passing tests, with two files / three existing skips; two browser identity tests; successful domain, SEO and admin builds. The root's logs own those results. This agent independently completed source integrity/routing checks and selector computation, and did not rerun the expensive regression.

Narrow regression entry points are listed in `canonical-inventory.json`: requirement integrity/routing, scene/camera/edition ownership, locale selectors, archive gates, interface audit, the English pause contract and service-worker behavior. Exact RC native/device tests and full locale-state preservation remain separate acceptance work.

The verifier review found no remaining actionable issue after the independent input pin was added. See `VERIFIER_REVIEW.md`. Generic manifest integrity is not evidence that every product requirement is implemented.


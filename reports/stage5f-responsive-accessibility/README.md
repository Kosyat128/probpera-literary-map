# Stage 5F - responsive, loading, performance and accessibility

## Checkpoint

- Branch: `perf/home-stage5f-responsive-accessibility`
- Base: `3a30aaf74c4f6499f0a80f6590752ebd1096b358`
- Target checkpoint: `stage5/integration`
- Header/Hero owner locks: unchanged; governance hashes pass.
- Content was not removed, rewritten or reduced to satisfy performance limits.

## Implemented

- Globe, country corpus, full book graph, Shelf UI, journal catalog and Global Search are demand-owned by direct address, explicit intent or near-viewport activation.
- Stable semantic shells reserve the Globe, Shelf, Journal and Search layout, expose truthful `idle/loading/error/ready` states and provide retry actions.
- `?book=…`, direct hashes, browser history, Writer work actions and Book-of-the-month activate only the data/runtime they require and preserve normal scrolling.
- Header Global Search and Shelf Global Search reuse one keyed index Promise/object; local Shelf suggestions do not load the article catalog.
- Search failures are not rendered as empty results. Locale/archive revisions cannot display a stale index.
- One App-owned book array is shared by Shelf and Global Search.
- Supabase SDK loading is moved out of the initial module graph while auth, diagnostics, ratings and comments preserve fail-safe behavior.
- 3D cover decoding uses a bounded shared LRU Promise cache; duplicate decorative raster owners were removed without lowering source quality.
- Coarse-pointer controls are at least 44×44 px in scoped control families. Mobile/200% reflow rules do not hide global overflow or alter locked Header/Hero/Globe/Shelf art direction.
- Fixed dialogs remain viewport-owned; Search loading and ready dialogs trap focus, lock page scroll and restore the original opener.
- Vite's preload helper is isolated from lazy Three.js, preventing accidental initial Three preload.

## Performance evidence

Fresh production build: PASS (`1082` modules).

- Initial module/modulepreload/CSS gzip: `215462 / 307200` bytes.
- Initial references: `4 / 4`, all resolved under configured site base.
- Initial Three.js: `0`.
- Initial BookArchive/Shelf UI: `0`.
- Initial full book catalog: `0`.
- Initial full search catalog/index: `0`.
- Production files: `2218`; all existing image, cover, portrait, texture and JS budgets pass unchanged.

## Verification

- Changed-area Vitest: `11 files / 53 tests`; after restoring the Header owner lock, focused governance/loading rerun: `2 files / 11 tests`, PASS.
- Search/performance fixtures: `3 files / 29 tests`, PASS.
- Responsive/Supabase/engagement focused checks: PASS.
- TypeScript `--noEmit`: PASS.
- `git diff --check`: PASS.
- Production build: PASS.
- Performance audit: PASS.
- Desktop browser smoke: homepage/no horizontal break, shared Global Search, lazy Globe/WebGL - `3 / 3`, PASS.

The full RU/EN, 360/768/1440/1920, zoom, reduced-motion, Shelf/Catalog/collections/inspection and owner-lock matrix remains the dedicated Stage 5G certification block, not an unmeasured claim in this checkpoint.

STAGE 5F RESPONSIVE PERFORMANCE AND ACCESSIBILITY: READY FOR REVIEW

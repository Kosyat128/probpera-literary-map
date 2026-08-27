# Stage 5D-3 — virtual shelf and spatial library

Status: **PASS / READY FOR NEXT SUBLEVEL**.

## Delivered

- One lazy, demand-rendered Canvas consumes the complete filtered archive while
  keeping a bounded live pool: `21/17` desktop, `13/11` tablet and `9/7`
  mobile (`quality/economy`). Catalog and page navigation remain fixed at 13.
- Slots are stable and finite. First/last positions do not wrap; keyboard,
  wheel/trackpad, touch swipe, Home/End, PageUp/PageDown and an accessible
  progress rail use the same controller.
- The selected inspection book may use only its allowed exact cover. It is
  contained without crop, stretch or tint; unsafe cross-origin URLs fail
  closed; stale async assignments are cancelled and disposed.
- Procedural fallback bindings have eight deterministic text-cover layouts and
  deterministic era/audience presentation profiles derived only from verified
  archive fields.
- Spatial Layer B/C uses bounded instancing, architecture, depth, fog and a
  cheap physical floor. `HIGH/BALANCED/ECONOMY` profiles share the existing
  Three vendor. No postprocessing or continuous background animation was added.
- Hidden tabs switch the persistent Canvas to `frameloop=never`; visible idle
  stays on demand; offscreen content does not mount the lazy renderer.

## Verification

- Focused integration suite: **7 files / 46 tests passed**.
- Review-follow-up suite: **4 files / 37 tests passed**.
- TypeScript `--noEmit`: passed.
- Production Vite build: passed.
- Production performance budget: **PASS, 12/12 measured limits**.
- Desktop/mobile production preview: one Canvas, zero horizontal overflow,
  idle and inspection phases passed; no audio elements.
- `git diff --check`: passed.

## Recorded budget measurements

All local build numbers are diagnostics, not replacements for the SHA-bound
Stage 5A production artifact.

| Item | Stage 5D-3 local build | Stage 5A production baseline | Delta |
| --- | ---: | ---: | ---: |
| Initial/main JS raw | 638,503 B | 682,305 B | -43,802 B |
| Initial/main JS gzip | 149,699 B | 156,780 B | -7,081 B |
| CSS raw | 371,325 B | 324,296 B | +47,029 B |
| Lazy BookArchive chunk | 189,447 B | n/a | isolated |
| Lazy shelf entry chunks | 2 × 4,350 B | n/a | retry entry shares code |
| Shared shelf renderer | 41,684 B | n/a | lazy |
| Shared Three vendor | 1,095,942 B | one vendor | no duplicate vendor |

- Total dist: `114,983,980 / 115,081,216 B`.
- Dist excluding book covers: `75,408,814 / 75,497,472 B`.
- Cold software-WebGL desktop readiness: `9,281 ms`; warmed independent mobile
  readiness: `3,518 ms`. Both include the archive route/data load.
- Runtime scene bounds: at most 21 foreground books plus 104 instanced
  midground books, 8 instanced shelves and 16-or-fewer architecture instances.
  The environment itself is six material draws; foreground draw count is
  bounded by the slot pool and selected-book LOD.
- Texture cache: procedural textures are bounded by the live slots; a real
  cover is loaded only for the selected inspection book; generation guards
  dispose stale assignments. No 10k-cover preload or new derivative storage.
- Source-estimated worst-case GPU texture residency is approximately 210 MiB
  on HIGH during selected inspection and below 20 MiB on ECONOMY. This is an
  upper bound including mipmaps, not a runtime allocation trace.

Visual evidence and raw measurements are in `browser/`.

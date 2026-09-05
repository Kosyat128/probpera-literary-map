# Current-main canonical delta

Captured 2026-09-05. Historical intake: `e073b21acfea854b3b573aa4613215156957ff38`; parent-verified main: `0a348bd4202e3fa1558d88183549f7576a361c4b`; rebased S00 head: `14586b08d9901429050aee2d6f1a77195aebf433`. The historical inventory remains unchanged. [Machine-readable evidence](current-main-canonical-delta.json) contains exact Git trees, SHA256 hashes and changed/unchanged path scopes.

61/67 previously hashed canonical files are byte-identical to main. Changed files: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `scripts/stage5-baseline-registry.mjs`, `package.json`, `package-lock.json`. The scene/Canvas/camera files, atlas state, country/writer corpus, book/publication selectors, biography/article/country locale selectors, interface dictionary/CMS copy, registered textures and PWA entry points remain unchanged. App composition, CSS/typography, calendar presentation and admin publication/editor behavior changed upstream. The rebased S00 source delta from main is listed separately in the JSON.

The existing aggregate counts (200 countries, 1,684 writer-country records, 46 public books, 1,211 dictionary pairs; zero accepted English country profiles, 20 English biographies and one English article) are **historical selector results**, conditional on unchanged actual inputs and execution settings. Listed selector source scopes are unchanged. This report did not rerun selectors or recompute the complete 301-input fingerprint while npm ci was active. Selected React/R3F/Three/esbuild lock entries are compared explicitly; installed package bytes remain outside this check. Counts do not establish bilingual production coverage or editorial approval.

## Accepted upstream presentation scope

The upstream [typography report](../../../../reports/master-typography-and-card-geometry.md) records preservation of both Header bands and the complete Hero, with a narrow owner exception for the **open Sections and Articles panels** (lines 7, 17, 49). It separately records rearrangement of existing embedded globe controls (line 52). Preserve these accepted main changes and existing node identities. Root's subsequent AGENTS.md worktree update explicitly incorporates these bounded exceptions and links the upstream report; its raw worktree hash is recorded separately from head14586. Review found no scope conflict. No additional redesign or production authorization is inferred.

## Verification boundary

This check used Git objects and Node built-ins only: no dependencies, source imports, builds, tests or production actions. Previous green suites and screenshots retain their original e073 provenance. Root owns current-main regression, type/typography audit, affected browser checks and admin validation. Upstream screenshots are useful inherited evidence and do not satisfy future RU/EN exact-RC screenshot acceptance. Existing translation, native/PWA package and owner-approval gaps are not closed by this source refresh.

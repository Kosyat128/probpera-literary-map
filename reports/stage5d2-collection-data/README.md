# Stage 5D-2 collection data and private sync

Status: **COMPLETE IN SOURCE - ready for the next Stage 5 sublevel**.

## Result

- Preserved the existing `reader_favorites` contract and the
  `saved` / `reading` / `finished` reading states.
- Added the versioned `BookCollection`, `BookCollectionItem`, and separate
  favorite-membership model without duplicating archive metadata.
- Added the four derived system shelves, validated smart filters, deterministic
  first-login merge, stable manual order, and explicit conflict reporting.
- Replaced active smart-shelf writes to unbounded `localStorage` with bounded
  IndexedDB storage, a coalescing offline queue, and cross-tab notifications.
- Added private Supabase collections, items, and favorites with forced
  owner-only RLS; anonymous access is revoked and public sharing remains
  intentionally deferred.
- Wired the existing smart-shelf control and the explicitly labelled
  `Избранное` action to the new data layer. The completed 3D shelf was not
  rewritten.
- Added the migration to the guarded SHA allowlist and updated the production
  reconciliation contract from 14 to 15 ledger entries.

## Verification

- Focused Stage 5D-2 suite: **5 files / 27 relevant tests passed**.
- TypeScript `--noEmit`: passed.
- Migration SHA-256:
  `b8f7e004e0c094e67bfc1d3aa5f50071cdc7ad32a7718969666717ba8dc199e4`.
- `git diff --check`: passed.
- No full build, full test run, E2E run, browser capture, dependency install, CI
  run, or production deploy was performed for this data-layer block.

An earlier broader selection exposed one pre-existing production-plan assertion
whose backup-workflow regex assumes LF while the checked-out unrelated backup
workflow uses CRLF. The focused Stage 5D-2 plan assertion and all new contracts
pass; that unrelated backup workflow was not changed as part of this block.

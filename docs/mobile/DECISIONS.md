# V12 decisions

- 2026-09-04 / D001: The current user request is the authority for this task.
  V12 binding files are supplied product requirements. Their original bytes remain
  unchanged; amendments and verified official-source differences belong here.
- D002: Canonical base is remote main e073b21acfea854b3b573aa4613215156957ff38.
  Create an independent local clone because the existing checkout is dirty and
  shares Git metadata with other tasks. Preserve all existing worktrees and PRs.
- D003: Use the requested branch codex/literary-planet-v12-bilingual-final-autopilot.
  No deploy, merge, store submission/release, production writes or paid actions.
- D004: Preserve header/hero visual locks, antique default and one existing globe.
  The new V12 scope supersedes the older English-paused release scope; this does
  not authorize publishing unreviewed machine output or deleting prior evidence.
- D005: Node 24/npm 11 remain the repository contract. Keep exact package lock.
  Newer tooling is adopted only for a verified compatibility or quality need.
- D006: Requirement source files are exempt from editorial punctuation rewriting
  and Git newline conversion. A pinned SHA256SUMS digest and full file-integrity
  check replace punctuation lint for that exact immutable directory.
- D007: Language readiness is not inferred from the existence of two catalogs.
  Human/editorial/legal approval, runtime tests and exact-artifact evidence remain
  separate gates. Missing English translations remain internal work.
- D008: Store/native policy snapshots are dated evidence. Directly retrieved
  official requirements take precedence; partial or unavailable sources remain
  labelled, never converted to PASS. Recheck at RC and before any authorized upload.
- D009: On resume current remote main advanced to 0a348bd4 (#173, #175, #176). Preserve the e073 baseline evidence as historical, checkpoint S00, rebase locally and rerun affected baseline checks before S01. This is not a production merge.

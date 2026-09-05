# CODEX CONTEXT ORCHESTRATION — V12

## 1. Problem

The archive is intentionally comprehensive. Reading the full standalone
prompt repeatedly wastes context and usage.

## 2. Initial read

Read only:

1. MANIFEST.json.
2. 03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt.
3. 03A_MODERATION_READY_EXECUTION_OVERLAY_RU.md.
4. 03B_OWNER_MINIMAL_FINAL_OVERLAY_RU.md.
5. 68_REQUIREMENT_ID_INDEX.csv.
6. 69_STAGE_ACCEPTANCE_MATRIX.csv.
7. 95_STAGE_DOCUMENT_ROUTING.json.
8. Stage 0 routed files.

The standalone full prompt is a recovery fallback, not a second required
read after modular files.

## 3. Stage read rule

Before each Stage:

- read shared invariants;
- read only routed documents;
- inspect relevant source files;
- use requirement IDs;
- update state/evidence;
- do not load unrelated catalogs in full;
- use searches/queries to locate exact entries.

## 4. Session resume

Read:

- AGENTS.md;
- AUTOPILOT_STATE.json;
- STATUS.md;
- DECISIONS.md;
- BLOCKERS.md;
- NEXT_CODEX_PROMPT.txt;
- current Stage routing;
- changed repository files.

Do not repeat full audit unless the base/main changed materially.

## 5. Document hashing

Copy package to:

`docs/mobile/requirements/v12/`

Record:

- original archive hash;
- per-file hashes;
- load order;
- package version;
- current Stage document subset.

Never silently edit the original requirement copy. Amendments go into
DECISIONS.md with owner reference.

## 6. Compact evidence

Every Stage creates:

- short human summary;
- machine-readable result;
- links to detailed logs;
- no pasted megabyte logs in STATUS;
- no duplicated screenshots.

## 7. Test budgeting

- unit/narrow tests after each change;
- boundary tests after feature block;
- full platform gate at checkpoints;
- full moderation gate only at S28+ or material release changes;
- reuse unchanged valid evidence when exact inputs/hash match.

## 8. Stop/resume guarantee

Before session end:

- commit complete safe work;
- record dirty files if commit impossible;
- record first next command;
- record current failure;
- record tested hash;
- record routed docs for next Stage.

The next session starts without asking owner to re-upload old prompts.

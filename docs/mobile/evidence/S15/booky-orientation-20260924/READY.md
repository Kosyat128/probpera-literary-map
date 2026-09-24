Prepared D186 helpers only. No repository edits, configure, tests, builds or cleanup execution were performed by this preparation task. The final fixture hash was checked only after root confirmed source freeze.

Base checkpoint: `5feb4e41b7d6b0c528cf90c0df48c7b33db82463`. Prior source: `a965e043eee6c778f37215f236db5a52272a91ed`. Prior result: `docs/mobile/evidence/S15/booky-touch-reset-20260923/result.json`. Prior manifest: `38b1b6058b5d9d5683a860164820c46ee06a87516842ab4491a00223934b705d`.

Required scope is 154 unit cases, 13 browser cases and 47 captures, with five modified files and no new source files. These are expected counts, not execution results. Scope preserves all D185 assertions and adds the ten final orientation flags to each existing RU/EN mobile dock scenario. `sourceFrozen` and `browserContractComplete` are true. Final fixture SHA256 `3c7339dc9d192e7687ce1a8215ca8aa6aaed1b1c954ee77c57de84d7d4628913` was verified after confirmation; all 13 prepared files are frozen.

After scope freeze, root can invoke the standalone copier from the repository:

```powershell
& 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-orientation/staging/copy-helpers.ps1'
node docs/mobile/evidence/S15/booky-orientation-20260924/configure.mjs 5feb4e41b7d6b0c528cf90c0df48c7b33db82463
node docs/mobile/evidence/S15/booky-orientation-20260924/check.mjs unit a1
node docs/mobile/evidence/S15/booky-orientation-20260924/check.mjs static a1
node docs/mobile/evidence/S15/booky-orientation-20260924/check.mjs browser a1
```

The copier authenticates every helper against `prepared-files.json`, preserves all three original cleanup receipts, refuses an existing destination, and creates a byte-copy receipt. It does not configure or run tests.

After successful checks and committing frozen source, replace `SOURCE_SHA` with its exact SHA:

```powershell
node docs/mobile/evidence/S15/booky-orientation-20260924/build-pwa-a1.mjs SOURCE_SHA
& ./docs/mobile/evidence/S15/booky-orientation-20260924/build-android-a1.ps1 -expectedSource SOURCE_SHA
node docs/mobile/evidence/S15/booky-orientation-20260924/preserve-android-a1.mjs SOURCE_SHA
node docs/mobile/evidence/S15/booky-orientation-20260924/checkpoint.mjs SOURCE_SHA a1 a1 a1
```

Process-local Git environment ownership is inherited for PWA build, Android build and standalone preservation. All attempts, stdout/stderr and real process exits remain distinct. No global Git config is changed.

`requireDiagnosticHistory:true`: create a compact `diagnostic-history.json` with original a1/a2 refs and classifications, not inline copies of hundreds of source records. Each attempt needs `report`, `execution` (or `executionEvidence.record`), `executionEvidence.stdout`, `executionEvidence.stderr` and a numeric `executionEvidence.nodeExit` (or `exitCode`). `sourceEvidence`, `attachment` and `proof` refs are checked when present. The checker authenticates the original execution JSON and compares its real exit with the ledger; proof.nodeExit is also compared when provided. Optional `priorResult` or `retainedPriorHistory` are authenticated refs with original attribution. D185/D184 attempts must not be relabeled as D186.

Visual review remains a focused subset bound to the final source manifest and exact PNG bytes. All captures are authenticated. The selected review declares `inspectedCount`, `totalCapturedCount`, scope and limitations; no claim that all prior images were viewed again. Model photos remain attributed to their original source.

After directly opening the four final `booky-rotation-landscape-{ru-844,en-640}` and `booky-rotation-reset-{ru-390,en-320}` PNGs, the reviewer writes an external JSON receipt with `sourceCommit` and four `images` entries (`path`, exact `sha256`, `inspected:true`, `method:"direct-view_image"`, `reviewer`, nonempty `findings`). Nothing declares those images inspected in advance. Then run:

```powershell
node docs/mobile/evidence/S15/booky-orientation-20260924/record-visual.mjs SOURCE_SHA ABSOLUTE_DIRECT_REVIEW_RECEIPT
```

The visual helper selects the exact four PNGs from formal source-evidence attachments and verifies byte hashes and dimensions against the actual review receipt. After checkpoint creates its successful result, `node docs/mobile/evidence/S15/booky-orientation-20260924/finalize-notes.mjs` adds the corresponding bounded D186 note to AGENTS.

Root has already completed the verified cleanup of only the two named, D:-preserved D184 runtime duplicates: 151,622,227 bytes. Original preflight, deletion intent and deletion receipts remain in staging for copying. Do not repeat cleanup.

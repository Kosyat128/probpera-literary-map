# Portable M07-T05 evidence

This is evidence attached to the canonical `docs/CODEX_ADMIN_EXECUTION_STATE.md`, not another checkpoint. The admin work remains unfinished.

The archive preserves immutable capture382, the separate one-file caller supplement, focused SAME proofs and their executed source copies/raw reports, current T01 compatibility reports, the 254-case page harness, isolated native SQL receipts, contracts, source fingerprint, protection proof, and continuation runners. All archive names retain their repository-relative `.tmp/` paths. Fourteen captured fonts are reconstructed from hash-identical tracked checkout assets by the restore script; executable binaries, PostgreSQL data/password files, dependencies, environment files, caches, and screenshots are excluded.

Recorded local focused results: Book 3/16 -> 16/16, Country 5/17 -> 17/17, Review 28/34 -> 34/34, caller 0/2 -> 2/2, current T01 Book 19/19 and Country 39/39, page harness 254/254, source protection 1393 checks, and isolated SQL 29 checks. Book/Country BEFORE uses the immutable capture; Review BEFORE is the newly added review implementation before its follow-up corrections. The separate caller comparison changes only its captured caller. These records do not establish authenticated or production acceptance.

The frozen source fingerprint is `62b00fe41d04d4dbc11f1e911ec91bfa926235fc6e487bbeadce9968f6c008a4` (246 files). The 197-file global test run and build/static gates were interrupted: partial logs have no terminal command receipts or aggregate proof. They remain **not verified**; no complete global PASS is claimed. Writer biography is a source-only finding with zero runtime tests and remains the next reproduction/fix item.

On the other computer, clone the saved branch, install its locked dependencies, then optionally restore historical evidence from the checkout root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/admin-r3-evidence/2026-10-09-handoff/restore-evidence.ps1 -RepositoryRoot (Get-Location).Path
```

The script checks ZIP/member hashes, writes only listed `.tmp/` files, and preserves any existing differing artifact. Default CURRENT test execution uses current maintained code without historical captures. Historical BEFORE comparisons and the archived continuation runners need the restored capture/manifest inputs. Native SQL receipts can be inspected without PostgreSQL; native replay requires separately supplied PostgreSQL tools, and runners retain historical machine/HEAD/branch checks.

The historical 197-file selection also contains six independent Telegram changes excluded from the admin commit. To reproduce that exact test snapshot, first review the separately retained patch and apply it explicitly in a disposable worktree:

```powershell
git apply --check docs/admin-r3-evidence/2026-10-09-handoff/independent-telegram.patch
git apply docs/admin-r3-evidence/2026-10-09-handoff/independent-telegram.patch
```

Its SHA256 is `fba9551c2a131fd04dbf6ed04127c907bf3bbcf520ed3ed0241475877ff64122`. Recompute a fresh current-commit source identity and use new output labels before rerunning interrupted checks; historical receipts and source manifests remain immutable. The historical freezer/protection runners pin the pre-save HEAD, so they are not current-commit acceptance commands.

`manifest.json` lists every archive member and hash. `verification.json` records packaging/extraction checks and path-only secret-pattern scan results. `omitted-references.json` inventories historical, directory, dependency/tool, and missing terminal-proof references; earlier proof chains are intentionally partial. Auth/environment values must be configured separately on the new computer. The original task package is saved alongside this evidence at `docs/admin-r3-task-package/`.

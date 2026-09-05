# S00 requirement verifier review

Reviewed on 2026-09-05: `scripts/mobile/requirements.mjs`, its tests, and both CLI callers. Exact reviewed file SHA256 values are recorded in `canonical-inventory.json`.

**No remaining actionable correctness findings for the pinned, flat V12 input path.**

The earlier version verified only internally consistent package hashes. Root added the independent `V12_INPUT_PIN.checksumFileSha256`; both `verify-requirements.mjs` and `stage-context.mjs` now pass it. Because the pinned checksum list includes MANIFEST.json and routed documents, a coordinated document/manifest/checksum rewrite is rejected. The added test covers a mismatching independent pin.

The implementation rejects traversal/absolute/backslash paths, case-insensitive duplicate checksums, missing/changed files, manifest byte/hash mismatches, unregistered top-level input, and overlapping or missing stage routes. It resolves file targets within the input root and rejects non-regular leaf files. Tests exercise integrity failure, missing/unregistered input, path validation and route overlap.

Scope limits: this is a verifier for the known flat archive, not a general recursive package format or factual validation engine. Passing hashes do not prove editorial/legal approval or stage acceptance. The full test run is owned by root; no source or test files were modified by this reviewer.


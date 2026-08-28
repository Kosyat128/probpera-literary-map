# Stage 5D-6 certification evidence

This package is the deterministic, non-browser gate for the Stage 5D-6 Shelf
certification. It is deliberately fail-closed: a missing governed source,
missing required contract, forbidden audio path, helper execution failure, or
budget breach produces `status: "FAIL"` and a non-zero CLI exit code.

## Run

Print JSON metrics without changing the working tree:

```bash
node scripts/audit-stage5d6-certification.mjs
```

Write the same payload to `reports/stage5d6-certification/metrics.json` for a
final evidence snapshot:

```bash
node scripts/audit-stage5d6-certification.mjs --write
```

Focused contract test:

```bash
vitest run scripts/audit-stage5d6-certification.test.mjs
```

## Static contracts

The audit checks the actual Shelf-owned sources for:

- `HIGH`, `BALANCED`, and `ECONOMY` quality profiles;
- the 32 desktop / 16 mobile-or-economy Shelf texture budgets and one selected
  high-resolution texture;
- demand-driven Canvas rendering, hidden-page pause, and no always-on loop;
- `webglcontextlost` fallback and `webglcontextrestored` recovery;
- mobile detail `collapsed`, `half`, and `expanded` states, axis lock, and
  reduced-motion-safe transitions;
- the integrated search combobox and the semantic Shelf live region;
- near-viewport/lazy Canvas mounting with direct-book activation;
- absence of audio APIs, elements, and audio assets in Shelf-owned runtime
  sources.

## Deterministic datasets

The audit bundles and executes the repository's own
`resolveBookShelfQualitySettings`, `selectCompleteShelfWorkingSet`,
`createBookShelfTextureLru`, and `touchBookShelfTextureLru` helpers. Logical
datasets of `1`, `7`, `12`, `100`, `1000`, `current`, and `10000` books are
exercised under all three profiles. `current` is built from the real canonical
corpus with `buildBookArchive(bookArchiveCountries)`, deduplicated by the live
archive key, and recorded with both raw and logical counts. The JSON records
reachable first/middle/last anchors, working-set peaks, LRU
retention/evictions, resolution tiers, and every budget assertion.

This gate does **not** claim browser/GPU timings, CLS, frame-time plateau, live
service-worker behavior, or visual reference fidelity. Those remain browser and
production evidence in the final D6/5G/5H matrices; no PASS is invented here.

## Browser smoke evidence

The final production build was also opened once in system Chrome with reduced
motion at `1440 × 1000` and `390 × 844`. Both Shelf views mounted a WebGL canvas
without page errors or horizontal frame overflow. A random work was opened in
each viewport; desktop rendered the side detail panel and mobile settled the
detail sheet in its `half` state. The captured evidence is stored beside this
report as `visual-desktop.png`, `visual-mobile.png`,
`visual-desktop-selected.png`, and `visual-mobile-selected.png`.

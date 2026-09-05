# Physical bookshelf browser evidence

Run from the repository root with the local production preview already running:

```powershell
node scripts/audit-bookshelf-physics.mjs http://127.0.0.1:4185/
```

The full run exercises desktop 1440x1000 and mobile 390x844. It checks real first, middle and last spine clicks, selected-book bounds inside the measured unobscured canvas, minimum physical book size, forward and backward page drags, native pointer cancellation, latest click while the shelf is moving, 50 desktop open/close cycles and 100 desktop page turns. It waits for actual demand frames to finish (bounded to 5 seconds), then requires zero draw calls while idle. Resource counts compare live WebGL objects before and after closing; created and deleted counts are retained separately.

The observers are injected by Playwright into the audit page. The production application exposes no test globals. Projected hit targets and physical bounds come from the actual Three.js objects and camera, rather than assumed screenshot coordinates. Screenshots and the JSON report are saved in physics-after. --smoke uses two open/close cycles and four page turns; it is not the full stress result.

The unchanged pre-work production build was measured with:

```powershell
node scripts/audit-bookshelf-physics.mjs http://127.0.0.1:4184/ --baseline
```

Its physics-before report records three real open/close cycles, four page turns and the prior framing/cancel/idle defects. Its oversized working set contains 21 books; only the first spine remains an appropriate visible target for that comparison.

Actual owner-color evidence is separate in materials. physical-row-1720 is the first integrated WebGL capture (failed color gate); physical-neutral-* are explicitly diagnostic browser lighting candidates. The measured neutral-light exposure 0.38 candidate passed CIEDE2000 mean 2.415 / maximum 4.293 across the 17 corresponding cloth regions. Source lighting now retains that calibrated illumination across quality tiers. The final unmodified-build capture must be used for release acceptance.

Status: the full physical workload, corrected latest-intent recheck, all three actual LOD color gates and targeted shader-preparation repair pass are complete. See physics-after/README.md for the measured matrix, source contracts and timings. The original 5-9 second synchronous cold block is documented separately from the final repaired 2248 ms cold preparation including the procedural endpaper (maximum long task 366 ms). Run scripts/audit-bookshelf-first-use.mjs for its bounded reproducible CPU/GPU trace, early cancellation and resource checks.

# Physical bookshelf validation

The physical checks below were measured against the production build at http://127.0.0.1:4185/ on 2026-09-05. The unchanged baseline is http://127.0.0.1:4184/. Source-level guarantees and browser measurements are distinguished explicitly.

| Check | Desktop 1440 x 1000 HIGH | Mobile 390 x 844 ECONOMY | Evidence |
| --- | --- | --- | --- |
| Closed shelf | 17 upright books; all 17 owner slots present | 7-book finite working set; same owner slots | closed-row-1440/390 PNG + JSON |
| First /  middle /  last actual spine click | Correct identity, all 3 | Correct identity, all 3 | physics.json interactions |
| Selected closed book within measured free rect | PASS; height 503.2-505.0 px | PASS; height 142.7-143.5 px in 201.6 px free height | actual mesh bounds + camera projection |
| Selected open book within measured free rect | PASS; height 475.3-534.4 px;73.4-82.5% free height | PASS; height 142.6 px;70.7-70.8% free height | physics.json openFraming |
| Forward /  backward /  native cancel | 0 -> 1 / 1 -> 0 / 0 -> 0, all 3 books | Same, all 3 books | actual physical page pointer gestures |
| Replacement click while moving | Correct latest identity | Not separately measured | latest-intent.json |
| Open /  close workload | 50 cycles | 2 cycles | physics.json openClose |
| Page-turn workload | 100 turns | 4 turns | physics.json pageTurns |
| Idle draw calls over 1.2 s after actual settling | 0 | 0 | injected native WebGL counters |
| Live WebGL textures after closed workload | 63 -> 63 | 35 -> 35 | created/deleted/live tracked separately |
| Live WebGL buffers after closed workload | 369 -> 369 | 182 -> 182 | same |
| Renderer geometries after closed workload | 102 -> 102 | 52 -> 52 | Three.js renderer.info |
| Framebuffers /  renderbuffers | 6 -> 6 / 2 -> 2 | 5 -> 5 / 1 -> 1 | native WebGL counters |
| Console page errors | 0 | 0 | physics.json errors |

The initial full workload used an overstrict harness assertion that required both selection clicks to already occur while moving. Its raw issue is retained in physics.json. The actual first click was IDLE, the replacement was SETTLING, and the replacement identity won. The corrected requirement is that the replacement click occurs during movement/settling. A separate real-browser run, latest-intent.json, verifies IDLE -> MOVING -> latest selected with zero issues. The full 50/100 workload was not repeated for that harness correction.

## Owner reference, construction and detail tiers

The supplied 1720 x 582 owner reference remains immutable. The model uses the exact 17 slot palette, uniform 1.52 high cloth binding,0.022 physical gap and no random tilt, leather identity or real-cover artwork on the physical front. The initial finite batch is centred independently of keyboard focus. These are source/model contracts checked by completeShelfModel and bookShelfPhysicalLayout tests; the desktop 17-book photograph confirms the real rendered result.

All three actual rendered detail tiers pass the owner color gate (mean Delta E00 < 4, maximum < 7): HIGH 1440/17 books 2.407/4.266, BALANCED 1024/13 books 2.181/3.986, ECONOMY 390/7 books 2.949/4.299. Their PNGs, projected owner-slot rectangles and color calculations are recorded in closed-row-1440, closed-row-1024 and closed-row-390 files. Diagnostic pre-calibration captures remain in ../materials and are not final acceptance images.

The complete selected rig retains front/back boards, cloth spine, page block, headbands, paper edges, hinge and segmented sheet until the book returns to the row. The selected physical front is procedural. Segmented forward/backward turns, grab-position curl and cancel-to-origin were exercised in the browser; each page uses an upright front, mirrored backside and separately upright under-page texture. Backward turns keep the current page beneath the previous turning leaf.

Dynamic gutter and camera safety are tested mathematically for first/middle/last placement, full swept cover/page bounds, exact row restoration and 3024 projected bound corners across viewport/phase/orbit cases. Those tests are source-level coverage; the browser table confirms the real first/middle/last book remains in the unobscured rectangle. Offscreen/covered rectangles below 64 px retain the last valid camera instead of producing a huge offscreen zoom. The final desktop DOM page-action check also passes: all three buttons are 44 px high, inside the measured free rectangle and hit their own centre. Actual next/previous navigation passed; see final-actions.json and final-actions-1440.png.

## Timing and baseline comparison

| Measurement | Unchanged baseline | Current measured build |
| --- | --- | --- |
| First desktop click to INSPECTION_CLOSED |8068 ms|5488 ms|
| First mobile click to INSPECTION_CLOSED |Not measured|7327 ms|
| Subsequent measured desktop selections |Not separately recorded|640 ms,1616 ms|
| Subsequent measured mobile selections |Not separately recorded|808 ms,490 ms|
| Workload |3 close/open,4 turns|50 close/open,100 turns desktop|
| Closed textures /  buffers growth |52 -> 52 / 298 -> 298|63 -> 63 / 369 -> 369 desktop|
| Renderer geometries growth |83 -> 83|102 -> 102 desktop|
| Idle draw calls |327 in 1.2 s|0 in 1.2 s|

The new construction uses more resources than the baseline but the measured closed workload does not grow them. No total JavaScript heap leak proof is claimed. Camera settling after logical SHELF_IDLE took 1401 ms desktop and 1539 ms mobile in this run, then rendering stopped. The test uses a hard 5 second demand-frame settling timeout.

Before shader preparation, cold opening was slow and is not labelled a performance pass. cold-open-trace.json records loaded fonts and hardware AMD/D3D11 rather than SwiftShader. CPU profiling measured immediate INSPECTION_ENTERING feedback at 131 ms, then one 9099 ms main-thread task, including 9020 ms in native getProgramInfoLog. Post-click network fetches were a 197 ms local cover thumbnail, an 84 ms italic font and a 2 ms logo. The bounded diagnostic A/B in cold-open-no-debug-trace.json shows that disabling shader checks merely moves the block to getProgramParameter (6218 ms); diagnostics therefore remain enabled in production source.

The targeted repair submits the existing hidden inspection materials with Three.js compile and polls only KHR_parallel_shader_compile completion before revealing their surfaces. This uses the same mechanism as compileAsync, with explicit cancellation and a 20 second bound so disposal/context loss cannot leave an internal polling loop alive. The row spine remains visible; no additional canvas, context, material copy or continuous animation loop is created. Actual post-repair timing is recorded separately in shader-warmup-first-use.json after the final build; pre-repair traces remain above for comparison.

The strengthened final run, including the procedural endpaper texture, passes: cold click to closed inspection 2248 ms, initial entering feedback 37.5 ms, maximum main-thread long task 366 ms and maximum 50 ms heartbeat gap 609 ms. Shader diagnostics remain enabled. This is a substantial reduction from the 5-9 second synchronous first-use block; it is not an assertion that cold preparation is instantaneous or that all input delays are below 50 ms. The first warmup prototype that reached its 20 second bound is preserved as shader-warmup-lifetime-diagnostic.json with explicit rejected acceptance.

After native page cancel, next/previous turns and three additional open/close cycles, live Shader objects remain 0 -> 0, Program 13 -> 13, Texture 66 -> 66 and Buffer 371 -> 371; idle rendering is 0 draws over 1.2 seconds. A separate fresh page received three real early Escape inputs during INSPECTION_ENTERING; two landed while all five inspection surface groups were still waiting for shaders. After those cancellations Shader remains 0 -> 0 and Program 13 -> 13. Console and page errors are zero. The cancelled preparation deletes attached shader objects safely without deleting shared programs; unused compiled variants also execute their existing Three diagnostics and first-use cleanup after completion.

The endpaper ornament is visible in the actual WebGL screenshot shader-warmup-open-1440.png. endpaper-1440.png is its native pixel crop, with no recoloring or resampling. The low-contrast diamond lattice and border remain subordinate to the facing text; the screenshot did not justify increasing their opacity. The additional texture is disposed on close, as the unchanged closed Texture counts above demonstrate.

The final closed-row hint also passes at 1440 and 320 px: its complete text wraps naturally into two and three lines respectively, without ellipsis or clipping. The button is 430 x 81.5 px desktop and 268 x 95.7 px mobile, with every measured text rectangle inside it. See final-closed-hint.json and final-closed-hint-1440/320.png. These were two screenshot-only checks; the 50/100 workload was not repeated.

## Reproduction

Run from the repository root while the relevant preview is already running:

```powershell
node scripts/audit-bookshelf-physics.mjs http://127.0.0.1:4185/
node scripts/audit-bookshelf-physics.mjs http://127.0.0.1:4185/ --intent-only
node scripts/audit-bookshelf-physics.mjs http://127.0.0.1:4184/ --baseline
node scripts/audit-bookshelf-owner-physical-colour.mjs ../physics-after/closed-row-1440
node scripts/audit-bookshelf-owner-physical-colour.mjs ../physics-after/closed-row-1024 13
node scripts/audit-bookshelf-owner-physical-colour.mjs ../physics-after/closed-row-390 7
node scripts/audit-bookshelf-first-use.mjs http://127.0.0.1:4185/
```

The Playwright observers and WebGL instrumentation exist only in the audit page. The production site contains no test globals. Eight focused physical unit suites passed 57 tests; the additional shader lifecycle suite passes five tests, including cancellation, disposed handles, unused shader release and bounded driver/context failure. TypeScript passed before this production capture. Final shared CSS/content changes require only targeted visual/actions sanity unless they change physical source.

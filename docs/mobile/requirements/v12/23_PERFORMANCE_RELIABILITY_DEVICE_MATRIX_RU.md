# PERFORMANCE, RELIABILITY, THERMAL AND DEVICE SUPPORT — V12

## 1. Measure first

At Stage 0 record current site baseline and test methodology. At every
release store device/OS/browser/build/content/scene/quality tier.

Targets are budgets, not unsupported claims. If baseline/device makes a
budget unrealistic, document evidence and establish a stricter regression
threshold without hiding the limitation.

## 2. Device tiers

High:
- modern flagship GPU;
- high textures;
- full atmosphere/shadows/3D scene.

Balanced:
- default;
- mobile 2K-ish surface where appropriate;
- optimized full-3D backgrounds;
- controlled post effects.

Economy:
- lower resolution;
- static/2.5D fallback for backgrounds;
- demand frame loop;
- reduced particles/shadows;
- lower anisotropy;
- aggressive optional cache eviction.

Automatic tier can be overridden by adult/parent. Avoid unreliable user
agent heuristics; use capability/performance measurements conservatively.

## 3. Budgets

Track:

- cold/warm start;
- time to minimum UI;
- time to interactive globe;
- median/P95 frame time;
- dropped frames;
- JS/main thread tasks;
- memory/GPU memory proxy;
- texture/decode time;
- binary/bundle size;
- bootstrap/package sizes;
- battery/thermal behaviour;
- network bytes;
- search latency;
- content update time;
- background switch latency.

Initial target guidance:

- minimum UI usable around 3 s on representative mid device;
- warm resume around 1.5 s where feasible;
- 55–60 FPS High/Balanced on supported representative devices;
- stable 30 FPS Economy;
- no unbounded memory growth after 20 minutes/30 switches;
- idle render loop stops unless required.

## 4. Globe runtime

- one Canvas/renderer;
- no React state per frame;
- bounded pointer coalescing;
- latest camera/asset intent wins;
- demand rendering in settled states;
- pause when hidden/background;
- context-loss restore;
- R3F owns renderer sizing;
- no duplicate resize/listeners;
- preserve camera/selection on orientation/resume.

## 5. Asset performance

- responsive textures;
- supported texture compression with fallback;
- limited decode concurrency;
- bounded LRU;
- explicit disposal;
- lazy load screens/catalog;
- no mass preload optional store;
- shader warm-up before commit;
- LOD/lightmaps/light probes for 3D scenes;
- static Economy fallback;
- downloads resumable;
- integrity before activation.

## 6. Reliability states

Handle:

- no network;
- slow/flaky network;
- backend/CDN/store unavailable;
- interrupted download/update/purchase;
- process killed;
- low memory;
- disk full;
- corrupt local DB/package;
- WebGL context lost;
- expired license;
- revoked purchase;
- orientation/multitasking;
- PWA service worker update;
- clock skew;
- locale change;
- OS upgrade;
- app downgrade blocked safely.

No infinite loader. Every recoverable state has retry and safe fallback.

## 7. Device matrix

Cover:

- Android API minimum through current target;
- low/mid/high devices;
- different GPU vendors;
- phones 320/360/390/430 widths;
- tablets 768/1024+;
- iPhone notch/Dynamic Island;
- iPad split view;
- portrait/landscape;
- PWA Chromium/Safari/Firefox support boundaries;
- reduced motion/large text;
- 32-bit not supported if platform/toolchain no longer supports it,
  documented clearly.

## 8. Stress and soak

- 20–30 minute globe interaction;
- 30 skin switches;
- 30 stand switches;
- 30 full-3D background switches;
- repeated mascot/explore transitions;
- 50 background/foreground cycles;
- repeated country/writer selection;
- large search;
- update/download cancel-resume;
- purchase callback restart;
- low-storage and low-memory simulation.

## 9. CI/performance evidence

Create reproducible profiles, budgets and regression gates. Heavy native
profiling may run at release checkpoints, not after every tiny change.
Store evidence with commit/device/version.

## 10. Acceptance

- no growing leak;
- no duplicate Canvas/listeners;
- Economy stable;
- no severe thermal drain during idle;
- content/package budgets enforced;
- context recovery works;
- safe fallbacks preserve product value;
- known unsupported devices documented in store metadata.

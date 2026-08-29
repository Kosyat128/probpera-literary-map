# Stage 5A visual baseline

This directory is the immutable visual evidence package for the Stage 5A
homepage baseline. It records the verified Stage 4 production release before
the Stage 5 visual work begins; it is evidence, not a redesign deliverable.

## Provenance

| Item | Verified value |
| --- | --- |
| Production release | `8c24038510324d00086afe05b8de78b0f09ae52e` |
| GitHub Pages run | `32719497676` |
| Official Pages artifact | `9517505146` |
| Artifact release marker | exact match to the production release |
| Render source | exact official artifact, served read-only over loopback |
| Browser | Chrome `151.0.7922.170` |
| Main JavaScript | `assets/index-ko5WhBaQ.js`, 682305 bytes, SHA-256 `6e843844b8b929ca1200d51a6647406bc169c4ded6333766e3cce02d4023cea4` |
| Main CSS | `assets/index-Cvad-RPW.css`, 324296 bytes, SHA-256 `2317e1bb6354395808e7fe4570783a50232ddac0950b4d75b3675620fcb343ef` |

The artifact identity is also recorded in `capture-session.json`. The local
artifact was used for deterministic rendering because live hashed assets
temporarily stalled in the capture environment.

The final independent root check on 2026-08-24 passed strict TLS validation
(exact wall-clock time was not recorded): `authorized=true`, CN `probpera.ru`,
SAN `probpera.ru,www.probpera.ru`, valid from `2026-08-24 11:34:37 GMT` through
`2026-11-22 11:34:36 GMT`, fingerprint SHA-256
`49:69:0C:C3:52:1B:B9:07:BB:14:96:70:71:47:62:F6:F0:92:E1:22:F1:A6:8B:DA:5D:E0:25:C9:C8:04:FA:CF`.
Cache-bypassing Range GETs for the exact JS and CSS both returned HTTP 206 and
1024 bytes in 752 ms and 718 ms respectively; their full artifact sizes are
682305 and 324296 bytes. The earlier asset stall/certificate mismatch was a
transient event and is resolved; no P1 remained from that event.

## Evidence inventory

The package contains 47 WebP rasters:

- 15 anchor matrices: 11 RU viewports and 4 EN viewports;
- 19 component and feature closeups;
- 13 interaction, responsive, motion, zoom, and forced-colors states.

Every raster was fully decoded with Sharp 0.35.3. All 47 decoded successfully
as WebP. Every matrix width matches its named viewport. Each matrix contains
11 viewport-height anchor frames separated by ten 4 px gutters, so its encoded
height is `11 * viewport height + 40 px`. The complete dimensions and per-file
SHA-256 values are in `manifest.json`.

All 15 measured pages had `scrollWidth == clientWidth`, zero horizontal
overflow, zero failed images, and all 11 expected anchors.

## Interaction-state scope

| Evidence | Status |
| --- | --- |
| Default, hover, active, keyboard focus, expanded menu | MEASURED |
| Empty and selected search results | MEASURED |
| Article-reader loading and opened reader | MEASURED |
| Mobile layout and expanded country sheet | MEASURED |
| Reduced motion, forced colors, and 200%-equivalent reflow | MEASURED |
| RU and EN public book details | MEASURED |
| Error-state content | NOT MEASURED |
| Disabled-state content | NOT MEASURED - no visible disabled control was available in the captured contexts |
| Authenticated Reading Library content | NOT MEASURED - only the unauthenticated account gate is captured |

No write-capable control (save, follow, rating, or account mutation) was
activated. Read-only rating-summary RPC requests were deliberately blocked by
the capture harness.

## Runtime-log classification

Across 32 recorded browser sessions, `pageErrors` and HTTP response errors were
both zero. The session records 38 identical
`net::ERR_BLOCKED_BY_CLIENT.Inspector` console messages associated with the
harness-blocked Supabase RPC, 18 corresponding request failures, and 32
identical service-worker warnings caused by Playwright blocking registration.
After that exhaustive classification, product runtime errors in the recorded
session are 0. The RPC and service-worker entries are harness noise and are not
classified as product defects.

## Files and integrity

- `manifest.json` is the machine-readable provenance, coverage, validation,
  dimensions, byte size, and SHA-256 registry for all 47 rasters.
- `checksums.sha256` hashes every file in this directory tree except the
  checksum file itself, using paths relative to this directory.
- `capture-session.json` is the raw capture record, including measurements,
  browser logs, blocked mutations, and the artifact identity.
- `runtime-computed-styles.json` and `runtime-computed-styles.md` preserve the
  computed-style evidence.
- `capture-additional.mjs` is the deterministic supplementary capture harness.

From this directory, verify the portable checksum list with:

```sh
sha256sum -c checksums.sha256
```

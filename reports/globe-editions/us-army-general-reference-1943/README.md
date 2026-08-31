# General Reference Map No. 1 — globe texture QA

## Result

The 1943 federal world map was analytically reprojected from its three interrupted sinusoidal panels into a canonical 2:1 equirectangular texture. Every production pixel is source-derived. No current coastline, generated detail, recoloring, or synthetic polar cap is baked into the texture.

- Runtime edition id: `us-army-general-reference-1943`
- Overlay contract: `STANDARD_GLOBE_OVERLAY_PROFILE` (full country boundaries and selection geometry are supplied by the runtime, not by the bitmap)
- Texture content version: `sha256-eca2ae835ef2d061` (combined desktop + mobile fingerprint)
- Desktop: `public/textures/us-army-general-reference-1943.webp`, 4096×2048, 1,971,264 bytes, SHA-256 `09418203d87aa85a465e3694e53d33b9893387796db798966197dd19193e36d6`
- Mobile: `public/textures/us-army-general-reference-1943-mobile.webp`, 2048×1024, 525,424 bytes, SHA-256 `020f0808c4c1e0671c05124e836349884d6a204fd635057226106a9b9268d38a`

## Provenance and rights

The sheet is *General Reference Map No. 1*, Manual M-101, November 1943, sheet 1057-G, prepared by the American Geographical Society for the Department of State and published by the U.S. Army Service Forces. The pinned digital scan is David Rumsey Map Collection List No. 6351.015, acquired through Wikimedia Commons. Commons marks the underlying 1943 federal map `PD-USGov-Military`; that status is recorded separately and is not treated as waiving the terms for this particular scan.

The [David Rumsey copyright and permissions page](https://www.davidrumsey.com/about/copyright-and-permissions) permits publication use with the required credit: **David Rumsey Map Collection, David Rumsey Map Center, Stanford University Libraries**. The source page, federal catalog evidence, scan-use evidence, and exact credit are preserved in the manifest and source configuration.

Source: 5491×2641, 1,858,194 bytes, SHA-256 `60cd9e6057f9cb334cf93c9d1394c76754aca7297f7709836bc8dee13deeb6a1`.

## Registration QA

- Digitized 15° graticule residual: RMSE 1.5858 source px (0.1188°), maximum 3.2711 source px (0.2451°).
- Coastline/printed-line proxy at 2048×1024: RMSE 2.3654 px (0.4158° at the equator), p95 4.0 px, 94.26% within 3 px.
- The six calibrated pole apexes have zero analytical residual. Polar rows are a direct reprojection of the printed apex neighborhoods; there is no synthetic fill.
- The overlay preview uses modern Natural Earth geometry only as a QA layer. The production WebP files contain the historical scan alone.

The automated coastline metric is deliberately described as a linework-proximity proxy: labels and historical borders can be nearby strong edges. Inspect `qa-preview-standard-overlay.png` for continental alignment and `qa-preview-graticule.png` for the printed-grid registration.

## Canonical seam measurements

- `wrap-180`: mean 33.0663 → 2.9842, p95 75.5833 → 8.3333, max 182.3333 → 23.0 RGB levels.
- `panel-minus-30`: mean 22.1267 → 0.9454, p95 60.25 → 4.25, max 152.3333 → 20.0 RGB levels.
- `panel-plus-60`: mean 28.6182 → 2.7874, p95 86.9167 → 9.6667, max 185.3333 → 27.0 RGB levels.

The correction is a source-derived multiband feather. High-frequency map detail is retained through the tone band; only the six central desktop columns at each mathematical cut are crossfaded to remove the duplicated printed lobe edge. No fill or modern geometry is introduced.

## Reproduction

Run once with the pinned source already in the ignored cache:

```powershell
python scripts/build-us-army-general-reference-1943.py
```

If the source cache is absent, `--download` acquires the exact Commons original and verifies its SHA-256 before rendering.

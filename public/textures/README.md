# Globe surface provenance

All production textures are served locally. The globe never sends a visitor's
location, pointer activity, or map request to a third-party tile service.

## Antique surface (default)

The antique globe uses a restored spherical projection derived from:

- Rand McNally and Company, *Rand McNally & Co.'s new twelve inch terrestrial
  globe [gores]*, Chicago, 1887.
- Library of Congress Geography and Map Division, digital ID
  `g3201b.ct001417`.
- Source: https://www.loc.gov/resource/g3201b.ct001417/

The Library of Congress describes the item as free to use and reuse. The scan
is a public-domain reproduction of a work published in 1887. The production
texture is rebuilt from the official 6152 × 3006 IIIF scan so that engraved
place names and hachured relief survive the reprojection.

- `antique-world-1887.webp`: 4096 × 2048 desktop texture.
- `antique-world-1887-mobile.webp`: 2048 × 1024 compact texture.

## Real Earth surface

The real-Earth option uses NASA's *Blue Marble: Next Generation* July image:

- Catalog page: https://svs.gsfc.nasa.gov/3487
- Original file: https://svs.gsfc.nasa.gov/vis/a000000/a003400/a003487/earth4K.png
- Original dimensions: 4096 × 2048.
- Original SHA-256:
  `4174334687BA05969E2F99AA2CFAF8B1847995EB525E3C1AFFCA877EAE1E2176`.
- Credit requested by the source: NASA/Goddard Space Flight Center Scientific
  Visualization Studio. Blue Marble Next Generation data courtesy of Reto
  Stockli (NASA/GSFC) and NASA Earth Observatory.

The source PNG was converted without cropping or reprojection. The desktop
asset is WebP quality 84; the compact asset is resized with Lanczos 3 and saved
as WebP quality 82.

- `earth-blue-marble.webp`: 4096 × 2048, SHA-256
  `CC2B9B11FB1CCD4194C612C84320F0EF1AB991F6B247473BE7B51A66F3328C41`.
- `earth-blue-marble-mobile.webp`: 2048 × 1024, SHA-256
  `7E7DCFFF082C0E1EFE909E6D64EE815BC1B9D17F782B802A8FD4E4B2E7A65397`.

NASA content is used under the official NASA Images and Media Usage Guidelines:
https://www.nasa.gov/nasa-brand-center/images-and-media/. NASA says its media
and 3D texture-map content is generally not subject to copyright in the United
States when used factually without implying endorsement, and asks that NASA be
acknowledged. This asset contains no NASA insignia and no identifiable person.

The Earth files are loaded only after the globe enters the viewport and that
style is selected (including a previously saved visitor preference).

## Modern surface

The modern option's 2026 visual edition recreates the appearance of a current
physical relief globe. Its locally rendered 2:1 equirectangular surface blends
Natural Earth I's satellite-derived land cover, shaded relief, and ocean water
with the reviewed country boundaries in `src/data/geo/countries.geojson`. The
year identifies the site's visual edition, not the date or legal status of the
country boundaries.

Physical raster base:

- Natural Earth I with Shaded Relief and Water, 16,200 × 8,100 GeoTIFF.
- Catalog: https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/10m-natural-earth-1-with-shaded-relief-and-water/
- Official archive: https://naturalearth.s3.amazonaws.com/10m_raster/NE1_LR_LC_SR_W.zip
- Catalog version: 3.2.0; the downloaded archive's embedded version file is
  2.0.0. Both are recorded rather than silently conflated.
- Archive SHA-256:
  `8E30C15D49BC73223A36EAEFFC07FD49998E658E373A5498F276F5D26BFD1D0A`.
- Extracted GeoTIFF SHA-256:
  `539906DC5F2CC83BE551AEB2A4E7D2E168A6FDD573207A4477C69E923FF95DBB`.
- The checked-in 4096 × 2048 preparation source is
  `scripts/assets/natural-earth-i-relief-source.webp`, SHA-256
  `67075D803D345CC48B8715D851FE94096F53E114A94DC3B69D234EF2DCAF02AD`.

The same vector geometry is used for the visible borders, country hit testing,
outlines, centroids, and localized labels. Russian and English country names,
label points, and priorities come from the official `NAME_RU`, `NAME_EN`,
`LABEL_X`, `LABEL_Y`, `LABELRANK`, and `scalerank` fields. A deterministic
collision pass retains 87 labels on desktop and 69-70 on compact textures. The
three longest sovereign names use restrained atlas forms (`Китай`/`China`,
`ДР Конго`/`DR Congo`, and `США`/`United States`); their official source names
remain unchanged in the GeoJSON. Five subdued ocean labels use documented
static geographic positions. No city layer is invented without a city dataset.

Country and ocean wording is part of the permanent CMS site-copy snapshot. A
public release exports that snapshot first and then deterministically rebuilds
all four RU/EN desktop/mobile textures, so an editor's saved `country.XX` or
`globe.ocean.*` value is baked into the very next deployed modern globe. The
renderer preserves the reviewed geometry, label coordinates, dimensions,
density thresholds, and file-size budgets; release QA fails before deployment
if an edited label violates localization, coverage, or performance rules.

The runtime requests only the active interface language and viewport density,
after the modern style is selected. A live RU/EN switch replaces the texture
without recreating the globe. The procedural surface remains the local fallback.

- `modern-atlas-2026-ru.webp`: 4096 × 2048 Russian desktop texture, SHA-256
  `2EB0A86AEA6D1ADFF08C1AACE8FBD89149F432AEBC4001F1B97AEC637321D82B`.
- `modern-atlas-2026-ru-mobile.webp`: 2048 × 1024 Russian compact texture,
  SHA-256 `DAB618C766250D9DF340868366A987F2A402864DC8B717482255E470F92C39AB`.
- `modern-atlas-2026-en.webp`: 4096 × 2048 English desktop texture, SHA-256
  `8DF82C055820B44B178EFA7321888E9049821859CA0408BBC77B64B2D9219399`.
- `modern-atlas-2026-en-mobile.webp`: 2048 × 1024 English compact texture,
  SHA-256 `B897E3722909FFBEFA25013851AD2BDF605711A069E5C552129B6E470BB3C957`.

To refresh label metadata from a reviewed official download, run
`npm run assets:globe:modern:labels -- <admin-0.geojson>`, then
`npm run assets:globe:modern`. The renderer always reads the tracked,
checksummed relief source; it does not accept an arbitrary raster override.
Routine public builds run `content:export:cms`, `assets:globe:modern`, and
`assets:globe:qa` in that order.

The bundled geometry comes from the official Natural Earth Admin 0 - Countries
GeoJSON in repository release `v5.1.2`, retrieved on 2026-08-09. Natural
Earth's theme page currently labels the 110m Admin 0 theme `v5.1.1`; both
identifiers are recorded to avoid conflating the repository and theme versions:

- Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
- Release: https://github.com/nvkelso/natural-earth-vector/releases/tag/v5.1.2
- Theme page: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/
- Raw source SHA-256:
  `6866C877D39CBA9C357620878839B336D569F8C662D3CFAB4CB1DBE2D39C977F`.
- Compact local GeoJSON SHA-256:
  `1390263ABE434B8A30321230D79D10A12693BE465E8F2CDBAC711C7BBA7838AC`.
- Local feature count: 177.
- Machine-readable provenance: `src/data/geo/countries.provenance.json`.

Natural Earth raster and vector map data are public domain under its published
terms: https://www.naturalearthdata.com/about/terms-of-use/.

Country boundaries and classifications follow the default cartographic
viewpoint in the cited Natural Earth release. They support literary navigation
and do not constitute a legal or political determination.

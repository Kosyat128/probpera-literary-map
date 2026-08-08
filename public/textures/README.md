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

The modern option has no raster source. It is drawn locally at runtime from
`src/data/geo/countries.geojson`, the same Natural Earth geometry used for
country hit testing, outlines, and centroids. This keeps visual and interactive
geometry aligned and avoids an additional download.

Natural Earth raster and vector map data are public domain:
https://www.naturalearthdata.com/about/terms-of-use/.

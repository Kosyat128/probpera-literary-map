# Public image delivery

Published article and CMS source URLs remain editorial records. The presentation layer resolves an exact source URL through `src/data/imageDelivery.generated.json`, selects a local rendition and supplies intrinsic dimensions and `srcset`. Full-resolution viewing selects the largest rendition. Credits, links, captions, focus positions and original content hashes are preserved.

`scripts/prepare-public-images.mjs` inventories article bodies in both languages, cover fields, CMS content and site backgrounds. It downloads with bounded concurrency and retries, validates decoded input, deduplicates by SHA-256, preserves orientation, transparency and native resolution, and produces proportional 640/1280/1920px renditions where useful. Full-size originals are retained when conversion is larger; vectors and animation are preserved. WebP quality90 is visual compression, not a promise of identical pixel values.

Use `npm run assets:images:prepare` after changing published images. The normal snapshot build runs preparation and verification automatically. Existing committed provenance and renditions are reusable without downloading everything again on a clean checkout. Changed local originals invalidate their derivative; `--refresh` explicitly refreshes remote originals. `npm run assets:images:check` checks coverage, manifest consistency and output checksums. Provenance and any unavailable sources are recorded in `reports/public-image-delivery.json`.

Use `publicImageAttributes` for content images and `publicImageUrl` for backgrounds or canvas textures. The resolver honors the site's base path and supports both original URLs and rendition URLs. Image-error handlers must remove `srcset` before assigning a fallback. Static article pages use the same selection model; external publication feeds keep their original media URLs.

Article illustrations load lazily with reserved geometry. The visible article cover remains eager and receives high fetch priority. These choices follow the browser guidance on [image loading and dimensions](https://web.dev/articles/browser-level-image-lazy-loading) and [fetch priority](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority).

The 3D article book opens without waiting for every remote illustration. Its cancellable image queue retries transient failures and updates page textures after an image arrives, retaining the current page, canvas and reading progress. Page texture updates wait until page-turn motion settles. Pending and failed illustrations have distinct states and retain their semantic text-view image.

CMS image uploads use the shared browser optimizer and inspect actual file headers. Supported JPEG/PNG/WebP/AVIF images retain their native dimensions for editorial uploads. High-quality WebP is selected only when smaller; supported animation and smaller originals retain their bytes. Oversized inputs are reported instead of silently applying repeated destructive resizing or low-quality compression. Upload results show the original and submitted file sizes. Server validation checks actual format and dimensions independently of the filename and submitted MIME type.

Existing writer portraits and book-cover thumbnails already have separate optimized delivery pipelines. Globe textures keep their reviewed desktop/mobile variants and spatial alignment.

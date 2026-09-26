# Q: prepared media and native social transport

The existing literary-news runner now prepares optional licensed photographs before it builds or reconciles posts. The same `prepareNewsPost` output is used by preview and delivery. Telegram uses multipart `sendPhoto` / `editMessageMedia`; VK uses `photos.getWallUploadServer`, bounded file upload, `photos.saveWallPhoto`, then `wall.post` / `wall.edit`. Upload completion is not publication success. No real platform upload, message, post, credentials or production database was used for this implementation or its tests.

## Admission and cache

`data/news/social-media-assets.json` is the code-owned runtime registry. It is deliberately empty: the configured numeric social destinations are also empty. Existing source-article thumbnails explicitly prohibit social reuse and are never promoted into this registry.

Every admitted asset binds exact news IDs, subject/entity evidence, author/rightsholder, source URL and SHA-256, license evidence URL and SHA-256, checking method/date, expiry, transformation permissions, numeric destination permissions and the reviewed derivative descriptor. A string cannot substitute for the exact-ID or host arrays. Supported rights profiles are public domain, CC0, CC BY 4.0, ownership or explicit permission; NC/ND/SA are held. CC BY captions also carry the creator, license URL and a notice explaining orientation/resize/JPEG/metadata removal. Rights are rechecked at preparation and immediately before delivery, including destination binding and expiry. Network failures do not prove revocation.

Source downloads use the existing DNS-pinned HTTPS transport with a separate code-owned host allowlist, no redirects and all DNS answers required to be public. Input is capped at 8 MiB, 20 million pixels, one raster page and a 15-second fetch deadline. Only signature-matched JPEG/PNG/WebP is accepted; Sharp decodes the raster with a 10-second processing deadline. Output is contained within 1600×1600, never enlarged or cropped, converted to JPEG, limited to 2 MiB, and stripped of embedded metadata including GPS. Minimum side is 240 pixels. Hashes cover actual source and derivative bytes.

Derivatives are disposable local files in ignored `.tmp/news-social-media/<SHA256>.jpg`, outside JSONB and Git. A fresh runner calls `prepareRegisteredNewsMedia` before preview/reconciliation/send, rebuilding only a code-owned source SHA and reviewed derivative SHA. A source or renderer change fails closed for editorial review. Transport reads exact cached bytes and does not research, select or render images. Registry preparation is bounded to 32 assets and runs sequentially. A missing/invalid asset yields an explicit reason and a complete text variant; no text, negation, title, source link or mandatory image credit is truncated. Telegram captions over 1024 UTF-16 units fall back to one full text message, never a photo plus continuation.

## Upload, control and corrections

VK upload hosts have a separate provider allowlist (`pu[digits].vk.com`, `pu[digits].vkuserphoto.ru`, `pu[digits].userapi.com`, including `pu` without digits). Unknown hosts and redirects fail closed. POST transport pins validated public DNS answers, preserves Host/SNI, verifies TLS, has a 30-second deadline and limits replies to 256 KiB. Provider tokens are not sent to upload hosts. VK photos permission is checked as well as wall permission.

Upload occurs before the publication dispatch marker. After it completes, current provider rights, pause/mode/canary/history, job version and destination controls are read again; the actual create/edit uses a fresh atomic SQL control fence. A pause, withdrawal, replacement revision or cooldown during upload prevents publication. Upload 429/auth errors update destination-wide cooldown/pause, including later jobs. An uncertain photo-send remains ambiguous and cannot create a text fallback or a new post.

The existing durable job stores a small `mediaCache` receipt scoped to platform, numeric destination, currently verified bot/user account ID and derivative SHA-256. VK's saved attachment receipt is committed with CAS **before** any wall publication can start. Telegram's returned `file_id` is saved only with an accepted message receipt. A restart, pause after upload or wall rate limit can reuse that exact resource, after current rights/expiry validation. A new account, destination or byte hash cannot reuse it; token renewal for the same verified account does not invalidate a still legal resource. No credential or image bytes enter JSONB. A crash before an upload receipt can be durably recorded can leave an orphaned file, but cannot create a duplicate post; unknown publication outcomes remain ambiguous.

Image/credit revisions preserve the durable job and known remote ID. Existing text posts are not automatically converted when the new photo profile becomes available. A profile-only restyle of an already sent photo is also preserved unless substantive content/asset information changes. Telegram photo-to-text removal (including a withdrawn/expired asset with no safe photo replacement) is explicitly blocked for operator resolution; the runner never deletes and recreates a post. VK can clear attachments with an edit. Platform-side editing remains subject to the existing preflight/canary gate.

## Evidence and reproducibility

- `scripts/lib/literary-news-media.test.mjs` plus existing social tests: 49 tests passed. Cases cover corrupt/MIME/size/pixel rejection, destination/expiry/CC BY attribution, exact multipart bytes and captions, upload owner binding, shadow and fixture zero writes, ambiguous photo response, upload pause/withdrawal/rate limit/auth, unchanged identity on correction, no archival restyle, pinned upload DNS, mixed-public/private rejection, durable resource reuse after pause/rate limit/restart, and bot/destination/hash rotation.
- `scripts/check-literary-news-runtime-sql.mjs`: 19 checks passed in isolated PGlite 0.3.10. Actual JSONB reloads preserve canonical payloads, image descriptors and scoped upload receipts; Telegram and VK each create once then edit the same ID, reusing the file, using mocked native endpoints. This is not a deployed SQL or live platform test.
- `quality/`: six synthetic subjects, fourteen Telegram/VK payload variants, eighteen screenshots at 1200/360/430 pixels; every preview is `sendable:false`. These were rendered and opened. The fixture runner stores implementation fingerprints and output hashes.
- `media-rights/`: three real, separately researched portrait candidates (Jason Reynolds, Edna St. Vincent Millay, George W. Bush) with exact bytes/license evidence, normalized derivatives and visual inspection. They remain `held`, with empty destination permissions; they are not runtime approvals. Archival dates and subjects are explicitly distinguished from the current news event.

Reproduce local checks:

```text
npx vitest run --configLoader runner scripts/lib/literary-news-media.test.mjs scripts/lib/literary-news-social.test.mjs
node scripts/check-literary-news-runtime-sql.mjs --pglite=../r10-sql-test/node_modules/@electric-sql/pglite/dist/index.js
node reports/r10/social/quality/render-synthetic-previews.mjs
```

Provider references checked during implementation: [Telegram Bot API](https://core.telegram.org/bots/api#sendphoto), [Telegram editing methods](https://core.telegram.org/bots/api#editmessagemedia), [official VK photos method schema](https://github.com/VKCOM/vk-api-schema/blob/master/photos/methods.json). No claim of a successful real provider canary is made.

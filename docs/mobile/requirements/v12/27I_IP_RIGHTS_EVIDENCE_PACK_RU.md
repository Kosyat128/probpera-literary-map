# INTELLECTUAL PROPERTY RIGHTS EVIDENCE PACK — V12

## 1. Scope

Create evidence for every protected or factual asset:

- brand/logo;
- Планетка;
- writer portrait;
- country flag source/license;
- book cover;
- illustration;
- historical globe/map;
- 3D model/material/texture;
- font;
- music/sound;
- narration/voice;
- literary translation;
- quotation;
- StoryWorld;
- Disney/other character.

## 2. Record

Each asset has:

- stable asset ID;
- file path;
- SHA-256;
- source URL/reference;
- creator;
- rights holder;
- license type;
- license text snapshot/reference;
- acquisition date;
- attribution;
- commercial permission;
- derivative permission;
- mobile/Web permissions;
- territories;
- languages;
- term/expiry;
- store marketing permission;
- child suitability;
- reviewer;
- status;
- replacement/fallback.

## 3. Production statuses

- `OWNER_ORIGINAL_APPROVED`
- `PUBLIC_DOMAIN_ASSET_VERIFIED`
- `LICENSE_APPROVED`
- `ATTRIBUTION_REQUIRED_APPROVED`
- `REVIEW_REQUIRED`
- `BLOCKED`
- `EXPIRED`

Only first four may enter production, subject to their conditions.

## 4. Real people

For writer portraits:

- no AI generation/reconstruction;
- no “similar person”;
- no face replacement;
- only canonical approved asset/derivative;
- conservative resize/crop/color normalization that does not create new
  facial content;
- faceless placeholder when unavailable.

## 5. Book covers and illustrations

Do not assume cover art follows the public-domain status of text.
Each edition/cover/illustration is audited independently.

## 6. Historical maps/globes

Preserve:

- institution/source;
- catalog record;
- reproduction terms;
- adaptation method;
- original checksum;
- transformation pipeline;
- output checksum;
- attribution;
- geographic registration report.

## 7. Disney and licensed characters

Technical catalog records remain blocked until signed evidence includes:

- exact characters;
- exact assets;
- 3D/animation rights;
- in-app commercial/IAP rights;
- platforms/territories/languages;
- store screenshots/marketing;
- term;
- royalties;
- approval workflow;
- post-term policy.

No asset may be bundled before PASS.

## 8. Binary scan

Search exact RC for:

- blocked filenames/keywords;
- image perceptual hashes where available;
- unreferenced hidden assets;
- audio fingerprints/metadata;
- test downloads;
- generated face indicators;
- expired license asset hashes;
- missing attribution.

## 9. Reviewer packet

Create concise store-facing rights summary, with sensitive contracts kept
outside public repository. The summary references secure evidence
locations without exposing confidential terms.

## 10. Release blocker

- unknown source;
- rights unclear;
- license expired;
- platform/territory mismatch;
- marketing permission absent for screenshot;
- generated real portrait;
- unlicensed character;
- unauthorized translation/audio;
- missing attribution;
- hidden blocked asset bundled.

# Q: focused independent text-preview review

This is an agent review of local prepared payloads, not human acceptance or native Telegram/VK screenshots. `runLiteraryNews({args:['--preview-local'], env:{}, fetchImpl:networkDenied})` produced 322 previews from 161 current local public items, with zero preparation errors and zero delivery. No network request was permitted by that invocation.

The prepared Russian text is 343-703 UTF-16 code units per item. Eight items were read in full: Jamaica Kincaid/Sjöjungfrun, the Strugatsky trailer, ENS/ALEF, the Sergei Markov archive, Córdoba books, TV5MONDE, the Alim Aliiev interview, and the Pesnyary exhibition. The short title, separated summary, event date, named source, full source URL and site-section link form a readable sequence. The important qualifications survive: planned premiere, archive publication versus new acquisition, and book distribution versus purchase are expressed in the prepared text. Titles and source URLs are not truncated. Telegram bold uses a native entity over the full title; VK uses the same complete plain text.

The review supports readability of this text template and the inspected samples. It does not certify every underlying fact, all 161 editorial records, native link rendering, or production appearance. The eight samples and all payloads can be reproduced from `reports/r10/social/previews.json`.

Media features are not connected in this news profile: image selection/licence evidence, destination-specific image rights, photographer/artist credits, photo upload, image crop/contain testing inside native clients, generated artwork, video, albums and rich-media editing. Every inspected payload has `media:null` and `fallbackReason:no_destination_licensed_asset`. Telegram link previews are explicitly disabled. VK's actual link-card behaviour still requires the authorised native canary/profile verification enforced elsewhere. No media quality or native UI acceptance is claimed.

Disposition: text-preview review passed within this scope; Q as a broader media/native acceptance stage remains incomplete.

Snapshot note (2026-09-26): the review above describes the earlier 161-item / 322-preview checkpoint. The final local set contains 222 eligible items and 444 prepared text previews. The preserved eight-item reading is sample evidence only; it is not a claim that all 444 variants or any native client were visually inspected.

Implementation note after the media extension: MEDIA_Q.md is the final media implementation record. Native upload/edit, byte/rights validation and scoped durable provider-reference reuse are now implemented and tested. The historical text review above remains valid for its inspected payloads; it is not the final feature inventory. The latest 444 local previews remain text-only because numeric destinations and runtime asset permissions are not configured.

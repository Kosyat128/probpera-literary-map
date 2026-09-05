# DECISION DEFAULTS — V12

These defaults prevent unnecessary clarification pauses. Owner-provided
values in `EXTERNAL_OWNER_INPUTS` override them before production action.

| Area | Default |
|---|---|

| Required release locales | Russian (`ru`) and English (`en`) |
| Runtime fallback | English for unsupported system locales |
| Russian product identity | Литературная планета / Проба пера / Планетка |
| English product identity | Literary Planet / Proba Pera / Planetka |
| App language start | System preference; Russian for Russian, English otherwise |
| English Base Edition coverage | 100% before release |
| Raw machine translation | Prohibited in production |
| English title strategy | Verified published title or clearly labelled fallback |
| App Store locales | en-US + Russian |
| Google Play locales | en-US default + ru-RU translation |
| RuStore | Russian listing + Russian/English in-app selector |
| Bilingual stages | S36–S40 mandatory |
| Canon | Current main and site Literary Planet |
| Store app name | Литературная планета |
| Store subtitle/brand | Проба пера |
| Apple Kids Category | Not selected automatically; owner/legal decision |
| Audience strategy | General/family educational app with protected child mode |
| Reviewer access | Durable account/PIN; no SMS/OTP/owner intervention |
| Store screenshots | Exact RC only; concept collage prohibited |
| Account deletion | In-app + required public path when accounts exist |
| Permissions | Minimal allowlist; no microphone for narration |
| Moderation stages | S28–S31 mandatory |
| Owner-minimal stages | S32–S35 mandatory |
| Release profile | SAFE_PAID_BILINGUAL_V1 |
| Owner configuration | One owner-release-inputs.json |
| Native account | Disabled in first release unless all gates pass |
| First optional product | One original non-consumable if fully review-ready |
| Public territories | SAFE_INITIAL, not worldwide by default |
| Store API automation | Dry-run/draft only; no auto submission |
| Apple EU/DSA | Trader/export/current EU terms rechecked |
| Android verification | Developer/package registration rechecked |
| Final launch | Manual/staged with 72-hour monitoring |
| Branch | codex/literary-planet-v12-bilingual-final-autopilot |
| Distribution | Paid upfront + optional non-consumables |
| Base price planning | USD 9.99 equivalent; RuStore/Web 899 RUB anchor |
| Subscription | Disabled |
| Ads | Disabled |
| Account | Guest-first; adult optional |
| Child profiles | Up to four local profiles |
| Child store | Hidden |
| Child analytics | Disabled except non-profiled operational errors |
| Child narration | Off until parent enables |
| Microphone/location/camera | Not requested |
| First locale | System; Russian fallback |
| Theme | Canonical violet/orange |
| Globe | Current site default edition |
| Background | MuseumSkyDome/MuseumStarfield |
| Stand | Museum/classic |
| Graphics | Balanced, auto capability fallback |
| Motion | System preference; child calm default |
| Notifications | Off; ask at point of optional use only |
| Disney/licensed packs | Hidden/blocked |
| Store family sharing | Not promised until configured |
| Cross-store entitlements | Disabled by default |
| Content rollout | Staged, signed, rollbackable |
| Telemetry | NoOp/minimal redacted until approved |
| Production deploy | Manual owner action |
| Auto-merge | Disabled |

Defaults must be centralized, typed, documented and testable, not spread
as magic values. A default cannot weaken child safety, rights, purchase
verification or security.

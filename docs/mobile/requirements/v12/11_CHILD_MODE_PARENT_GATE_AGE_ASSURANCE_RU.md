# CHILD MODE AND PARENTAL CONTROL — V12 BINDING SPEC

## 1. Nature of child mode

Child mode is a sealed execution, navigation, content and commerce
boundary. It is not:

- a colour theme;
- a post-render filter;
- a search toggle;
- a few hidden buttons;
- a free demo inside the paid app;
- a store funnel.

The active child profile and policy must be restored before navigation,
search indexes, history, recommendations, prices or route content are
exposed. If policy state is uncertain, deny by default.

Child mode is included in the paid Base Edition and cannot require IAP.

## 2. Local child profiles

Support up to four local child profiles per licensed installation.

Store only necessary data:

- generated profile ID;
- parent-defined nickname or neutral label;
- exact age in completed years, integer 3–17;
- derived age band;
- optional reading level;
- allowed/blocked topics;
- sound/motion/narration settings;
- favorites/history/downloads;
- active child-safe theme;
- age confirmation date;
- policy version.

Do not require:

- legal full name;
- full birth date;
- email;
- phone;
- public account;
- exact location;
- photo;
- advertising identifier;
- school;
- contact list.

Parent periodically reconfirms age. Never infer age from behaviour.

## 3. Exact-age policy

Access is evaluated separately for every entity and action:

- country presentation;
- writer;
- biography;
- individual work;
- literary character;
- Disney licensed character;
- StoryWorld;
- fact;
- quote;
- task/quiz;
- narration;
- image;
- animation;
- background;
- skin;
- stand;
- accessory;
- search result;
- recommendation;
- favorite;
- recent;
- offline package;
- deep link;
- external link;
- store preview.

Writer eligibility never unlocks all works.

Required decision:

```ts
type ChildAccessDecision = {
  allowed: boolean;
  reasonCode:
    | "approved"
    | "age-too-low"
    | "age-too-high"
    | "not-reviewed"
    | "rejected"
    | "topic-blocked"
    | "rights-blocked"
    | "territory-blocked"
    | "license-expired"
    | "missing-child-content"
    | "parent-gate-required";
  profileAge: number;
  entityMinAge?: number;
  entityMaxAge?: number;
  reviewStatus: "approved" | "not-reviewed" | "rejected";
  rightsStatus: "approved" | "review-required" | "blocked";
  sourcePolicyVersion: string;
};
```

Unknown/missing/not-reviewed/expired = denied.

## 4. Age bands

Exact age is primary. Bands are presentation helpers:

- 3–5;
- 6–8;
- 9–11;
- 12–14;
- 15–17.

Platform store age categories are mapped explicitly and never replace the
internal exact-age decision.

## 5. Child-specific writer and work data

Child Writer:

- explicit approved status;
- min/max age;
- child biography;
- approved work IDs;
- reviewer;
- review date;
- source references;
- sensitive-topic notes;
- locale review status;
- portrait rights;
- character/world links.

Child Work:

- explicit approved status;
- min/max age;
- child summary;
- topic/sensitivity tags;
- source;
- reviewer/date;
- cover/image rights;
- narration rights;
- approved character IDs;
- approved tasks/facts.

No mechanical truncation of adult biography.
No generated factual biography.
No automatic AI publication.
No writer-level blanket permission.

## 6. Separate indexes and storage

Create:

- child writers index;
- child works index;
- child characters index;
- child StoryWorld index;
- child search index per locale/age package;
- child recommendation pool;
- child recent/history namespace;
- child favorites view;
- child offline package;
- child deep-link policy;
- child cache namespace;
- child theme catalog;
- child narration registry.

Do not query adult index and hide results after retrieval.

## 7. Startup invariant

When child mode was last active:

```text
native splash
→ secure profile restore
→ policy restore
→ child package validation
→ child route validation
→ child Home
```

Adult Home, adult recent, adult suggestions, store price, Buy CTA and
unlicensed character previews must not appear for even one frame.

## 8. Parent Gate

Required for:

- exit child mode;
- switch to adult profile;
- change exact age;
- change blocked topics;
- open adult store;
- initiate purchase;
- restore purchases;
- open external website/app;
- share;
- account changes;
- data export;
- child data deletion;
- diagnostics;
- privacy/settings that expand access;
- enable Disney/licensed pack;
- view legal/commercial details.

PIN:

- never plaintext;
- salted verifier in platform secure storage;
- rate limiting/backoff;
- no logs;
- no analytics;
- optional biometric/system owner confirmation;
- no Android Back bypass;
- no restart bypass;
- no deep-link bypass;
- no purchase callback bypass;
- no route-restore bypass;
- no notification bypass.

System Ask to Buy / Family Link approval supplements but does not replace
the in-app Parent Gate.

## 9. Планетка

Планетка is the original project mascot and guide.

Functions:

- welcome;
- explain globe gestures;
- introduce country;
- introduce approved author/work;
- offer age-appropriate journey;
- show sourced fact;
- explain offline/error gently;
- celebrate completion;
- direct to parent for protected action;
- help return to Home;
- suggest included content, not paid products.

Not allowed:

- open generative chat;
- unreviewed free-form factual answers;
- mandatory microphone;
- voice cloning;
- behaviour-based profiling;
- persistent nagging;
- purchase pressure;
- promotional lines addressed to a child.

Dialogue is data-driven, editorially reviewed, age/locale tagged and
captioned. Narration is optional and rights-cleared.

Visual:

- mouth below eyes;
- full hands and legs in mascot frame;
- face/limbs separate from globe surface;
- geography unchanged;
- reduced motion;
- no frightening expressions;
- no excessive looping;
- no imitation of Disney or other licensed mascots.

## 10. Paid app and child commerce

The adult purchaser has already paid for the Base Edition.

Child mode includes without further purchase:

- Planetka;
- child educational globe;
- cheerful Planetka skin;
- child stand;
- child backgrounds;
- child writers/works;
- exact-age filtering;
- included StoryWorld;
- child offline package;
- parent controls.

Child UI must not show:

- price;
- Buy;
- discount;
- countdown;
- premium ranking;
- locked paid carousel;
- store badge;
- scarcity;
- “ask now” pressure.

Child may use:

- included child-safe items;
- already-owned child-safe items;
- already-installed child-safe items.

Neutral protected action:

```text
«Спросить взрослого»
```

It does not show price or product desirability.

## 11. Literary and Disney characters

Each character/StoryWorld has:

- source work or screen-origin disclosure;
- author/tradition where applicable;
- country;
- legal status;
- asset-specific rights;
- territory;
- platform;
- expiry;
- approved artwork;
- approved text/translation;
- approved dialogue;
- age policy;
- child review;
- publish status.

Disney records are always blocked by default:

```text
legalStatus = LICENSE_REQUIRED
publishStatus = BLOCKED
storeStatus = HIDDEN
```

Paid app purchase does not authorize Disney IP.

Do not create:
- “almost the same” replacements;
- AI imitation;
- copied animation;
- cloned voice;
- film frame;
- unauthorized music;
- Disney-like store marketing.

The app must ship without waiting for Disney, using Planetka, original
worlds and cleared classics.

## 12. Disney packs in child mode

A licensed Disney pack can become visible only when all gates pass:

1. Signed license.
2. Character list approved.
3. Exact artwork/model approved.
4. Platform and territory approved.
5. In-app sale approved.
6. Store marketing approved.
7. Dialogue/narration approved.
8. Child age policy approved.
9. Licensor QA approved.
10. Store QA approved.
11. Expiry/post-term policy defined.

After activation:

- only allowed profiles/ages see it;
- only allowed territory sees it;
- only approved language assets load;
- Parent Gate controls purchase;
- child sees content after ownership, not price;
- license expiry handled safely.

## 13. No ads or child tracking

Child mode:

- no advertising SDK;
- no personalised ads;
- no third-party behavioural analytics;
- no IDFA/ad ID;
- no location;
- no cross-app tracking;
- no public profile;
- no user-generated chat;
- no upload of child media;
- no child-specific marketing profile.

Use local/redacted operational diagnostics only.

## 14. Child offline mode

Offline child package contains only:

- approved age-compatible writers;
- approved works;
- approved characters;
- approved StoryWorld;
- child-safe images;
- included/owned child-safe themes;
- scripts and narration with rights.

An adult cached entity cannot appear through fallback.
Policy version is stored with package.
Age change triggers atomic re-evaluation/rebuild.

## 15. Family use

Paid app may be family-shared according to platform rules, but child safety
is always local and explicit.

- family sharing does not create child profile automatically;
- store account identity is not a child profile;
- IAP sharing differs by platform;
- no promise of cross-store sharing;
- shared entitlement revocation does not delete child progress;
- protected optional item becomes unavailable gracefully.

## 16. Child QA gates

Required:

- cold start into saved child profile;
- zero-frame adult leakage;
- exact-age boundary tests for every entity type;
- direct adult ID blocked;
- adult deep link blocked;
- adult cached result blocked;
- adult recent/favorite hidden;
- store hidden;
- price absent;
- Parent Gate on purchase/restore/external;
- wrong PIN backoff;
- Android Back no bypass;
- restart no bypass;
- callback no bypass;
- Disney hidden without license;
- license expiry safe fallback;
- offline package contains no adult/unlicensed item;
- Planетка never advertises purchase.

## 17. Release status

Child mode is COMPLETE only if:

- it is fully included in Base Edition;
- no IAP is needed for core child use;
- all data boundaries are enforced before render;
- Parent Gate is secure;
- exact-age work filtering is proven;
- unlicensed characters are absent;
- privacy and accessibility gates are green.

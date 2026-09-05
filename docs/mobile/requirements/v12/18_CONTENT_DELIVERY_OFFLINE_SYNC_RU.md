# CONTENT DELIVERY, OFFLINE, UPDATE, ROLLBACK AND SYNC — V12 BINDING CONTRACT

## 1. Source of truth

```text
canonical CMS/database
→ existing evidence/rights/editorial gates
→ deterministic web export
→ deterministic app export
→ child-approved export
→ signed manifest
→ staged delivery
→ atomic client activation
```

No manual app-only writer biography, coordinates, portrait or work record.

## 2. Package structure

At minimum:

- bootstrap manifest;
- countries index/records;
- writers index/records;
- works index/records;
- general search indexes;
- child indexes by locale/policy version;
- StoryWorld/journey data;
- Planetka scripts;
- media manifest;
- rights/provenance manifest;
- customization catalog;
- entitlement-independent included asset registry;
- deletion/tombstone list;
- schema and minimum app version.

## 3. Manifest

Fields:

- schemaVersion;
- contentVersion;
- generatedAt;
- minimum/maximum compatible app version;
- locale;
- package list;
- byte size;
- SHA-256/integrity signature;
- ETag;
- dependencies;
- child policy version;
- rollback version;
- staged rollout metadata;
- source commit/database snapshot;
- provenance summary.

## 4. Atomic update

```text
check manifest
→ validate signature/schema/app compatibility
→ download to temp
→ resume/cancel safely
→ verify every hash
→ migrate temp database
→ run package invariants
→ activate pointer atomically
→ keep previous verified package
→ cleanup after stability window
```

Partial/corrupt/incompatible package never becomes active. Failed update
leaves previous package functional.

## 5. Local storage

Preferred separation:

- SQLite/structured database: indexes/metadata/state;
- filesystem: heavy media and 3D assets;
- secure storage: Parent PIN verifier and secrets;
- preferences: non-sensitive settings;
- memory cache: bounded transient data.

Evaluate current maintained plugins. If no safe plugin, implement narrow
native adapter with migrations/tests. Do not choose abandoned dependency.

## 6. Offline included experience

Without network after a legitimate base installation:

- app shell;
- canonical globe bootstrap;
- included skins/stands/backgrounds;
- country index;
- writer search/index and selected biographies;
- Favorites/Recent;
- child bootstrap/index/profile;
- Planetka core scripts;
- downloaded journeys;
- last verified optional entitlements;
- help/privacy/parent controls.

## 7. Downloads UX

- package/list size;
- free space;
- Wi-Fi-only;
- progress;
- pause/resume/cancel;
- retry;
- checksum status;
- storage destination where platform allows;
- remove optional package;
- protect mandatory bootstrap;
- explain offline availability;
- child package managed behind Parent Gate.

## 8. Child isolation

- separate namespace/index/package;
- adult cache never used as child fallback;
- exact-age policy stored with package;
- age/policy change triggers atomic re-evaluation;
- deny-by-default during refresh;
- no adult flash/search/recent/deep-link;
- licensed expiry removes world safely.

## 9. Sync

Guest-first. Optional adult account can sync:

- preferences;
- Favorites;
- journey progress;
- child settings under parent authority;
- optional download intent, not large files;
- active composition IDs if available on platform.

Conflict policy:

- server authority for entitlements;
- parent authority for child restrictions;
- add-wins or explicit conflict UI for favorites;
- last-write with timestamps/version for ordinary settings;
- progress monotonic merge where possible;
- no automatic cross-store entitlement portability.

## 10. Service Worker/PWA

- isolated scope, no conflict with public site SW;
- precache only essential shell;
- versioned runtime cache;
- update prompt/rollback;
- no stale paid-access bypass;
- no remote executable code;
- offline license grace policy;
- clear distinction public website vs paid PWA.

## 11. Delivery and privacy

- TLS;
- signed/integrity-checked packages;
- no secrets in URL;
- minimal logs;
- no child behavioural tracking;
- CDN failure fallback;
- rate limiting;
- content package does not expose private admin catalogs.

## 12. Acceptance

- deterministic export;
- site/app parity;
- interrupted update recovery;
- rollback;
- airplane mode;
- storage pressure;
- corrupt package;
- schema migration;
- child isolation;
- PWA SW coexistence;
- optional sync conflicts;
- last-known-good always available.

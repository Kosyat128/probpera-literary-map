# REVIEW BUILD REPRODUCIBILITY — V12

## 1. Goal

A clean authorized environment should reproduce the submitted artifact
from the recorded source and dependencies, except for expected
store/signing nondeterminism documented explicitly.

## 2. Pinning

Record:

- Git SHA;
- lockfile;
- Node/npm;
- Capacitor;
- Java/Gradle/Android SDK;
- Xcode/Swift/iOS SDK;
- build tools;
- native plugin versions;
- content manifest;
- rights manifest;
- store catalog;
- environment;
- build command;
- signing reference.

## 3. Build isolation

- clean checkout;
- no developer-global state;
- no untracked asset;
- no local secret baked into binary;
- production environment explicit;
- network sources pinned/verified;
- content assets checksummed;
- generated files reproducible or attested.

## 4. Store variants

Each build has explicit provider and no competing provider:

- Google Play;
- RuStore;
- App Store;
- Web/PWA.

Automated scan rejects mixed billing or store links.

## 5. Rebuild comparison

Compare:

- file inventory;
- bundle modules;
- native manifests;
- permissions;
- embedded assets;
- endpoints;
- product IDs;
- content version;
- source map/debug flags;
- SBOM;
- signatures where comparable.

Explain permitted differences such as signing timestamp.

## 6. Submission artifact freeze

After artifact selected:

- mark immutable;
- upload checksum;
- bind screenshots/notes/declarations;
- no silent replacement;
- new build number for changes;
- preserve old artifact until decision.

## 7. Backend compatibility

Record minimum/maximum compatible backend/content versions. Submission
must not depend on a temporary branch backend.

## 8. Validation

- install exact artifact;
- compare displayed version/build;
- reviewer access;
- sandbox product;
- offline;
- account deletion;
- child policy;
- rights scan.

## 9. Owner instructions

Provide exact commands and locations, without exposing secrets.

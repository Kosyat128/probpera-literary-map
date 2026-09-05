# TECHNICAL STABILITY AND PRELAUNCH — V12

## 1. Exact RC test

All technical evidence is produced from the same artifact submitted.

## 2. Launch

Test:

- cold/warm start;
- first install;
- upgrade;
- signed release;
- no white/black splash flash;
- no endless bootstrap;
- child policy restored before content;
- offline bootstrap;
- backend unavailable;
- content manifest corrupt;
- storage full;
- clock/timezone changes.

## 3. Globe

- one Canvas/renderer;
- canonical site parity;
- rotate/pinch/tap;
- country picking;
- camera intents;
- WebGL context loss/recovery;
- 30 skin/stand/background switches;
- high/balanced/economy;
- memory plateau;
- no black frame;
- no reset of country/writer;
- low-end device.

## 4. Lifecycle

- background/foreground 30 cycles;
- orientation;
- process recreation;
- low-memory warning;
- incoming call/system interruption;
- purchase callback;
- download continuation/recovery;
- no duplicate listeners.

## 5. Network

- offline;
- 2G/high latency;
- intermittent;
- captive portal-like failures;
- DNS failure;
- TLS failure;
- server 4xx/5xx;
- retry/backoff;
- no data corruption;
- clear user state.

## 6. Child mode

- saved child cold start;
- zero adult-frame leakage;
- wrong PIN/backoff;
- Back/deep link/notification;
- adult cache/index unavailable;
- age boundaries;
- Parent Gate around store/external link;
- review PIN;
- offline child package.

## 7. Purchases

- product unavailable;
- pending;
- cancel;
- duplicate;
- app killed;
- backend verification delayed;
- restore;
- refund/revocation;
- account change;
- licensed pack expiry;
- no self-grant.

## 8. Account and privacy

- create/login;
- offline existing session;
- password reset, if present;
- deletion;
- export, if offered;
- local child deletion;
- no secret in logs;
- privacy links.

## 9. Accessibility

- VoiceOver;
- TalkBack;
- Dynamic Type/large text;
- reduced motion;
- high contrast/forced colors where relevant;
- keyboard/switch navigation;
- alternative country list;
- dialogs and focus;
- purchase state announcements.

## 10. Store artifact checks

- production endpoint;
- correct provider;
- no competitor store link;
- no debug menu/secrets;
- no unlicensed asset;
- correct app label/icon;
- required SDK/target;
- signing;
- checksum;
- installation/update.

## 11. Crash and performance gate

No reproducible P0/P1:
- crash;
- ANR/hang;
- blank globe;
- data loss;
- child leak;
- purchase corruption;
- account deletion failure.

Budgets are documented by device class and enforced where deterministic.

## 12. Prelaunch report

Generate:

- device matrix;
- pass/fail;
- videos/screenshots;
- memory/FPS;
- crash/ANR summary;
- known limitations;
- exact build identity;
- owner signoff checklist.

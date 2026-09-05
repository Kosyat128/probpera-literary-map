# SECURITY, PRIVACY, COMPLIANCE AND THREAT MODEL — V12 BINDING CONTRACT

## 1. Security objectives

Protect:

- canonical content integrity;
- child-mode boundary;
- Parent Gate;
- paid entitlements;
- store receipts/tokens;
- licensing/rights metadata;
- admin access;
- signing/release chain;
- user preferences/progress;
- availability and recoverability.

## 2. Threat model

Model at least:

- local entitlement tampering;
- receipt replay/forgery;
- wrong environment/store token;
- deep-link route bypass;
- Parent PIN brute force;
- child/adult cache leakage;
- malicious/corrupt content package;
- CDN/object replacement;
- XSS/rich-text injection;
- remote code loading;
- compromised admin account;
- supply-chain/dependency compromise;
- leaked signing/merchant secret;
- unauthorized Disney/licensed asset publication;
- screenshot/log privacy leakage;
- WebGL denial/memory exhaustion;
- rollback/downgrade attack;
- account takeover;
- accidental production action.

## 3. Client security

- no secrets in bundle;
- no eval/dynamic remote code;
- strict CSP where applicable;
- TLS only;
- deep-link allowlist/schema validation;
- sanitized rich content;
- least native permissions;
- secure storage for PIN verifier/tokens that truly require it;
- debug menus disabled in release;
- no test endpoints/SKUs in production;
- package integrity and anti-rollback metadata;
- safe error messages;
- log redaction;
- dependency lockfile.

Certificate pinning only after risk/rotation analysis; do not introduce
brittle outages by default.

## 4. Parent Gate

- salted slow verifier/key derivation appropriate to platform;
- platform secure storage;
- rate limit and increasing delay;
- no raw PIN in memory longer than necessary;
- no logs/analytics;
- optional biometric as convenience, not secret replacement;
- recovery documented;
- no Back/restart/deep-link/callback bypass;
- tests for tampered local preferences.

## 5. Purchase security

- backend verification;
- idempotency;
- server-controlled SKU mapping;
- store/environment/package validation;
- only purchased/verified state grants;
- pending not granted;
- acknowledge/finish after successful verified delivery;
- RTDN/server notifications where available;
- refund/revocation reconciliation;
- hashed/redacted transaction identifiers;
- store secrets server-side;
- no client self-grant;
- audit trail.

## 6. Content integrity

- deterministic export;
- signed manifest/integrity metadata;
- SHA-256 per asset;
- schema validation;
- source commit/snapshot;
- minimum app version;
- atomic activation;
- last-known-good rollback;
- anti-path traversal;
- no executable content packages;
- rights/provenance gate.

## 7. Admin security

- role-based least privilege;
- MFA/AAL2 where configured and safe;
- server-side authorization;
- CSRF/session protection;
- transactional publish;
- audit log;
- dry-run;
- two-person review for child/licensed publication where feasible;
- secrets in managed secret store;
- production action confirmation;
- backup and recovery;
- no public leakage of private catalogs/keys.

## 8. Child privacy

- no public child account;
- no full birth date required;
- no exact location;
- no contact/camera/microphone permissions in core;
- no advertising ID/IDFA;
- no behavioural advertising/third-party profiling;
- no raw child search telemetry;
- no UGC/chat;
- data minimization;
- local profiles by default;
- parent export/delete;
- retention policy;
- stricter rule wins across internal/platform signals.

## 9. Adult account and data rights

- optional account;
- clear privacy notice;
- export;
- deletion;
- session/device revocation;
- recovery;
- retention schedule;
- deletion verification;
- child data separately controlled;
- store transaction records retained only as legally/operationally needed;
- no entitlement loss solely due account deletion where store restore
  remains possible.

## 10. Permissions audit

Core should not request:

- location;
- camera;
- microphone;
- contacts;
- broad filesystem;
- advertising tracking;
- Bluetooth scanning.

Only request notification or optional feature permission at point of use,
not onboarding. Every permission has purpose, fallback and store disclosure.

## 11. Supply chain

- dependency inventory;
- vulnerability scan;
- SBOM;
- pinned CI actions/dependencies;
- license audit;
- abandoned-package review;
- reproducible builds;
- artifact checksums/signatures;
- secret scan;
- source provenance;
- update policy;
- security response SLA.

## 12. Compliance deliverables

- data map;
- privacy policy draft;
- terms/EULA draft;
- child safety statement;
- data safety/App Privacy answers mapped to code;
- account/data deletion instructions;
- paid app/refund disclosure;
- licensed-content disclosure;
- cookie/web storage policy;
- accessibility statement;
- permission list;
- incident notification playbook;
- records of processing as appropriate for owner/legal review.

## 13. Acceptance

- no critical/high unresolved vulnerability;
- secret scan green;
- SBOM generated;
- permission list minimal;
- child data boundary proven;
- purchase tamper tests pass;
- content signature/rollback tests pass;
- admin authorization tests pass;
- privacy declarations match actual code;
- external legal review clearly identified, not faked by Codex.

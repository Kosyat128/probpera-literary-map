# APP OWNERSHIP AND ENTITLEMENT MODEL V12 — BINDING CONTRACT

## 1. Separate ownership layers

The system has four independent concepts:

1. Base app access.
2. Optional product ownership.
3. Asset installation.
4. Active customization.

Never collapse them into one boolean.

## 2. Base access

```ts
type BaseAppEntitlement = {
  platform: "web" | "app-store" | "google-play" | "rustore";
  source: "paid-download" | "web-license" | "promo" | "family-share";
  status: "unknown" | "valid" | "grace" | "revoked";
  storefront?: string;
  verifiedAt?: string;
  lastOnlineCheckAt?: string;
  appVersion?: string;
};
```

Rules:

- native store distribution controls paid download;
- no mandatory account just to use the purchased native app;
- temporary network failure does not lock a legitimate offline user;
- web full PWA needs verified web license;
- base app purchase cannot be represented by an optional IAP SKU;
- reinstall of paid native app is handled by store account/redownload;
- optional purchase restore is a separate action.

## 3. Optional entitlement

```ts
type OptionalEntitlement = {
  internalProductId: string;
  platform: "web" | "app-store" | "google-play" | "rustore";
  storeProductId: string;
  source:
    | "direct-purchase"
    | "family-share"
    | "promo"
    | "support-grant";
  status:
    | "pending"
    | "verified"
    | "revoked"
    | "refunded"
    | "expired-license";
  transactionIdHash?: string;
  originalTransactionIdHash?: string;
  purchasedAt?: string;
  verifiedAt?: string;
  revokedAt?: string;
  rightsVersion?: string;
  licenseTermId?: string;
};
```

The server is authority for optional paid ownership.

## 4. Installation state

```ts
type AssetInstallState =
  | "not-required"
  | "download-required"
  | "downloading"
  | "downloaded-unverified"
  | "installed"
  | "update-available"
  | "corrupt"
  | "removed";
```

Ownership does not imply the asset is installed.
Installation does not imply current ownership.

## 5. Active state

```ts
type ActiveComposition = {
  globeSkinId: string;
  standId: string;
  backgroundId: string;
  accessoryIds: string[];
};
```

Only included or verified-owned installed items can become active.

## 6. Offline grace

- included Base Edition works offline;
- last verified optional items work offline according to product policy;
- entitlement refresh occurs when network returns;
- failed server request does not delete previously verified data;
- revoked/refunded status is applied after authoritative update;
- licensed items follow contract-specific offline grace.

## 7. Cross-platform scope

Default:

- base purchase is platform-specific;
- optional purchase is store-specific;
- user progress may sync;
- entitlements do not automatically transfer;
- no “buy once everywhere” claim;
- account link cannot silently grant a product prohibited by another store
  or license territory.

Cross-platform grants require an explicit policy record.

## 8. Family sharing

Apple:
- support non-consumable sharing only if enabled in App Store Connect;
- process shared source;
- process revocation;
- owner decision required before irreversible configuration.

Google:
- paid app may be shared via Family Library where eligible;
- in-app purchases are not represented as shareable by default;
- never fabricate shared entitlement.

RuStore/Web:
- no family sharing promise without approved implementation.

## 9. Disney/licensed entitlement

A licensed product includes:

- rights version;
- territory;
- term;
- permitted platform;
- post-term policy;
- refund/delisting policy.

Entitlement verification must reject:

- unsupported territory;
- expired term;
- wrong platform;
- disabled SKU;
- unapproved product version.

The user's local data remains intact if the licensed asset becomes
unavailable.

## 10. Refund/revocation

On optional product revocation:

- remove active use after authoritative confirmation;
- switch to safe included fallback;
- keep child profiles/favorites/history;
- keep a readable purchase-support record;
- remove/download asset according to contract;
- do not crash during startup;
- show adult-facing explanation;
- do not expose commercial details to child.

## 11. Security

- raw receipts/tokens not stored in logs;
- transaction identifiers hashed where practical;
- server secrets never in client;
- idempotency required;
- test/prod isolated;
- local state cannot self-grant;
- catalog ID mapping server-controlled;
- remote entitlement response schema validated.

## 12. Required tests

- base app offline;
- web license expiry/recovery;
- optional purchase verify;
- duplicate callback;
- app killed;
- reinstall;
- store account change;
- family-share grant/revoke;
- refund;
- licensed term expiry;
- wrong territory;
- local tampering;
- safe fallback;
- child mode remains sealed throughout.

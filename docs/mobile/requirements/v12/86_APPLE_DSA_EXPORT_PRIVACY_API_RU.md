# APPLE DSA, EXPORT COMPLIANCE AND PRIVACY-API CONTRACT — V12

## 1. EU Digital Services Act trader status

Before EU App Store distribution:

- owner/legal self-assesses trader status;
- App Store Connect trader status is declared;
- trader email, phone and address are verified when required;
- organization/individual evidence is supplied;
- app-specific trader status is set;
- public product-page contact details are reviewed for accuracy;
- labels/markings URL is considered where legally required;
- status is monitored until verified.

Even if EU distribution is not planned, complete the status declaration
when App Store Connect requires it.

Source:
https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/

## 2. EU business terms

If submission/release occurs near or after 2026-10-01:

- recheck current Apple EU terms;
- do not rely on superseded external purchase entitlements/addenda;
- external payment/distribution stays disabled by default;
- owner/legal must explicitly approve any alternative EU commerce model;
- base App Store/StoreKit route remains the safe default.

Source:
https://developer.apple.com/support/apps-in-the-eu

## 3. Export compliance

Create an encryption inventory:

- TLS/HTTPS;
- Keychain/Secure Enclave;
- secure storage;
- custom cryptography;
- third-party crypto libraries;
- encrypted local database;
- purchase/signature verification;
- content package signatures.

Complete App Store Connect export-compliance questions.

If only exempt/platform-standard encryption is used:

- set Info.plist declarations only when accurate;
- document the exemption rationale.

If non-Apple industry-standard or proprietary encryption is used:

- determine CCATS/document requirements;
- determine French encryption declaration requirement if distributing in
  France;
- complete documentation before TestFlight/App Review where required.

Sources:
https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
https://developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption/

## 4. Privacy manifests and Required Reason APIs

For the exact archive:

- generate Xcode privacy report;
- collect app and third-party PrivacyInfo.xcprivacy manifests;
- scan Required Reason API use;
- verify every declared reason is approved and accurate;
- remove unnecessary SDK/API usage;
- compare privacy report with App Privacy answers;
- retain the generated privacy report in review evidence.

Source:
https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests

## 5. App Privacy

Generate App Privacy draft from actual data flow, including third-party
partners. Do not use a generic “no data” declaration when purchase
verification, support, accounts, crash logs or retained server data exist.

Privacy Policy URL is required.
Privacy Choices URL is prepared when account/deletion/privacy controls
benefit from it.

Sources:
https://developer.apple.com/app-store/app-privacy-details/
https://developer.apple.com/help/app-store-connect/reference/app-privacy/

## 6. Accessibility product-page information

Generate a truthful accessibility support worksheet from tested features:

- VoiceOver;
- Voice Control where supported;
- Larger Text;
- Reduced Motion;
- Captions;
- sufficient contrast;
- alternative non-3D country navigation.

Do not claim a support item until exact RC testing passes.

Source:
https://developer.apple.com/app-store/submitting/

## 7. Apple owner-only actions

After Codex completion the owner should only need to:

- verify/declare DSA trader status;
- accept agreements;
- enter tax/banking;
- provide App Store Connect API/signing secrets;
- approve export-compliance answers/documents;
- approve App Privacy and age rating;
- approve price/territories/screenshots;
- click Submit/Release.

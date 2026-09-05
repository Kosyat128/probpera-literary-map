# Official requirements refreshed 2026-09-04

These are preparation findings from official sources, not product acceptance or
legal approval. Detailed URL/status/access records are in
`evidence/S00/official-sources/`. Partial retrievals remain unresolved.

| Area | Verified requirement or implementation consequence |
| --- | --- |
| Apple build | Xcode 26+ and iOS/iPadOS SDK 26+ from 2026-04-28. Current stable table lists Xcode 26.6 / SDK 26.5; the older upload table must not lower the dated minimum. [Requirements](https://developer.apple.com/news/upcoming-requirements/) |
| Android build | Phone/tablet submissions target Android 16 / API 36 from 2026-08-31. [Policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) |
| Billing | Current release notes list Play Billing 9.1.0, dated 2026-06-18. [Release notes](https://developer.android.com/google/play/billing/release-notes) |
| Capacitor | v8 docs require Node 22+, Xcode 26+, Android Studio 2025.2.1+; runtime minima Android API 24 and iOS 15. Repository stays Node 24/npm 11. [Environment](https://capacitorjs.com/docs/getting-started/environment-setup) |
| RuStore Pay | Official Kotlin/Java index lists 11.1.0. Detailed guide returned 429; SDK integration and English system payment UI remain unverified. [SDK index](https://www.rustore.ru/help/sdk/pay/kotlin-java) |
| Android locale | setApplicationLocales can recreate Activity. V12 must explicitly handle configuration changes and test Activity/WebView/Canvas identity. [Per-app languages](https://developer.android.com/guide/topics/resources/app-languages?hl=en) |
| Apple locale | Store metadata and binary localization are separate. New store localizations can copy primary screenshots; validate explicit RU/EN captures. [Localization](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information) |
| RuStore captures | At least three screenshots for each advertised device type. The 1-10 number concerns an upload operation. [Publication](https://www.rustore.ru/help/en/developers/publishing-and-verifying-apps/app-publication) |
| RuStore draft | publishType defaults to INSTANTLY. Any later authorized draft operation must explicitly use MANUAL. No such operation is performed now. [Draft API](https://www.rustore.ru/help/en/work-with-rustore-api/api-upload-publication-app/create-draft-version) |
| Google draft | Product APIs are outside transactional edits and can mutate immediately. Dry-run must prevent all outbound mutations, not only edits.commit. [Edits](https://developers.google.com/android-publisher/edits) |
| EU terms | Apple announces terms effective 2026-10-01; recheck at actual RC/release. Alternative payment flows remain disabled. [EU terms](https://developer.apple.com/support/apps-in-the-eu) |
| Accessibility | WCAG 2.2 is the applicable product target. WAI also publishes WCAG-EM 2.0 for evaluating apps and digital products; a test report is required, not a blanket compliance assertion. [WAI](https://www.w3.org/WAI/) |
| PWA | A manifest describes installation; service-worker registration controls an origin/path and its lifecycle must preserve valid existing clients. V12 needs isolated scope and verified atomic content activation. [Manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest), [Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) |

Child privacy preparation:

- COPPA covers relevant services processing personal information from children
  under 13. The FTC FAQ explicitly points to the amended 2025 rule; consent,
  deletion, minimization and retention require actual data-flow evidence.
  [FTC FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions),
  [amendments](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data).
- EU consent thresholds vary from 13 to 16 by Member State. This concerns the
  applicable consent basis, not a universal age of contractual capacity.
  [European Commission](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en).
- CNIL distinguishes consent at 15 from general digital adulthood and contract
  capacity. The old node/241 URL failed; the linked current recommendation was
  retrieved as the replacement source.
  [Capacity](https://www.cnil.fr/en/recommendation-1-regulate-capacity-children-act-online),
  [parental consent](https://www.cnil.fr/en/recommendation-4-seek-parental-consent-children-under-15),
  [consent basis](https://www.cnil.fr/fr/les-bases-legales/consentement).
- ICO expects age-appropriate protections designed into the service and DPIA.
  Where age confidence is inadequate for the risk, apply protective standards to
  all users. This does not justify collecting more child information by default.
  [Design standards](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/standards-of-age-appropriate-design/),
  [age application](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/3-age-appropriate-application/).

SAFE_PAID_BILINGUAL_V1 therefore keeps child profiles local, with no child cloud
accounts, analytics, advertising, upload or AI input. This is a technical default;
territory-specific legal approval is not inferred from it. Recheck official rules
at bilingual RC, before any authorized upload and after a rejection.

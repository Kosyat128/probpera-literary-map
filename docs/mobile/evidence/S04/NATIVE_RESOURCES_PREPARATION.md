# S04 native resource preparation

Observed 2026-09-05T21:14:18.534Z. Status: RESOURCE_COMPILER_AND_PROJECT_PARSING_PASS. This is local preparation, not native application or release acceptance.

Android now has the existing canonical app name in default English and Russian resources, non-translatable package/scheme identifiers, explicit en/ru localeConfig, allowBackup=false and usesCleartextTraffic=false. iOS has en/ru InfoPlist.strings, matching CFBundleLocalizations and knownRegions, plus target resource references. The Capacitor 8.5 UIScene configuration, SceneDelegate and AppDelegate are preserved.

The application privacy manifest declares UserDefaults reason CA92.1 for the observed app-only language/theme preferences. The current official Apple structured document and installed Preferences source were inspected. This entry does not replace the complete linked-binary privacy audit or assert legal/human approval.

Verification used the installed AAPT2 to compile the actual three Android resource files and link them against API 36 in a separate resource-only fixture. The resulting resource dump contains both canonical names. The installed Xcode parser accepted the project and resource references; OpenStep/plist parsing accepted both localized string files, language declarations and privacy entry. Seven check groups passed; eleven native source hashes and supporting input hashes are in the companion JSON. Reproduce locally with `node .tmp/native-tools/verify-native-resources.mjs`.

The separate resource-only APK under .tmp is a compiler fixture, not the Literary Planet application. No Android application build/install, Xcode build, signing, iOS Simulator or device validation is claimed here. Runtime language preservation and first-frame behavior remain root-owned native checks. Android allowBackup=false is not evidence of universal OEM device-to-device transfer suppression. No permissions for unused sensors/services or unreviewed privacy claims were added.

Sources: [Android app languages](https://developer.android.com/guide/topics/resources/app-languages), [Apple InfoPlist localization](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AboutInformationPropertyListFiles.html), [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences), [Apple required-reason API](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype). The exact Apple JSON URL, local copy hash and access date are in the JSON receipt.

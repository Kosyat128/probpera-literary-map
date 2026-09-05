# S04 iOS sync review

Observed 2026-09-05T21:43:23.626Z. Status: IOS_SYNC_BYTES_AND_PROJECT_STRUCTURE_VERIFIED_NO_NATIVE_BUILD.

The synchronized iOS/dev web bundle is build e7921e30d23f94261f264335aab1ace9e3f9e988fb8f3040558ef731668619d4. All 319 declared inventory files plus artifact.json match dist-native byte-for-byte. The destination contains 322 files: those 320 exact copies and exactly two additional zero-byte compatibility files, cordova.js and cordova_plugins.js. The inspected CLI creates these empty files when no Cordova plugins are installed. No missing, changed or unknown extra file was found.

Generated capacitor.config.json uses the local capacitor://localhost bundle, contains the expected five plugin classes and has no server.url or allowNavigation override. The Xcode project parses; its target still references localized InfoPlist.strings, PrivacyInfo.xcprivacy, public and Assets.xcassets. All seven previously recorded iOS project/localization/lifecycle source hashes and all four prepared iOS brand hashes remain unchanged. RU/EN localizations, CA92.1 and the single UIScene delegate remain present.

All five local SPM plugin paths resolve to their intended installed npm packages and contain the expected Package.swift/product/source directories. This is filesystem/manifest verification, not Swift compilation.

Correction to the earlier package intake: line 58 of capacitor-package-contracts.md and /contractFindings/templates/ios/cliUpdateVersionRange in its JSON incorrectly described the final app dependency as a from: range. The actual CLI 8.5.1 app generator, generatePackageText at util/spm.js:107, emits exact: from the installed iOS package version; the synchronized CapApp-SPM/Package.swift therefore has exact: "8.5.1". The update.js from: handling concerns plugin manifests and generated Cordova packages. Original intake bytes are preserved under history with hashes in the companion JSON; the original reports were not edited.

The remaining resolution caution is valid: there is no Package.resolved or actual Swift resolver/native build evidence. The exact generated application constraint does not establish a completed resolved dependency graph or compiled iOS application. On this Windows host neither swift nor xcodebuild was found on PATH. No remote jobs, signing, deployment or account/credential inspection was performed.

Reproduce this local read-only review with node .tmp/native-bootstrap/review-ios-sync.mjs while the same bundle and native source checkpoint remain present. Full per-file hashes, original/corrected evidence pointers, generator hashes and limitations are in ios-project-sync-review.json.

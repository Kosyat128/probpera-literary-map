# ANDROID DEVELOPER VERIFICATION AND PACKAGE REGISTRATION — V12

## 1. Purpose

Ensure that Android packages and signing identities remain installable as
Android developer verification expands.

## 2. Current rollout snapshot

Official Android guidance observed during V12 preparation states:

- verification is rolling out to developers in Play Console and Android
  Developer Console;
- from 2026-09-30, apps must be registered by verified developers to be
  installed/updated on certified devices in Brazil, Indonesia, Singapore
  and Thailand, subject to the documented advanced/ADB paths;
- expansion continues in 2027 and beyond.

Codex must recheck current scope and dates immediately before release.

Source:
https://developer.android.com/blog/posts/android-developer-verification-rolling-out-to-all-developers-on-play-console-and-android-developer-console

## 3. Technical preparation

Generate:

- package inventory;
- variant/package mapping;
- signing certificate SHA-256 fingerprints;
- Google Play app-signing/upload-key mapping;
- RuStore signing mapping;
- direct/internal build mapping;
- registration evidence reference;
- affected territory status;
- developer verification state.

## 4. Signing consistency

- do not accidentally register debug keys as production;
- preserve upload and app-signing roles;
- document Play App Signing;
- align RuStore update compatibility strategy;
- never expose private keys;
- maintain encrypted backups and recovery instructions;
- record certificate expiry/rotation where applicable.

## 5. Owner-only actions

Owner may need to:

- complete identity/organization verification;
- confirm app/package registration;
- upload requested legal documents;
- confirm signing certificate associations;
- complete verification in Play/Android Developer Console.

Codex must prepare exact package/fingerprint values and screenshots
showing where they are entered.

## 6. Release gate

Fail when:

- production package not registered where required;
- developer not verified in an affected rollout;
- signing identity mismatches registration;
- RuStore/Play package mapping is ambiguous;
- test key used in public artifact;
- package name differs from store records.

# Local Android toolchain - installed and verified

Updated 2026-09-05T21:02:36.096Z. Java and the requested SDK packages are ready for a project build. No app build or device test is claimed. Historical license-pending preparation is preserved separately; S04 remains incomplete.

The explicit user reply was: **«Разрешаю принять лицензию и установить SDK»**. Source: explicit user reply in current task. sdkmanager presented the standard android-sdk-license and received one authorized y response during installation. The acceptance file was created by the tool. The repository text is dated16Jan2019; the public download agreement displays28Apr2026. They are preserved as distinct sources.

| Component | Verified version | Local path below .tmp/native-tools |
|---|---|---|
| Java | Temurin21.0.12.1+1 | java/jdk-21.0.12.1+1 |
| Command-line tools / sdkmanager | 22.0, build15859902 | android-sdk/cmdline-tools/22.0 |
| SDK platform | API36 revision2 | android-sdk/platforms/android-36 |
| Build Tools | 36.0.0 | android-sdk/build-tools/36.0.0 |
| Platform Tools | 37.0.1 | android-sdk/platform-tools |

The command-line tools ZIP matched the [official SHA256](https://developer.android.com/studio):90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a. The three package archives matched Google repository SHA1/size records and passed path/link inspection before installation. All11,525 installed payload files subsequently matched those archived bytes by SHA256. Publisher SHA256 was not provided for those three archives; locally measured SHA256 is labeled accordingly.

Actual checks passed: Java/javac and UTF-8 compilation/run; sdkmanager version/installed listing; adb1.0.41(37.0.1-15733141), aapt2, apksigner0.9, D8, and zipalign create/check on a local smoke ZIP. Around14.0GB remained free after payload verification. Exact bytes, versions, hashes and logs are recorded in android-toolchain-preparation.json.

Use the process-scoped SDK wrapper from the repository root:

```powershell
& './.tmp/native-tools/Invoke-ScopedSdk.ps1' -Operation Version
& './.tmp/native-tools/Invoke-ScopedSdk.ps1' -Operation Installed
```

The wrapper restores inherited values on exit. JAVA_HOME points to java/jdk-21.0.12.1+1; ANDROID_HOME/ANDROID_SDK_ROOT point to android-sdk; ANDROID_USER_HOME, GRADLE_USER_HOME, Java user.home and TEMP/TMP remain inside native-tools. No registry, permanent PATH or global environment was changed. Root will use the generated project Gradle wrapper; no global Gradle or app build was run here.

**Windows ADB constraint:** SDK environment variables do not redirect ADB's base profile directory. Current [official ADB source](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/adb_utils.cpp) resolves CSIDL_PROFILE directly. The single version check created an empty C:\Users\User\.android; it was removed after exact creation-time, directory-type and emptiness checks. No keys, server or device enumeration were created. Do not rerun ADB under a workspace-only profile-write guarantee. A future device workflow needs an explicitly permitted profile-cache exception or a separate host. After that scope is arranged, adb devices -l and adb -s <confirmed-device> shell getprop ro.build.version.sdk are the intended read-only inventory commands; they have not run.

Java Path.toRealPath and ADB known-profile lookup failed in the restricted sandbox; the same local checks passed with approved scoped escalation. Those failures and the reverted ADB side effect remain in evidence. TLS verification was never weakened.

Current [sdkmanager documentation](https://developer.android.com/tools/sdkmanager) marks it deprecated. The22.0 package includes the new Android CLI, which was not invoked or initialized and did not replace the Capacitor8.5.1/AGP8.13 template. No extra AI/MCP setup, emulator/system image, NDK or CMake was installed. No production signing, deploy, store submission, iOS build or native test result is implied.

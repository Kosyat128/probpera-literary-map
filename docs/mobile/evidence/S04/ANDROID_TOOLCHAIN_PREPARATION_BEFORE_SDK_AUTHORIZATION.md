# Local Android toolchain preparation

Source checkpoint:0afad0906f266dcac138aba697fc7cc97579fc7e. Verified:2026-09-05T20:40:07.586Z. Java is usable; Android SDK is awaiting the actual SDK agreement decision. S04 is not complete.

Portable Temurin21.0.12.1+1 is at `.tmp/native-tools/java/jdk-21.0.12.1+1`. It was downloaded from the [official Adoptium release](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1); archive SHA256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` matches the publisher API, release listing and separately fetched checksum. No global install or permanent environment change.

From the repository root, these commands only run the already verified local JDK:

```powershell
& './.tmp/native-tools/java/jdk-21.0.12.1+1/bin/java.exe' -version
& './.tmp/native-tools/java/jdk-21.0.12.1+1/bin/javac.exe' -version
```

Actual version output:

```text
openjdk version "21.0.12.1" 2026-08-18 LTS
OpenJDK Runtime Environment Temurin-21.0.12.1+1 (build 21.0.12.1+1-LTS)
OpenJDK 64-Bit Server VM Temurin-21.0.12.1+1 (build 21.0.12.1+1-LTS, mixed mode, sharing)
javac 21.0.12.1
JAVA21_UTF8_WORKSPACE_SMOKE_PASS
```

Before download C: had15,703,764,992 free bytes; after Java extraction:14916997120. ZIP inspection validated 577 entries (490 files; 343823876 expanded bytes), path containment, duplicate names and absence of links before extraction. Compilation plus UTF-8 file roundtrip succeeded inside the Cyrillic workspace path. Raw results/scripts remain under .tmp/native-tools; their hashes are in android-toolchain-preparation.json.

The first205,073,461-byte transfer timed out after300s at131,221,312 bytes. It was resumed from that offset and fully hashed before use. Ordinary Windows sandbox HTTPS failed Schannel credential initialization; approved escalation succeeded with certificate validation enabled.

The initial Java compilation passed inside sandbox, but running the class failed with AccessDeniedException in Path.toRealPath. The identical class/arguments passed with scoped local escalation. Full version/compile/run verification was repeated in a fresh output directory with that allowance; the initial failure is preserved in java-initial-sandbox-failure.json. A future Gradle run may need this execution allowance too. No ACL or system setting was changed.

## Android SDK: concrete pending action

The [official download page](https://developer.android.com/studio) requires agreement before downloading command-line tools. Its SDK agreement also treats use as acceptance. This preparation did not accept it or bypass the gate; root must resolve the actual authorized-owner decision. This is not a request for the owner to write code.

Pinned Windows archive:commandlinetools-win-15859902_latest.zip, displayed155.7MB; publisher SHA256:90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a. It has not been downloaded; sdkmanager version and internal package revision remain unknown.

After that decision, preserve the scoped layout:

```text
.tmp/native-tools/
  java/jdk-21.0.12.1+1/
  android-sdk/cmdline-tools/15859902/{bin,lib,NOTICE.txt,source.properties}
  android-user/
  gradle-user/
```

Do not create a global PATH/JAVA_HOME/ANDROID_HOME entry or write a guessed SDK license hash. Use process-scoped values in the eventual build runner, with JAVA_HOME pointing at the verified directory, ANDROID_USER_HOME and GRADLE_USER_HOME inside native-tools, and explicit SDK root. Read source.properties before claiming the15859902 package is any semantic version.

Proposed commands below have NOT run and remain behind the SDK agreement gate. The actual runner must restore its inherited environment on exit:

```powershell
$nativeTools = Join-Path (Get-Location).Path '.tmp/native-tools'
$sdkRoot = Join-Path $nativeTools 'android-sdk'
$sdkManager = Join-Path $sdkRoot 'cmdline-tools/15859902/bin/sdkmanager.bat'
# After scoped JAVA_HOME/ANDROID_USER_HOME setup and actual agreement authorization:
& $sdkManager --version
& $sdkManager "--sdk_root=$sdkRoot" --list --channel=0
# Confirm actual stable revisions/checksums first; do not pipe automatic acceptance:
& $sdkManager "--sdk_root=$sdkRoot" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" --channel=0
```

The planned package IDs follow the [documented SDK interface](https://developer.android.com/tools/sdkmanager); exact platform/tools repository revisions have not yet been resolved. [Android16 setup](https://developer.android.com/about/versions/16/setup-sdk) specifies compile/target36 and compatible36.x build tools. Cap8.5.1 requires Java21/AGP8.13/Gradle8.14.3; use the future project wrapper with verified distribution checksum, not a global Gradle installation.

Current documentation marks sdkmanager deprecated. The replacement [Android CLI](https://developer.android.com/tools/agents/android-cli) currently documents Windows PowerShell download and Windows emulator limitations. It was not installed; its AGP9 default template must not replace the canonical Capacitor project. Root can evaluate it separately once SDK authorization is concrete.

No emulator/system image, NDK, CMake, production signing, native project generation or iOS build occurred. Recheck free disk space before further packages. No claim of SDK acceptance, Android build readiness or native test success is made.

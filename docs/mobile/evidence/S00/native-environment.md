# S00 native environment readiness

Checked 2026-09-04 19:24 UTC against canonical main `e073b21acfea854b3b573aa4613215156957ff38`. This is environment evidence; no native build or release readiness is claimed.

## Available and missing

| Area | Observed |
| --- | --- |
| Host | Windows x64; Node 24.20.0, npm 11.19.0, Git, GitHub CLI and SSH available |
| Android | No Java/JDK, Gradle, SDK, adb, sdkmanager, emulator or Android CLI found on PATH or inspected standard locations |
| iOS | Xcode unavailable locally; no configured macOS host discovered |
| Repository | No Capacitor/native dependencies, android/ios projects or Gradle wrapper yet |
| Existing CI | 15 workflows use Ubuntu, plus one Windows workflow; no macOS/native workflow. Recent GitHub Actions job read confirms working Ubuntu Actions |
| Disk | C: 3.5 GiB free; D: 94.8 GiB free. Native caches and SDK should use the existing writable task directory on D |
| Virtualization | Unknown: read-only processor query was denied |
| Downloads | Three direct binary HEAD requests failed with HttpRequestException; documentation retrieval succeeded |

No installation, binary download, workflow dispatch, secrets reading, signing or production action was performed. Discovery was scoped, not an exhaustive disk search.

## Concrete S04 preparation

Use `D:/CodexData/.codex/visualizations/2026/09/04/01a06dd0-30ba-7fe1-9637-858d87ac1ff5/native-toolchain` for portable tools, SDK, Gradle/AVD caches and temporary build outputs. Keep environment changes process-local.

1. Download and hash **Microsoft OpenJDK 21.0.12.1 Windows x64 ZIP** and **Android command-line tools build 15859902**. Official links and the published Android checksum are in the JSON. JDK checksum still needs retrieval. [JDK](https://learn.microsoft.com/en-us/java/openjdk/download), [Android downloads](https://developer.android.com/studio#command-line-tools-only)
2. Install only stable `platforms;android-36`, `build-tools;36.0.0` and `platform-tools` initially; record resolved package versions. Add emulator images after disk and acceleration checks. [SDK package syntax](https://developer.android.com/tools/sdkmanager)
3. At S04, add locked **Capacitor 8.5.1** to the canonical application and generate its native projects. Its Android source requires Java 21, AGP 8.13.0 and API 36/min24; the v8 migration guide specifies Gradle wrapper 8.14.3. Use the project's wrapper, not global Gradle. Verify generated versions before building. [Release](https://github.com/ionic-team/capacitor/releases/tag/8.5.1), [Android source](https://raw.githubusercontent.com/ionic-team/capacitor/8.5.1/android/capacitor/build.gradle), [Wrapper](https://capacitorjs.com/docs/updating/8-0)
4. Preserve lifecycle carefully: Capacitor 8.5 adds UIScene, while 8.5.1 includes proxy-navigation and SPM fixes. Retest locale changes, resume, links and bridge identity. [UIScene migration](https://capacitorjs.com/docs/updating/8-5)

The new Android CLI offers layout inspection and Journeys. Its current Windows limitations disable the emulator command and do not support PowerShell download. Evaluate these capabilities on a compatible runner; retain the documented command-line-tools route for this Windows bootstrap. [Official CLI](https://developer.android.com/tools/agents/android-cli)

## Feasible macOS route

The repository is public with working Actions. Standard GitHub-hosted **macos-26-intel** is a feasible future simulator runner; the official image lists **Xcode 26.6 / 17F113** and **iOS 26.5** iPhone/iPad simulators. [Runner availability](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [Image contents](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)

Prepare a separate artifact-only job with explicit Xcode selection, local bundled web assets and unsigned simulator build/test. Capture actual image version, Xcode/SDK, commit and RU/EN iPhone/iPad results. No store/deploy steps or production credentials are needed for this check. Repository execution permissions and runner policy have not been verified; no macOS job was dispatched. Simulator success will not establish physical-device graphics, payment, signing or store release readiness.

Machine-readable inventory, direct download references, limitations and observed CI metadata: `native-environment.json`.


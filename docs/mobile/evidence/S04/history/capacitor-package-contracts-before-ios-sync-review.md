# S04: official Capacitor package contracts

Access date: 2026-09-05. Package intake only; native build, device verification and S04 acceptance remain open. No root dependency/source changes, npm install/ci, lifecycle scripts, Capacitor generation/sync, SDK installation, license acceptance or production action occurred in this subtask.

This is historical package/source intake before native implementation, not a statement about later working-tree activity.

The [machine-readable manifest](capacitor-package-contracts.json) records exact npm registry URLs, raw metadata SHA256, published timestamps, dist integrity, downloaded SHA256, peer/engine requirements and 48 inspected source files with SHA256 and line anchors. Nine tarballs passed both registry SHA512 SRI and legacy SHA1 checks. This binds bytes to HTTPS registry metadata; npm signature/provenance attestations were not independently verified. Package license metadata is MIT. No npm global cache was used: direct registry downloads and inspected templates live under `.tmp/native-bootstrap/`.

| Package | Exact selected version | Observed latest | Core peer / Node engine |
| --- | --- | --- | --- |
| @capacitor/core | 8.5.1 | 8.5.1 | No engine field |
| @capacitor/cli | 8.5.1 | 8.5.1 | Node >=22.0.0 |
| @capacitor/android | 8.5.1 | 8.5.1 | core ^8.5.0 |
| @capacitor/ios | 8.5.1 | 8.5.1 | core ^8.5.0 |
| @capacitor/app | 8.1.1 | 8.1.1 | core >=8.0.0 |
| @capacitor/network | 8.0.1 | 8.0.1 | core >=8.0.0 |
| @capacitor/preferences | 8.0.1 | 8.0.1 | core >=8.0.0 |
| @capacitor/browser | 8.0.4 | 8.0.4 | core >=8.0.0 |
| @capacitor/app-launcher | 8.0.1 | 8.0.1 | core >=8.0.0 |

The first four versions are explicitly pinned. Plugin versions are the highest stable 8.x versions actually observed in the registry, not assumed equal to core. Peer compatibility is not a native build result. Each exact tarball URL and full integrity string is in the corresponding `packages[]` record, together with the original registry snapshot. [Official registry: core 8.5.1](https://registry.npmjs.org/@capacitor%2fcore/8.5.1), [App 8.1.1](https://registry.npmjs.org/@capacitor%2fapp/8.1.1), [App Launcher 8.0.1](https://registry.npmjs.org/@capacitor%2fapp-launcher/8.0.1).

## Actual plugin interfaces and behavior

**App:** `getState(): Promise<{isActive:boolean}>`; `getAppLanguage(): Promise<{value:string}>`; `addListener('appStateChange'|'pause'|'resume', callback): Promise<PluginListenerHandle>`. A handle owns asynchronous `remove()`. Use only owned handles; `removeAllListeners()` would affect other consumers. Android pause/resume comes from activity lifecycle, with resume emitted after the activity has previously paused. iOS App 8.1.1 observes UIApplication notifications and reads application state. Native plugin loading has its own lifecycle even if the JS adapter subscribes lazily. Source IDs: `app.types`, `app.android`, `app.ios`, `core.types`. [App API](https://capacitorjs.com/docs/apis/app).

**Language is read-only and singular:** Android gets the first app locale, otherwise `Locale.getDefault()`, then returns `getLanguage()` without region. iOS returns `Bundle.main.preferredLocalizations.first`. These are not the ranked device-language list, not a native locale setter, and not locale-change events. Validate returned values despite the TS string declaration. The Web implementation reads `navigator.language`; using it as a silent native fallback would hide missing plugin binding. All five inspected plugins lack a native language setter. Do not claim complete native language switching from this API.

**Network:** `getStatus(): Promise<{connected:boolean,connectionType:'wifi'|'cellular'|'none'|'unknown'}>` plus `networkStatusChange`. Android checks both INTERNET and VALIDATED network capabilities and starts/stops monitoring on resume/pause. iOS uses Reachability; failed monitor initialization can resolve as disconnected. Neither establishes that the license/support endpoint is reachable or authorized. The plugin adds Android `ACCESS_NETWORK_STATE`; no runtime permission prompt follows from this manifest declaration alone. Source IDs: `network.types`, `network.android`, `network.android-plugin`, `network.android-manifest`, `network.ios`, `network.ios-plugin`. [Network API](https://capacitorjs.com/docs/apis/network).

**Preferences:** `get({key}): Promise<{value:string|null}>`, `set({key,value}): Promise<void>`, `remove({key}): Promise<void>`. Android invokes `SharedPreferences.Editor.apply()`; iOS uses `UserDefaults.standard` with a group prefix. Resolution/readback confirms current acceptance, not an fsync/durable commit. Keep the host preference port `best-effort`. Missing keys reject, while a malformed/missing value behaves differently on Android and iOS; validate exact permitted string keys and values before calling either plugin. Serialize writes per key; verify readback, expose failure, and keep current in-memory user choice if persistence fails. Do not store secrets, ownership proofs or catalog data, and do not expose group-wide clear/migrate operations. Source IDs: `preferences.types`, `preferences.android`, `preferences.android-plugin`, `preferences.ios`, `preferences.ios-plugin`. [Preferences API](https://capacitorjs.com/docs/apis/preferences).

**Browser:** `open({url,...}): Promise<void>`. iOS prepares SFSafariViewController for HTTP/HTTPS only. Android parses a Uri and launches Custom Tabs without the product's strict HTTPS/credentials/control-character checks. Validate URL and host/child policy before any SDK call. Do not use the Browser Web fallback in the public graph: its `window.open` lacks our explicit noopener/noreferrer policy. Promise completion is not successful page/account navigation. `browserPageLoaded` covers the initial page only; the iOS implementation emits it without checking the initial-load success boolean. Source IDs: `browser.types`, `browser.android`, `browser.android-plugin`, `browser.ios`, `browser.ios-plugin`, `browser.web`. [Browser API](https://capacitorjs.com/docs/apis/browser).

**Canonical support email needs App Launcher, not Browser:** the minimal official extension is `@capacitor/app-launcher@8.0.1`. Its exact methods are `canOpenUrl({url}): Promise<{value:boolean}>` and `openUrl({url}): Promise<{completed:boolean}>` - lowercase `Url`, not `URL`. iOS calls UIApplication.open; Android tries ACTION_VIEW/startActivity and returns false when no handler succeeds. `completed` indicates OS handoff, never that an email was composed or delivered. Allow exactly `mailto:probperasite@yandex.ru` for the current support action; arbitrary schemes/package IDs, recipients or injected cc/bcc do not become permitted. Source IDs: `app-launcher.types`, `app-launcher.android`, `app-launcher.ios`, `app-launcher.readme`. [App Launcher API](https://capacitorjs.com/docs/apis/app-launcher).

Calling `openUrl` does not require a preliminary `canOpenUrl` probe. If the UI uses such a probe, declare only the required mailto scheme in iOS `LSApplicationQueriesSchemes` and Android 11+ `<queries>` with ACTION_VIEW/data scheme mailto. A false query can reflect missing visibility declarations, so it is not unconditional proof of no installed handler. Root selected `OpenLinkResult | Promise<OpenLinkResult>`. Native adapters await the real plugin result: policy rejection returns `blocked`, rejection or `completed:false` returns `unavailable`, and successful OS handoff returns `requested`. Public Web may retain synchronous behavior. Never announce successful page navigation or mail delivery.

## Inspected native templates

Three nested CLI archives were inspected with exact members and hashes; selected text was copied only to `.tmp/native-bootstrap/template-inspection/`, not generated as an app.

| Boundary | Shipped Capacitor 8.5.1 value | Required integration work |
| --- | --- | --- |
| Android SDK | min 24, compile 36, target 36 | Verify installed SDK/tools and current store target policy separately |
| Android toolchain | AGP 8.13.0, Gradle wrapper 8.14.3; core source/target Java 21 | Use environment-owner verified JDK/CLI setup; no SDK license acceptance here |
| Android strings | Only default `values/strings.xml`: My App and placeholder IDs | Add actual RU/EN resource variants and supported app-locale declaration; replace placeholders |
| Android variants | No product flavors in shipped app build.gradle | Add explicit dev/Google Play/RuStore variants later with adapter boundaries; no speculative billing SDK |
| Android activity | `locale`, `density` and existing configChanges flags; singleTask | Preserve configuration handling and verify real state/Canvas retention on devices |
| Android backup | Template allowBackup=true | Explicit product policy before storing sensitive/native data; template is not final policy |
| iOS | Deployment 15.0; device families 1,2; knownRegions en/Base | Actual RU/EN resources, app labels and native usage strings remain to implement |
| iOS lifecycle | SceneDelegate, UIScene manifest, multiple scenes false | Keep 8.5 scene forwarding; verify cold/warm URL and foreground/background behavior |
| iOS package manager | SPM is default; CocoaPods template also shipped | Resolve exact native dependency graph on macOS; no simulator/build result here |
| iOS privacy | No application PrivacyInfo.xcprivacy in either template; core manifest has empty API list | Add required app declarations for actual APIs; do not infer compliance from the core file |

The app Preferences README specifies UserDefaults as a required-reason API and recommends CA92.1 for appropriate app-only settings. That needs an app privacy manifest and a check against actual usage, not blindly copying every reason. Source IDs: `preferences.readme`, `ios.privacy`; template member inventories establish the missing application manifest. [Privacy manifest guidance](https://capacitorjs.com/docs/ios/privacy-manifest).

The raw SPM template uses `from: "8.0.0"`; CLI update.js rewrites the dependency to `from: <installed iOS package version>`. That remains a range. Exact npm pins alone do not lock the Swift package resolution: later capture and verify Package.resolved/locked resolution. This is a preparation dependency gap, not an instruction to hand-edit generated files now.

The 8.0 documentation requires Node 22+, Xcode 26+ and iOS 15+. The 8.5 documentation adds the scene lifecycle changes; the exact 8.5.1 package templates already contain SceneDelegate. [8.0 upgrade requirements](https://capacitorjs.com/docs/updating/8-0), [8.5 scene migration](https://capacitorjs.com/docs/updating/8-5). Android SDK command selection is separate: current [sdkmanager documentation](https://developer.android.com/tools/sdkmanager) marks it deprecated and points to Android CLI. Do not present sdkmanager as the preferred current interface or confuse that CLI change with the pinned Gradle/AGP template requirements. The environment owner retains the SDK license gate.

## Proposed shared integration boundary

Use one SDK-free `createHostPlatformServices(host)` implementation receiving structural capabilities. Android/iOS adapters alone import actual Capacitor plugins and inject them. Keep public Web/PWA on its existing adapter. No native SDK import belongs in the canonical shared App/globe/catalog/locale graph; no second scene or database is introduced.

Resolve app language and the canonical non-secret language preference before the single provider mount, with bounded timeout and explicit fallback status. Cache an immutable language snapshot for the existing synchronous `getSystemLanguages`; never start native work in `getSnapshot`. Late initialization cannot overwrite a user's newer selection. Preserve `resolveInitialInterfaceLanguage` precedence: explicit route, saved RU/EN, validated native preference, existing controlled fallback. Add narrow optional inputs/persistence to the same InterfaceLanguageProvider rather than mounting a second language store. Global RU/EN changes update that provider and serialize preference writes without changing its key, Canvas, renderer, camera or host activity. Native OS language setters that recreate an activity are not an acceptable shortcut.

First/last subscription owns JS native listener handles. Account for asynchronous listener registration completing after cleanup: remove that returned handle immediately. Use lifetime/event epochs so stale `getState`/`getStatus` responses cannot overwrite later events or a disposed host. Keep stable immutable snapshots until a value changes. Refresh only necessary state on resume; no catalog reload or duplicate subscription tree.

Use bundled local webDir content, default localhost with Android HTTPS and iOS capacitor scheme as documented. `server.url`, remote `allowNavigation`, cleartext live-reload and a remote WebView runtime are excluded. Current CLI types explicitly mark the remote options as development features. Native account/backend paths still need their own validated bridge policy; Browser/AppLauncher do not authorize content or entitlements. [Configuration contract](https://capacitorjs.com/docs/config).

Next meaningful checks after authorized implementation: late listener resolution after unsubscribe/StrictMode, async snapshot/event ordering, preference rejection and serialized writes, safe HTTPS and exact mailto failure outcomes, native app-locale initialization, real RU/EN same-Canvas lifecycle, compiled strings/privacy resources and exact native dependency resolution. This intake accepts none of those future runtime checks.

param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$expectedSource)
$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
if ($repoRoot -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work') { throw 'Unexpected checkout' }
$out = Join-Path $repoRoot 'docs/mobile/evidence/S13/writer-study-20260920/android-a1'
if (Test-Path -LiteralPath $out) { throw 'Preserve prior build attempt' }
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = $repoRoot.Replace('\', '/')
if ((& git rev-parse HEAD).Trim() -ne $expectedSource) { throw 'Unexpected source HEAD' }
$paths = @('src', 'apps/mobile/android', 'native.html', 'vite.native.config.ts', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'capacitor.config.json', 'data/book-canon-source-registry.json', 'scripts/mobile/build-native.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-artifact.mjs')
if (& git status --porcelain --untracked-files=all -- $paths) { throw 'Build source is not committed' }
$prior = Get-Content -Raw -LiteralPath 'docs/mobile/evidence/S13/ceramic-portraits-20260920/android-a1/result.json' | ConvertFrom-Json
if ($prior.pass -ne $true -or $prior.checks.exactCopiedBytes -ne $true -or $prior.buildId -ne 'b537c81d509863d0821d04588f133b25ce8db18b5b19dafbba30639ddcf42950') { throw 'Unexpected prior Android evidence' }
if (-not (Test-Path -LiteralPath $prior.artifact.path -PathType Container) -or -not (Test-Path -LiteralPath (Split-Path -Parent $prior.apk.path) -PathType Container)) { throw 'Prior Android preserved directory is absent' }
foreach ($entry in @(@{path='dist-native/artifact.json';sha=$prior.artifact.sha256}, @{path=($prior.artifact.path + '/artifact.json');sha=$prior.artifact.sha256}, @{path=$prior.apk.path;sha=$prior.apk.sha256}, @{path='apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk';sha=$prior.apk.sha256})) {
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $entry.path).Hash.ToLowerInvariant() -ne $entry.sha) { throw 'Prior manifest/APK preservation mismatch' }
}
New-Item -ItemType Directory -Path $out | Out-Null
$began = [DateTimeOffset]::UtcNow
node scripts/mobile/build-native.mjs android dev *> (Join-Path $out 'native-build.log')
if ($LASTEXITCODE -ne 0) { throw 'Native JS build failed; keep report' }
$artifact = Get-Content -Raw -LiteralPath 'dist-native/artifact.json' | ConvertFrom-Json
if ($artifact.sourceCommit -ne $expectedSource) { throw 'Wrong built source' }
node scripts/mobile/verify-native-artifact.mjs *> (Join-Path $out 'native-artifact-audit.json')
if ($LASTEXITCODE -ne 0) { throw 'Strict native runtime audit failed' }
node node_modules/@capacitor/cli/bin/capacitor sync android *> (Join-Path $out 'sync-android.log')
if ($LASTEXITCODE -ne 0) { throw 'Native sync failed' }
$toolRoot = Join-Path $repoRoot '.tmp/native-tools'
$env:JAVA_HOME = Join-Path $toolRoot 'java/jdk-21.0.12.1+1'
$env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-user'
$env:TEMP = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-ws/temp'
$env:TMP = $env:TEMP
$env:JAVA_OPTS = '-Duser.home="' + (Join-Path $toolRoot 'tool-user') + '" -Djava.io.tmpdir="' + $env:TEMP + '"'
& './apps/mobile/android/gradlew.bat' -p './apps/mobile/android' :app:assembleDevDebug --offline --no-daemon --max-workers=2 *> (Join-Path $out 'assemble-dev-debug.log')
if ($LASTEXITCODE -ne 0) { throw 'Android assembly failed; keep log' }
$apkPath = Join-Path $repoRoot 'apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'
$buildTools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
& (Join-Path $buildTools 'aapt2.exe') dump badging $apkPath *> (Join-Path $out 'android-dev-apk-aapt2-badging.txt')
if ($LASTEXITCODE -ne 0) { throw 'Badging failed' }
& (Join-Path $buildTools 'aapt2.exe') dump xmltree $apkPath --file AndroidManifest.xml *> (Join-Path $out 'android-dev-apk-manifest.txt')
if ($LASTEXITCODE -ne 0) { throw 'Manifest check failed' }
& (Join-Path $buildTools 'aapt2.exe') dump xmltree $apkPath --file res/xml/locales_config.xml *> (Join-Path $out 'android-dev-apk-locales.txt')
if ($LASTEXITCODE -ne 0) { throw 'Locale check failed' }
& (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $apkPath *> (Join-Path $out 'android-dev-apk-signature.txt')
if ($LASTEXITCODE -ne 0) { throw 'Signature check failed' }
& (Join-Path $buildTools 'zipalign.exe') -c -P 16 -v 4 $apkPath *> (Join-Path $out 'android-dev-apk-zipalign.txt')
if ($LASTEXITCODE -ne 0) { throw 'Alignment check failed' }
node docs/mobile/evidence/S13/writer-study-20260920/verify-android.mjs --expected-build-id $artifact.buildId *> (Join-Path $out 'apk-inspection.log')
if ($LASTEXITCODE -ne 0) { throw 'Actual APK inspection failed' }
if ((& git rev-parse HEAD).Trim() -ne $expectedSource -or (& git status --porcelain --untracked-files=all -- $paths)) { throw 'Source changed during build' }
$result = [ordered]@{pass=$true;sourceCommit=$expectedSource;buildId=$artifact.buildId;startedAt=$began.ToString('o');durationSeconds=([DateTimeOffset]::UtcNow-$began).TotalSeconds;task=':app:assembleDevDebug';offline=$true;registrySourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'data/book-canon-source-registry.json').Hash.ToLowerInvariant();deviceTested=$false;iosCompiled=$false;releaseReady=$false}
$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $out 'build-run.json')
([pscustomobject]$result) | Select-Object pass,sourceCommit,buildId,durationSeconds | ConvertTo-Json

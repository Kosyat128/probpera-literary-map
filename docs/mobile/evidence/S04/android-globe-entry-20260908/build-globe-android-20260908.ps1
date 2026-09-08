$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
if ($repoRoot -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work') { throw 'Unexpected checkout' }
$reportRoot = Join-Path $repoRoot '.tmp/native-globe-entry-20260908'
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0=$repoRoot.Replace('\','/')
node scripts/mobile/verify-native-artifact.mjs *> (Join-Path $reportRoot 'native-artifact-audit.json')
if ($LASTEXITCODE -ne 0) { throw 'Native artifact audit failed' }
node node_modules/@capacitor/cli/bin/capacitor sync android *> (Join-Path $reportRoot 'sync-android.log')
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
$toolRoot = Join-Path $repoRoot '.tmp/native-tools'
$env:JAVA_HOME = Join-Path $toolRoot 'java/jdk-21.0.12.1+1'
$env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-user'
$env:TEMP = Join-Path $toolRoot 'tool-temp'
$env:TMP = $env:TEMP
$env:JAVA_OPTS = '-Duser.home="' + (Join-Path $toolRoot 'tool-user') + '" -Djava.io.tmpdir="' + $env:TEMP + '"'
$started = [DateTimeOffset]::UtcNow
& './apps/mobile/android/gradlew.bat' -p './apps/mobile/android' :app:assembleDevDebug --offline --no-daemon --max-workers=2 *> (Join-Path $reportRoot 'assemble-dev-debug.log')
$gradleExit = $LASTEXITCODE
$duration = ([DateTimeOffset]::UtcNow - $started).TotalSeconds
if ($gradleExit -ne 0) { Get-Content (Join-Path $reportRoot 'assemble-dev-debug.log') -Tail 30; throw 'Gradle failed' }
$apkPath = Join-Path $repoRoot 'apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'
$buildTools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
& (Join-Path $buildTools 'aapt2.exe') dump badging $apkPath *> (Join-Path $reportRoot 'android-dev-apk-aapt2-badging.txt')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 badging failed' }
& (Join-Path $buildTools 'aapt2.exe') dump xmltree $apkPath --file AndroidManifest.xml *> (Join-Path $reportRoot 'android-dev-apk-manifest.txt')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 manifest failed' }
& (Join-Path $buildTools 'aapt2.exe') dump xmltree $apkPath --file res/xml/locales_config.xml *> (Join-Path $reportRoot 'android-dev-apk-locales.txt')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 locales failed' }
& (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $apkPath *> (Join-Path $reportRoot 'android-dev-apk-signature.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
& (Join-Path $buildTools 'zipalign.exe') -c -P 16 -v 4 $apkPath *> (Join-Path $reportRoot 'android-dev-apk-zipalign.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed' }
[ordered]@{pass=$true;startedAt=$started.ToString('o');durationSeconds=$duration;task=':app:assembleDevDebug';offline=$true;deviceTested=$false;releaseReady=$false} | ConvertTo-Json | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $reportRoot 'build-run.json')
Get-Content (Join-Path $reportRoot 'assemble-dev-debug.log') -Tail 5
Get-FileHash -Algorithm SHA256 -LiteralPath $apkPath | Select-Object Hash


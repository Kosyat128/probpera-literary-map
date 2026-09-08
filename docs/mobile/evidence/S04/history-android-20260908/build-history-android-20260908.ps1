param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-f0-9]{40}$')]
  [string]$ExpectedSourceCommit
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
if ($repoRoot -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work') { throw 'Unexpected checkout' }
$reportRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.tmp/history-android-20260908'))
if (-not $reportRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Uncontained report path' }
if (Test-Path -LiteralPath $reportRoot) { throw 'Report directory already exists; preserve prior output and select a reviewed new run directory' }
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = $repoRoot.Replace('\', '/')
$sourceHead = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceHead -ne $ExpectedSourceCommit) { throw 'HEAD differs from the explicitly expected source commit' }
$sourcePaths = @('src', 'native.html', 'vite.native.config.ts', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'capacitor.config.json', 'data/book-canon-source-registry.json', 'scripts/mobile/build-native.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-artifact.mjs')
$sourceDirty = & git status --porcelain --untracked-files=all -- $sourcePaths
if ($LASTEXITCODE -ne 0 -or $sourceDirty) { throw 'Commit all native source inputs before building this exact source checkpoint' }
$registryPath = Join-Path $repoRoot 'data/book-canon-source-registry.json'
$registrySha256 = (Get-FileHash -LiteralPath $registryPath -Algorithm SHA256).Hash.ToLowerInvariant()
# Refuse to replace the working APK unless the previous immutable copy still
# matches its already recorded runtime and binary identities.
$priorEvidence = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'docs/mobile/evidence/S04/capacity-android-20260908/result.json') | ConvertFrom-Json
foreach ($item in @(
  @{Relative='dist-native/artifact.json'; Sha256=$priorEvidence.artifact.sha256},
  @{Relative=($priorEvidence.artifact.path + '/artifact.json'); Sha256=$priorEvidence.artifact.sha256},
  @{Relative='apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'; Sha256=$priorEvidence.apk.sha256},
  @{Relative=$priorEvidence.apk.path; Sha256=$priorEvidence.apk.sha256}
)) {
  $priorPath = [IO.Path]::GetFullPath((Join-Path $repoRoot $item.Relative))
  if (-not $priorPath.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Uncontained historical artifact path' }
  if ((Get-Item -LiteralPath $priorPath).LinkType) { throw 'Linked historical artifact is forbidden' }
  if ((Get-FileHash -LiteralPath $priorPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.Sha256) { throw 'Previous runtime/APK preservation identity differs' }
}

New-Item -ItemType Directory -Path $reportRoot | Out-Null

node scripts/mobile/build-native.mjs android dev *> (Join-Path $reportRoot 'native-build.log')
if ($LASTEXITCODE -ne 0) { throw 'Native source build failed; preserve the unique report folder' }
$artifact = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'dist-native/artifact.json') | ConvertFrom-Json
if ($artifact.sourceCommit -ne $ExpectedSourceCommit -or $artifact.platform -ne 'android' -or $artifact.channel -ne 'dev' -or $artifact.buildId -notmatch '^[a-f0-9]{64}$') { throw 'Unexpected freshly built artifact identity' }
$registryInputs = @($artifact.sourceInputs.files | Where-Object { $_.path -eq 'data/book-canon-source-registry.json' })
if ($registryInputs.Count -ne 1 -or $registryInputs[0].sha256 -ne $registrySha256) { throw 'Canonical authority registry is not bound to this source snapshot' }

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
if ($gradleExit -ne 0) { throw 'Gradle failed; preserve the unique transcript' }
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
$endHead = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $endHead -ne $ExpectedSourceCommit) { throw 'Source HEAD changed during build' }
$sourceDirtyAfter = & git status --porcelain --untracked-files=all -- $sourcePaths
if ($LASTEXITCODE -ne 0 -or $sourceDirtyAfter) { throw 'Native source inputs changed during build' }
if ((Get-FileHash -LiteralPath $registryPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $registrySha256) { throw 'Canonical authority registry changed during build' }
$taskSummary = [regex]::Match((Get-Content -Raw -LiteralPath (Join-Path $reportRoot 'assemble-dev-debug.log')), '(?m)^(\d+) actionable tasks: (.+)\r?$')
if (-not $taskSummary.Success) { throw 'Gradle task summary missing; do not invent task counts' }
$taskCounts = @{}
foreach ($entry in @(@('executed', 'executed'), @('upToDate', 'up-to-date'), @('fromCache', 'from-cache'))) {
  $taskCount = [regex]::Match($taskSummary.Groups[2].Value, '(\d+) ' + $entry[1])
  $taskCounts[$entry[0]] = if ($taskCount.Success) { [int]$taskCount.Groups[1].Value } else { 0 }
}
[ordered]@{pass=$true;sourceCommit=$ExpectedSourceCommit;buildId=$artifact.buildId;registrySourceSha256=$registrySha256;startedAt=$started.ToString('o');durationSeconds=$duration;task=':app:assembleDevDebug';offline=$true;actionableTasks=[int]$taskSummary.Groups[1].Value;executed=$taskCounts.executed;upToDate=$taskCounts.upToDate;fromCache=$taskCounts.fromCache;deviceTested=$false;releaseReady=$false} | ConvertTo-Json | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $reportRoot 'build-run.json')
node .tmp/native-bootstrap/verify-history-android-20260908.mjs --expected-build-id $artifact.buildId *> (Join-Path $reportRoot 'apk-verifier-transcript.json')
if ($LASTEXITCODE -ne 0) { throw 'Actual APK byte inspection failed' }
Get-Content -Raw -LiteralPath (Join-Path $reportRoot 'android-dev-apk-verification.json')

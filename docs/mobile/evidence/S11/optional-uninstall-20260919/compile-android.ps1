$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
if ($repoRoot -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work') { throw 'Unexpected checkout' }
$out = Join-Path $repoRoot 'docs/mobile/evidence/S11/optional-uninstall-20260919/android-compile-a1'
if (Test-Path -LiteralPath $out) { throw 'Preserve prior attempt' }
New-Item -ItemType Directory -Path $out | Out-Null
$sourcePaths = @('apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetContentStorePlugin.java', 'apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/MainActivity.java', 'apps/mobile/android/app/build.gradle', 'apps/mobile/android/variables.gradle', 'apps/mobile/android/build.gradle', 'apps/mobile/android/settings.gradle', 'apps/mobile/android/gradle/wrapper/gradle-wrapper.properties')
$before = @($sourcePaths | ForEach-Object { [ordered]@{path=$_;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot $_)).Hash.ToLowerInvariant()} })
$toolRoot = Join-Path $repoRoot '.tmp/native-tools'
$env:JAVA_HOME = Join-Path $toolRoot 'java/jdk-21.0.12.1+1'
$env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-user'
$env:TEMP = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-uninstall/temp'
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$env:TMP = $env:TEMP
$env:JAVA_OPTS = '-Duser.home="' + (Join-Path $toolRoot 'tool-user') + '" -Djava.io.tmpdir="' + $env:TEMP + '"'
$began = [DateTimeOffset]::UtcNow
& './apps/mobile/android/gradlew.bat' -p './apps/mobile/android' :app:compileDevDebugJavaWithJavac --offline --no-daemon --max-workers=2 *> (Join-Path $out 'gradle.log')
$compileExit = $LASTEXITCODE
$after = @($sourcePaths | ForEach-Object { [ordered]@{path=$_;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot $_)).Hash.ToLowerInvariant()} })
$unchanged = ($before | ConvertTo-Json -Depth 5 -Compress) -ceq ($after | ConvertTo-Json -Depth 5 -Compress)
$result = [ordered]@{kind='native-java-compilation';startedAt=$began.ToString('o');durationSeconds=([DateTimeOffset]::UtcNow-$began).TotalSeconds;exitCode=$compileExit;sourceInputs=$before;sourceInputsUnchanged=$unchanged;pass=($compileExit -eq 0 -and $unchanged);apkBuilt=$false;deviceTested=$false;iosCompiled=$false;releaseReady=$false}
$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $out 'result.json')
$result | Select-Object kind,exitCode,pass,durationSeconds | ConvertTo-Json
if (-not $result.pass) { Get-Content -LiteralPath (Join-Path $out 'gradle.log') -Tail 65; throw 'Native compile failed' }

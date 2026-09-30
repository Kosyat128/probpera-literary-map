param(
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceCommit,
  [Parameter(Mandatory)][string]$SourceManifestPath,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceManifestSha256
)
$ErrorActionPreference = 'Stop'
$repoRoot = 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
$recipeRoot = $PSScriptRoot
$outRoot = Join-Path $recipeRoot 'android-a1'
$artifactRoot = 'D:\CodexData\.codex\visualizations\2026\09\20\01a0bd7e-e7b5-7111-b319-db1a60746e94\s15-booky-reader-foreground-runtime-build-evidence\attempt-a1\android'
$rawRoot = Join-Path $artifactRoot 'android-a1-raw'
$toolRoot = Join-Path $repoRoot '.tmp\native-tools'
$nodeExe = @(Get-Command node -CommandType Application)[0].Source
$boundArgs = @($SourceCommit,$SourceManifestPath,$SourceManifestSha256)
$encoding = [Text.UTF8Encoding]::new($false)
$variables = @{
  JAVA_HOME = Join-Path $toolRoot 'java\jdk-21.0.12.1+1'
  ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
  ANDROID_SDK_ROOT = Join-Path $toolRoot 'android-sdk'
  ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
  GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-user'
  JAVA_OPTS = '-Duser.home="' + (Join-Path $toolRoot 'tool-user') + '" -Djava.io.tmpdir="' + (Join-Path $artifactRoot 'temp') + '"'
  TEMP = Join-Path $artifactRoot 'temp'
  TMP = Join-Path $artifactRoot 'temp'
  GIT_CONFIG_COUNT = '3'
  GIT_CONFIG_KEY_0 = 'safe.directory'
  GIT_CONFIG_VALUE_0 = $repoRoot.Replace('\','/')
  GIT_CONFIG_KEY_1 = 'core.autocrlf'
  GIT_CONFIG_VALUE_1 = 'false'
  GIT_CONFIG_KEY_2 = 'safe.directory'
  GIT_CONFIG_VALUE_2 = 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work'
}
$previous = @{}
foreach ($key in $variables.Keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key,'Process') }
function Write-NewJson([string]$file,[object]$value) {
  if (Test-Path -LiteralPath $file) { throw "Immutable result exists: $file" }
  [IO.File]::WriteAllText($file,(ConvertTo-Json -InputObject $value -Depth 10)+"`n",$encoding)
}
function Invoke-Recorded([string]$Name,[string]$Executable,[string[]]$Arguments,[string]$WorkingDirectory=$repoRoot) {
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $Executable; $start.WorkingDirectory = $WorkingDirectory
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
  $began = [DateTimeOffset]::UtcNow; $timer = [Diagnostics.Stopwatch]::StartNew()
  if (-not $process.Start()) { throw "Child not started: $Name" }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync(); $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit(); $timer.Stop()
  $stdout = $stdoutTask.GetAwaiter().GetResult(); $stderr = $stderrTask.GetAwaiter().GetResult()
  $logs = @{}
  foreach ($stream in @('stdout','stderr')) {
    $logPath = Join-Path $outRoot ($Name+'-'+$stream+'.log')
    if (Test-Path -LiteralPath $logPath) { throw 'Immutable child log exists' }
    $contents = if ($stream -eq 'stdout') { $stdout } else { $stderr }
    [IO.File]::WriteAllText($logPath,$contents,$encoding)
    $logs[$stream] = @{path=$logPath;bytes=([IO.FileInfo]$logPath).Length;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $logPath).Hash.ToLowerInvariant()}
  }
  $execution = @{command=@($Executable)+$Arguments;cwd=$WorkingDirectory;startedAt=$began.ToString('o');exitCode=$process.ExitCode;durationMs=$timer.ElapsedMilliseconds;stdout=$logs.stdout;stderr=$logs.stderr}
  Write-NewJson (Join-Path $outRoot ($Name+'-execution.json')) $execution
  if ($process.ExitCode -ne 0) { throw "$Name failed: actual exit $($process.ExitCode)" }
  return @{stdout=$stdout;execution=$execution}
}
try {
  foreach ($key in $variables.Keys) { [Environment]::SetEnvironmentVariable($key,$variables[$key],'Process') }
  foreach ($directory in @($outRoot,$artifactRoot)) { if (Test-Path -LiteralPath $directory) { throw "Fresh attempt required: $directory" } }
  New-Item -ItemType Directory -Path $outRoot | Out-Null
  New-Item -ItemType Directory -Path $rawRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $variables.TEMP | Out-Null
  $guard = Join-Path $recipeRoot 'guard-build.mjs'
  $null = Invoke-Recorded 'source-before' $nodeExe (@($guard)+$boundArgs)
  $builderRealpathRun = Invoke-Recorded 'native-builder-realpath' $nodeExe @('-e','process.stdout.write(require("node:fs").realpathSync(process.argv[1]))',(Join-Path $repoRoot 'scripts\mobile\build-native.mjs'))
  $nativeBuilderPath = $builderRealpathRun.stdout.Trim()
  if (-not [IO.Path]::IsPathFullyQualified($nativeBuilderPath) -or -not (Test-Path -LiteralPath $nativeBuilderPath) -or -not $nativeBuilderPath.Replace('\','/').EndsWith('/scripts/mobile/build-native.mjs')) { throw 'Invalid native builder realpath' }
  $null = Invoke-Recorded 'native-build' $nodeExe @($nativeBuilderPath,'android','dev')
  $realpathRun = Invoke-Recorded 'native-audit-realpath' $nodeExe @('-e','process.stdout.write(require("node:fs").realpathSync(process.argv[1]))',(Join-Path $repoRoot 'scripts\mobile\verify-native-artifact.mjs'))
  $nativeAuditPath = $realpathRun.stdout.Trim()
  if (-not [IO.Path]::IsPathFullyQualified($nativeAuditPath) -or -not (Test-Path -LiteralPath $nativeAuditPath) -or -not $nativeAuditPath.Replace('\','/').EndsWith('/scripts/mobile/verify-native-artifact.mjs')) { throw 'Invalid actual primary native auditor realpath' }
  $auditRun = Invoke-Recorded 'native-artifact-audit' $nodeExe @($nativeAuditPath)
  if ([string]::IsNullOrWhiteSpace($auditRun.stdout)) { throw 'Primary native auditor returned no JSON' }
  $nativeAudit = ConvertFrom-Json -InputObject $auditRun.stdout
  if (-not $nativeAudit.pass) { throw 'Strict native audit did not pass' }
  Write-NewJson (Join-Path $outRoot 'native-artifact-audit.json') $nativeAudit
  $artifact = Get-Content -LiteralPath (Join-Path $repoRoot 'dist-native\artifact.json') -Raw | ConvertFrom-Json
  if ($artifact.sourceCommit -ne $SourceCommit -or $artifact.platform -ne 'android' -or $artifact.channel -ne 'dev') { throw 'Wrong actual native artifact identity' }
  $null = Invoke-Recorded 'capacitor-copy' $nodeExe @('node_modules/@capacitor/cli/bin/capacitor','copy','android')
  $javaExe = Join-Path $variables.JAVA_HOME 'bin\java.exe'
  $wrapperJar = Join-Path $repoRoot 'apps\mobile\android\gradle\wrapper\gradle-wrapper.jar'
  $signerJar = Join-Path $toolRoot 'android-sdk\build-tools\36.0.0\lib\apksigner.jar'
  foreach ($file in @($javaExe,$wrapperJar,$signerJar)) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required existing Java tool missing: $file" } }
  $javaScope = @(('-Duser.home='+(Join-Path $toolRoot 'tool-user')),('-Djava.io.tmpdir='+$variables.TEMP))
  $gradleArguments = @('-Xmx64m','-Xms64m')+$javaScope+@('-Dorg.gradle.appname=gradlew','-classpath',$wrapperJar,'org.gradle.wrapper.GradleWrapperMain','--offline','--no-daemon',':app:assembleDevDebug')
  $gradleRun = Invoke-Recorded 'assemble-dev-debug' $javaExe $gradleArguments (Join-Path $repoRoot 'apps\mobile\android')
  Write-NewJson (Join-Path $outRoot 'build-run.json') @{pass=$true;sourceCommit=$SourceCommit;buildId=$artifact.buildId;sourceManifest=@{path=$SourceManifestPath;sha256=$SourceManifestSha256;fileCount=1665};startedAt=$gradleRun.execution.startedAt;durationMs=$gradleRun.execution.durationMs;task=':app:assembleDevDebug';offline=$true;execution=$gradleRun.execution;deviceTested=$false;iosCompiled=$false;releaseReady=$false}
  $apk = Join-Path $repoRoot 'apps\mobile\android\app\build\outputs\apk\dev\debug\app-dev-debug.apk'
  $sdkTools = Join-Path $toolRoot 'android-sdk\build-tools\36.0.0'
  foreach ($entry in @(
    @('android-dev-apk-aapt2-badging','aapt2.exe',@('dump','badging',$apk)),
    @('android-dev-apk-manifest','aapt2.exe',@('dump','xmltree','--file','AndroidManifest.xml',$apk)),
    @('android-dev-apk-locales','aapt2.exe',@('dump','xmltree','--file','res/xml/locales_config.xml',$apk)),
    @('android-dev-apk-zipalign','zipalign.exe',@('-c','-P','16','-v','4',$apk))
  )) {
    $run = Invoke-Recorded $entry[0] (Join-Path $sdkTools $entry[1]) $entry[2]
    [IO.File]::WriteAllText((Join-Path $rawRoot ($entry[0]+'.txt')),$run.stdout,$encoding)
  }
  $signature = Invoke-Recorded 'android-dev-apk-signature' $javaExe ($javaScope+@('-jar',$signerJar,'verify','--verbose','--print-certs',$apk))
  [IO.File]::WriteAllText((Join-Path $rawRoot 'android-dev-apk-signature.txt'),$signature.stdout,$encoding)
  $null = Invoke-Recorded 'binary-audit' $nodeExe (@((Join-Path $recipeRoot 'verify-android-a1.mjs'),'--expected-build-id',$artifact.buildId)+$boundArgs)
  $preserver = Join-Path $recipeRoot 'preserve-android-a1.mjs'
  if (-not (Test-Path -LiteralPath $preserver)) { throw 'Reviewed actual Android preserver missing' }
  $preserved = Invoke-Recorded 'preserve' $nodeExe (@($preserver)+$boundArgs)
  $null = Invoke-Recorded 'source-after' $nodeExe (@($guard)+$boundArgs)
  Write-Output $preserved.stdout
} finally {
  foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
}

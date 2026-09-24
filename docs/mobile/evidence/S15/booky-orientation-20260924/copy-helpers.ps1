$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath '.').Path
if($repo -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'){throw 'Unexpected repository'}
$stage=(Resolve-Path -LiteralPath $PSScriptRoot).Path
if($stage -ne 'D:\CodexData\.codex\visualizations\2026\09\20\01a0bd7e-e7b5-7111-b319-db1a60746e94\s15-booky-orientation\staging'){throw 'Unexpected staging location'}
$manifest=Get-Content -Raw -LiteralPath (Join-Path $stage 'prepared-files.json')|ConvertFrom-Json
$scope=Get-Content -Raw -LiteralPath (Join-Path $stage 'scope.json')|ConvertFrom-Json
if($manifest.sourceFrozen -ne $true -or $scope.sourceFrozen -ne $true -or $scope.browserContractComplete -ne $true){throw 'Wait for final source and scope freeze'}
$expected=@('configure.mjs','check.mjs','unit.config.mjs','playwright.config.mjs','build-pwa-a1.mjs','pwa-a1.config.mjs','build-android-a1.ps1','verify-android-a1.mjs','preserve-android-a1.mjs','checkpoint.mjs','scope.json','record-visual.mjs','finalize-notes.mjs')
if((($manifest.files.name|Sort-Object) -join '|') -ne (($expected|Sort-Object) -join '|')){throw 'Unexpected helper inventory'}
foreach($file in $manifest.files){if((Get-FileHash -LiteralPath (Join-Path $stage $file.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw ('Staged helper changed: '+$file.name)}}
$destination=[IO.Path]::GetFullPath((Join-Path $repo 'docs/mobile/evidence/S15/booky-orientation-20260924'))
if(Test-Path -LiteralPath $destination){throw 'Preserve existing evidence directory'}
$receipts=@('generated-build-cleanup-preflight.json','generated-build-cleanup-deletion-intent.json','generated-build-cleanup-deletion.json')
foreach($name in $receipts){if(-not (Test-Path -LiteralPath (Join-Path $stage $name) -PathType Leaf)){throw ('Missing original cleanup receipt: '+$name)}}
$cleanup=Get-Content -Raw -LiteralPath (Join-Path $stage 'generated-build-cleanup-deletion.json')|ConvertFrom-Json
if($cleanup.pass -ne $true -or $cleanup.removed -ne $true -or $cleanup.onlyD184GeneratedDuplicates -ne $true){throw 'Expected verified D184 duplicate cleanup'}
if((Get-FileHash -LiteralPath $cleanup.preflight.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $cleanup.preflight.sha256){throw 'Cleanup preflight changed'}
$names=$expected+@('prepared-files.json','cleanup-generated.ps1','copy-helpers.ps1','READY.md')+$receipts
$copies=@($names|ForEach-Object {[ordered]@{name=$_;source=(Join-Path $stage $_);path=(Join-Path $destination $_);sha256=(Get-FileHash -LiteralPath (Join-Path $stage $_) -Algorithm SHA256).Hash.ToLowerInvariant()}})
[IO.Directory]::CreateDirectory($destination)|Out-Null
foreach($file in $copies){[IO.File]::Copy($file.source,$file.path,$false);if((Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Copied helper bytes differ'}}
$receipt=[ordered]@{schemaVersion=1;recordedAt=[DateTimeOffset]::UtcNow.ToString('o');pass=$true;copied=$copies;configured=$false;testsRun=$false;buildsRun=$false;releaseReady=$false}
[IO.File]::WriteAllText((Join-Path $destination 'helper-copy.json'),($receipt|ConvertTo-Json -Depth 8)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
[pscustomobject]@{copied=$copies.Count;destination=$destination;configured=$false}|ConvertTo-Json

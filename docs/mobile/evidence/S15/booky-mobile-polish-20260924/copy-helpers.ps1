$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath '.').Path
if($repo -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'){throw 'Unexpected repository'}
$stage=$PSScriptRoot
$m=Get-Content -Raw -LiteralPath (Join-Path $stage 'prepared-files.json')|ConvertFrom-Json
$scope=Get-Content -Raw -LiteralPath (Join-Path $stage 'scope.json')|ConvertFrom-Json
if($m.sourceFrozen -ne $true -or $scope.sourceFrozen -ne $true -or $scope.browserContractComplete -ne $true){throw 'Wait for proven fix and final scope freeze'}
if($m.files.Count -ne 13 -or $scope.browserTestTitles.Count -ne $scope.expectedBrowserTests){throw 'Expected thirteen helpers and the exact selected cases'}
foreach($file in $m.files){if((Get-FileHash -LiteralPath (Join-Path $stage $file.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw ('Prepared helper changed: '+$file.name)}}
$destination=Join-Path $repo 'docs/mobile/evidence/S15/booky-mobile-polish-20260924'
if(Test-Path -LiteralPath $destination){throw 'Preserve existing evidence directory'}
$names=@($m.files.name)+@('prepared-files.json','copy-helpers.ps1','READY.md')
if(Test-Path -LiteralPath (Join-Path $stage 'diagnostic-history.json')){$ledger=Get-Content -Raw -LiteralPath (Join-Path $stage 'diagnostic-history.json')|ConvertFrom-Json;if($ledger.recordingComplete -ne $true){throw 'Final ledger incomplete'};$names+=@('diagnostic-history.json')}
$copies=@($names|ForEach-Object {[ordered]@{name=$_;source=(Join-Path $stage $_);path=(Join-Path $destination $_);sha256=(Get-FileHash -LiteralPath (Join-Path $stage $_) -Algorithm SHA256).Hash.ToLowerInvariant()}})
[IO.Directory]::CreateDirectory($destination)|Out-Null
foreach($file in $copies){[IO.File]::Copy($file.source,$file.path,$false);if((Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Copied bytes differ'}}
$record=[ordered]@{schemaVersion=1;recordedAt=[DateTimeOffset]::UtcNow.ToString('o');pass=$true;copied=$copies;configured=$false;testsRun=$false;buildsRun=$false;releaseReady=$false}
[IO.File]::WriteAllText((Join-Path $destination 'helper-copy.json'),($record|ConvertTo-Json -Depth 8)+"`n",[Text.UTF8Encoding]::new($false))
[pscustomobject]@{copied=$copies.Count;destination=$destination}|ConvertTo-Json

param([switch]$DeleteVerifiedD182Duplicates)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath '.').Path
if($repo -ne 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'){throw 'Unexpected repository'}
$stage=(Resolve-Path -LiteralPath $PSScriptRoot).Path
if($stage -ne 'D:\CodexData\.codex\visualizations\2026\09\20\01a0bd7e-e7b5-7111-b319-db1a60746e94\s15-booky-mobile-dock\staging'){throw 'Unexpected receipt directory'}
$receiptName=if($DeleteVerifiedD182Duplicates){'generated-build-cleanup-deletion.json'}else{'generated-build-cleanup-preflight.json'}
$receiptPath=Join-Path $stage $receiptName
$intentPath=Join-Path $stage 'generated-build-cleanup-deletion-intent.json'
if(Test-Path -LiteralPath $receiptPath){throw 'Preserve existing cleanup receipt'}
if($DeleteVerifiedD182Duplicates -and (Test-Path -LiteralPath $intentPath)){throw 'Preserve existing deletion intent'}
function Read-Verified($ref){
  if((Get-FileHash -LiteralPath $ref.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ref.sha256){throw ('Evidence changed: '+$ref.path)}
  return Get-Content -Raw -LiteralPath $ref.path | ConvertFrom-Json
}
function Save-New([string]$file,$value){
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
  $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
}
function Safe-Member([string]$base,[string]$relative){
  if([IO.Path]::IsPathRooted($relative) -or $relative.Contains('\') -or @($relative.Split('/')|Where-Object {$_ -eq '..' -or $_ -eq '.' -or $_ -eq ''}).Count){throw ('Unsafe manifest path: '+$relative)}
  $file=[IO.Path]::GetFullPath((Join-Path $base $relative))
  if(-not $file.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Manifest escapes verified tree'}
  return $file
}
$state=Get-Content -Raw -LiteralPath 'docs/mobile/AUTOPILOT_STATE.json'|ConvertFrom-Json
$checkpointRef=$state.verificationCache.s15BookyWalkContinuity
$checkpoint=Read-Verified $checkpointRef
if($checkpoint.sourceCommit -ne '50170c3a2be24a698957eda999c303a6189351c4' -or $checkpoint.pass -ne $true){throw 'Expected verified D183 checkpoint'}
$prior=Read-Verified $checkpoint.previous
if($prior.sourceCommit -ne '78d6c5731db4b6123c240153e59fa3bd2c346ee9' -or $prior.pass -ne $true){throw 'Expected verified D182 evidence'}
$plans=@(
  @{kind='pwa';name='pwa-previous-51ea237a-e652-4f2d-931a-ea56a5aa7050';buildId='86fb2772591dc9cd29946cf9b43e2502ca4062e0b77e17e5726ae649f8400b32';ref=$prior.pwa},
  @{kind='android';name='native-previous-844188c0-da11-4d36-b25d-2db0dd67bb13';buildId='a74ff0e4c1450412b9ca35ffc4553b5c2de8de44a584418c07b07c377a53d62e';ref=$prior.android}
)
$verified=@()
foreach($plan in $plans){
  $build=Read-Verified $plan.ref
  if($build.pass -ne $true -or $build.sourceCommit -ne $prior.sourceCommit -or $build.buildId -ne $plan.buildId){throw 'Build identity mismatch'}
  $target=(Resolve-Path -LiteralPath (Join-Path $repo ('.tmp/'+$plan.name))).Path
  if(-not $target.StartsWith($repo+'\.tmp\',[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $target) -ne $plan.name){throw 'Unsafe resolved deletion target'}
  $preserved=(Resolve-Path -LiteralPath $build.artifact.path).Path
  $preservedRoot='D:\CodexData\.codex\visualizations\2026\09\20\01a0bd7e-e7b5-7111-b319-db1a60746e94\s15-booky-approach-stop\'
  if($preserved -eq $target -or -not $preserved.StartsWith($preservedRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected preserved directory'}
  $manifestHash=if($plan.kind -eq 'pwa'){$build.artifact.artifactSha256}else{$build.artifact.sha256}
  foreach($base in @($target,$preserved)){
    $members=@((Get-Item -LiteralPath $base))+@(Get-ChildItem -LiteralPath $base -Recurse -Force)
    if(@($members|Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count){throw 'Reparse point in verified tree'}
    $manifestFile=Join-Path $base 'artifact.json'
    if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifestHash){throw 'Manifest hash mismatch'}
    $manifest=Get-Content -Raw -LiteralPath $manifestFile|ConvertFrom-Json
    if($manifest.sourceCommit -ne $prior.sourceCommit -or $manifest.buildId -ne $plan.buildId){throw 'Manifest identity mismatch'}
    if(@($members|Where-Object {-not $_.PSIsContainer}).Count -ne $manifest.inventory.Count+1){throw 'Unexpected generated files'}
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach($entry in $manifest.inventory){
      if(-not $seen.Add($entry.path)){throw 'Duplicate manifest path'}
      $file=Safe-Member $base $entry.path
      if((Get-Item -LiteralPath $file).Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw ('Payload mismatch: '+$entry.path)}
    }
  }
  $verified+=@{kind=$plan.kind;target=$target;preserved=$preserved;buildResult=$plan.ref;artifactSha256=$manifestHash;files=$manifest.inventory.Count+1;bytes=[long](($manifest.inventory|Measure-Object -Property bytes -Sum).Sum)+(Get-Item -LiteralPath (Join-Path $target 'artifact.json')).Length;sourceCommit=$manifest.sourceCommit;buildId=$manifest.buildId}
}
$receipt=[ordered]@{schemaVersion=1;recordedAt=[DateTimeOffset]::UtcNow.ToString('o');pass=$true;dryRun=(-not $DeleteVerifiedD182Duplicates);removed=$false;onlyD182GeneratedDuplicates=$true;priorCheckpoint=@{path=$checkpointRef.path;sha256=$checkpointRef.sha256};priorEvidence=$checkpoint.previous;targets=$verified;bytes=($verified|Measure-Object -Property bytes -Sum).Sum;releaseReady=$false}
if($DeleteVerifiedD182Duplicates){
  $preflightPath=Join-Path $stage 'generated-build-cleanup-preflight.json'
  if(-not (Test-Path -LiteralPath $preflightPath)){throw 'Run and retain a read-only preflight first'}
  $preflight=Get-Content -Raw -LiteralPath $preflightPath|ConvertFrom-Json
  if($preflight.pass -ne $true -or $preflight.dryRun -ne $true -or $preflight.removed -ne $false -or $preflight.targets.Count -ne $verified.Count){throw 'Invalid preflight'}
  for($i=0;$i -lt $verified.Count;$i++){
    foreach($field in @('kind','target','preserved','artifactSha256','files','bytes','sourceCommit','buildId')){
      if($preflight.targets[$i].$field -ne $verified[$i].$field){throw ('Verified preflight field changed: '+$field)}
    }
    if($preflight.targets[$i].buildResult.path -ne $verified[$i].buildResult.path -or $preflight.targets[$i].buildResult.sha256 -ne $verified[$i].buildResult.sha256){throw 'Verified preflight result changed'}
  }
  $receipt.preflight=@{path=$preflightPath;sha256=(Get-FileHash -LiteralPath $preflightPath -Algorithm SHA256).Hash.ToLowerInvariant()}
  Save-New $intentPath $receipt
  foreach($record in $verified){
    # Both resolved absolute targets and complete D: copies were checked above.
    Remove-Item -LiteralPath $record.target -Recurse -Force
    if(Test-Path -LiteralPath $record.target){throw 'Removal incomplete; preserve intent receipt'}
  }
  $receipt.removed=$true
}
Save-New $receiptPath $receipt
[pscustomobject]@{pass=$true;dryRun=$receipt.dryRun;removed=$receipt.removed;targets=$verified.Count;bytes=$receipt.bytes;receipt=$receiptPath}|ConvertTo-Json

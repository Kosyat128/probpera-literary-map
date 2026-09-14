$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath '.').Path
$expectedWorkspace = 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
if ($workspace -cne $expectedWorkspace) { throw 'Unexpected workspace' }
$reportPath = Join-Path $workspace '.tmp/native-runtime-duplicate-audit-20260914-a1.json'
$report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
if ($report.redundant.Count -ne 9 -or $report.reclaimableBytes -ne 499615083) { throw 'Unexpected audit' }
$receiptPath = Join-Path $workspace '.tmp/native-runtime-duplicate-cleanup-20260914-a1.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'Receipt already exists' }
$pending = @()
foreach ($entry in $report.redundant) {
  if ($entry.redundantPath -notmatch '^\.tmp/native-previous-[a-f0-9-]+$' -or $entry.retainedPath -notmatch '^\.tmp/native-builds/android-dev/[^/]+/runtime$') { throw 'Unexpected path' }
  $target = (Resolve-Path -LiteralPath (Join-Path $workspace $entry.redundantPath)).Path
  $retained = (Resolve-Path -LiteralPath (Join-Path $workspace $entry.retainedPath)).Path
  if ($target -cne $entry.redundantAbsolutePath -or $retained -cne $entry.retainedAbsolutePath) { throw 'Resolved path changed' }
  if (-not $target.StartsWith($workspace + '\.tmp\native-previous-', [StringComparison]::Ordinal) -or -not $retained.StartsWith($workspace + '\.tmp\native-builds\', [StringComparison]::Ordinal)) { throw 'Outside intended generated workspace' }
  foreach ($tree in @($target, $retained)) {
    $item = Get-Item -LiteralPath $tree -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked/non-directory root' }
    $children = @(Get-ChildItem -LiteralPath $tree -Recurse -Force)
    if (@($children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Linked child' }
    $files = @($children | Where-Object { -not $_.PSIsContainer })
    if ($files.Count -ne $entry.files -or ($files | Measure-Object -Property Length -Sum).Sum -ne $entry.bytes) { throw 'Tree changed after full SHA audit' }
    $metadata = Join-Path $tree 'artifact.json'
    if ((Get-FileHash -LiteralPath $metadata -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.artifactSha256) { throw 'Artifact identity changed' }
  }
  $tracked = @(git -c "safe.directory=$($workspace.Replace('\','/'))" ls-files -- $entry.redundantPath)
  if ($LASTEXITCODE -ne 0 -or $tracked.Count) { throw 'Tracked or unverifiable deletion target' }
  $pending += [pscustomobject]@{ target = $target; retained = $retained; artifactSha256 = $entry.artifactSha256; fullTreeSha256 = $entry.fullTreeSha256; files = $entry.files; bytes = $entry.bytes; removed = $false }
}
$receipt = [ordered]@{ recordedAt = [DateTime]::UtcNow.ToString('o'); audit = '.tmp/native-runtime-duplicate-audit-20260914-a1.json'; auditSha256 = (Get-FileHash -LiteralPath $reportPath -Algorithm SHA256).Hash.ToLowerInvariant(); scope = 'Only fully duplicated generated native-previous runtime trees. Canonical runtime counterparts, APKs, source, SDK, user data and evidence retained.'; freeBytesBefore = (Get-PSDrive -Name C).Free; logicalBytesRemoved = 0; entries = $pending }
$receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptPath -Encoding utf8
foreach ($entry in $pending) {
  Remove-Item -LiteralPath $entry.target -Recurse -Force
  if (Test-Path -LiteralPath $entry.target) { throw 'Deletion incomplete' }
  if (-not (Test-Path -LiteralPath (Join-Path $entry.retained 'artifact.json'))) { throw 'Retained tree missing' }
  $entry.removed = $true
  $receipt.logicalBytesRemoved += $entry.bytes
  $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptPath -Encoding utf8
}
$receipt.freeBytesAfter = (Get-PSDrive -Name C).Free
$receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptPath -Encoding utf8
[pscustomobject]@{ removedGeneratedDuplicates = $pending.Count; logicalBytesRemoved = $receipt.logicalBytesRemoved; freeBytesAfter = $receipt.freeBytesAfter; receipt = $receiptPath } | ConvertTo-Json

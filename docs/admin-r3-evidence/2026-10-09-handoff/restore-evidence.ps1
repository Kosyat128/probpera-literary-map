param([string]$RepositoryRoot = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd([char[]]'\/')
$taskPrefix = $taskRoot + [IO.Path]::DirectorySeparatorChar
$taskTmpPrefix = [IO.Path]::GetFullPath((Join-Path $taskRoot '.tmp')) + [IO.Path]::DirectorySeparatorChar
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$archivePath = Join-Path $PSScriptRoot $manifest.archive.file
function Get-TaskHash([string]$Path) {
    $digest = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $digest.Dispose() }
}
function Get-TaskTarget([string]$RelativePath) {
    if (-not $RelativePath.StartsWith('.tmp/')) { throw "Unexpected restoration path: $RelativePath" }
    $target = [IO.Path]::GetFullPath((Join-Path $taskRoot $RelativePath))
    if (-not $target.StartsWith($taskTmpPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Restoration path leaves checkout .tmp' }
    return $target
}
function Save-TaskBytes([string]$RelativePath, [byte[]]$Bytes, [string]$ExpectedHash, [long]$ExpectedLength) {
    if ($Bytes.LongLength -ne $ExpectedLength) { throw "Unexpected length: $RelativePath" }
    $digest = [Security.Cryptography.SHA256]::Create()
    try { $actualHash = [BitConverter]::ToString($digest.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $digest.Dispose() }
    if ($actualHash -ne $ExpectedHash) { throw "Hash mismatch: $RelativePath" }
    $target = Get-TaskTarget $RelativePath
    if (Test-Path -LiteralPath $target) {
        if ((Get-TaskHash $target) -ne $ExpectedHash) { throw "Existing artifact differs; preserved without overwrite: $RelativePath" }
        return
    }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.File]::WriteAllBytes($target, $Bytes)
}
if ((Get-TaskHash $archivePath) -ne $manifest.archive.sha256) { throw 'Archive hash mismatch' }
$expected = @{}
foreach ($member in $manifest.members) { $expected[$member.path] = $member }
[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($zip.Entries.Count -ne $manifest.archive.members) { throw 'Archive member count mismatch' }
    foreach ($entry in $zip.Entries) {
        if (-not $expected.ContainsKey($entry.FullName)) { throw "Unlisted archive member: $($entry.FullName)" }
        $row = $expected[$entry.FullName]
        $stream = $entry.Open()
        $buffer = [IO.MemoryStream]::new()
        try { $stream.CopyTo($buffer); Save-TaskBytes $row.path $buffer.ToArray() $row.sha256 $row.bytes }
        finally { $stream.Dispose(); $buffer.Dispose() }
    }
}
finally { $zip.Dispose() }
# Tracked font assets are available in the clone and stay out of this text archive.
foreach ($row in $manifest.checkoutAssets) {
    $source = [IO.Path]::GetFullPath((Join-Path $taskRoot $row.source))
    if (-not $source.StartsWith($taskPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Asset source leaves the checkout' }
    Save-TaskBytes $row.path ([IO.File]::ReadAllBytes($source)) $row.sha256 $row.bytes
}
Write-Output "Evidence restored and hash verified: $($manifest.archive.members) archive members plus $($manifest.checkoutAssets.Count) tracked font assets."

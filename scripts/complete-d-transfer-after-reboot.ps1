[CmdletBinding()]
param(
    [string]$ExpectedSha = '',
    [string]$ExpectedTree = '',
    [ValidateRange(0, 2147483647)]
    [int]$ExpectedTrackedCount = 0,
    [switch]$ArchiveInvalidTarget
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# These paths are intentionally not parameters. The source is the repository
# containing this script; the destination is the one reviewed canonical path.
$SourceRepo = [System.IO.Directory]::GetParent($PSScriptRoot).FullName
$AllowedTarget = 'D:\Codex\probpera-literary-map'
$AllowedTargetParent = 'D:\Codex'
$ExpectedOriginUrl = 'https://github.com/Kosyat128/probpera-literary-map.git'

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Test-SamePath {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right
    )

    return [System.StringComparer]::OrdinalIgnoreCase.Equals(
        (Get-NormalizedPath -Path $Left),
        (Get-NormalizedPath -Path $Right)
    )
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )

    $output = @(& $script:GitExecutable @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if (($exitCode -ne 0) -and (-not $AllowFailure)) {
        $rendered = $Arguments -join ' '
        $details = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "git $rendered failed with exit code $exitCode.$([Environment]::NewLine)$details"
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output | ForEach-Object { $_.ToString() })
    }
}

function Get-GitScalar {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $result = Invoke-Git -Arguments $Arguments
    $value = ($result.Output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "git returned an empty value for: $($Arguments -join ' ')"
    }

    return $value
}

function Assert-NoReparsePoint {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Label must not be a junction, symlink, or other reparse point: $Path"
    }
}

function Assert-RepositoryState {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryPath,
        [Parameter(Mandatory = $true)][string]$Label,
        [switch]$VerifyOriginMain,
        [switch]$RequireNoUntrackedFiles
    )

    if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
        throw "$Label does not exist: $RepositoryPath"
    }
    Assert-NoReparsePoint -Path $RepositoryPath -Label $Label

    $topLevel = Get-GitScalar -Arguments @('-C', $RepositoryPath, 'rev-parse', '--show-toplevel')
    if (-not (Test-SamePath -Left $topLevel -Right $RepositoryPath)) {
        throw "$Label resolves to a different Git worktree: $topLevel"
    }

    $head = (Get-GitScalar -Arguments @('-C', $RepositoryPath, 'rev-parse', 'HEAD')).ToLowerInvariant()
    if ($head -ne $script:ExpectedShaNormalized) {
        throw "$Label HEAD is $head; expected $script:ExpectedShaNormalized."
    }

    $treeSpec = "$($script:ExpectedShaNormalized)^{tree}"
    $tree = (Get-GitScalar -Arguments @('-C', $RepositoryPath, 'rev-parse', $treeSpec)).ToLowerInvariant()
    if ($tree -ne $script:ExpectedTreeNormalized) {
        throw "$Label tree is $tree; expected $script:ExpectedTreeNormalized."
    }

    if ($VerifyOriginMain) {
        $originMain = (Get-GitScalar -Arguments @(
            '-C', $RepositoryPath, 'rev-parse', 'refs/remotes/origin/main'
        )).ToLowerInvariant()
        if ($originMain -ne $script:ExpectedShaNormalized) {
            throw "$Label origin/main is $originMain; expected $script:ExpectedShaNormalized."
        }

        $originUrl = Get-GitScalar -Arguments @('-C', $RepositoryPath, 'remote', 'get-url', 'origin')
        if ($originUrl -cne $script:ExpectedOriginUrl) {
            throw "$Label origin URL is '$originUrl'; expected '$script:ExpectedOriginUrl'."
        }
    }

    $tracked = Invoke-Git -Arguments @(
        '-C', $RepositoryPath, 'ls-tree', '-r', '--name-only', $script:ExpectedShaNormalized
    )
    $trackedCount = @($tracked.Output).Count
    if ($trackedCount -ne $script:ExpectedTrackedCount) {
        throw "$Label has $trackedCount tracked paths; expected $script:ExpectedTrackedCount."
    }

    $statusArguments = @('-C', $RepositoryPath, 'status', '--porcelain=v1')
    if (-not $RequireNoUntrackedFiles) {
        $statusArguments += '--untracked-files=no'
    }
    $status = Invoke-Git -Arguments $statusArguments
    if (@($status.Output).Count -ne 0) {
        $details = ($status.Output -join [Environment]::NewLine)
        throw "$Label has working-tree changes:$([Environment]::NewLine)$details"
    }

    $diff = Invoke-Git -Arguments @(
        '-C', $RepositoryPath, 'diff', '--quiet', $script:ExpectedShaNormalized, '--'
    ) -AllowFailure
    if ($diff.ExitCode -ne 0) {
        throw "$Label tracked files differ from $script:ExpectedShaNormalized."
    }

    Invoke-Git -Arguments @(
        '-C', $RepositoryPath, 'fsck', '--full', '--strict', '--no-dangling',
        $script:ExpectedShaNormalized
    ) | Out-Null

    return [pscustomobject]@{
        Head = $head
        Tree = $tree
        TrackedCount = $trackedCount
    }
}

function New-UniqueSiblingPath {
    param([Parameter(Mandatory = $true)][string]$Suffix)

    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
        $candidate = Join-Path -Path $script:TargetParent -ChildPath (
            "$($script:TargetLeaf).$Suffix.$stamp.$PID.$attempt"
        )
        if (-not (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
        Start-Sleep -Milliseconds 10
    }

    throw "Unable to allocate a unique sibling path under $script:TargetParent."
}

$script:ExpectedOriginUrl = $ExpectedOriginUrl
$script:GitExecutable = (Get-Command git.exe -ErrorAction Stop).Source
$script:TargetPath = Get-NormalizedPath -Path $AllowedTarget
$script:TargetParent = Get-NormalizedPath -Path $AllowedTargetParent
$script:TargetLeaf = [System.IO.Path]::GetFileName($script:TargetPath)
$sourcePath = Get-NormalizedPath -Path $SourceRepo

if (-not (Test-SamePath -Left $script:TargetPath -Right 'D:\Codex\probpera-literary-map')) {
    throw "Safety check failed: the only allowed target is D:\Codex\probpera-literary-map."
}
if (-not (Test-SamePath -Left $script:TargetParent -Right 'D:\Codex')) {
    throw 'Safety check failed: the only allowed target parent is D:\Codex.'
}
if (-not (Test-SamePath -Left ([System.IO.Directory]::GetParent($script:TargetPath).FullName) -Right $script:TargetParent)) {
    throw 'Safety check failed: target is not a direct child of D:\Codex.'
}
if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals(
    [System.IO.Path]::GetPathRoot($script:TargetPath),
    'D:\'
)) {
    throw 'Safety check failed: target is not physically addressed on drive D:.'
}
if (-not (Test-Path -LiteralPath 'D:\' -PathType Container)) {
    throw 'Drive D: is not mounted.'
}

if (-not (Test-Path -LiteralPath $script:TargetParent -PathType Container)) {
    New-Item -ItemType Directory -Path $script:TargetParent | Out-Null
}
Assert-NoReparsePoint -Path $script:TargetParent -Label 'Target parent'

if (($ExpectedSha -eq '') -xor ($ExpectedTree -eq '') -or
    (($ExpectedSha -eq '') -xor ($ExpectedTrackedCount -eq 0))) {
    throw 'ExpectedSha, ExpectedTree and ExpectedTrackedCount must be supplied together or all omitted.'
}

$sourceOriginUrl = Get-GitScalar -Arguments @('-C', $sourcePath, 'remote', 'get-url', 'origin')
if ($sourceOriginUrl -cne $script:ExpectedOriginUrl) {
    throw "Source origin URL is '$sourceOriginUrl'; expected '$script:ExpectedOriginUrl'."
}
$sourceHead = (Get-GitScalar -Arguments @('-C', $sourcePath, 'rev-parse', 'HEAD')).ToLowerInvariant()
$sourceOriginMain = (Get-GitScalar -Arguments @(
    '-C', $sourcePath, 'rev-parse', 'refs/remotes/origin/main'
)).ToLowerInvariant()
if ($sourceHead -ne $sourceOriginMain) {
    throw "Source HEAD $sourceHead does not equal the published origin/main $sourceOriginMain."
}
$derivedTree = (Get-GitScalar -Arguments @(
    '-C', $sourcePath, 'rev-parse', "$sourceHead^{tree}"
)).ToLowerInvariant()
$derivedTrackedResult = Invoke-Git -Arguments @(
    '-C', $sourcePath, 'ls-tree', '-r', '--name-only', $sourceHead
)
$derivedTrackedCount = @($derivedTrackedResult.Output).Count

if ($ExpectedSha -ne '') {
    if ($ExpectedSha -notmatch '\A[0-9a-fA-F]{40}\z') {
        throw 'ExpectedSha must be a full 40-character hexadecimal commit SHA.'
    }
    if ($ExpectedTree -notmatch '\A[0-9a-fA-F]{40}\z') {
        throw 'ExpectedTree must be a full 40-character hexadecimal tree SHA.'
    }
    if ($ExpectedSha.ToLowerInvariant() -ne $sourceHead -or
        $ExpectedTree.ToLowerInvariant() -ne $derivedTree -or
        $ExpectedTrackedCount -ne $derivedTrackedCount) {
        throw 'The explicitly pinned snapshot does not match the clean published source repository.'
    }
}

# Pin the exact published source snapshot for the remainder of this run. A new
# push after this point cannot silently change what is installed on D:.
$script:ExpectedShaNormalized = $sourceHead
$script:ExpectedTreeNormalized = $derivedTree
$script:ExpectedTrackedCount = $derivedTrackedCount

Write-Host 'Verifying the source repository and its published origin/main...'
$sourceState = Assert-RepositoryState `
    -RepositoryPath $sourcePath `
    -Label 'Source repository' `
    -VerifyOriginMain

# A valid existing target makes the operation idempotent. Untracked/ignored local
# files are tolerated here, but tracked files and the Git object database must match.
if (Test-Path -LiteralPath $script:TargetPath) {
    if (-not (Test-Path -LiteralPath $script:TargetPath -PathType Container)) {
        throw "Canonical target exists but is not a directory: $script:TargetPath"
    }
    Assert-NoReparsePoint -Path $script:TargetPath -Label 'Canonical target'

    try {
        $existingState = Assert-RepositoryState `
            -RepositoryPath $script:TargetPath `
            -Label 'Canonical target' `
            -VerifyOriginMain

        Write-Host "Canonical D: repository is already valid at $($existingState.Head). No changes made."
        return
    }
    catch {
        if (-not $ArchiveInvalidTarget) {
            throw "The canonical target exists but is not the expected repository. Re-run with -ArchiveInvalidTarget to move it to a recoverable sibling before installation. Validation error: $($_.Exception.Message)"
        }
        Write-Warning "The existing target is invalid and will be archived by rename only: $($_.Exception.Message)"
    }
}

$tempPath = New-UniqueSiblingPath -Suffix (
    "transfer-$($script:ExpectedShaNormalized.Substring(0, 12))"
)
$archivedTarget = $null
$installedTarget = $false

Write-Host "Creating an independent clone in temporary sibling: $tempPath"
try {
    Invoke-Git -Arguments @(
        'clone', '--no-local', '--no-hardlinks', '--no-checkout',
        '--config', 'core.longpaths=true', '--', $sourcePath, $tempPath
    ) | Out-Null

    Invoke-Git -Arguments @(
        '-C', $tempPath, 'checkout', '-B', 'main', $script:ExpectedShaNormalized, '--'
    ) | Out-Null
    Invoke-Git -Arguments @(
        '-C', $tempPath, 'remote', 'set-url', 'origin', $script:ExpectedOriginUrl
    ) | Out-Null
    Invoke-Git -Arguments @(
        '-C', $tempPath, 'update-ref', 'refs/remotes/origin/main',
        $script:ExpectedShaNormalized
    ) | Out-Null
    Invoke-Git -Arguments @(
        '-C', $tempPath, 'symbolic-ref', 'refs/remotes/origin/HEAD',
        'refs/remotes/origin/main'
    ) | Out-Null
    Invoke-Git -Arguments @(
        '-C', $tempPath, 'branch', '--set-upstream-to=origin/main', 'main'
    ) | Out-Null

    $tempState = Assert-RepositoryState `
        -RepositoryPath $tempPath `
        -Label 'Temporary clone' `
        -VerifyOriginMain `
        -RequireNoUntrackedFiles

    if (Test-Path -LiteralPath $script:TargetPath) {
        $archivedTarget = New-UniqueSiblingPath -Suffix 'previous'
        Write-Host "Archiving the invalid existing target by atomic rename: $archivedTarget"
        [System.IO.Directory]::Move($script:TargetPath, $archivedTarget)
    }

    Write-Host "Promoting the verified clone to canonical target: $script:TargetPath"
    [System.IO.Directory]::Move($tempPath, $script:TargetPath)
    $installedTarget = $true

    $finalState = Assert-RepositoryState `
        -RepositoryPath $script:TargetPath `
        -Label 'Installed canonical target' `
        -VerifyOriginMain `
        -RequireNoUntrackedFiles

    Write-Host ''
    Write-Host 'D: canonical transfer completed successfully.'
    Write-Host "Path:          $script:TargetPath"
    Write-Host "HEAD:          $($finalState.Head)"
    Write-Host "Tree:          $($finalState.Tree)"
    Write-Host "Tracked paths: $($finalState.TrackedCount)"
    if ($null -ne $archivedTarget) {
        Write-Host "Previous target archive (recoverable): $archivedTarget"
    }
    Write-Host "Source left untouched: $sourcePath"
}
catch {
    $primaryError = $_
    $failedInstalledPath = $null

    # Directory.Move can complete immediately before a later PowerShell statement
    # fails. Detect that state so recovery still preserves/restores both sides.
    if ((-not $installedTarget) -and
        (-not (Test-Path -LiteralPath $tempPath)) -and
        (Test-Path -LiteralPath $script:TargetPath -PathType Container)) {
        $installedTarget = $true
    }

    if ($installedTarget -and (Test-Path -LiteralPath $script:TargetPath -PathType Container)) {
        try {
            $failedInstalledPath = New-UniqueSiblingPath -Suffix 'failed-install'
            [System.IO.Directory]::Move($script:TargetPath, $failedInstalledPath)
            Write-Warning "The failed installed target was preserved at: $failedInstalledPath"
        }
        catch {
            Write-Warning "Could not move the failed installed target aside: $($_.Exception.Message)"
        }
    }

    if (($null -ne $archivedTarget) -and
        (Test-Path -LiteralPath $archivedTarget -PathType Container) -and
        (-not (Test-Path -LiteralPath $script:TargetPath))) {
        try {
            [System.IO.Directory]::Move($archivedTarget, $script:TargetPath)
            Write-Warning 'The previous canonical target was restored after the failed promotion.'
        }
        catch {
            Write-Warning "Automatic restoration failed. Recover manually from: $archivedTarget"
        }
    }

    if (Test-Path -LiteralPath $tempPath -PathType Container) {
        Write-Warning "The temporary clone was preserved for diagnosis: $tempPath"
    }
    throw $primaryError
}

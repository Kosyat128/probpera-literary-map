[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$taskName = 'ProbperaCanonicalDTransferOnce'
$sourceRepo = [System.IO.Directory]::GetParent($PSScriptRoot).FullName
$transferScript = Join-Path $PSScriptRoot 'complete-d-transfer-after-reboot.ps1'
$logDirectory = Join-Path $sourceRepo '.local-ops'
$logPath = Join-Path $logDirectory 'd-transfer-after-reboot.log'
$targetPath = 'D:\Codex\probpera-literary-map'
$expectedOrigin = 'https://github.com/Kosyat128/probpera-literary-map.git'

function Write-OperationLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    if (-not (Test-Path -LiteralPath $logDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $logDirectory | Out-Null
    }
    $line = '{0:o} {1}' -f [DateTime]::UtcNow, $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Test-GitSnapshot {
    try {
        $head = @(& git.exe -C $sourceRepo rev-parse HEAD 2>$null)
        if (($LASTEXITCODE -ne 0) -or ($head.Count -ne 1)) { return $false }
        $head = $head[0].Trim()

        $originMain = @(& git.exe -C $sourceRepo rev-parse refs/remotes/origin/main 2>$null)
        if (($LASTEXITCODE -ne 0) -or ($originMain.Count -ne 1)) { return $false }
        $originMain = $originMain[0].Trim()

        $originUrl = @(& git.exe -C $sourceRepo remote get-url origin 2>$null)
        if (($LASTEXITCODE -ne 0) -or ($originUrl.Count -ne 1)) { return $false }
        $originUrl = $originUrl[0].Trim()

        $status = @(& git.exe -C $sourceRepo status --porcelain=v1 2>$null)
        if ($LASTEXITCODE -ne 0) { return $false }

        return (
            ($head -match '\A[0-9a-f]{40}\z') -and
            ($head -eq $originMain) -and
            ($originUrl -ceq $expectedOrigin) -and
            ($status.Count -eq 0)
        )
    }
    catch {
        return $false
    }
}

function Test-StoragePreflight {
    if (-not (Test-Path -LiteralPath 'D:\' -PathType Container)) {
        Write-OperationLog 'Drive D: is not mounted; transfer skipped and task preserved.'
        return $false
    }

    # Reject only processes that still reference the transfer target. Ordinary
    # Git processes from Codex/GitHub Desktop must not prevent the one-shot task.
    $candidateProcesses = @(
        Get-CimInstance Win32_Process -ErrorAction Stop |
            Where-Object {
                ($_.ProcessId -ne $PID) -and
                ($_.Name -match '\A(?:git|robocopy|tar|powershell|pwsh|cmd)\.exe\z')
            }
    )
    $uninspectableProcesses = @(
        $candidateProcesses |
            Where-Object { [string]::IsNullOrWhiteSpace($_.CommandLine) }
    )
    if ($uninspectableProcesses.Count -gt 0) {
        Write-OperationLog 'A transfer-capable process has no inspectable command line; transfer skipped and task preserved.'
        return $false
    }
    $transferProcesses = @(
        $candidateProcesses |
            Where-Object {
                $_.CommandLine -match '(?i)(D:\\Codex|complete-d-transfer-after-reboot)'
            }
    )
    if ($transferProcesses.Count -gt 0) {
        Write-OperationLog 'Transfer-related processes are still active; transfer skipped and task preserved.'
        return $false
    }

    $volume = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction Stop
    if (($null -eq $volume) -or ($volume.FileSystem -ne 'NTFS') -or ($volume.FreeSpace -lt 10737418240)) {
        Write-OperationLog 'Drive D: failed the NTFS/free-space preflight; transfer skipped and task preserved.'
        return $false
    }

    # Win32_Volume exposes the dirty bit as a boolean and avoids parsing localized
    # output from fsutil.exe.
    $volumeState = Get-CimInstance Win32_Volume -Filter "DriveLetter='D:'" -ErrorAction Stop
    if (($null -eq $volumeState) -or ($volumeState.DirtyBitSet -ne $false)) {
        Write-OperationLog 'Drive D: dirty-state preflight was not clean; transfer skipped and task preserved.'
        return $false
    }

    $scan = @(& chkdsk.exe D: /scan 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-OperationLog ('CHKDSK /scan did not pass; transfer skipped and task preserved. Exit={0}' -f $LASTEXITCODE)
        return $false
    }

    return $true
}

$transferMutex = [System.Threading.Mutex]::new(
    $false,
    'Local\ProbperaCanonicalDTransfer'
)
$ownsTransferMutex = $false

try {
    try {
        $ownsTransferMutex = $transferMutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $ownsTransferMutex = $true
    }
    if (-not $ownsTransferMutex) {
        Write-OperationLog 'Another transfer wrapper is active; task preserved.'
        exit 7
    }

    Write-OperationLog 'One-shot post-reboot transfer preflight started.'
    if (-not (Test-GitSnapshot)) {
        Write-OperationLog 'Source repository is not a clean published origin/main snapshot; transfer skipped and task preserved.'
        exit 2
    }
    if (-not (Test-StoragePreflight)) {
        exit 3
    }

    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $transferScript -ArchiveInvalidTarget *>> $logPath
    if ($LASTEXITCODE -ne 0) {
        Write-OperationLog ('Transfer script failed; task preserved for diagnosis. Exit={0}' -f $LASTEXITCODE)
        exit $LASTEXITCODE
    }

    $installedHead = @(& git.exe -C $targetPath rev-parse HEAD 2>$null)
    $installedHeadExit = $LASTEXITCODE
    $sourceHead = @(& git.exe -C $sourceRepo rev-parse HEAD 2>$null)
    $sourceHeadExit = $LASTEXITCODE
    $installedStatus = @(& git.exe -C $targetPath status --porcelain=v1 2>$null)
    $installedStatusExit = $LASTEXITCODE
    if (($installedHeadExit -ne 0) -or ($installedHead.Count -ne 1) -or
        ($sourceHeadExit -ne 0) -or ($sourceHead.Count -ne 1) -or
        ($installedStatusExit -ne 0)) {
        Write-OperationLog 'Installed target Git verification failed; task preserved.'
        exit 4
    }
    $installedHead = $installedHead[0].Trim()
    $sourceHead = $sourceHead[0].Trim()
    if (($installedHead -ne $sourceHead) -or ($installedStatus.Count -ne 0)) {
        Write-OperationLog 'Installed target failed the final SHA/status check; task preserved.'
        exit 4
    }

    Write-OperationLog ('Canonical D: transfer completed at SHA {0}; removing the one-shot task.' -f $installedHead)
    & schtasks.exe /Delete /TN $taskName /F *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-OperationLog 'Transfer succeeded, but the scheduled task could not remove itself; the idempotent check will run again.'
        exit 6
    }
    exit 0
}
catch {
    Write-OperationLog ('Unhandled failure; task preserved: {0}' -f $_.Exception.Message)
    exit 5
}
finally {
    if ($ownsTransferMutex) {
        try { $transferMutex.ReleaseMutex() } catch { }
    }
    $transferMutex.Dispose()
}

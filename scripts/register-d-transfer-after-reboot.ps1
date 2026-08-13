[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$taskName = 'ProbperaCanonicalDTransferOnce'
$sourceRepo = [System.IO.Directory]::GetParent($PSScriptRoot).FullName
$wrapperPath = Join-Path $PSScriptRoot 'run-d-transfer-once-after-reboot.ps1'
$expectedOrigin = 'https://github.com/Kosyat128/probpera-literary-map.git'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

function Get-GitScalar {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = @(& git.exe @Arguments 2>$null)
    if (($LASTEXITCODE -ne 0) -or ($output.Count -ne 1)) {
        throw "Git validation failed: git $($Arguments -join ' ')"
    }
    return $output[0].Trim()
}

if (-not (Test-Path -LiteralPath $wrapperPath -PathType Leaf)) {
    throw "Transfer wrapper is missing: $wrapperPath"
}

$head = Get-GitScalar -Arguments @('-C', $sourceRepo, 'rev-parse', 'HEAD')
$originMain = Get-GitScalar -Arguments @(
    '-C', $sourceRepo, 'rev-parse', 'refs/remotes/origin/main'
)
$originUrl = Get-GitScalar -Arguments @('-C', $sourceRepo, 'remote', 'get-url', 'origin')
$status = @(& git.exe -C $sourceRepo status --porcelain=v1 2>$null)
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to verify the source repository working tree.'
}
if (($head -notmatch '\A[0-9a-f]{40}\z') -or
    ($head -ne $originMain) -or
    ($originUrl -cne $expectedOrigin) -or
    ($status.Count -ne 0)) {
    throw 'The transfer task may only be registered from a clean published origin/main snapshot.'
}

$actionArguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $wrapperPath
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actionArguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$trigger.Delay = 'PT1M'
$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType Interactive `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 15)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'One-shot verified transfer of Probpera to D: after Windows restart.' `
    -Force | Out-Null

$registered = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if (($registered.Actions.Count -ne 1) -or
    ($registered.Actions[0].Execute -ine 'powershell.exe') -or
    ($registered.Actions[0].Arguments -cne $actionArguments) -or
    ($registered.Principal.RunLevel -ne 'Highest')) {
    throw 'The scheduled task was created but failed exact action/principal verification.'
}

Write-Host "Registered $taskName for $currentUser at published SHA $head."

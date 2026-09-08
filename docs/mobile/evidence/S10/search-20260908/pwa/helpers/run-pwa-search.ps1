param([Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedSourceCommit)
$ErrorActionPreference = 'Stop'
$workspace = 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
if ((Get-Location).Path -ne $workspace) { throw 'Unexpected checkout' }
$log = Join-Path $workspace '.tmp/s10-search-pwa-20260908/pipeline-a1.log'
$receipt = Join-Path $workspace '.tmp/s10-search-pwa-20260908/pipeline-a1-execution.json'
if ((Test-Path -LiteralPath $log) -or (Test-Path -LiteralPath $receipt)) { throw 'Refusing existing pipeline evidence' }
& node .tmp/s10-search-pwa-20260908/run-pwa-search.mjs --expected-source-commit $ExpectedSourceCommit *> $log
$runExitCode = $LASTEXITCODE
[pscustomobject]@{sourceCommit=$ExpectedSourceCommit;exitCode=$runExitCode;log='.tmp/s10-search-pwa-20260908/pipeline-a1.log';buildAndAuditInvoked=$true;affectedBrowserPlanned=$true;stageAccepted=$false;releaseReady=$false} | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding utf8
Get-Content -LiteralPath $log -Tail 24
exit $runExitCode

# Source-only proposal; root frozen input and Astra review required before execution.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$InputFile,[Parameter(Mandatory)][string]$PlanSha)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3
$R = 'D:\CodexProjects\Работа по сайту\literary-planet-v12-work'
$W = 'D:\CodexData\.codex\visualizations\2026\10\02\01a0fd35-3865-7973-8f4c-0c7a0148df47\release-completion\advanced-booky-work-20261006'
$B2 = 'e8ac3c03e8aa142e219cb03e46e75757910c82dd'
$Utf8 = [Text.UTF8Encoding]::new($false)
$Entries = [Collections.Generic.List[object]]::new()
$Names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
function Need($ok, [string]$message) { if ($ok -ne $true) { throw $message } }
function Sha([byte[]]$data) { [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($data)).ToLowerInvariant() }
function JsonBytes($value) { $Utf8.GetBytes(($value | ConvertTo-Json -Depth 30) + [char]10) }
function SafeName([string]$name) {
  Need ($name.Length -gt 0 -and $name.Length -lt 1024 -and $name -notmatch '[\\:<>"|?*\x00-\x1f]' -and -not $name.StartsWith('/')) 'Unsafe relative name'
  foreach ($part in $name.Split('/')) {
    Need ($part -notin @('', '.', '..') -and $part -notmatch '[. ]$' -and $part -notmatch '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)') 'Unsafe name segment'
    Need ($part -notin @('.git', '.aws', '.codex', 'node_modules') -and $part -notmatch '^(?i:\.env(?:\.|$)|auth\.json$|credentials\.json$|tokens?\.json$|id_rsa(?:\.|$))' -and $part -notmatch '(?i)\.(?:pem|key|p12|pfx|jks|keystore)$') 'Secret or excluded filename'
  }
}
function Regular([string]$base, [string]$relative) {
  SafeName $relative
  $root = [IO.Path]::GetFullPath($base).TrimEnd('\')
  $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
  Need ($full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) 'File escapes fixed root'
  $item = Get-Item -LiteralPath $full -Force
  Need (-not $item.PSIsContainer -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Source is not a regular file'
  $parent = $item.Directory
  while ($null -ne $parent) {
    Need (($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Linked source ancestor'
    $parent = $parent.Parent
  }
  $item
}
function Small([string]$base, [string]$relative, $pin = $null) {
  $file = Regular $base $relative
  Need ($file.Length -le 8MB) 'Metadata exceeds fixed bound'
  $data = [IO.File]::ReadAllBytes($file.FullName); $hash = Sha $data
  if ($null -ne $pin) { Need ($data.LongLength -eq $pin.bytes -and $hash -ceq $pin.sha256) ('Changed metadata: ' + $relative) }
  [pscustomobject]@{file=$file.FullName; bytes=$data.LongLength; sha256=$hash; data=$data; value=$(if ($relative.EndsWith('.json') -or $relative.EndsWith('native-audit.stdout.txt') -or $relative.EndsWith('pwa-audit.stdout.txt')) { $Utf8.GetString($data) | ConvertFrom-Json } else { $null })}
}
function AddFile([string]$name, [string]$base, [string]$relative, $pin) {
  SafeName $name; Need ($Names.Add($name)) ('Case-duplicate archive name: ' + $name)
  $file = Regular $base $relative
  Need ($pin.bytes -ge 0 -and $file.Length -eq $pin.bytes -and $pin.sha256 -cmatch '^[a-f0-9]{64}$') ('Invalid file pin: ' + $name)
  $Entries.Add([pscustomobject]@{name=$name; file=$file.FullName; base=$base; relative=$relative; data=$null; bytes=[long]$pin.bytes; sha256=$pin.sha256})
}
function AddMemory([string]$name, [byte[]]$data) {
  SafeName $name; Need ($Names.Add($name)) ('Case-duplicate archive name: ' + $name)
  $Entries.Add([pscustomobject]@{name=$name; file=$null; data=$data; bytes=$data.LongLength; sha256=(Sha $data)})
}
function CheckGraph($rows, [string]$digest, [string]$key) {
  $spec = $Plan.graphSpecs.$key
  $expected = [Collections.Generic.List[string]]::new()
  foreach ($name in $Snapshot.Keys) {
    $member = $false
    foreach ($root in $spec.roots) { if ($name -ceq $root -or $name.StartsWith($root + '/', [StringComparison]::Ordinal)) { $member = $true; break } }
    if ($member -and (-not $spec.excludeTests -or $name -cnotmatch '\.(?:test|spec)\.[cm]?[jt]sx?$')) { $expected.Add($name) }
  }
  $expectedNames = $expected.ToArray(); [Array]::Sort($expectedNames, [StringComparer]::Ordinal)
  $actual = @($rows)
  Need ($expectedNames.Count -eq $spec.rows -and $actual.Count -eq $spec.rows -and $digest -ceq $spec.digest) ('Exact graph count or digest identity differs: ' + $key)
  $parts = [Collections.Generic.List[string]]::new(); $lf = [string][char]10
  for ($i = 0; $i -lt $actual.Count; $i++) {
    $row = $actual[$i]; SafeName $row.path
    Need (@($row.PSObject.Properties.Name).Count -eq 2 -and $null -ne $row.PSObject.Properties['path'] -and $null -ne $row.PSObject.Properties['sha256']) 'Graph row shape differs'
    Need ($row.path -ceq $expectedNames[$i] -and $row.sha256 -ceq $Snapshot[$row.path].sha256) ('Graph membership/raw-source pin differs: ' + $key + '/' + $row.path)
    $pathJson = ConvertTo-Json -InputObject ([string]$row.path) -Compress
    $shaJson = ConvertTo-Json -InputObject ([string]$row.sha256) -Compress
    if ($spec.format -ceq 'pretty') { $parts.Add('  {' + $lf + '    "path": ' + $pathJson + ',' + $lf + '    "sha256": ' + $shaJson + $lf + '  }') }
    else { $parts.Add('{"path":' + $pathJson + ',"sha256":' + $shaJson + '}') }
  }
  $text = if ($spec.format -ceq 'pretty') { '[' + $lf + ($parts -join (',' + $lf)) + $lf + ']' + $lf } else { '[' + ($parts -join ',') + ']' }
  Need ((Sha ($Utf8.GetBytes($text))) -ceq $digest) ('Independent graph digest differs: ' + $key)
  [ordered]@{rows=$actual.Count; fingerprint=$digest; exactMembership=$true; everyRowMatchesCapsulePlusOverlay=$true; independentDigest=$true}
}
function Owned([string]$key, [int]$expectedPid) {
  $terminal = $fixed[($key + 'terminal')].value; $launch = $fixed[($key + 'launch')].value
  Need ($terminal.pid -eq $expectedPid -and $terminal.exitCode -eq 0 -and $terminal.naturalTermination -eq $true -and $launch.pid -eq $expectedPid -and [IO.Path]::GetFullPath($launch.cwd) -ceq $R) ('Exact natural owned terminal differs: ' + $key)
  Need ($terminal.stdoutSha256 -ceq $fixed[($key + 'stdout')].sha256 -and $terminal.stderrSha256 -ceq $fixed[($key + 'stderr')].sha256) ('Owned terminal log binding differs: ' + $key)
}
function CleanB2 {
  $head = & git -c ('safe.directory=' + $R) -C $R rev-parse HEAD
  Need ($LASTEXITCODE -eq 0 -and $head -ceq $B2) 'Repository HEAD is not B2'
  $status = & git -c ('safe.directory=' + $R) -C $R status --porcelain=v1 --untracked-files=all
  Need ($LASTEXITCODE -eq 0 -and -not $status) 'Repository is not clean'
}

$run = $null; $partial = $null
try {
  CleanB2
  Need ($InputFile -ceq 'proposal-inputs-final-a1.json' -and $PlanSha -cmatch '^[a-f0-9]{64}$') 'Only final frozen reviewed plan is admitted'
  $planRead = Small $PSScriptRoot $InputFile
  Need ($planRead.sha256 -ceq $PlanSha) 'Frozen final proposal changed'
  $Plan = $planRead.value
  Need ($Plan.kind -ceq 'ADULT_DIAGNOSTIC_PACKET_FROZEN_ROOT_APPROVED' -and $Plan.rootApproved -eq $true -and $Plan.sourceOnly -eq $false) 'Source-only draft is not executable'
  Need ($Plan.physicalRepo -ceq $R -and $Plan.evidenceRoot -ceq $W -and $Plan.sourceCommit -ceq $B2) 'Fixed roots/source differ'
  Need ($Plan.baselineSourceCommit -ceq 'b2f7018e6c0a695864d381b7c0b4cdd4908bc3e4') 'Baseline identity differs'
  $refs = @{}
  foreach ($property in $Plan.references.PSObject.Properties) {
    $pin = $property.Value; Need ($pin.root -ceq 'W') 'Proof root differs'
    $refs[$property.Name] = Small $W $pin.path $pin
    AddFile $pin.entry $W $pin.path $pin
  }
  $baseline = @($refs.baselineInventory.value)
  $restore = $refs.baselineRestore.value
  Need ($baseline.Count -eq 3947 -and $restore.status -ceq 'PASS_B2_INCREMENTAL_SOURCE_RESTORE_SHA_SIZE' -and $restore.productSourceCommit -ceq $Plan.baselineSourceCommit -and $restore.sourceFiles -eq 3947) 'Verified B2 inventory/restore changed'
  Need ($restore.restoredInventory.sha256 -ceq $refs.baselineInventory.sha256 -and $restore.restoredInventory.bytes -eq $refs.baselineInventory.bytes) 'Baseline inventory receipt binding changed'
  Need ($restore.packet.archive.sha256 -ceq $Plan.baselinePacket.sha256 -and $restore.packet.archive.bytes -eq $Plan.baselinePacket.bytes -and $restore.packet.archive.path -ceq $Plan.baselinePacket.path) 'Baseline separate packet identity changed'
  $caseNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $Snapshot = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
  foreach ($row in $baseline) { SafeName $row.path; Need ($caseNames.Add($row.path)) 'Case duplicate baseline source'; $Snapshot.Add($row.path, $row) }
  Need (@($Plan.sourceOverlays).Count -eq 15) 'Expected exactly fifteen source overlays'
  $replaced = 0; $added = 0; $overlayBytes = [long]0
  foreach ($pin in $Plan.sourceOverlays) {
    SafeName $pin.path
    if ($Snapshot.ContainsKey($pin.path)) { Need ($pin.operation -ceq 'REPLACE' -and $pin.baseline.sha256 -ceq $Snapshot[$pin.path].sha256 -and $pin.baseline.bytes -eq $Snapshot[$pin.path].bytes) 'Overlay baseline differs'; $replaced++ }
    else { Need ($pin.operation -ceq 'ADD' -and $null -eq $pin.baseline -and $caseNames.Add($pin.path)) 'New name was present or case duplicate'; $added++ }
    $Snapshot[$pin.path] = $pin; $overlayBytes += $pin.bytes
    AddFile ('source-overlay/' + $pin.path) $R $pin.path $pin
  }
  $sourceBytes = [long]0; foreach ($row in $Snapshot.Values) { $sourceBytes += $row.bytes }
  Need ($replaced -eq 7 -and $added -eq 8 -and $overlayBytes -eq 595581 -and $Snapshot.Count -eq 3955 -and $sourceBytes -eq 127763368) 'Overlay/composed metadata arithmetic differs'
  Need ($Plan.composite.wholeHeadSourceClaim -eq $false -and $Plan.composite.metadataOnly -eq $true -and $Plan.composite.inheritedDocs -eq 196) 'Inherited historical documentation cannot become current whole HEAD'
  $qa = $refs.qa.value; $ui = $refs.browser.value
  Need ($qa.pass -eq $true -and $qa.actualPid -eq 11384 -and $qa.sourceRows -eq 1958 -and $qa.sourceFingerprint -ceq $Plan.commonClosingGraph.sourceFingerprint) 'Current QA identity differs'
  Need (($qa.reportProofs.passed | Measure-Object -Sum).Sum -eq 20 -and $qa.reportProofs[1].skipped -eq 71) 'New20/old71-skip qualification differs'
  foreach ($process in $qa.processes) { Need ($process.record.actualExitCode -eq 0 -and $process.record.naturalCloseObserved -eq $true -and $process.record.runtimeValid -eq $true) 'QA child lacks actual natural pass/runtime' }
  Need ($ui.pass -eq $true -and $ui.actualRootPid -eq 18516 -and $ui.actualParentPid -eq 10576 -and $ui.sourceUnchanged -eq $true -and $ui.checksCompleted -eq $true -and @($ui.screenshots).Count -eq 2 -and @($ui.cases).Count -eq 2) 'Actual mounted fixture UI identity differs'
  Need ($ui.limitations.actualAppMounted -eq $false -and $ui.limitations.canonicalGlobeMounted -eq $false -and $ui.limitations.humanScreenshotReview -eq $false) 'Fixture/human boundaries changed'
  $fixed = @{}
  foreach ($property in $Plan.fixedBuildFiles.PSObject.Properties) {
    $pin = $property.Value; Need ($pin.root -cin @('R','W')) 'Build proof root differs'
    $base = if ($pin.root -ceq 'R') { $R } else { $W }
    $fixed[$property.Name] = Small $base $pin.path $pin
    AddFile $pin.entry $base $pin.path $pin
  }
  Owned 'android' ([int]$Plan.android.actualPid)
  Owned 'pwa' ([int]$Plan.pwa.actualPid)
  $pwaFinal = $fixed.pwaFinalization.value; $pwaArtifact = $fixed.pwaArtifact.value; $pwaAudit = $fixed.pwaAudit.value
  Need ($pwaFinal.status -ceq 'PASS_CURRENT_RETAINED_PWA_INTEGRITY_ONLY' -and $pwaFinal.actualPid -eq $Plan.pwa.actualPid -and $pwaFinal.packageableRetainedBundle -eq $true) 'Qualified current PWA finalization differs'
  Need ($pwaFinal.original.ownerPid -eq 23420 -and $pwaFinal.original.originalNaturalTermination -ceq 'UNKNOWN' -and $null -eq $pwaFinal.original.originalExitCode -and $pwaFinal.original.originalFullInputSnapshot -ceq 'UNRECOVERABLE_EMPTY_PREPARATION') 'Original interrupted PWA completion must remain UNKNOWN'
  Need ($pwaFinal.actions.compile -eq 0 -and $pwaFinal.actions.auditReruns -eq 0 -and $pwaFinal.actions.tests -eq 0 -and $pwaFinal.actions.archives -eq 0 -and $pwaFinal.actions.trackedWrites -eq 0 -and $pwaFinal.actions.remote -eq 0) 'PWA finalization scope changed'
  Need ($pwaFinal.source.sourceCommit -ceq $B2 -and $pwaFinal.source.sourceFingerprint -ceq $Plan.commonClosingGraph.sourceFingerprint -and $pwaFinal.currentIntegrity.sourceUnchanged -eq $true) 'Current PWA source identity differs'
  Need ($pwaArtifact.kind -ceq 'literary-planet-controlled-pwa-preparation' -and $pwaArtifact.sourceCommit -ceq $B2 -and $pwaArtifact.buildId -ceq $Plan.pwa.buildId -and $pwaArtifact.scopePath -ceq '/planet/' -and $pwaArtifact.releaseReady -eq $false -and $pwaArtifact.productionActionsAuthorized -eq $false -and $pwaArtifact.localQaAuthority -eq $false) 'PWA artifact identity differs'
  $pwaGraph = CheckGraph $pwaArtifact.sourceInputs.files $pwaArtifact.sourceInputs.sha256 'pwa'
  Need ($pwaFinal.currentIntegrity.pwaInputSha256 -ceq $pwaGraph.fingerprint -and $pwaFinal.currentIntegrity.pwaInputFiles -eq 1198) 'Finalized PWA graph binding differs'
  Need ($pwaAudit.pass -eq $true -and @($pwaAudit.findings).Count -eq 0 -and $pwaAudit.identity.sourceCommit -ceq $B2 -and $pwaAudit.identity.buildId -ceq $pwaArtifact.buildId -and $pwaAudit.counts.files -eq 1427 -and $pwaAudit.counts.sourceInputs -eq 1198) 'Retained PWA audit identity differs'
  Need ($pwaFinal.retainedAudit.reference.sha256 -ceq $fixed.pwaAudit.sha256 -and $pwaFinal.retainedAudit.reexecuted -eq $false) 'Retained audit exact reference differs'
  Need (@($pwaArtifact.inventory).Count -eq 1426) 'Full fresh PWA payload inventory differs'
  foreach ($row in $pwaArtifact.inventory) { AddFile ('builds/pwa/pwa-bundle/' + $row.path) $R ($Plan.pwa.bundleRelative + '/' + $row.path) $row }
  $android = $fixed.androidPreparation.value; $native = $fixed.nativeArtifact.value; $bin = $fixed.binary.value; $nativeAudit = $fixed.nativeAudit.value
  Need ($android.kind -ceq 'literary-planet-local-release-preparation' -and $android.mode -ceq 'android' -and $android.pass -eq $true -and $android.mainBinaryPrepared -eq $true -and $android.instrumentationCompiled -eq $true) 'Android must finish both APKs'
  Need ($android.releaseReady -eq $false -and $android.deviceTested -eq $false -and $android.iosCompiled -eq $false -and $android.productionActionsAuthorized -eq $false) 'Android local qualification differs'
  Need ($android.inputs.sourceCommit -ceq $B2 -and $android.inputs.repositoryHead -ceq $B2 -and $android.inputs.sourceStatus -ceq '') 'Fresh Android source identity differs'
  Need ((@($android.attempts.name) -join '|') -ceq (@($Plan.android.attemptNames) -join '|')) 'Android exact attempt sequence differs'
  foreach ($attempt in $android.attempts) { Need ($attempt.exitCode -eq 0 -and $null -eq $attempt.signal -and $null -eq $attempt.errorCode -and $attempt.deadline -eq $false) 'Android attempt lacks actual natural pass' }
  $releaseGraph = CheckGraph $android.inputs.sourceFiles $android.inputs.sourceFingerprint 'release'
  Need ($native.kind -ceq 'literary-planet-bundled-native-preparation' -and $native.platform -ceq 'android' -and $native.channel -ceq 'dev' -and $native.sourceCommit -ceq $B2 -and $native.buildId -ceq $Plan.android.buildId -and $native.releaseReady -eq $false) 'Native artifact identity differs'
  $nativeGraph = CheckGraph $native.sourceInputs.files $native.sourceInputs.sha256 'native'
  Need ($nativeAudit.pass -eq $true -and @($nativeAudit.findings).Count -eq 0 -and $nativeAudit.identity.sourceCommit -ceq $B2 -and $nativeAudit.identity.buildId -ceq $native.buildId -and $nativeAudit.counts.sourceInputs -eq 1202) 'Native artifact audit binding differs'
  Need ($bin.kind -ceq 'literary-planet-native-binary-preparation' -and $bin.platform -ceq 'android' -and $bin.channel -ceq 'dev' -and $bin.sourceCommit -ceq $B2 -and $bin.preparationSourceCommit -ceq $B2 -and $bin.releaseReady -eq $false -and $bin.deviceTested -eq $false) 'Binary receipt identity differs'
  $binaryGraph = CheckGraph $bin.sourceInputs.files $bin.sourceInputs.sha256 'binary'
  $id = $android.packageIdentity
  Need ($id.applicationId -ceq 'ru.probpera.literaryplanet.dev' -and $id.sourceCommit -ceq $B2 -and $id.preparationSourceCommit -ceq $B2 -and $id.storeArtifact -eq $false -and $id.channel -ceq 'dev' -and $id.buildId -ceq $native.buildId -and $id.sourceFingerprint -ceq $releaseGraph.fingerprint) 'Package identity differs'
  Need ($bin.applicationId -ceq $id.applicationId -and $bin.versionCode -eq $id.versionCode -and $bin.versionName -ceq $id.versionName -and $bin.certificateSha256 -ceq $id.certificateSha256 -and $bin.webArtifactSha256 -ceq $fixed.nativeArtifact.sha256 -and $bin.webArtifactPath -ceq $android.nativeBundle.artifactPath) 'Binary/web/package metadata bindings differ'
  Need ($android.nativeBundle.sha256 -ceq $fixed.nativeArtifact.sha256 -and $android.binaryReceipt -ceq $Plan.fixedBuildFiles.binary.path) 'Android preparation metadata references differ'
  Need (@($android.outputs).Count -eq 3 -and @($Plan.android.outputs).Count -eq 3) 'Exact Android outputs count differs'
  for ($i=0; $i -lt 3; $i++) {
    $pin=$Plan.android.outputs[$i]; $row=$android.outputs[$i]
    Need ($row.path -ceq $pin.path -and $row.bytes -eq $pin.bytes -and $row.sha256 -ceq $pin.sha256) 'Android output pin differs'
    if ($i -gt 0) { AddFile ('builds/android/' + [IO.Path]::GetFileName($pin.path)) $R $pin.path $pin }
  }
  Need ($bin.artifactPath -ceq $Plan.android.outputs[1].path -and $bin.artifactSha256 -ceq $Plan.android.outputs[1].sha256 -and $bin.testArtifactPath -ceq $Plan.android.outputs[2].path -and $bin.testArtifactSha256 -ceq $Plan.android.outputs[2].sha256 -and $id.artifactSha256 -ceq $bin.artifactSha256) 'Exact two APK bindings differ'
  Need (($Utf8.GetString($fixed.mainCompileLog.data)) -cmatch [string]$Plan.android.mainCompilePattern -and ($Utf8.GetString($fixed.testCompileLog.data)) -cmatch [string]$Plan.android.testCompilePattern) 'Exact Java compile task qualifications differ'
  $pwaBinding=[ordered]@{actualFinalizerPid=$Plan.pwa.actualPid; finalizerNaturalExitCode=0; originalPid=23420; originalNaturalTermination='UNKNOWN'; originalExitCode=$null; originalFullInputSnapshot='UNRECOVERABLE_EMPTY_PREPARATION'; qualification='CURRENT_RETAINED_BYTES_ONLY_NOT_ORIGINAL_BUILD_COMPLETION'; artifactSource=$pwaGraph; buildId=$pwaArtifact.buildId; compileRepeated=$false; auditRepeated=$false}
  $androidBinding=[ordered]@{actualPid=$Plan.android.actualPid; naturalExitCode=0; naturalTermination=$true; releaseSource=$releaseGraph; artifactSource=$nativeGraph; binarySource=$binaryGraph; buildId=$native.buildId; javaCompile=$Plan.android.javaCompileQualification; originalInterruptedPid=6256; originalNaturalTermination='UNKNOWN'; originalExitCode=$null}
  $sourceCommit=[ordered]@{schemaVersion=1;sourceCommit=$B2;cleanRepository=$true;commonClosingGraph=$Plan.commonClosingGraph;sourceOverlay=$Plan.sourceOverlays;selectedSource=$Plan.composite;baselinePacket=$Plan.baselinePacket;baselineRestore=$Plan.references.baselineRestore;pwa=$pwaBinding;android=$androidBinding;qualifications=@{currentWholeHeadSource='NOT_INCLUDED';currentSourceRestore='NOT_RUN';crc='NOT_RUN';releaseReady=$false;criteriaClosed=0;formalTransitions=0}}
  AddMemory 'source-commit.json' (JsonBytes $sourceCommit)
  $readme=@"
RU
Локальное внутреннее дополнение: текущий продукт $B2, 15 файлов поверх уже проверенного состава B2 (7 замен, 8 новых).
B2 ZIP — отдельное дополнение к более раннему K, а не полный исходный пакет. Старые архивы не включены и не открывались.
Составленные метаданные: 3955 файлов, 127763368 байт; 196 документов унаследованы из B2. Это не весь текущий HEAD.
Включены полный PWA /planet/ и два новых Android dev APK; полный native Web bundle не дублируется.
PWA: текущие сохранённые байты проверены отдельной финализацией. Исходный PID23420: естественное завершение UNKNOWN, exit неизвестен, подготовка осталась пустой. Компиляция и аудит не повторены.
Android: новая завершённая подготовка; исходный прерванный PID6256 сохраняет неизвестный exit. Java квалификация указана в source-commit.json.
Локальные проверки: 20 новых unit cases, TypeScript, статическая проверка единственного globe, raw AST; настоящий смонтированный RU/EN интерфейс с синтетическим native port, четыре локальных download и два снимка.
Снимки просмотрены основным агентом; человеческое RU/EN/editorial/legal/voice одобрение не получено.
Новый полный source restore, CRC, установленная OS/нативное хранилище, экранный диктор, реальный Auth/удаление, PSP/транзакции, support delivery/SLA и release acceptance НЕ ПРОВЕРЕНЫ.
releaseReady=false; criteriaClosed=0; formalTransitions=0. Исторические FAIL и пустые/прерванные доказательства сохранены.
Запуск из отдельно подготовленного актуального дерева с установленными зависимостями: npm run dev -- --host 127.0.0.1
Открыть http://127.0.0.1:5173/planet/ с фактическим портом Vite.

EN
Internal local supplement: current product $B2, fifteen files over the verified B2 selection (seven replacements, eight additions).
The separate B2 ZIP is a supplement to older K, not a full source archive. Old archives are neither included nor opened.
Composed metadata: 3955 files / 127763368 bytes, with 196 inherited B2 documents. This does not represent the whole current HEAD.
Included: complete PWA /planet/ and two fresh Android dev APKs. Full native Web bundle is not duplicated.
PWA: separate finalization verifies current retained bytes. Original PID23420 natural termination remains UNKNOWN, exit unknown, preparation empty. Compile and audit were not repeated.
Android: fresh completed preparation; interrupted PID6256 retains unknown exit. Exact Java qualification is in source-commit.json.
Local evidence: twenty new unit cases, TypeScript, static canonical-globe proof, raw AST; actual mounted RU/EN panel using a synthetic native port, four local downloads and two screenshots.
Root directly reviewed screenshots; human RU/EN/editorial/legal/voice approval remains pending.
Whole current source restore, CRC, installed OS/storage, screen reader, real Auth/deletion, PSP/transactions, support delivery/SLA and release acceptance remain unverified.
releaseReady=false; criteriaClosed=0; formalTransitions=0. Historical failures and empty/interrupted evidence remain unchanged.
Run from a separately prepared current tree with dependencies: npm run dev -- --host 127.0.0.1
Open http://127.0.0.1:5173/planet/ using Vite's actual reported port.
"@
  AddMemory 'README-RU-EN.txt' ($Utf8.GetBytes($readme + [char]10))
  $payload=@($Entries|ForEach-Object {[ordered]@{name=$_.name;bytes=$_.bytes;sha256=$_.sha256}})
  $manifest=[ordered]@{schemaVersion=1;kind='CURRENT_ADULT_DIAGNOSTIC_INTERNAL_SUPPLEMENT_NOT_ACCEPTANCE';sourceCommit=$B2;commonClosingGraph=$Plan.commonClosingGraph;selectedSource=$Plan.composite;baselinePacket=$Plan.baselinePacket;sourceOverlays=$Plan.sourceOverlays;references=$Plan.references;exactBuildProofs=$Plan.fixedBuildFiles;buildBindings=@{pwa=$pwaBinding;android=$androidBinding};entries=$payload;verificationScope='NEW_ZIP_ONLY_EXACT_NAMES_SIZES_SHA256';qualifications=@{currentSourceRestore='NOT_RUN';crc='NOT_RUN';installedOS='NOT_RUN';PSP='UNSELECTED';actualTransactions='NOT_RUN';humanReviews='PENDING';AuthDeletion='NOT_RUN';remote='NOT_RUN';releaseReady=$false;criteriaClosed=0;formalTransitions=0}}
  AddMemory 'manifest.json' (JsonBytes $manifest)
  $rawBytes = [long]0; foreach ($entry in $Entries) { $rawBytes += $entry.bytes }
  $requiredBytes = $rawBytes + 24MB + 1GB
  $freeBytes = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($W)).AvailableFreeSpace
  Need ($freeBytes -ge $requiredBytes) 'Free-space gate failed: raw bytes + 24 MiB + 1 GiB reserve'
  $run = Join-Path $W ('adult-diagnostic-packet-run-' + [Guid]::NewGuid().ToString())
  Need (-not (Test-Path -LiteralPath $run)) 'Fresh output directory collision'
  [IO.Directory]::CreateDirectory($run) | Out-Null
  $partial = Join-Path $run 'current-adult-diagnostic-e8ac.zip.partial'
  $archivePath = Join-Path $run 'current-adult-diagnostic-e8ac.zip'
  $fileStream = [IO.FileStream]::new($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $zip = [IO.Compression.ZipArchive]::new($fileStream, [IO.Compression.ZipArchiveMode]::Create, $false, $Utf8)
  try {
    foreach ($row in $Entries) {
      $sourceStream = $null; $dest = $null; $hash = [Security.Cryptography.SHA256]::Create()
      try {
        if ($null -ne $row.file) {
          $regular = Regular $row.base $row.relative
          Need ($regular.FullName -ceq $row.file) 'Streaming source path changed'
          $sourceStream = [IO.FileStream]::new($row.file, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        } else { $sourceStream = [IO.MemoryStream]::new([byte[]]$row.data, $false) }
        Need ($sourceStream.Length -eq $row.bytes) ('Source size differs before ZIP entry: ' + $row.name)
        $observed = [Convert]::ToHexString($hash.ComputeHash($sourceStream)).ToLowerInvariant()
        Need ($observed -ceq $row.sha256) ('Source SHA differs before ZIP entry: ' + $row.name)
        $sourceStream.Position = 0
        $entry = $zip.CreateEntry($row.name, [IO.Compression.CompressionLevel]::Optimal)
        $dest = $entry.Open(); $sourceStream.CopyTo($dest, 1MB)
      } finally { if ($null -ne $dest) { $dest.Dispose() }; if ($null -ne $sourceStream) { $sourceStream.Dispose() }; $hash.Dispose() }
    }
  } finally { $zip.Dispose(); $fileStream.Dispose() }
  $expected = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
  foreach ($row in $Entries) { $expected.Add($row.name, $row) }
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $read = [IO.Compression.ZipFile]::OpenRead($partial)
  try {
    Need ($read.Entries.Count -eq $Entries.Count) 'New ZIP entry count differs'
    foreach ($entry in $read.Entries) {
      Need ($expected.ContainsKey($entry.FullName) -and $seen.Add($entry.FullName)) 'New ZIP has missing/extra/case-duplicate name'
      $row = $expected[$entry.FullName]; Need ($entry.Length -eq $row.bytes) 'New ZIP entry size differs'
      $stream = $entry.Open(); $hash = [Security.Cryptography.SHA256]::Create()
      try { $observed = [Convert]::ToHexString($hash.ComputeHash($stream)).ToLowerInvariant(); Need ($observed -ceq $row.sha256) ('New ZIP entry SHA differs: ' + $row.name) }
      finally { $hash.Dispose(); $stream.Dispose() }
    }
  } finally { $read.Dispose() }
  Need ($seen.Count -eq $expected.Count) 'New ZIP name set differs'
  CleanB2
  $archiveHash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
  $archiveBytes = (Get-Item -LiteralPath $partial).Length
  [IO.File]::Move($partial, $archivePath)

  $result=[ordered]@{schemaVersion=1;status='PASS_CURRENT_ADULT_DIAGNOSTIC_INTERNAL_PACKET_NOT_ACCEPTANCE';actualPid=$PID;sourceCommit=$B2;output=$archivePath;bytes=$archiveBytes;sha256=$archiveHash;entries=$Entries.Count;rawBytes=$rawBytes;freeBefore=$freeBytes;requiredBefore=$requiredBytes;reserveBytes=1GB;exactNamesSizesSha256=$true;newZipEntryReadPasses=1;newArchiveHashPasses=1;oldArchivesOpenedCopiedOrRehashed=$false;nativeBundleDuplicated=$false;selectedSource=$Plan.composite;repositoryWrites=0;productChecksRepeated=$false;buildBindings=@{pwa=$pwaBinding;android=$androidBinding};inputPlan=@{path=(Join-Path $PSScriptRoot $InputFile);bytes=$planRead.bytes;sha256=$PlanSha};releaseReady=$false;criteriaClosed=0;formalTransitions=0}
  [IO.File]::WriteAllBytes((Join-Path $run 'result.json'),(JsonBytes $result))
  $result | ConvertTo-Json -Depth 10
} catch {
  if($null-ne$run){[IO.File]::WriteAllBytes((Join-Path $run 'result.json'),(JsonBytes ([ordered]@{status='FAIL_CURRENT_ADULT_DIAGNOSTIC_PACKET_RETAINED';actualPid=$PID;error=$_.Exception.Message;partial=$partial;partialRetained=(Test-Path -LiteralPath $partial);releaseReady=$false;criteriaClosed=0;formalTransitions=0})))}
  throw
}

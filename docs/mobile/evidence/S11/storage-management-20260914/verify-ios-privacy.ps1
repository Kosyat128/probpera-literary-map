$ErrorActionPreference = 'Stop'
$file = 'apps/mobile/ios/App/App/PrivacyInfo.xcprivacy'
$settings = [System.Xml.XmlReaderSettings]::new()
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Ignore
$settings.XmlResolver = $null
$reader = [System.Xml.XmlReader]::Create((Join-Path (Get-Location).Path $file), $settings)
$document = [System.Xml.XmlDocument]::new()
$document.XmlResolver = $null
try { $document.Load($reader) } finally { $reader.Dispose() }
$entries = @($document.SelectNodes('/plist/dict/array/dict') | ForEach-Object {
    [ordered]@{category=$_.SelectSingleNode('key[text()="NSPrivacyAccessedAPIType"]/following-sibling::string[1]').InnerText;
    reasons=@($_.SelectNodes('key[text()="NSPrivacyAccessedAPITypeReasons"]/following-sibling::array[1]/string') | ForEach-Object { $_.InnerText })}
})
if ($entries.Count -ne 2 -or ($entries | Where-Object { $_.category -eq 'NSPrivacyAccessedAPICategoryDiskSpace' }).reasons -cne '85F4.1' -or
    ($entries | Where-Object { $_.category -eq 'NSPrivacyAccessedAPICategoryUserDefaults' }).reasons -cne 'CA92.1') { throw 'Unexpected accessed API declarations' }
$result = [ordered]@{pass=$true;kind='local-ios-privacy-xml-validation';source=$file;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();
    checkedAt=[DateTimeOffset]::UtcNow.ToString('o');entries=$entries;iosCompiled=$false;deviceTested=$false;releaseReady=$false;
    diskSpaceUse='Display only on explicit user action; in-memory result, no off-device transfer or persistence';
    reference='https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype'}
$out = 'docs/mobile/evidence/S11/storage-management-20260914/ios-privacy.json'
if (Test-Path -LiteralPath $out) { throw 'Preserve prior result' }
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $out -Encoding utf8NoBOM
([pscustomobject]$result) | Select-Object pass,kind,iosCompiled,deviceTested | ConvertTo-Json

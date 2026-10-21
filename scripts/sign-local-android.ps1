param(
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.dtexchange-signing\production'),
  [string]$CandidateManifest = '.audit\local-android-candidate.json',
  [switch]$ValidateOnly
)
# Run locally in an interactive PowerShell terminal. Never paste passwords into chat.
# Signs only the hash-verified simulation candidate. Does not install or publish.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'file-sha256.ps1')
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot $CandidateManifest) -Raw | ConvertFrom-Json
if ($manifest.apiEndpoint -ne 'https://dtexchange.app/test-api/api/v1' -or $manifest.package -ne 'com.dtexchange.dt_exchange' -or $manifest.simulation -ne $true -or $manifest.versionCode -notin @(8022, 8023) -or $manifest.signerSha256 -ne '475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c') {
  throw 'Verified build 8022 or 8023 simulation configuration and original signing certificate required.'
}
$inputApk = [IO.Path]::GetFullPath($manifest.path)
if (-not $inputApk.StartsWith(($projectRoot + '\mobile\build\'), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Candidate must be inside this recovered project build folder.'
}
if ((Get-DtFileSha256 -LiteralPath $inputApk) -ne $manifest.sha256) {
  throw 'Candidate changed after validation. Rebuild and revalidate its manifest.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($inputApk)
try {
  $libraries = @($archive.Entries | Where-Object { $_.FullName -match '^lib/[^/]+/libapp\.so$' })
  if ($libraries.Count -eq 0) { throw 'Compiled Flutter libraries are missing.' }
  foreach ($entry in $libraries) {
    $stream = $entry.Open()
    $buffer = [IO.MemoryStream]::new()
    try {
      $stream.CopyTo($buffer)
      $compiled = [Text.Encoding]::ASCII.GetString($buffer.ToArray())
      if (-not $compiled.Contains($manifest.apiEndpoint) -or $compiled.Contains('api.example.invalid') -or $compiled.Contains('https://api.dtexchange.app/api/v1')) {
        throw 'Compiled API endpoint does not match the isolated simulation candidate.'
      }
    } finally { $buffer.Dispose(); $stream.Dispose() }
  }
} finally { $archive.Dispose() }
$keystore = Join-Path $SigningDirectory 'android-production.p12'
$identity = Get-Content -LiteralPath (Join-Path $SigningDirectory 'identity.json') -Raw | ConvertFrom-Json
if ($identity.applicationId -ne $manifest.package -or -not (Test-Path -LiteralPath $keystore)) {
  throw 'Original production signing identity required.'
}
$java = 'C:\Program Files\Android\Android Studio\jbr\bin\java.exe'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.0.0'
$signer = Join-Path $sdk 'lib\apksigner.jar'
$badging = & (Join-Path $sdk 'aapt.exe') dump badging $inputApk 2>$null
if ($LASTEXITCODE -ne 0 -or $badging[0] -notmatch "name='com\.dtexchange\.dt_exchange'" -or $badging[0] -notmatch ("versionCode='" + [regex]::Escape([string]$manifest.versionCode) + "'")) {
  throw 'APK version does not match the validated manifest.'
}
if ($ValidateOnly) {
  Write-Host 'Candidate SHA-256, package, version and simulation configuration validated. No password requested.'
  return
}
$outputDir = Join-Path $projectRoot '.audit\local-android'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$outputApk = Join-Path $outputDir ("DTExchange-" + $manifest.versionCode + '-signed.apk')
if (Test-Path -LiteralPath $outputApk) { throw 'Signed output already exists; inspect it before creating another candidate.' }
Write-Host ("Build " + $manifest.versionCode + ' uses the isolated simulation API. No real USDT or INR processing is enabled.')
$password = Read-Host 'Enter the EXISTING Android keystore password locally' -AsSecureString
$pointer = [IntPtr]::Zero
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
  $env:DT_LOCAL_SIGN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $signOutput = & $java --enable-native-access=ALL-UNNAMED -jar $signer sign --ks $keystore --ks-key-alias $identity.alias --ks-pass env:DT_LOCAL_SIGN_PASSWORD --key-pass env:DT_LOCAL_SIGN_PASSWORD --out $outputApk $inputApk 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Signing failed. Native output suppressed to protect signing details.' }
  $verification = & $java --enable-native-access=ALL-UNNAMED -jar $signer verify --print-certs $outputApk 2>&1
  if ($LASTEXITCODE -ne 0 -or -not (($verification -join "`n").ToLower().Contains($manifest.signerSha256.ToLower()))) {
    throw 'Signed candidate did not verify against the original certificate. Do not install it.'
  }
  [pscustomobject]@{
    path=$outputApk
    sha256=(Get-DtFileSha256 -LiteralPath $outputApk)
    simulation=$true
    signerSha256=$manifest.signerSha256
    versionCode=$manifest.versionCode
    apiEndpoint=$manifest.apiEndpoint
    signatureVerified=$true
    installed=$false
    published=$false
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputDir ("signed-candidate-" + $manifest.versionCode + '.json'))
  Write-Host "Verified local signed candidate: $outputApk"
} finally {
  Remove-Item Env:DT_LOCAL_SIGN_PASSWORD -ErrorAction SilentlyContinue
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $password.Dispose()
}

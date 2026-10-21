$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'file-sha256.ps1')
# Prove the helper does not depend on the unavailable cmdlet.
function Get-FileHash { throw 'Get-FileHash must not be called' }
$path = Join-Path ([IO.Path]::GetTempPath()) ('dt hash ' + [Guid]::NewGuid().ToString() + '.test')
try {
  [IO.File]::WriteAllBytes($path, [byte[]]@())
  if ((Get-DtFileSha256 $path) -ne 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') { throw 'Empty-file vector failed' }
  [IO.File]::WriteAllBytes($path, [Text.Encoding]::ASCII.GetBytes('abc'))
  if ((Get-DtFileSha256 $path) -ne 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') { throw 'ABC vector failed' }
  [IO.File]::WriteAllBytes($path, [Text.Encoding]::ASCII.GetBytes('abcd'))
  if ((Get-DtFileSha256 $path) -eq 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') { throw 'Mutation was not detected' }
  $missingRejected = $false
  try { Get-DtFileSha256 ($path + '.missing') | Out-Null } catch { $missingRejected = $true }
  if (-not $missingRejected) { throw 'Missing file was accepted' }
  Write-Host 'PASS: SHA-256 known vectors, changed content, missing file, paths with spaces, released file handles, unavailable Get-FileHash.'
} finally {
  if ([IO.File]::Exists($path)) { [IO.File]::Delete($path) }
}

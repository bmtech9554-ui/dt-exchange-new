function Get-DtFileSha256 {
  param([Parameter(Mandatory=$true)][string]$LiteralPath)
  $stream = $null
  $sha256 = $null
  try {
    $stream = [IO.File]::Open(
      [IO.Path]::GetFullPath($LiteralPath),
      [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    )
    $sha256 = [Security.Cryptography.SHA256]::Create()
    return [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
  } finally {
    if ($sha256) { $sha256.Dispose() }
    if ($stream) { $stream.Dispose() }
  }
}

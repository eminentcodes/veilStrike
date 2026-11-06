$ErrorActionPreference = 'Stop'
$archivePath = Join-Path $env:TEMP 'veilstrike-blender-4.5.9.zip'
$expectedBytes = 399051129
$sources = @(
  'https://download.blender.org/release/Blender4.5/blender-4.5.9-windows-x64.zip',
  'https://mirrors.dotsrc.org/blender/release/Blender4.5/blender-4.5.9-windows-x64.zip',
  'https://ftp.halifax.rwth-aachen.de/blender/release/Blender4.5/blender-4.5.9-windows-x64.zip'
)
for ($attempt = 0; $attempt -lt 300; $attempt++) {
  $savedBytes = if (Test-Path -LiteralPath $archivePath) { (Get-Item -LiteralPath $archivePath).Length } else { 0 }
  if ($savedBytes -eq $expectedBytes) { Write-Output 'BLENDER_DOWNLOAD_COMPLETE'; exit 0 }
  if ($savedBytes -gt $expectedBytes) { throw 'Archive size exceeds the official file size.' }
  Write-Output ('Resuming Blender: {0:N1} MB downloaded; {1:N1} MB left.' -f ($savedBytes / 1000000), (($expectedBytes - $savedBytes) / 1000000))
  & 'C:\Windows\System32\curl.exe' -fsSL --continue-at - --connect-timeout 15 --max-time 120 --speed-time 25 --speed-limit 10000 --output $archivePath $sources[$attempt % $sources.Count]
  if ($LASTEXITCODE -ne 0) { Start-Sleep -Seconds 5 }
}
throw 'Blender download is incomplete; saved bytes have been preserved.'

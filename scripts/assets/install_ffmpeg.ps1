param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\PetPresenceTools\ffmpeg",
  [string]$Url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

$zipPath = Join-Path $env:TEMP "petpresence-ffmpeg.zip"
$tmp = Join-Path $env:TEMP ("petpresence-ffmpeg-" + [guid]::NewGuid().ToString("N"))

Invoke-WebRequest -Uri $Url -OutFile $zipPath
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $tmp -Force

$ffmpegExe = Get-ChildItem -Path $tmp -Recurse -Filter ffmpeg.exe | Select-Object -First 1
if (-not $ffmpegExe) {
  throw "ffmpeg.exe not found in downloaded archive."
}

$sourceBin = $ffmpegExe.DirectoryName
Copy-Item -Path (Join-Path $sourceBin "*") -Destination $InstallRoot -Recurse -Force

$installed = Join-Path $InstallRoot "ffmpeg.exe"
if (-not (Test-Path $installed)) {
  $installed = Join-Path $InstallRoot "bin\ffmpeg.exe"
}
if (-not (Test-Path $installed)) {
  throw "Installed ffmpeg.exe was not found under $InstallRoot."
}

[Environment]::SetEnvironmentVariable("FFMPEG_PATH", $installed, "User")
$env:FFMPEG_PATH = $installed

Remove-Item -LiteralPath $tmp -Recurse -Force
Remove-Item -LiteralPath $zipPath -Force

& $installed -version | Select-Object -First 1
Write-Output "FFMPEG_PATH=$installed"

